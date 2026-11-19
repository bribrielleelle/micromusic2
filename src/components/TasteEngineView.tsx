import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderPlus,
  ListPlus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Unplug,
  UserPlus,
} from 'lucide-react';
import {
  formatDuration,
  usePlayerStore,
} from '../store/playerStore';
import {
  postToQueueTrack,
  type FeedPost,
  type SoundCloudOAuthStatus,
  type SoundCloudTrackPayload,
  type TasteEngineResponse,
} from '../types/hub';
import type { SessionUser } from './AuthGateModal';

interface TasteEngineViewProps {
  platformPosts: FeedPost[];
  sessionUser: SessionUser | null;
  databaseConnected: boolean;
  onOpenProfile: (username: string) => void;
  onSelectCrate: (crateId: string) => void;
  onCratesChanged: () => void;
  onRequireAuth: () => void;
}

const SAMPLE_SOUNDCLOUD_PAYLOAD: SoundCloudTrackPayload[] = [
  {
    id: 'sc-901',
    title: 'Flickermood',
    artist: 'Forss',
    genre: 'Electronic / Downtempo',
    bpm: 96,
    tagList: ['downtempo', 'tape-loop', 'broken-beat', 'idm'],
    mood: 'Nocturnal, warm analog',
    playbackCount: 48200,
    durationSeconds: 215,
    likedAt: '2026-11-18T22:14:00Z',
    permalinkUrl: 'https://soundcloud.com/forss/flickermood',
  },
  {
    id: 'sc-902',
    title: 'Rhodes Sketch 04 (Cassette Dub)',
    artist: 'Koto & Tape',
    genre: 'Ambient Jazz',
    bpm: 84,
    tagList: ['ambient-jazz', 'rhodes', 'late-night', 'lofi'],
    mood: 'Reflective, rainy',
    playbackCount: 3900,
    durationSeconds: 264,
    likedAt: '2026-11-18T23:40:00Z',
  },
  {
    id: 'sc-903',
    title: 'Submarine Dub (Unreleased B-Side)',
    artist: 'Devon Park',
    genre: 'Deep Dub / Ambient',
    bpm: 112,
    tagList: ['dub', 'analog', 'vinyl-rip', 'deep'],
    mood: 'Hypnotic, subterranean',
    playbackCount: 1850,
    durationSeconds: 318,
    likedAt: '2026-11-19T01:05:00Z',
  },
];

const SIMULATED_NEW_LIKES: SoundCloudTrackPayload[] = [
  {
    id: 'sc-904',
    title: 'Tokyo Platform 3AM (Field Loop)',
    artist: 'Mina Takahashi',
    genre: 'Ambient / Tape Loop',
    bpm: 88,
    tagList: ['ambient', 'tape-loop', 'field-recording', 'late-night'],
    mood: 'Wistful, hazy neon',
    playbackCount: 1240,
    durationSeconds: 230,
    likedAt: new Date().toISOString(),
  },
  {
    id: 'sc-905',
    title: 'Velvet Break 94',
    artist: 'Sora Beats',
    genre: 'Broken Beat / Jazz Hop',
    bpm: 104,
    tagList: ['broken-beat', 'rhodes', 'vinyl-rip', 'downtempo'],
    mood: 'Smoky, kinetic groove',
    playbackCount: 6400,
    durationSeconds: 205,
    likedAt: new Date().toISOString(),
  },
];

export function TasteEngineView({
  platformPosts,
  sessionUser,
  databaseConnected,
  onOpenProfile,
  onSelectCrate,
  onCratesChanged,
  onRequireAuth,
}: TasteEngineViewProps) {
  const [scStatus, setScStatus] = useState<SoundCloudOAuthStatus | null>(null);
  const [jsonInput, setJsonInput] = useState<string>(() =>
    JSON.stringify({ liked_tracks: SAMPLE_SOUNDCLOUD_PAYLOAD }, null, 2),
  );
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(false);
  const [syncingLikes, setSyncingLikes] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingCrate, setSavingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<TasteEngineResponse | null>(null);
  const previousTrackIdsRef = useRef<string[]>([]);
  const simIndexRef = useRef(0);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const queue = usePlayerStore((s) => s.queue);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  const loadSoundCloudStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/soundcloud/status', { credentials: 'include' });
      if (!res.ok) return null;
      const data = (await res.json()) as SoundCloudOAuthStatus;
      setScStatus(data);
      if (data.connected && data.likedTracks.length > 0) {
        setJsonInput(JSON.stringify({ liked_tracks: data.likedTracks }, null, 2));
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadSoundCloudStatus();
  }, [loadSoundCloudStatus]);

  const runAnalysis = useCallback(
    async (overridePayload?: unknown, useOAuth = false) => {
      setError(null);
      setNotice(null);

      let parsedPayload: unknown = overridePayload;
      if (!useOAuth && parsedPayload === undefined) {
        try {
          parsedPayload = JSON.parse(jsonInput);
        } catch {
          setError('SoundCloud JSON payload is invalid JSON. Fix syntax or reset to sample.');
          return;
        }
      }

      const catalogFallback = platformPosts.map((p) => ({
        id: p.id,
        title: p.title,
        artistName: p.artistName,
        provider: p.provider,
        tags: p.tags,
        curatorUsername: p.author.username,
        likeCount: p.likeCount,
        viewCount: p.viewCount,
      }));

      const curatorsMap = new Map<
        string,
        {
          id: string;
          username: string;
          bio: string | null;
          isVerifiedArtist: boolean;
          verifiedArtistName: string | null;
          sampleTags: string[];
          sampleArtists: string[];
        }
      >();
      for (const post of platformPosts) {
        const existing = curatorsMap.get(post.author.username);
        if (!existing) {
          curatorsMap.set(post.author.username, {
            id: post.author.id,
            username: post.author.username,
            bio: 'SONA community curator and crate selector.',
            isVerifiedArtist: Boolean(post.author.isVerifiedArtist),
            verifiedArtistName: post.author.verifiedArtistName ?? null,
            sampleTags: [...post.tags],
            sampleArtists: [post.artistName],
          });
        } else {
          post.tags.forEach((t) => {
            if (!existing.sampleTags.includes(t)) existing.sampleTags.push(t);
          });
          if (!existing.sampleArtists.includes(post.artistName)) {
            existing.sampleArtists.push(post.artistName);
          }
        }
      }

      setAnalyzing(true);
      try {
        const res = await fetch('/api/taste-engine/analyze', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            soundcloudPayload: useOAuth ? undefined : parsedPayload,
            useConnectedOAuth: useOAuth,
            previousTrackIds: previousTrackIdsRef.current,
            catalogFallback,
            curatorsFallback: Array.from(curatorsMap.values()),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || `Taste Engine analysis failed (HTTP ${res.status}).`);
          return;
        }
        const typed = data as TasteEngineResponse;
        previousTrackIdsRef.current = typed.trackIds;
        setResult(typed);
        if (typed.newlyAddedCount > 0) {
          setNotice(
            `Real-time adaptation detected ${typed.newlyAddedCount} new liked track${typed.newlyAddedCount > 1 ? 's' : ''}: ${typed.newlyAddedTrackTitles.join(', ')}.`,
          );
        }
      } catch {
        setError('Network error communicating with SONA Taste Engine.');
      } finally {
        setAnalyzing(false);
      }
    },
    [jsonInput, platformPosts],
  );

  // Listen for SoundCloud OAuth popup completion
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (
        !event.origin.endsWith('.run.app') &&
        !event.origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'soundcloud') {
        setNotice('SoundCloud connected! Pulling your Liked Tracks...');
        const fresh = await loadSoundCloudStatus();
        if (fresh?.connected && fresh.likedTracks.length > 0) {
          await runAnalysis({ liked_tracks: fresh.likedTracks }, true);
        }
      } else if (
        event.data?.type === 'OAUTH_AUTH_ERROR' &&
        event.data?.provider === 'soundcloud'
      ) {
        setError(`SoundCloud OAuth declined: ${event.data?.error || 'access denied'}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadSoundCloudStatus, runAnalysis]);

  const handleSyncSoundCloudLikes = useCallback(async () => {
    setSyncingLikes(true);
    setError(null);
    try {
      const res = await fetch('/api/soundcloud/likes', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to sync SoundCloud Liked Tracks.');
        return;
      }
      const tracks = Array.isArray(data.likedTracks)
        ? (data.likedTracks as SoundCloudTrackPayload[])
        : [];
      setJsonInput(JSON.stringify({ liked_tracks: tracks }, null, 2));
      setScStatus((prev) => (prev ? { ...prev, likedTracks: tracks } : prev));
      const newIds = tracks.map((t) => String(t.id));
      const hasNew = newIds.some((id) => !previousTrackIdsRef.current.includes(id));
      if (hasNew || !result) {
        await runAnalysis({ liked_tracks: tracks }, true);
      } else {
        setNotice('SoundCloud Liked Tracks synced — no new likes since last scan.');
      }
    } catch {
      setError('Network error syncing SoundCloud Liked Tracks.');
    } finally {
      setSyncingLikes(false);
    }
  }, [result, runAnalysis]);

  useEffect(() => {
    if (!liveSyncEnabled || !scStatus?.connected) return;
    const timer = window.setInterval(() => {
      handleSyncSoundCloudLikes();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [liveSyncEnabled, scStatus?.connected, handleSyncSoundCloudLikes]);

  const handleConnectSoundCloud = async () => {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/soundcloud/url', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(
          data?.error ||
            'SoundCloud OAuth app credentials are not configured yet. You can still test live analysis with the SoundCloud JSON payload below.',
        );
        return;
      }
      const popup = window.open(
        data.url,
        'soundcloud_oauth',
        'width=600,height=700',
      );
      if (!popup) {
        setError('Popup was blocked by your browser. Please allow popups to connect SoundCloud.');
      }
    } catch {
      setError('Unable to initiate SoundCloud OAuth.');
    }
  };

  const handleDisconnectSoundCloud = async () => {
    await fetch('/api/soundcloud/disconnect', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setLiveSyncEnabled(false);
    await loadSoundCloudStatus();
    setNotice('Disconnected SoundCloud session.');
  };

  const handleSimulateNewLike = async () => {
    setError(null);
    let parsed: { liked_tracks?: SoundCloudTrackPayload[] } = {};
    try {
      const raw = JSON.parse(jsonInput);
      parsed = Array.isArray(raw) ? { liked_tracks: raw } : raw;
    } catch {
      parsed = { liked_tracks: [...SAMPLE_SOUNDCLOUD_PAYLOAD] };
    }

    const baseTracks = Array.isArray(parsed.liked_tracks)
      ? [...parsed.liked_tracks]
      : [...SAMPLE_SOUNDCLOUD_PAYLOAD];
    const nextSample =
      SIMULATED_NEW_LIKES[simIndexRef.current % SIMULATED_NEW_LIKES.length];
    simIndexRef.current += 1;
    const newEntry: SoundCloudTrackPayload = {
      ...nextSample,
      id: `${nextSample.id}-${Date.now().toString().slice(-4)}`,
      likedAt: new Date().toISOString(),
    };
    const updatedPayload = { liked_tracks: [newEntry, ...baseTracks] };
    setJsonInput(JSON.stringify(updatedPayload, null, 2));
    await runAnalysis(updatedPayload, false);
  };

  const hydratedCrateTracks = useMemo(() => {
    if (!result) return [];
    const postMap = new Map<string, FeedPost>();
    platformPosts.forEach((p) => postMap.set(p.id, p));
    if (result.hydratedPosts) {
      Object.values(result.hydratedPosts).forEach((p) => postMap.set(p.id, p));
    }
    return result.analysis.discoveryCrate.tracks
      .map((item) => {
        const post = postMap.get(item.postId);
        if (!post) return null;
        return { ...item, post };
      })
      .filter((x): x is { postId: string; whyItFits: string; matchScore: number; post: FeedPost } =>
        Boolean(x),
      );
  }, [result, platformPosts]);

  const handleQueueAllCrate = () => {
    if (!result || hydratedCrateTracks.length === 0) return;
    const crateTitle = result.analysis.discoveryCrate.title;
    hydratedCrateTracks.forEach((item, idx) => {
      const qTrack = postToQueueTrack(item.post, crateTitle);
      if (idx === 0 && !currentTrack) {
        playTrack(qTrack);
      } else {
        enqueueTrack(qTrack);
      }
    });
    setNotice(`Queued ${hydratedCrateTracks.length} tracks from "${crateTitle}".`);
  };

  const handleSaveAsCrate = async () => {
    if (!result) return;
    if (!databaseConnected) {
      setNotice('Connect PostgreSQL on Replit to persist saved Crates—queued tracks locally for now.');
      handleQueueAllCrate();
      return;
    }
    if (!sessionUser) {
      onRequireAuth();
      return;
    }

    setSavingCrate(true);
    setError(null);
    try {
      const createRes = await fetch('/api/crates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.analysis.discoveryCrate.title.slice(0, 80),
          description: result.analysis.discoveryCrate.description.slice(0, 300),
          isPublic: true,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createData?.crate?.id) {
        setError(createData?.error || 'Unable to save Discovery Crate.');
        return;
      }

      const crateId = createData.crate.id as string;
      for (const item of hydratedCrateTracks) {
        await fetch('/api/crates/items', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crateId, postId: item.postId }),
        });
      }

      onCratesChanged();
      onSelectCrate(crateId);
    } catch {
      setError('Network error saving Discovery Crate.');
    } finally {
      setSavingCrate(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            SoundCloud Taste Engine
          </h2>
          <p className="text-xs text-[#5C534A]">
            Analyze real-time SoundCloud Liked Tracks to curate a living Discovery Crate and match overlapping tastemakers
          </p>
        </div>
        <span className="font-mono-tabular text-xs text-[#5C534A]">
          {scStatus?.connected ? `Connected: @${scStatus.user?.username}` : 'JSON / OAuth Ready'}
        </span>
      </div>

      {/* SoundCloud Connection & Living Document Input Card */}
      <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-[#1F1B18]">
              1. SoundCloud Living Account &amp; Liked Tracks Payload
            </h3>
            <p className="text-xs text-[#5C534A]">
              {scStatus?.connected
                ? 'Live SoundCloud OAuth connected. Sync latest likes anytime or turn on auto-sync.'
                : scStatus?.oauthConfigured
                  ? 'Connect your SoundCloud account via OAuth or test directly with a JSON Liked Tracks payload.'
                  : 'Paste your SoundCloud Liked Tracks JSON below, or add SOUNDCLOUD_CLIENT_ID & SOUNDCLOUD_CLIENT_SECRET in Secrets for one-click OAuth.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {scStatus?.connected ? (
              <>
                <button
                  type="button"
                  disabled={syncingLikes || analyzing}
                  onClick={handleSyncSoundCloudLikes}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingLikes ? 'animate-spin' : ''}`} />
                  <span>{syncingLikes ? 'Syncing...' : 'Sync Latest Likes'}</span>
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs text-[#1F1B18] whitespace-nowrap shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={liveSyncEnabled}
                    onChange={(e) => setLiveSyncEnabled(e.target.checked)}
                    className="accent-[#B84A2E]"
                  />
                  <span>Live Auto-Sync (30s)</span>
                </label>
                <button
                  type="button"
                  onClick={handleDisconnectSoundCloud}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#DDD5C7] text-xs text-[#5C534A] hover:text-[#B84A2E] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectSoundCloud}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-[#B84A2E]" />
                <span>Connect SoundCloud OAuth</span>
              </button>
            )}
          </div>
        </div>

        <label className="block space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-[#1F1B18]">
              SoundCloud Liked Tracks JSON Payload
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  previousTrackIdsRef.current = [];
                  setJsonInput(
                    JSON.stringify({ liked_tracks: SAMPLE_SOUNDCLOUD_PAYLOAD }, null, 2),
                  );
                }}
                className="text-xs text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
              >
                Reset sample
              </button>
              <button
                type="button"
                disabled={analyzing}
                onClick={handleSimulateNewLike}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Append New Liked Track &amp; Re-Analyze</span>
              </button>
            </div>
          </div>
          <textarea
            rows={7}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 font-mono-tabular text-xs text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[#5C534A] truncate max-w-full">
            {scStatus?.callbackUrl
              ? `SoundCloud Callback URI: ${scStatus.callbackUrl}`
              : 'Powered by SONA Taste Engine'}
          </span>
          <button
            type="button"
            disabled={analyzing}
            onClick={() => runAnalysis(undefined, false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{analyzing ? 'Analyzing Sonic Profile...' : 'Generate Discovery Crate'}</span>
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-[#B84A2E]/30 bg-[#B84A2E]/10 px-3 py-2 text-xs text-[#9E3D24]">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]">
            {notice}
          </p>
        )}
      </div>

      {/* Results: Sonic Profile + Personalized Discovery Crate + Recommended Tastemakers */}
      {result && (
        <div className="space-y-6">
          {/* Sonic Profile */}
          <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#DDD5C7] pb-3">
              <div>
                <p className="text-xs font-semibold text-[#B84A2E]">
                  Core Sonic Profile
                </p>
                <h3 className="font-display text-lg font-semibold text-[#1F1B18]">
                  {result.analysis.sonicProfile.dominantGenres.join(' · ')}
                </h3>
              </div>
              <span className="font-mono-tabular text-xs text-[#5C534A]">
                {result.analysis.sonicProfile.tempoRangeBpm} · {result.analyzedCount} liked tracks analyzed
              </span>
            </div>

            <p className="text-sm text-[#1F1B18] leading-relaxed">
              {result.analysis.sonicProfile.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-[#5C534A]">Moods &amp; Textures</p>
                <p className="text-[#1F1B18]">
                  {result.analysis.sonicProfile.moods.join(' · ')}
                </p>
                <p className="text-[#5C534A] pt-1">
                  {result.analysis.sonicProfile.vibeKeywords.map((k) => `#${k}`).join(' · ')}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono-tabular">
                  <span className="font-semibold text-[#5C534A]">
                    Underground vs. Mainstream
                  </span>
                  <span className="text-[#1F1B18]">
                    {result.analysis.sonicProfile.undergroundPercentage}% underground
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#EFE9DE] overflow-hidden">
                  <div
                    className="h-full bg-[#B84A2E] transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, result.analysis.sonicProfile.undergroundPercentage))}%`,
                    }}
                  />
                </div>
                <p className="text-[#5C534A]">
                  {result.analysis.sonicProfile.mainstreamVsUndergroundBalance}
                </p>
              </div>
            </div>

            <div className="border-t border-[#DDD5C7] pt-3 text-xs text-[#5C534A]">
              <span className="font-semibold text-[#1F1B18]">Real-Time Adaptation: </span>
              <span>{result.analysis.realtimeAdaptationNote}</span>
            </div>
          </div>

          {/* Personalized Discovery Crate */}
          <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#DDD5C7] pb-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#B84A2E]">
                  Personalized Discovery Crate · {result.analysis.discoveryCrate.aestheticMood}
                </p>
                <h3 className="font-display text-xl font-semibold text-[#1F1B18]">
                  {result.analysis.discoveryCrate.title}
                </h3>
                <p className="text-xs text-[#5C534A]">
                  {result.analysis.discoveryCrate.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleQueueAllCrate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] whitespace-nowrap cursor-pointer"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Queue All</span>
                </button>
                <button
                  type="button"
                  disabled={savingCrate}
                  onClick={handleSaveAsCrate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#1F1B18] text-xs font-semibold text-[#FCF9F4] hover:bg-[#B84A2E] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{savingCrate ? 'Saving...' : 'Save to SONA Crates'}</span>
                </button>
              </div>
            </div>

            {hydratedCrateTracks.length === 0 ? (
              <p className="text-xs text-[#5C534A]">
                No matching platform tracks were found for this profile yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#DDD5C7]">
                {hydratedCrateTracks.map((item, idx) => {
                  const isCurrent = currentTrack?.id === item.post.id;
                  const isQueued = queue.some((q) => q.id === item.post.id);
                  const queueTrack = postToQueueTrack(
                    item.post,
                    result.analysis.discoveryCrate.title,
                  );

                  return (
                    <li
                      key={item.postId}
                      className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono-tabular font-semibold text-[#B84A2E]">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-display text-sm font-semibold text-[#1F1B18] truncate">
                            {item.post.title}
                          </span>
                          <span className="text-[#5C534A]" aria-hidden="true">·</span>
                          <span className="text-[#5C534A] truncate">
                            {item.post.artistName}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C534A]">
                          {item.whyItFits}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#1F1B18]">
                            {item.matchScore}% match
                          </span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatDuration(item.post.durationSeconds)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent ? togglePlay() : playTrack(queueTrack)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#B84A2E] text-[11px] font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                        >
                          {isCurrent && isPlaying ? (
                            <>
                              <Pause className="w-3 h-3" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>Play</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isCurrent || isQueued}
                          onClick={() => enqueueTrack(queueTrack)}
                          className="px-2.5 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[11px] font-medium text-[#1F1B18] hover:border-[#B84A2E] disabled:opacity-50 cursor-pointer"
                        >
                          {isCurrent ? 'Playing' : isQueued ? 'Queued' : 'Queue'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recommended Tastemakers */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[#5C534A] uppercase">
              Overlapping Tastemakers ({result.analysis.recommendedTastemakers.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.analysis.recommendedTastemakers.map((maker) => (
                <article
                  key={maker.username}
                  className="rounded-lg border border-[#DDD5C7] bg-[#FCF9F4] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(maker.username)}
                        className="font-display text-base font-semibold text-[#1F1B18] hover:text-[#B84A2E] truncate cursor-pointer"
                      >
                        @{maker.username}
                      </button>
                      <span className="font-mono-tabular text-xs font-semibold text-[#B84A2E] shrink-0">
                        {maker.overlapPercent}% overlap
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5C534A]">
                      {maker.sharedGenres.join(' · ')}
                    </p>
                    <p className="text-xs text-[#1F1B18] leading-relaxed">
                      {maker.reason}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenProfile(maker.username)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>View Curator</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
