import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
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

      playTrack: (track) => {
        const { currentTrack, queue, history } = get();
        const nextHistory =
          currentTrack && currentTrack.id !== track.id
            ? [currentTrack, ...history.filter((h) => h.id !== currentTrack.id)].slice(0, 25)
            : history;

        set({
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
        const { currentTrack, queue } = get();
        if (currentTrack?.id === track.id || queue.some((q) => q.id === track.id)) {
          return;
        }
        set({ queue: [...queue, track] });
      },

      playNext: (track) => {
        const { currentTrack, queue } = get();
        if (currentTrack?.id === track.id) return;
        const filtered = queue.filter((q) => q.id !== track.id);
        set({ queue: [track, ...filtered] });
      },

      removeFromQueue: (trackId) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== trackId),
        }));
      },

      moveQueueItem: (fromIndex, toIndex) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.queue.length ||
            toIndex >= state.queue.length
          ) {
            return state;
          }
          const updated = [...state.queue];
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);
          return { queue: updated };
        });
      },

      clearQueue: () => set({ queue: [] }),

      skipNext: () => {
        const { currentTrack, queue, history } = get();
        if (queue.length === 0) {
          set({ isPlaying: false, progressSeconds: 0 });
          return;
        }
        const [nextTrack, ...restQueue] = queue;
        const nextHistory = currentTrack
          ? [currentTrack, ...history.filter((h) => h.id !== currentTrack.id)].slice(0, 25)
          : history;
        set({
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
        const { currentTrack, queue, history, progressSeconds } = get();
        if (progressSeconds > 5 && currentTrack) {
          set({ progressSeconds: 0, seekRequestSeconds: 0 });
          return;
        }
        if (history.length === 0) {
          set({ progressSeconds: 0, seekRequestSeconds: 0 });
          return;
        }
        const [prevTrack, ...restHistory] = history;
        const nextQueue = currentTrack
          ? [currentTrack, ...queue.filter((q) => q.id !== currentTrack.id)]
          : queue;
        set({
          currentTrack: prevTrack,
          queue: nextQueue,
          history: restHistory,
          isPlaying: true,
          progressSeconds: 0,
          durationSeconds: prevTrack.durationSeconds,
          seekRequestSeconds: null,
        });
      },

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (volume) =>
        set({ volume: Math.max(0, Math.min(100, volume)), isMuted: volume === 0 }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setProgress: (progressSeconds, durationSeconds) =>
        set((state) => ({
          progressSeconds,
          durationSeconds:
            typeof durationSeconds === 'number' && durationSeconds > 0
              ? durationSeconds
              : state.durationSeconds,
        })),
      requestSeek: (seconds) =>
        set({ progressSeconds: seconds, seekRequestSeconds: seconds }),
      clearSeekRequest: () => set({ seekRequestSeconds: null }),
      setQueueDrawerOpen: (open) => set({ queueDrawerOpen: open }),
    }),
    {
      name: 'sona-player-queue-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        history: state.history,
        volume: state.volume,
        isMuted: state.isMuted,
      }),
    },
  ),
);
