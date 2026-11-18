import {
  Bookmark,
  Compass,
  Disc3,
  LogOut,
  Plus,
  Search,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { NavSection } from '../store/playerStore';
import type { HubCrate } from '../types/hub';
import type { SessionUser } from './AuthGateModal';

const NAV_ITEMS: { label: NavSection; icon: typeof Disc3 }[] = [
  { label: 'Now Playing', icon: Disc3 },
  { label: 'Browse', icon: Compass },
  { label: 'Communities', icon: Users },
  { label: 'Charts', icon: TrendingUp },
  { label: 'Settings', icon: Settings },
];

const FILTER_TAGS = ['all', 'downtempo', 'ambient-jazz', 'analog', 'vinyl-rip'];

interface SidebarNavProps {
  activeNav: NavSection;
  activeCrateId: string | null;
  bookmarksOnly: boolean;
  searchQuery: string;
  activeTag: string;
  crates: HubCrate[];
  sessionUser: SessionUser | null;
  onSelectNav: (nav: NavSection) => void;
  onSelectBookmarks: () => void;
  onSelectCrate: (crateId: string) => void;
  onCreateCrate: () => void;
  onOpenShareTrack: () => void;
  onSearchChange: (q: string) => void;
  onTagChange: (tag: string) => void;
  onOpenAuth: () => void;
  onOpenProfile: (username: string) => void;
  onLogout: () => void;
  onCloseMobile?: () => void;
}

export function SidebarNav({
  activeNav,
  activeCrateId,
  bookmarksOnly,
  searchQuery,
  activeTag,
  crates,
  sessionUser,
  onSelectNav,
  onSelectBookmarks,
  onSelectCrate,
  onCreateCrate,
  onOpenShareTrack,
  onSearchChange,
  onTagChange,
  onOpenAuth,
  onOpenProfile,
  onLogout,
  onCloseMobile,
}: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col justify-between bg-[#EFE9DE] text-[#1F1B18] border-r border-[#DDD5C7]">
      <div className="p-5 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectNav('Now Playing')}
            className="font-display text-2xl font-semibold tracking-tight text-[#1F1B18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            SONA
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenShareTrack}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#B84A2E] text-[11px] font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Share Track</span>
            </button>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-[#5C534A] hover:text-[#1F1B18]"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search tracks and fandom tags</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C534A]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tags or artists..."
              className="w-full rounded-md border border-[#DDD5C7] bg-[#FCF9F4] pl-9 pr-3 py-2 text-xs text-[#1F1B18] placeholder:text-[#5C534A]/70 focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_TAGS.map((tag) => {
              const selected = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagChange(tag)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-[#1F1B18] text-[#FCF9F4]'
                      : 'bg-[#FCF9F4] text-[#5C534A] border border-[#DDD5C7] hover:text-[#1F1B18]'
                  }`}
                >
                  {tag === 'all' ? 'All Tags' : `#${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        <nav aria-label="Primary navigation" className="space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const active =
              activeNav === label && !activeCrateId && !bookmarksOnly;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSelectNav(label)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#FCF9F4] text-[#B84A2E] font-semibold border border-[#DDD5C7]'
                    : 'text-[#5C534A] hover:text-[#1F1B18] hover:bg-[#FCF9F4]/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onSelectBookmarks}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              bookmarksOnly
                ? 'bg-[#FCF9F4] text-[#B84A2E] font-semibold border border-[#DDD5C7]'
                : 'text-[#5C534A] hover:text-[#1F1B18] hover:bg-[#FCF9F4]/60'
            }`}
          >
            <Bookmark className="w-4 h-4 shrink-0" />
            <span>Saved Bookmarks</span>
          </button>
        </nav>

        <div className="border-t border-[#DDD5C7] pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-[#5C534A]">
              CRATES
            </h2>
            <button
              type="button"
              onClick={onCreateCrate}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New playlist</span>
            </button>
          </div>

          <ul className="space-y-1">
            {crates.map((crate) => {
              const selected = activeCrateId === crate.id;
              return (
                <li key={crate.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCrate(crate.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#FCF9F4] text-[#1F1B18] font-medium border border-[#DDD5C7]'
                        : 'text-[#5C534A] hover:text-[#1F1B18]'
                    }`}
                  >
                    <span className="truncate">{crate.title}</span>
                    <span className="font-mono-tabular text-xs text-[#5C534A]">
                      {crate.itemCount}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#DDD5C7] px-5 py-3.5 flex items-center justify-between text-xs text-[#5C534A]">
        {sessionUser ? (
          <>
            <button
              type="button"
              onClick={() => onOpenProfile(sessionUser.username)}
              className="font-medium text-[#1F1B18] hover:text-[#B84A2E] truncate cursor-pointer"
            >
              @{sessionUser.username}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </>
        ) : (
          <>
            <span>Invite-only hub</span>
            <button
              type="button"
              onClick={onOpenAuth}
              className="font-semibold text-[#B84A2E] hover:text-[#9E3D24] cursor-pointer"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
