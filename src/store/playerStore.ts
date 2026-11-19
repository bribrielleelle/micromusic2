import { useCallback, useSyncExternalStore } from 'react';

export type MediaProvider = 'youtube' | 'soundcloud';

export type NavSection =
  | 'Now Playing'
  | 'Browse'
  | 'Communities'
  | 'Charts'
  | 'Settings'
  | 'Admin';

export interface QueueTrack {
  id: string;
  mediaUrl: string;
  provider: MediaProvider;
  title: string;
  artistName: string;
  curatorHandle: string;
  curatorVerified?: boolean;
  curatorArtistName?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  tags: string[];
  crateName: string;
  coverTone: string;
  coverAccent: string;
}

export interface CrateSummary {
  id: string;
  name: string;
  count: number;
}

export const INITIAL_TRACKS: QueueTrack[] = [
  {
    id: 'trk-1',
    mediaUrl: 'https://soundcloud.com/forss/flickermood',
    provider: 'soundcloud',
    title: 'Flickermood',
    artistName: 'Forss',
    curatorHandle: '@analog_maya',
    durationSeconds: 215,
    tags: ['downtempo', 'tape-loop', 'electronic'],
    crateName: 'Midnight Pressing',
    coverTone: '#2E2622',
    coverAccent: '#B84A2E',
  },
  {
    id: 'trk-2',
    mediaUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    provider: 'youtube',
    title: 'Lofi Radio — Warm Analog Study Session',
    artistName: 'ChilledCow Archive',
    curatorHandle: '@crate_julian',
    durationSeconds: 342,
    tags: ['ambient-jazz', 'rhodes', 'late-night'],
    crateName: 'Rainy Sunday Crates',
    coverTone: '#394037',
    coverAccent: '#C68B3C',
  },
  {
    id: 'trk-3',
    mediaUrl: 'https://soundcloud.com/forss/soulhack',
    provider: 'soundcloud',
    title: 'Soulhack',
    artistName: 'Forss',
    curatorHandle: '@velvet_nora',
    durationSeconds: 249,
    tags: ['broken-beat', 'dub', 'analog'],
    crateName: 'B-Side Gems',
    coverTone: '#523B2B',
    coverAccent: '#D99B52',
  },
  {
    id: 'trk-4',
    mediaUrl: 'https://www.youtube.com/watch?v=rUxyKA_-grg',
    provider: 'youtube',
    title: 'Midnight Vinyl Crates — Deep Ambient Mix',
    artistName: 'Devon Park',
    curatorHandle: '@sub_archive',
    durationSeconds: 371,
    tags: ['ambient', 'vinyl-rip', 'deep'],
    crateName: 'Midnight Pressing',
    coverTone: '#23282D',
    coverAccent: '#B84A2E',
  },
];

export const INITIAL_CRATES: CrateSummary[] = [
  { id: 'crt-1', name: 'Midnight Pressing', count: 18 },
  { id: 'crt-2', name: 'Rainy Sunday Crates', count: 12 },
  { id: 'crt-3', name: 'B-Side Gems', count: 24 },
  { id: 'crt-4', name: 'Tokyo Cassette 89', count: 9 },
];

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function detectMediaProvider(url: string): MediaProvider | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
      return 'soundcloud';
    }
    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be'
    ) {
      return 'youtube';
    }
    return null;
  } catch {
    return null;
  }
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v');
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx !== -1 && parts[embedIdx + 1]) {
      return parts[embedIdx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

interface PlayerState {
  currentTrack: QueueTrack | null;
  queue: QueueTrack[];
  history: QueueTrack[];
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  progressSeconds: number;
  durationSeconds: number;
  seekRequestSeconds: number | null;
  queueDrawerOpen: boolean;

  playTrack: (track: QueueTrack) => void;
  enqueueTrack: (track: QueueTrack) => void;
  playNext: (track: QueueTrack) => void;
  removeFromQueue: (trackId: string) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setProgress: (progressSeconds: number, durationSeconds?: number) => void;
  requestSeek: (seconds: number) => void;
  clearSeekRequest: () => void;
  setQueueDrawerOpen: (open: boolean) => void;
}

type PersistedPlayerState = Pick<
  PlayerState,
  'currentTrack' | 'queue' | 'history' | 'volume' | 'isMuted'
>;

const STORAGE_KEY = 'sona-player-queue-v1';
const listeners = new Set<() => void>();

function readPersistedState(): Partial<PersistedPlayerState> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const wrapper = parsed as { state?: unknown };
    const saved = wrapper.state ?? parsed;
    if (!saved || typeof saved !== 'object') return {};

    const value = saved as Record<string, unknown>;
    return {
      ...(value.currentTrack === null ||
      (typeof value.currentTrack === 'object' && value.currentTrack !== null)
        ? { currentTrack: value.currentTrack as QueueTrack | null }
        : {}),
      ...(Array.isArray(value.queue) ? { queue: value.queue as QueueTrack[] } : {}),
      ...(Array.isArray(value.history)
        ? { history: value.history as QueueTrack[] }
        : {}),
      ...(typeof value.volume === 'number'
        ? { volume: Math.max(0, Math.min(100, value.volume)) }
        : {}),
      ...(typeof value.isMuted === 'boolean' ? { isMuted: value.isMuted } : {}),
    };
  } catch {
    return {};
  }
}

function persistState(current: PlayerState): void {
  if (typeof window === 'undefined') return;

  try {
    const persisted: PersistedPlayerState = {
      currentTrack: current.currentTrack,
      queue: current.queue,
      history: current.history,
      volume: current.volume,
      isMuted: current.isMuted,
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: persisted, version: 0 }),
    );
  } catch {
    // Playback remains usable when browser storage is unavailable or full.
  }
}

let state: PlayerState = {
  currentTrack: INITIAL_TRACKS[0],
  queue: INITIAL_TRACKS.slice(1),
  history: [],
  isPlaying: false,
  volume: 75,
  isMuted: false,
  progressSeconds: 0,
  durationSeconds: INITIAL_TRACKS[0].durationSeconds,
  seekRequestSeconds: null,
  queueDrawerOpen: false,
  ...readPersistedState(),
  playTrack: (track) => {
    const { currentTrack, queue, history } = state;
    const nextHistory =
      currentTrack && currentTrack.id !== track.id
        ? [currentTrack, ...history.filter((h) => h.id !== currentTrack.id)].slice(0, 25)
        : history;

    updateState({
      currentTrack: track,
      queue: queue.filter((q) => q.id !== track.id),
      history: nextHistory,
      isPlaying: true,
      progressSeconds: 0,
      durationSeconds: track.durationSeconds,
      seekRequestSeconds: null,
    });
  },
  enqueueTrack: (track) => {
    const { currentTrack, queue } = state;
    if (currentTrack?.id === track.id || queue.some((q) => q.id === track.id)) {
      return;
    }
    updateState({ queue: [...queue, track] });
  },
  playNext: (track) => {
    const { currentTrack, queue } = state;
    if (currentTrack?.id === track.id) return;
    const filtered = queue.filter((q) => q.id !== track.id);
    updateState({ queue: [track, ...filtered] });
  },
  removeFromQueue: (trackId) =>
    updateState({
      queue: state.queue.filter((item) => item.id !== trackId),
    }),
  moveQueueItem: (fromIndex, toIndex) => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.queue.length ||
      toIndex >= state.queue.length
    ) {
      return;
    }
    const updated = [...state.queue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    updateState({ queue: updated });
  },
  clearQueue: () => updateState({ queue: [] }),
  skipNext: () => {
    const { currentTrack, queue, history } = state;
    if (queue.length === 0) {
      updateState({ isPlaying: false, progressSeconds: 0 });
      return;
    }
    const [nextTrack, ...restQueue] = queue;
    const nextHistory = currentTrack
      ? [currentTrack, ...history.filter((h) => h.id !== currentTrack.id)].slice(0, 25)
      : history;
    updateState({
      currentTrack: nextTrack,
      queue: restQueue,
      history: nextHistory,
      isPlaying: true,
      progressSeconds: 0,
      durationSeconds: nextTrack.durationSeconds,
      seekRequestSeconds: null,
    });
  },
  skipPrevious: () => {
    const { currentTrack, queue, history, progressSeconds } = state;
    if (progressSeconds > 5 && currentTrack) {
      updateState({ progressSeconds: 0, seekRequestSeconds: 0 });
      return;
    }
    if (history.length === 0) {
      updateState({ progressSeconds: 0, seekRequestSeconds: 0 });
      return;
    }
    const [prevTrack, ...restHistory] = history;
    const nextQueue = currentTrack
      ? [currentTrack, ...queue.filter((q) => q.id !== currentTrack.id)]
      : queue;
    updateState({
      currentTrack: prevTrack,
      queue: nextQueue,
      history: restHistory,
      isPlaying: true,
      progressSeconds: 0,
      durationSeconds: prevTrack.durationSeconds,
      seekRequestSeconds: null,
    });
  },
  togglePlay: () => updateState({ isPlaying: !state.isPlaying }),
  setPlaying: (playing) => updateState({ isPlaying: playing }),
  setVolume: (volume) =>
    updateState({ volume: Math.max(0, Math.min(100, volume)), isMuted: volume === 0 }),
  toggleMute: () => updateState({ isMuted: !state.isMuted }),
  setProgress: (progressSeconds, durationSeconds) =>
    updateState({
      progressSeconds,
      durationSeconds:
        typeof durationSeconds === 'number' && durationSeconds > 0
          ? durationSeconds
          : state.durationSeconds,
    }),
  requestSeek: (seconds) =>
    updateState({ progressSeconds: seconds, seekRequestSeconds: seconds }),
  clearSeekRequest: () => updateState({ seekRequestSeconds: null }),
  setQueueDrawerOpen: (open) => updateState({ queueDrawerOpen: open }),
};

function updateState(update: Partial<PlayerState>): void {
  state = { ...state, ...update };
  persistState(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlayerStore<T>(selector: (current: PlayerState) => T): T {
  const getSnapshot = useCallback(() => selector(state), [selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
