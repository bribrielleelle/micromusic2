import type { PrototypeTrack } from '../design/tokens';

interface VinylDisplayProps {
  track: PrototypeTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function VinylDisplay({ track, isPlaying, onTogglePlay }: VinylDisplayProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-60 h-60 xl:w-64 xl:h-64 flex items-center justify-center select-none">
        {/* Turntable platter shadow */}
        <div
          className="absolute inset-2 rounded-full border border-[#DDD5C7] bg-[#EFE9DE] shadow-inner"
          aria-hidden="true"
        />

        {/* Rotating vinyl disc */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause decorative vinyl preview' : 'Play decorative vinyl preview'}
          className={`relative w-52 h-52 xl:w-56 xl:h-56 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B84A2E] transition-transform duration-300 ${
            isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-paused'
          }`}
          style={{
            background:
              'radial-gradient(circle at center, #1F1B18 0%, #161311 38%, #26211E 39%, #181412 52%, #28221F 53%, #14110F 72%, #241F1C 73%, #120F0D 100%)',
            boxShadow: '0 14px 32px -12px rgba(31, 27, 24, 0.45)',
          }}
        >
          {/* Subtle specular groove sheen */}
          <div
            className="absolute inset-0 rounded-full opacity-25 pointer-events-none"
            style={{
              background:
                'conic-gradient(from 40deg, transparent 0deg, rgba(252,249,244,0.45) 35deg, transparent 75deg, transparent 180deg, rgba(252,249,244,0.35) 215deg, transparent 255deg)',
            }}
          />

          {/* Center pressed paper label */}
          <div
            className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-[#1F1B18]/20 flex flex-col items-center justify-center p-2 text-center"
            style={{ backgroundColor: track.coverAccent }}
          >
            <span className="font-display text-[10px] font-semibold tracking-wider text-[#FCF9F4] uppercase">
              SONA
            </span>
            <span className="mt-0.5 text-[8px] leading-tight text-[#FCF9F4]/90 line-clamp-2">
              {track.artist}
            </span>
            <span className="mt-1 w-2.5 h-2.5 rounded-full bg-[#F7F3EC] border border-[#1F1B18]/40" />
          </div>
        </button>

        {/* Decorative tonearm */}
        <div
          className={`pointer-events-none absolute -top-1 right-3 origin-top-right transition-transform duration-500 ease-out ${
            isPlaying ? 'rotate-[18deg]' : 'rotate-0'
          }`}
          aria-hidden="true"
        >
          <div className="w-7 h-7 rounded-full border border-[#B7ACA0] bg-[#DDD5C7] flex items-center justify-center shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-[#5C534A]" />
          </div>
          <div className="mx-auto w-1 h-28 bg-[#8A7E72] rounded-full origin-top rotate-[12deg] -mt-2 shadow-sm">
            <div className="absolute -bottom-1 -left-1 w-3 h-4 bg-[#1F1B18] rounded-sm" />
          </div>
        </div>
      </div>

      {/* Caption clarifying ToS compliance */}
      <div className="mt-5 w-full border-t border-[#DDD5C7] pt-4 text-center">
        <p className="font-display text-base font-medium text-[#1F1B18] truncate">
          {track.title}
        </p>
        <p className="mt-1 text-xs text-[#5C534A]">
          {track.artist} · {track.provider}
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-[#5C534A]">
          Decorative turntable synced to playback state. Provider embed remains visible in the footer for ToS compliance.
        </p>
      </div>
    </div>
  );
}
