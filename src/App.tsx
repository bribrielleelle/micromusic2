import { useMemo, useState } from 'react';
import {
  Bookmark,
  Compass,
  Disc3,
  Heart,
  Menu,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  TrendingUp,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  PROTOTYPE_CRATES,
  PROTOTYPE_TRACKS,
  type PrototypeTrack,
} from './design/tokens';
import { VinylDisplay } from './components/VinylDisplay';
import { DesignSpecView } from './components/DesignSpecView';

type NavSection = 'Now Playing' | 'Browse' | 'Communities' | 'Charts' | 'Settings';
type PrototypeMode = 'wireframe' | 'spec';

const NAV_ITEMS: { label: NavSection; icon: typeof Disc3 }[] = [
  { label: 'Now Playing', icon: Disc3 },
  { label: 'Browse', icon: Compass },
  { label: 'Communities', icon: Users },
  { label: 'Charts', icon: TrendingUp },
  { label: 'Settings', icon: Settings },
];

const FILTER_TAGS = ['all', 'shoegaze', 'ambient-jazz', 'analog', 'vinyl-rip'];

export default function App() {
  const [mode, setMode] = useState<PrototypeMode>('wireframe');
  const [activeNav, setActiveNav] = useState<NavSection>('Now Playing');
  const [activeCrateId, setActiveCrateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(72);
  const [likedIds, setLikedIds] = useState<string[]>(['trk-1']);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(['trk-2']);
  const [crates, setCrates] = useState(PROTOTYPE_CRATES);

  const currentTrack: PrototypeTrack = PROTOTYPE_TRACKS[currentTrackIndex];
  const upNextTrack: PrototypeTrack =
    PROTOTYPE_TRACKS[(currentTrackIndex + 1) % PROTOTYPE_TRACKS.length];

  const filteredTracks = useMemo(() => {
    return PROTOTYPE_TRACKS.filter((track) => {
      const matchesTag = activeTag === 'all' || track.tags.includes(activeTag);
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        track.title.toLowerCase().includes(q) ||
        track.artist.toLowerCase().includes(q) ||
        track.tags.some((t) => t.toLowerCase().includes(q));
      const matchesCrate =
        !activeCrateId ||
        track.crateName === crates.find((c) => c.id === activeCrateId)?.name;
      return matchesTag && matchesQuery && matchesCrate;
    });
  }, [activeTag, searchQuery, activeCrateId, crates]);

  const handleSelectNav = (nav: NavSection) => {
    setActiveNav(nav);
    setActiveCrateId(null);
    setMode('wireframe');
    setMobileMenuOpen(false);
  };

  const handleSelectCrate = (crateId: string) => {
    setActiveCrateId(crateId);
    setActiveNav('Browse');
    setMode('wireframe');
    setMobileMenuOpen(false);
  };

  const handleCreateDraftCrate = () => {
    const nextNum = crates.length + 1;
    const newCrate = {
      id: `crt-${nextNum}`,
      name: `Untitled Crate ${nextNum}`,
      count: 0,
    };
    setCrates((prev) => [...prev, newCrate]);
    setActiveCrateId(newCrate.id);
    setActiveNav('Browse');
    setMobileMenuOpen(false);
  };

  const handleSkip = (direction: 1 | -1) => {
    setCurrentTrackIndex(
      (prev) => (prev + direction + PROTOTYPE_TRACKS.length) % PROTOTYPE_TRACKS.length,
    );
    setIsPlaying(true);
  };

  const toggleLike = (id: string) => {
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#EFE9DE] text-[#1F1B18] border-r border-[#DDD5C7]">
      <div className="p-5 space-y-6 overflow-y-auto">
        {/* Brand Wordmark */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleSelectNav('Now Playing')}
            className="font-display text-2xl font-semibold tracking-tight text-[#1F1B18] whitespace-nowrap shrink-0 cursor-pointer"
          >
            SONA
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-[#5C534A] hover:text-[#1F1B18]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Search */}
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Search tracks and fandom tags</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C534A]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags or artists..."
              className="w-full rounded-md border border-[#DDD5C7] bg-[#FCF9F4] pl-9 pr-3 py-2 text-xs text-[#1F1B18] placeholder:text-[#5C534A]/70 focus:outline-none focus:border-[#B84A2E]"
            />
          </label>

          {/* Tag Filters (interactive filter buttons) */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TAGS.map((tag) => {
              const selected = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
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

        {/* Primary Navigation */}
        <nav aria-label="Primary navigation" className="space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const active = mode === 'wireframe' && activeNav === label && !activeCrateId;
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleSelectNav(label)}
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
        </nav>

        {/* Dedicated CRATES section */}
        <div className="border-t border-[#DDD5C7] pt-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wider text-[#5C534A]">
              CRATES
            </h2>
            <button
              type="button"
              onClick={handleCreateDraftCrate}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New playlist</span>
            </button>
          </div>

          <ul className="space-y-1">
            {crates.map((crate) => {
              const selected = mode === 'wireframe' && activeCrateId === crate.id;
              return (
                <li key={crate.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectCrate(crate.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#FCF9F4] text-[#1F1B18] font-medium border border-[#DDD5C7]'
                        : 'text-[#5C534A] hover:text-[#1F1B18]'
                    }`}
                  >
                    <span className="truncate">{crate.name}</span>
                    <span className="font-mono-tabular text-xs text-[#5C534A]">
                      {crate.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Invite-only member preview */}
      <div className="border-t border-[#DDD5C7] px-5 py-3.5 flex items-center justify-between text-xs text-[#5C534A]">
        <span>@analog_maya</span>
        <span>Member</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EC] text-[#1F1B18]">
      {/* Mobile / Phase 1 Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#DDD5C7] bg-[#F7F3EC]/95 backdrop-blur-sm px-4 lg:px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-[#1F1B18]"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="lg:hidden font-display text-xl font-semibold text-[#1F1B18] whitespace-nowrap">
            SONA
          </span>
          <span className="hidden lg:inline text-xs font-medium text-[#5C534A] whitespace-nowrap">
            Phase 1 Prototype · Warm Vintage Three-Pane Layout
          </span>
        </div>

        {/* Phase 1 View Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-md border border-[#DDD5C7] bg-[#EFE9DE]">
          <button
            type="button"
            onClick={() => setMode('wireframe')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'wireframe'
                ? 'bg-[#FCF9F4] text-[#1F1B18] shadow-xs'
                : 'text-[#5C534A] hover:text-[#1F1B18]'
            }`}
          >
            Three-Pane Wireframe
          </button>
          <button
            type="button"
            onClick={() => setMode('spec')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'spec'
                ? 'bg-[#FCF9F4] text-[#1F1B18] shadow-xs'
                : 'text-[#5C534A] hover:text-[#1F1B18]'
            }`}
          >
            Design System &amp; Breakpoints
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay (< lg) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1F1B18]/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Workspace Area */}
      {mode === 'spec' ? (
        <main className="flex-1 pb-28 lg:pb-36">
          <DesignSpecView />
        </main>
      ) : (
        <div className="flex-1 flex min-h-0 pb-24 lg:pb-36">
          {/* Pane 1: Left Sidebar (Desktop lg+) */}
          <aside className="hidden lg:block w-64 shrink-0">
            {sidebarContent}
          </aside>

          {/* Pane 2: Center Dashboard / Feed */}
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-8">
            {/* Floating Now Playing Card */}
            <section
              aria-label="Now Playing"
              className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-5 sm:p-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                {/* Track Sleeve Art */}
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-lg border border-[#DDD5C7] flex flex-col justify-between p-3 text-[#FCF9F4]"
                  style={{ backgroundColor: currentTrack.coverTone }}
                >
                  <span className="font-mono-tabular text-[10px] uppercase tracking-wider opacity-80">
                    {currentTrack.provider}
                  </span>
                  <Radio className="w-5 h-5 opacity-80" />
                </div>

                {/* Track Metadata & Controls */}
                <div className="flex-1 min-w-0 w-full space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5C534A]">
                      <span>Now Playing</span>
                      <span aria-hidden="true">·</span>
                      <span>Curated by {currentTrack.curator}</span>
                      <span aria-hidden="true">·</span>
                      <span>{currentTrack.crateName}</span>
                    </div>
                    <h1 className="mt-1 font-display text-2xl font-semibold text-[#1F1B18] text-balance">
                      {currentTrack.title}
                    </h1>
                    <p className="text-sm text-[#5C534A]">{currentTrack.artist}</p>
                  </div>

                  {/* Unboxed tags separated by typographic middots */}
                  <p className="text-xs text-[#5C534A]">
                    {currentTrack.tags.map((tag, idx) => (
                      <span key={tag}>
                        {idx > 0 && <span className="mx-1.5" aria-hidden="true">·</span>}
                        <span>#{tag}</span>
                      </span>
                    ))}
                  </p>

                  {/* Scrubber & Transport Controls */}
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-xs text-[#5C534A]">01:42</span>
                      <div className="relative flex-1 h-1.5 rounded-full bg-[#EFE9DE] overflow-hidden">
                        <div className="h-full w-2/5 bg-[#B84A2E] rounded-full" />
                      </div>
                      <span className="font-mono-tabular text-xs text-[#5C534A]">
                        {currentTrack.duration}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSkip(-1)}
                          className="p-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#1F1B18] hover:bg-[#EFE9DE] cursor-pointer"
                          aria-label="Previous track"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPlaying((prev) => !prev)}
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
                          onClick={() => handleSkip(1)}
                          className="p-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#1F1B18] hover:bg-[#EFE9DE] cursor-pointer"
                          aria-label="Next track"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleLike(currentTrack.id)}
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
                          onClick={() => toggleBookmark(currentTrack.id)}
                          aria-label="Bookmark track"
                          className={`p-2 rounded-md border border-[#DDD5C7] transition-colors cursor-pointer ${
                            bookmarkedIds.includes(currentTrack.id)
                              ? 'bg-[#C68B3C]/15 text-[#9A6721] border-[#C68B3C]/40'
                              : 'bg-[#F7F3EC] text-[#5C534A] hover:text-[#1F1B18]'
                          }`}
                        >
                          <Bookmark className="w-4 h-4" />
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
                  <div className="flex items-center gap-2 text-sm text-[#1F1B18] truncate">
                    <button
                      type="button"
                      onClick={() => handleSkip(1)}
                      className="font-medium hover:text-[#B84A2E] truncate cursor-pointer"
                    >
                      {upNextTrack.title}
                    </button>
                    <span className="text-[#5C534A]" aria-hidden="true">·</span>
                    <span className="text-[#5C534A] truncate">{upNextTrack.artist}</span>
                  </div>
                </div>
                <span className="font-mono-tabular text-xs text-[#5C534A] shrink-0">
                  {upNextTrack.duration}
                </span>
              </div>
            </section>

            {/* Discovery Masonry Feed / Crate View */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
                    {activeCrateId
                      ? crates.find((c) => c.id === activeCrateId)?.name
                      : activeNav === 'Now Playing'
                        ? 'Discovery Feed'
                        : activeNav}
                  </h2>
                  <p className="text-xs text-[#5C534A]">
                    Curated SoundCloud and YouTube pressings from the community
                  </p>
                </div>
                <span className="font-mono-tabular text-xs text-[#5C534A]">
                  {filteredTracks.length} tracks
                </span>
              </div>

              {filteredTracks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#DDD5C7] bg-[#FCF9F4] py-12 px-6 text-center">
                  <p className="font-display text-lg text-[#1F1B18]">
                    {activeCrateId ? 'This crate is empty.' : 'No tracks found.'}
                  </p>
                  <p className="mt-1 text-xs text-[#5C534A]">
                    {activeCrateId
                      ? 'Add SoundCloud or YouTube links to start curating this crate.'
                      : 'Clear your tag filter or search query to view all curated tracks.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredTracks.map((track, idx) => {
                    const isCurrent = track.id === currentTrack.id;
                    return (
                      <article
                        key={track.id}
                        className={`rounded-lg border p-4 bg-[#FCF9F4] transition-colors flex flex-col justify-between gap-4 ${
                          isCurrent ? 'border-[#B84A2E]' : 'border-[#DDD5C7]'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              const realIdx = PROTOTYPE_TRACKS.findIndex(
                                (item) => item.id === track.id,
                              );
                              if (realIdx !== -1) {
                                setCurrentTrackIndex(realIdx);
                                setIsPlaying(true);
                              }
                            }}
                            className="w-14 h-14 shrink-0 rounded border border-[#DDD5C7] flex items-center justify-center text-[#FCF9F4] cursor-pointer"
                            style={{ backgroundColor: track.coverTone }}
                            aria-label={`Play ${track.title}`}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-base font-medium text-[#1F1B18] leading-snug">
                              {track.title}
                            </h3>
                            <p className="text-xs text-[#5C534A] mt-0.5">{track.artist}</p>
                            <p className="mt-2 text-[11px] text-[#5C534A]">
                              <span>{track.curator}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{track.provider}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span className="font-mono-tabular">{track.duration}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#DDD5C7]/70 pt-3 text-xs text-[#5C534A]">
                          <span className="truncate">
                            {track.tags.map((t) => `#${t}`).join(' · ')}
                          </span>
                          <span className="font-mono-tabular text-[11px] shrink-0">
                            0{idx + 1}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          {/* Pane 3: Interactive Hero Element (Right, lg+ only) */}
          <aside className="hidden lg:flex w-80 xl:w-[340px] shrink-0 border-l border-[#DDD5C7] bg-[#F7F3EC] p-6 pb-48 flex-col justify-center">
            <VinylDisplay
              track={currentTrack}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((prev) => !prev)}
            />
          </aside>
        </div>
      )}

      {/* Persistent Footer / Status Bar */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-[#DDD5C7] bg-[#EFE9DE]/95 backdrop-blur-sm">
        <div className="mx-auto flex items-center justify-between gap-4 px-4 lg:px-6 py-2.5">
          {/* Condensed track info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1F1B18] truncate">
              {currentTrack.title}
            </p>
            <p className="text-xs text-[#5C534A] truncate">
              {currentTrack.artist} · {currentTrack.provider}
            </p>
          </div>

          {/* Global Transport Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSkip(-1)}
              className="p-2 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
              aria-label="Previous track"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              className="w-9 h-9 rounded-full bg-[#B84A2E] text-[#FCF9F4] flex items-center justify-center hover:bg-[#9E3D24] cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => handleSkip(1)}
              className="p-2 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Master Volume & ToS-Compliant 200x200 Embed Slot (Desktop lg+) */}
          <div className="hidden lg:flex items-center gap-5 shrink-0">
            <label className="flex items-center gap-2 text-xs text-[#5C534A]">
              <Volume2 className="w-4 h-4" />
              <span className="sr-only">Master volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-[#B84A2E] cursor-pointer"
              />
              <span className="font-mono-tabular w-7 text-right">{volume}%</span>
            </label>

            {/* Visible dimmed 200x200px embed dock per Spec Section 3 */}
            <div className="relative w-[200px] h-10 shrink-0">
              <div
                className="absolute bottom-0 right-0 w-[200px] h-[200px] rounded-lg border border-[#DDD5C7] bg-[#1F1B18]/85 text-[#FCF9F4]/85 p-3 flex flex-col justify-between opacity-80 shadow-md"
                title="ToS-compliant SoundCloud / YouTube visible iframe container (200x200px)"
              >
                <div className="flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-wide text-[#FCF9F4]/70">
                  <span>{currentTrack.provider}</span>
                  <span>200×200</span>
                </div>
                <div className="text-center space-y-1">
                  <Radio className="w-6 h-6 mx-auto opacity-70" />
                  <p className="text-[11px] font-medium truncate">{currentTrack.title}</p>
                  <p className="text-[10px] text-[#FCF9F4]/60">
                    ToS-compliant embed slot
                  </p>
                </div>
                <div className="h-1 w-full rounded bg-[#FCF9F4]/20 overflow-hidden">
                  <div className="h-full w-2/5 bg-[#B84A2E]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
