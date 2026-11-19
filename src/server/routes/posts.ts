import { and, count, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { Router, type Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../../db/index.ts';
import {
  bookmarks,
  comments,
  crateItems,
  crates,
  likes,
  posts,
  postViews,
  users,
} from '../../db/schema.ts';
import {
  isOwnerOrAdmin,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireDatabase,
  type AuthRequest,
} from '../auth.ts';
import { fetchProviderOEmbed } from '../oembed.ts';
import { dbRateLimit } from '../rateLimit.ts';
import { getAdminAlertEmail, sendResendAlert } from '../resend.ts';

const postsRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function sanitizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  const cleaned = new Set<string>();
  for (const tag of rawTags) {
    if (typeof tag !== 'string') continue;
    const normalized = tag
      .trim()
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 32);
    if (normalized.length >= 2) {
      cleaned.add(normalized);
    }
    if (cleaned.size >= 8) break;
  }
  return Array.from(cleaned);
}

export async function hydratePosts(
  rows: Array<{
    id: string;
    userId: string;
    mediaUrl: string;
    title: string | null;
    artistName: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    tags: string[];
    viewCount: number;
    isHidden: boolean;
    createdAt: Date;
    authorUsername: string;
    authorAvatarUrl: string | null;
    authorIsVerifiedArtist?: boolean;
    authorVerifiedArtistName?: string | null;
  }>,
  viewerId?: string,
) {
  if (rows.length === 0) return [];
  const db = getDb();
  const postIds = rows.map((r) => r.id);

  const likeRows = await db
    .select({ postId: likes.postId, userId: likes.userId })
    .from(likes)
    .where(inArray(likes.postId, postIds));

  const bookmarkRows = await db
    .select({ postId: bookmarks.postId, userId: bookmarks.userId })
    .from(bookmarks)
    .where(inArray(bookmarks.postId, postIds));

  const commentCounts = await db
    .select({ postId: comments.postId, total: count() })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);

  const likeCountMap = new Map<string, number>();
  const viewerLikedSet = new Set<string>();
  for (const row of likeRows) {
    likeCountMap.set(row.postId, (likeCountMap.get(row.postId) ?? 0) + 1);
    if (viewerId && row.userId === viewerId) {
      viewerLikedSet.add(row.postId);
    }
  }

  const bookmarkCountMap = new Map<string, number>();
  const viewerBookmarkedSet = new Set<string>();
  for (const row of bookmarkRows) {
    bookmarkCountMap.set(row.postId, (bookmarkCountMap.get(row.postId) ?? 0) + 1);
    if (viewerId && row.userId === viewerId) {
      viewerBookmarkedSet.add(row.postId);
    }
  }

  const commentCountMap = new Map<string, number>();
  for (const row of commentCounts) {
    commentCountMap.set(row.postId, Number(row.total ?? 0));
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    mediaUrl: row.mediaUrl,
    provider: row.mediaUrl.includes('soundcloud.com') ? 'soundcloud' : 'youtube',
    title: row.title || 'Untitled Track',
    artistName: row.artistName || 'Unknown Artist',
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds ?? 240,
    tags: Array.isArray(row.tags) ? row.tags : [],
    viewCount: row.viewCount,
    isHidden: row.isHidden,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.userId,
      username: row.authorUsername,
      avatarUrl: row.authorAvatarUrl,
      isVerifiedArtist: Boolean(row.authorIsVerifiedArtist),
      verifiedArtistName: row.authorVerifiedArtistName ?? null,
    },
    likeCount: likeCountMap.get(row.id) ?? 0,
    bookmarkCount: bookmarkCountMap.get(row.id) ?? 0,
    commentCount: commentCountMap.get(row.id) ?? 0,
    likedByViewer: viewerLikedSet.has(row.id),
    bookmarkedByViewer: viewerBookmarkedSet.has(row.id),
  }));
}

// GET /api/posts - Cursor-based pagination on created_at
postsRouter.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ items: [], nextCursor: null, databaseConfigured: false });
  }

  const rawLimit = Number(req.query.limit ?? 12);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 30) : 12;
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const bookmarkedOnly = req.query.bookmarked === 'true';

  let cursorDate: Date | null = null;
  if (cursorRaw) {
    const parsed = new Date(cursorRaw);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'Invalid cursor timestamp.' });
    }
    cursorDate = parsed;
  }

  try {
    const db = getDb();
    const conditions = [eq(posts.isHidden, false)];
    if (cursorDate) {
      conditions.push(lt(posts.createdAt, cursorDate));
    }

    if (bookmarkedOnly) {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Sign in to view your bookmarks.' });
      }
      const rows = await db
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
        .innerJoin(
          bookmarks,
          and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, req.authUser.id)),
        )
        .where(and(...conditions))
        .orderBy(desc(posts.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const sliced = hasMore ? rows.slice(0, limit) : rows;
      const items = await hydratePosts(sliced, req.authUser.id);
      const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;
      return res.json({ items, nextCursor, databaseConfigured: true });
    }

    const rows = await db
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
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const items = await hydratePosts(sliced, req.authUser?.id);
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;

    return res.json({ items, nextCursor, databaseConfigured: true });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// GET /api/search - Fandom search against Posts(tags) via GIN index
postsRouter.get('/search', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ items: [], nextCursor: null, databaseConfigured: false });
  }

  const tagParam = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase().replace(/^#+/, '') : '';
  const queryParam = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const limit = 15;

  let cursorDate: Date | null = null;
  if (cursorRaw) {
    const parsed = new Date(cursorRaw);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'Invalid cursor timestamp.' });
    }
    cursorDate = parsed;
  }

  try {
    const db = getDb();
    const conditions = [eq(posts.isHidden, false)];

    if (cursorDate) {
      conditions.push(lt(posts.createdAt, cursorDate));
    }

    if (tagParam) {
      // Uses GIN index on posts.tags JSONB column
      conditions.push(sql`${posts.tags} @> ${JSON.stringify([tagParam])}::jsonb`);
    }

    if (queryParam) {
      const normalizedTagGuess = queryParam.toLowerCase().replace(/^#+/, '');
      const likePattern = `%${queryParam}%`;
      conditions.push(
        or(
          sql`${posts.tags} @> ${JSON.stringify([normalizedTagGuess])}::jsonb`,
          sql`${posts.title} ILIKE ${likePattern}`,
          sql`${posts.artistName} ILIKE ${likePattern}`,
        )!,
      );
    }

    const rows = await db
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
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const items = await hydratePosts(sliced, req.authUser?.id);
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt ?? null : null;

    return res.json({ items, nextCursor, databaseConfigured: true });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// GET /api/posts/:id - Fetch single post detail & 2-tier comments
postsRouter.get('/posts/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidUuid(id)) {
    return res.status(400).json({ error: 'Invalid post identifier.' });
  }
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database is not configured.' });
  }

  try {
    const db = getDb();
    const [row] = await db
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
      .where(eq(posts.id, id))
      .limit(1);

    if (!row || (row.isHidden && req.authUser?.role !== 'admin')) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const [hydrated] = await hydratePosts([row], req.authUser?.id);
    const commentRows = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        parentId: comments.parentId,
        userId: comments.userId,
        body: comments.body,
        createdAt: comments.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.postId, id))
      .orderBy(comments.createdAt);

    return res.json({
      post: hydrated,
      comments: commentRows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// GET /api/posts/:id/comments - Lightweight polling endpoint for comments
postsRouter.get('/posts/:id/comments', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidUuid(id)) {
    return res.status(400).json({ error: 'Invalid post identifier.' });
  }
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database is not configured.' });
  }

  try {
    const db = getDb();
    const commentRows = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        parentId: comments.parentId,
        userId: comments.userId,
        body: comments.body,
        createdAt: comments.createdAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.postId, id))
      .orderBy(comments.createdAt);

    return res.json({
      comments: commentRows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// POST /api/posts - Allowlisted URL + SSRF-safe oEmbed + RateLimits
postsRouter.post(
  '/posts',
  requireDatabase,
  requireAuth,
  dbRateLimit({ action: 'post_creation', maxRequests: 10, windowSeconds: 300 }),
  async (req: AuthRequest, res: Response) => {
    const { mediaUrl, tags, crateId, durationSeconds } = req.body ?? {};
    if (typeof mediaUrl !== 'string' || !mediaUrl.trim()) {
      return res.status(400).json({ error: 'A valid SoundCloud or YouTube URL is required.' });
    }

    let oembed;
    try {
      oembed = await fetchProviderOEmbed(mediaUrl);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_MEDIA_URL') {
        return res.status(400).json({
          error: 'Only direct youtube.com, youtu.be, or soundcloud.com track URLs are allowed.',
        });
      }
      return res.status(422).json({
        error: 'Unable to fetch track metadata from provider oEmbed endpoint. Verify the URL is public and playable.',
      });
    }

    const cleanTags = sanitizeTags(tags);
    const parsedDuration =
      typeof durationSeconds === 'number' && durationSeconds > 0 && durationSeconds < 36000
        ? Math.round(durationSeconds)
        : oembed.durationSeconds;

    try {
      const db = getDb();
      const created = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(posts)
          .values({
            userId: req.authUser!.id,
            mediaUrl: oembed.canonicalUrl,
            title: oembed.title,
            artistName: oembed.artistName,
            thumbnailUrl: oembed.thumbnailUrl,
            durationSeconds: parsedDuration,
            tags: cleanTags,
          })
          .returning();

        if (typeof crateId === 'string' && isValidUuid(crateId)) {
          const [targetCrate] = await tx
            .select()
            .from(crates)
            .where(eq(crates.id, crateId))
            .limit(1);

          if (
            targetCrate &&
            (targetCrate.isPublic || isOwnerOrAdmin(req.authUser!, targetCrate.ownerId))
          ) {
            await tx
              .insert(crateItems)
              .values({
                crateId: targetCrate.id,
                postId: inserted.id,
                addedBy: req.authUser!.id,
                position: 0,
              })
              .onConflictDoNothing();
          }
        }

        return inserted;
      });

      const [hydrated] = await hydratePosts(
        [
          {
            ...created,
            authorUsername: req.authUser!.username,
            authorAvatarUrl: req.authUser!.avatarUrl,
            authorIsVerifiedArtist: req.authUser!.isVerifiedArtist,
            authorVerifiedArtistName: req.authUser!.verifiedArtistName,
          },
        ],
        req.authUser!.id,
      );

      return res.status(201).json({ post: hydrated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/posts/:id/view - Log unique view in PostViews
postsRouter.post(
  '/posts/:id/view',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid post identifier.' });
    }

    try {
      const db = getDb();
      const viewCount = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(postViews)
          .values({
            postId: id,
            userId: req.authUser!.id,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted.length > 0) {
          const [updated] = await tx
            .update(posts)
            .set({ viewCount: sql`${posts.viewCount} + 1` })
            .where(eq(posts.id, id))
            .returning({ viewCount: posts.viewCount });
          return updated?.viewCount ?? null;
        }

        const [existing] = await tx
          .select({ viewCount: posts.viewCount })
          .from(posts)
          .where(eq(posts.id, id))
          .limit(1);
        return existing?.viewCount ?? null;
      });

      if (viewCount === null) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      return res.json({ viewCount });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// DELETE /api/posts/:id - Owner or Admin only
postsRouter.delete(
  '/posts/:id',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid post identifier.' });
    }

    try {
      const db = getDb();
      const [existing] = await db
        .select({ id: posts.id, userId: posts.userId })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      if (!isOwnerOrAdmin(req.authUser!, existing.userId)) {
        return res.status(403).json({ error: 'Forbidden: Only the owner or an admin can delete this post.' });
      }

      await db.delete(posts).where(eq(posts.id, id));
      return res.json({ deleted: true, id });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/posts/:id/flag - User report flag -> sets isHidden=true
postsRouter.patch(
  '/admin/posts/:id/flag',
  requireDatabase,
  requireAuth,
  dbRateLimit({ action: 'post_flag', maxRequests: 10, windowSeconds: 300 }),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid post identifier.' });
    }

    try {
      const db = getDb();
      const [updated] = await db
        .update(posts)
        .set({ isHidden: true })
        .where(eq(posts.id, id))
        .returning({
          id: posts.id,
          isHidden: posts.isHidden,
          title: posts.title,
          mediaUrl: posts.mediaUrl,
        });

      if (!updated) {
        return res.status(404).json({ error: 'Post not found.' });
      }

      const adminEmail = getAdminAlertEmail();
      if (adminEmail) {
        void sendResendAlert({
          to: adminEmail,
          alertType: 'moderation_flag',
          subject: `[SONA Moderation] Post flagged for review: ${updated.title || updated.id}`,
          text: `Member @${req.authUser!.username} flagged post "${updated.title || 'Untitled'}" (${updated.mediaUrl}) for admin review. The post has been hidden pending moderation.`,
        });
      }

      return res.json({ post: updated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// PATCH /api/admin/posts/:id/visibility - Admin route to unhide/hide flagged posts
postsRouter.patch(
  '/admin/posts/:id/visibility',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid post identifier.' });
    }
    const { isHidden } = req.body ?? {};
    if (typeof isHidden !== 'boolean') {
      return res.status(400).json({ error: 'Boolean isHidden field is required.' });
    }

    try {
      const db = getDb();
      const [updated] = await db
        .update(posts)
        .set({ isHidden })
        .where(eq(posts.id, id))
        .returning({ id: posts.id, isHidden: posts.isHidden });

      if (!updated) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      return res.json({ post: updated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

export default postsRouter;
