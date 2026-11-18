import { useState } from 'react';
import {
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { ProviderEmbedPlayer } from './ProviderEmbedPlayer';

export function PersistentFooter() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const skipNext = usePlayerStore((s) => s.skipNext);
  const skipPrevious = usePlayerStore((s) => s.skipPrevious);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const setQueueDrawerOpen = usePlayerStore((s) => s.setQueueDrawerOpen);
  const [mobileEmbedExpanded, setMobileEmbedExpanded] = useState(false);

  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-[#DDD5C7] bg-[#EFE9DE]/95 backdrop-blur-sm">
      <div className="mx-auto flex items-center justify-between gap-3 sm:gap-4 px-4 lg:px-6 py-2.5">
        {/* Track Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1F1B18] truncate">
            {currentTrack ? currentTrack.title : 'SONA Audio Hub'}
          </p>
          <p className="text-xs text-[#5C534A] truncate">
            {currentTrack
              ? `${currentTrack.artistName} · ${currentTrack.provider === 'youtube' ? 'YouTube' : 'SoundCloud'}`
              : 'No track active'}
          </p>
        </div>

        {/* Global Playback Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={skipPrevious}
            className="p-2 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
            aria-label="Previous track"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 rounded-full bg-[#B84A2E] text-[#FCF9F4] flex items-center justify-center hover:bg-[#9E3D24] disabled:opacity-50 cursor-pointer"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={skipNext}
            className="p-2 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile queue + embed toggle (< lg) */}
        <div className="flex lg:hidden items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setQueueDrawerOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-[#DDD5C7] bg-[#FCF9F4] text-xs font-medium text-[#1F1B18]"
            aria-label="Open queue"
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span className="font-mono-tabular">{queue.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileEmbedExpanded((prev) => !prev)}
            className="p-1.5 rounded border border-[#DDD5C7] bg-[#FCF9F4] text-[#5C534A]"
            aria-label={mobileEmbedExpanded ? 'Minimize provider player' : 'Show provider player'}
          >
            <ChevronUp
              className={`w-4 h-4 transition-transform ${
                mobileEmbedExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Desktop Volume + Queue + 200x200 ToS Embed Dock (lg+) */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setQueueDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-xs font-medium text-[#1F1B18] hover:bg-[#F7F3EC] cursor-pointer"
          >
            <ListMusic className="w-3.5 h-3.5 text-[#5C534A]" />
            <span>Queue</span>
            <span className="font-mono-tabular text-[#B84A2E]">{queue.length}</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-[#5C534A]">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-1 hover:text-[#1F1B18] cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#B84A2E]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Master volume"
              className="w-24 accent-[#B84A2E] cursor-pointer"
            />
            <span className="font-mono-tabular w-8 text-right">
              {isMuted ? 0 : volume}%
            </span>
          </div>

          <div className="w-[200px] h-10 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {/* Single persistent ProviderEmbedPlayer mounted across breakpoints for ToS compliance */}
      <div
        className={`${
          mobileEmbedExpanded ? 'block' : 'hidden'
        } lg:block fixed bottom-16 lg:bottom-2.5 right-4 lg:right-6 z-50`}
      >
        <ProviderEmbedPlayer />
      </div>
    </footer>
  );
}
