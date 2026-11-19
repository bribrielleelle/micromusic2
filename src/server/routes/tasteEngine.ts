import { desc, eq } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { getDb, isDatabaseConfigured } from '../../db/index.ts';
import { posts, users } from '../../db/schema.ts';
import {
  analyzeSoundCloudTasteProfile,
  type PlatformCuratorCandidate,
  type PlatformTrackCandidate,
  type SoundCloudTrackInput,
} from '../gemini.ts';
import { hydratePosts } from './posts.ts';
import { getActiveSoundCloudSession } from './soundcloud.ts';

const tasteEngineRouter = Router();

function coerceSoundCloudTrackList(rawPayload: unknown): SoundCloudTrackInput[] {
  let rawList: unknown[] = [];
  if (Array.isArray(rawPayload)) {
    rawList = rawPayload;
  } else if (rawPayload && typeof rawPayload === 'object') {
    const obj = rawPayload as Record<string, unknown>;
    if (Array.isArray(obj.liked_tracks)) {
      rawList = obj.liked_tracks;
    } else if (Array.isArray(obj.likedTracks)) {
      rawList = obj.likedTracks;
    } else if (Array.isArray(obj.collection)) {
      rawList = obj.collection;
    } else if (Array.isArray(obj.tracks)) {
      rawList = obj.tracks;
    }
  }

  const normalized: SoundCloudTrackInput[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const userObj =
      rec.user && typeof rec.user === 'object'
        ? (rec.user as Record<string, unknown>)
        : null;

    const rawTags = Array.isArray(rec.tagList)
      ? rec.tagList.filter((t): t is string => typeof t === 'string')
      : typeof rec.tag_list === 'string'
        ? Array.from(
            rec.tag_list.matchAll(/"([^"]+)"|(\S+)/g),
            (m) => (m[1] || m[2] || '').trim().toLowerCase(),
          ).filter(Boolean)
        : Array.isArray(rec.tags)
          ? rec.tags.filter((t): t is string => typeof t === 'string')
          : [];

    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    const artist =
      (typeof rec.artist === 'string' && rec.artist.trim()) ||
      (userObj && typeof userObj.username === 'string' && userObj.username.trim()) ||
      'Unknown Artist';

    if (!title) continue;
    normalized.push({
      id:
        typeof rec.id === 'string' || typeof rec.id === 'number'
          ? rec.id
          : `sc-input-${i + 1}`,
      title,
      artist,
      genre: typeof rec.genre === 'string' && rec.genre.trim() ? rec.genre.trim() : null,
      bpm: typeof rec.bpm === 'number' && rec.bpm > 0 ? Math.round(rec.bpm) : null,
      tagList: rawTags.slice(0, 10),
      mood: typeof rec.mood === 'string' ? rec.mood.trim() : null,
      playbackCount:
        typeof rec.playbackCount === 'number'
          ? rec.playbackCount
          : typeof rec.playback_count === 'number'
            ? rec.playback_count
            : null,
      durationSeconds:
        typeof rec.durationSeconds === 'number'
          ? rec.durationSeconds
          : typeof rec.duration === 'number'
            ? Math.round(rec.duration / 1000)
            : null,
      likedAt:
        typeof rec.likedAt === 'string'
          ? rec.likedAt
          : typeof rec.created_at === 'string'
            ? rec.created_at
            : null,
      permalinkUrl:
        typeof rec.permalinkUrl === 'string'
          ? rec.permalinkUrl
          : typeof rec.permalink_url === 'string'
            ? rec.permalink_url
            : null,
    });
  }
  return normalized.slice(0, 40);
}

// POST /api/taste-engine/analyze
tasteEngineRouter.post('/taste-engine/analyze', async (req: Request, res: Response) => {
  const {
    soundcloudPayload,
    useConnectedOAuth,
    previousTrackIds,
    catalogFallback,
    curatorsFallback,
  } = req.body ?? {};

  let scTracks: SoundCloudTrackInput[] = [];
  if (useConnectedOAuth) {
    const scSession = getActiveSoundCloudSession(req);
    if (!scSession) {
      return res.status(401).json({
        error: 'SoundCloud OAuth session is not connected. Connect SoundCloud or paste a JSON payload.',
      });
    }
    scTracks = scSession.likedTracks;
  } else {
    scTracks = coerceSoundCloudTrackList(soundcloudPayload);
  }

  if (scTracks.length === 0) {
    return res.status(400).json({
      error:
        'Provide at least one SoundCloud Liked Track in the JSON payload (or connect a SoundCloud account with liked tracks).',
    });
  }

  const prevSet = new Set<string>(
    Array.isArray(previousTrackIds)
      ? previousTrackIds.map((id) => String(id))
      : [],
  );
  const newlyAddedTrackTitles =
    prevSet.size > 0
      ? scTracks.filter((t) => !prevSet.has(String(t.id))).map((t) => `${t.title} — ${t.artist}`)
      : [];

  let hydratedCatalog: Awaited<ReturnType<typeof hydratePosts>> = [];
  let platformTracks: PlatformTrackCandidate[] = [];
  let platformCurators: PlatformCuratorCandidate[] = [];

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      const postRows = await db
        .select({
          id: posts.id,
          userId: posts.userId,
          mediaUrl: posts.mediaUrl,
          title: posts.title,
          artistName: posts.artistName,
          thumbnailUrl: posts.thumbnailUrl,
          durationSeconds: posts.durationSeconds,
          tags: posts.tags,
          viewCount: posts.viewCount,
          isHidden: posts.isHidden,
          createdAt: posts.createdAt,
          authorUsername: users.username,
          authorAvatarUrl: users.avatarUrl,
          authorIsVerifiedArtist: users.isVerifiedArtist,
          authorVerifiedArtistName: users.verifiedArtistName,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(eq(posts.isHidden, false))
        .orderBy(desc(posts.createdAt))
        .limit(40);

      hydratedCatalog = await hydratePosts(postRows);
      platformTracks = hydratedCatalog.map((p) => ({
        id: p.id,
        title: p.title,
        artistName: p.artistName,
        provider: p.provider === 'youtube' ? 'youtube' : 'soundcloud',
        tags: p.tags,
        curatorUsername: p.author.username,
        likeCount: p.likeCount,
        viewCount: p.viewCount,
      }));

      const userRows = await db
        .select({
          id: users.id,
          username: users.username,
          bio: users.bio,
          isVerifiedArtist: users.isVerifiedArtist,
          verifiedArtistName: users.verifiedArtistName,
        })
        .from(users)
        .orderBy(desc(users.isVerifiedArtist), desc(users.createdAt))
        .limit(25);

      platformCurators = userRows.map((u) => {
        const userPosts = hydratedCatalog.filter((p) => p.userId === u.id);
        const tagSet = new Set<string>();
        const artistSet = new Set<string>();
        for (const p of userPosts) {
          p.tags.forEach((tag) => tagSet.add(tag));
          if (p.artistName) artistSet.add(p.artistName);
        }
        return {
          id: u.id,
          username: u.username,
          bio: u.bio,
          isVerifiedArtist: u.isVerifiedArtist,
          verifiedArtistName: u.verifiedArtistName,
          sampleTags: Array.from(tagSet).slice(0, 10),
          sampleArtists: Array.from(artistSet).slice(0, 8),
        };
      });
    } catch {
      // Fallback below if DB is unreachable (e.g. sandbox without live DB)
    }
  }

  if (platformTracks.length === 0 && Array.isArray(catalogFallback)) {
    platformTracks = catalogFallback
      .filter((t): t is PlatformTrackCandidate => Boolean(t && typeof t.id === 'string'))
      .slice(0, 40);
  }

  if (platformCurators.length === 0 && Array.isArray(curatorsFallback)) {
    platformCurators = curatorsFallback
      .filter(
        (c): c is PlatformCuratorCandidate =>
          Boolean(c && typeof c.username === 'string'),
      )
      .slice(0, 25);
  }

  if (platformTracks.length === 0) {
    return res.status(400).json({
      error: 'No platform tracks available to build a Discovery Crate.',
    });
  }

  try {
    const analysis = await analyzeSoundCloudTasteProfile({
      soundcloudTracks: scTracks,
      newlyAddedTrackTitles,
      platformTracks,
      platformCurators,
    });

    const postMap = new Map(hydratedCatalog.map((p) => [p.id, p]));
    return res.json({
      analyzedCount: scTracks.length,
      trackIds: scTracks.map((t) => String(t.id)),
      newlyAddedCount: newlyAddedTrackTitles.length,
      newlyAddedTrackTitles,
      analysis,
      hydratedPosts: hydratedCatalog.length > 0 ? Object.fromEntries(postMap) : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to analyze SoundCloud listening habits.';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
    return res.status(status).json({ error: message });
  }
});

export default tasteEngineRouter;
