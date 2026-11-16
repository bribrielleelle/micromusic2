import {
  Bookmark,
  Heart,
  ListMusic,
  Pause,
  Play,
  Radio,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { formatDuration, usePlayerStore } from '../store/playerStore';

interface NowPlayingCardProps {
  likedIds: string[];
  bookmarkedIds: string[];
  onToggleLike: (id: string) => void;
  onToggleBookmark: (id: string) => void;
}

export function NowPlayingCard({
  likedIds,
  bookmarkedIds,
  onToggleLike,
  onToggleBookmark,
}: NowPlayingCardProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progressSeconds = usePlayerStore((s) => s.progressSeconds);
  const durationSeconds = usePlayerStore((s) => s.durationSeconds);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrevious = usePlayerStore((s) => s.skipPrevious);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const setQueueDrawerOpen = usePlayerStore((s) => s.setQueueDrawerOpen);

  if (!currentTrack) {
    return (
      <section
        aria-label="Now Playing"
        className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 text-center"
      >
        <p className="font-display text-lg text-[#1F1B18]">No track selected.</p>
        <p className="mt-1 text-xs text-[#5C534A]">
          Choose a track from the discovery feed below to start listening.
        </p>
      </section>
    );
  }

  const effectiveDuration = Math.max(durationSeconds || currentTrack.durationSeconds, 1);
  const upNextTrack = queue[0] ?? null;

  return (
    <section
      aria-label="Now Playing"
      className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 sm:p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        <div
          className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg border border-[#DDD5C7] flex flex-col justify-between p-3 text-[#FCF9F4]"
          style={{ backgroundColor: currentTrack.coverTone }}
        >
          <span className="font-mono-tabular text-[10px] uppercase tracking-wider opacity-80">
            {currentTrack.provider}
          </span>
          <Radio className="w-5 h-5 opacity-80" />
        </div>

        <div className="flex-1 min-w-0 w-full space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5C534A]">
              <span>Now Playing</span>
              <span aria-hidden="true">·</span>
              <span>Curated by {currentTrack.curatorHandle}</span>
              <span aria-hidden="true">·</span>
              <span>{currentTrack.crateName}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[#1F1B18] text-balance">
              {currentTrack.title}
            </h1>
            <p className="text-sm text-[#5C534A]">{currentTrack.artistName}</p>
          </div>

          <p className="text-xs text-[#5C534A]">
            {currentTrack.tags.map((tag, idx) => (
              <span key={tag}>
                {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                <span>#{tag}</span>
              </span>
            ))}
          </p>

          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono-tabular text-xs text-[#5C534A]">
                {formatDuration(progressSeconds)}
              </span>
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                value={Math.min(progressSeconds, effectiveDuration)}
                onChange={(e) => requestSeek(Number(e.target.value))}
                aria-label="Seek track position"
                className="flex-1 h-1.5 accent-[#B84A2E] cursor-pointer"
              />
              <span className="font-mono-tabular text-xs text-[#5C534A]">
                {formatDuration(effectiveDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={skipPrevious}
                  className="p-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#1F1B18] hover:bg-[#EFE9DE] cursor-pointer"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#B84A2E] text-[#FCF9F4] text-xs font-semibold hover:bg-[#9E3D24] transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Play</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={skipNext}
                  className="p-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#1F1B18] hover:bg-[#EFE9DE] cursor-pointer"
                  aria-label="Next track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleLike(currentTrack.id)}
                  aria-label="Like track"
                  className={`p-2 rounded-md border border-[#DDD5C7] transition-colors cursor-pointer ${
                    likedIds.includes(currentTrack.id)
                      ? 'bg-[#B84A2E]/10 text-[#B84A2E] border-[#B84A2E]/30'
                      : 'bg-[#F7F3EC] text-[#5C534A] hover:text-[#1F1B18]'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(currentTrack.id)}
                  aria-label="Bookmark track"
                  className={`p-2 rounded-md border border-[#DDD5C7] transition-colors cursor-pointer ${
                    bookmarkedIds.includes(currentTrack.id)
                      ? 'bg-[#C68B3C]/15 text-[#9A6721] border-[#C68B3C]/40'
                      : 'bg-[#F7F3EC] text-[#5C534A] hover:text-[#1F1B18]'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setQueueDrawerOpen(true)}
                  aria-label="Open Up Next queue"
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:bg-[#EFE9DE] cursor-pointer"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span className="font-mono-tabular">{queue.length}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Up Next Preview Row */}
      <div className="mt-5 pt-4 border-t border-[#DDD5C7] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#5C534A]">Up Next</span>
          {upNextTrack ? (
            <div className="flex items-center gap-2 text-sm text-[#1F1B18] truncate">
              <button
                type="button"
                onClick={skipNext}
                className="font-medium hover:text-[#B84A2E] truncate cursor-pointer"
              >
                {upNextTrack.title}
              </button>
              <span className="text-[#5C534A]" aria-hidden="true">·</span>
              <span className="text-[#5C534A] truncate">{upNextTrack.artistName}</span>
            </div>
          ) : (
            <p className="text-xs text-[#5C534A]">
              Queue is empty. Add tracks from the feed.
            </p>
          )}
        </div>
        {upNextTrack && (
          <span className="font-mono-tabular text-xs text-[#5C534A] shrink-0">
            {formatDuration(upNextTrack.durationSeconds)}
          </span>
        )}
      </div>
    </section>
  );
}
