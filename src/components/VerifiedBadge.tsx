import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  artistName?: string | null;
  showLabel?: boolean;
  className?: string;
}

export function VerifiedBadge({
  artistName,
  showLabel = false,
  className = '',
}: VerifiedBadgeProps) {
  const titleText = artistName
    ? `Verified Artist · ${artistName}`
    : 'Verified Artist';

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={`inline-flex items-center gap-1 text-[#B84A2E] align-middle ${className}`}
    >
      <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
      {showLabel && (
        <span className="text-[11px] font-semibold text-[#B84A2E] whitespace-nowrap">
          Verified Artist{artistName ? ` · ${artistName}` : ''}
        </span>
      )}
    </span>
  );
}
