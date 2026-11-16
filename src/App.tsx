import { useEffect, useMemo, useState } from 'react';
import { ListPlus, Menu, Pause, Play } from 'lucide-react';
import {
  formatDuration,
  INITIAL_CRATES,
  INITIAL_TRACKS,
  type NavSection,
  usePlayerStore,
} from './store/playerStore';
import { AuthGateModal, type SessionUser } from './components/AuthGateModal';
import { NowPlayingCard } from './components/NowPlayingCard';
import { PersistentFooter } from './components/PersistentFooter';
import { QueueDrawer } from './components/QueueDrawer';
import { SidebarNav } from './components/SidebarNav';
import { VinylDisplay } from './components/VinylDisplay';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('Now Playing');
  const [activeCrateId, setActiveCrateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [crates, setCrates] = useState(INITIAL_CRATES);
  const [likedIds, setLikedIds] = useState<string[]>(['trk-1']);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(['trk-2']);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setSessionUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      () => {},
    );
    setSessionUser(null);
  };

  const filteredTracks = useMemo(() => {
    return INITIAL_TRACKS.filter((track) => {
      const matchesTag = activeTag === 'all' || track.tags.includes(activeTag);
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        track.title.toLowerCase().includes(q) ||
        track.artistName.toLowerCase().includes(q) ||
        track.tags.some((t) => t.toLowerCase().includes(q));
      const activeCrateName = crates.find((c) => c.id === activeCrateId)?.name;
      const matchesCrate = !activeCrateId || track.crateName === activeCrateName;
      return matchesTag && matchesQuery && matchesCrate;
    });
  }, [activeTag, searchQuery, activeCrateId, crates]);

  const handleSelectNav = (nav: NavSection) => {
    setActiveNav(nav);
    setActiveCrateId(null);
    setMobileMenuOpen(false);
  };

  const handleSelectCrate = (crateId: string) => {
    setActiveCrateId(crateId);
    setActiveNav('Browse');
    setMobileMenuOpen(false);
  };

  const handleCreateCrate = () => {
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

  const activeCrateName = activeCrateId
    ? crates.find((c) => c.id === activeCrateId)?.name
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EC] text-[#1F1B18]">
      {/* Mobile Header (< lg) */}
      <header className="sticky top-0 z-30 flex lg:hidden items-center justify-between gap-4 border-b border-[#DDD5C7] bg-[#F7F3EC]/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-[#1F1B18]"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-display text-xl font-semibold text-[#1F1B18] whitespace-nowrap">
            SONA
          </span>
        </div>

        {sessionUser ? (
          <span className="text-xs font-medium text-[#1F1B18]">
            @{sessionUser.username}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="text-xs font-semibold text-[#B84A2E] hover:text-[#9E3D24]"
          >
            Sign in
          </button>
        )}
      </header>

      {/* Mobile Sidebar Drawer (< lg) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1F1B18]/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">
            <SidebarNav
              activeNav={activeNav}
              activeCrateId={activeCrateId}
              searchQuery={searchQuery}
              activeTag={activeTag}
              crates={crates}
              sessionUser={sessionUser}
              onSelectNav={handleSelectNav}
              onSelectCrate={handleSelectCrate}
              onCreateCrate={handleCreateCrate}
              onSearchChange={setSearchQuery}
              onTagChange={setActiveTag}
              onOpenAuth={() => {
                setMobileMenuOpen(false);
                setAuthModalOpen(true);
              }}
              onLogout={handleLogout}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Three-Pane Workspace */}
      <div className="flex-1 flex min-h-0 pb-24 lg:pb-36">
        {/* Pane 1: Left Sidebar (Desktop lg+) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-0 h-screen pb-16">
            <SidebarNav
              activeNav={activeNav}
              activeCrateId={activeCrateId}
              searchQuery={searchQuery}
              activeTag={activeTag}
              crates={crates}
              sessionUser={sessionUser}
              onSelectNav={handleSelectNav}
              onSelectCrate={handleSelectCrate}
              onCreateCrate={handleCreateCrate}
              onSearchChange={setSearchQuery}
              onTagChange={setActiveTag}
              onOpenAuth={() => setAuthModalOpen(true)}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        {/* Pane 2: Center Main Dashboard / Feed */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          <NowPlayingCard
            likedIds={likedIds}
            bookmarkedIds={bookmarkedIds}
            onToggleLike={toggleLike}
            onToggleBookmark={toggleBookmark}
          />

          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
                  {activeCrateName
                    ? activeCrateName
                    : activeNav === 'Now Playing'
                      ? 'Discovery Feed'
                      : activeNav}
                </h2>
                <p className="text-xs text-[#5C534A]">
                  Curated SoundCloud and YouTube pressings synced to your persistent queue
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
                {filteredTracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isQueued = queue.some((q) => q.id === track.id);
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
                          onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
                          className="w-14 h-14 shrink-0 rounded border border-[#DDD5C7] flex items-center justify-center text-[#FCF9F4] cursor-pointer"
                          style={{ backgroundColor: track.coverTone }}
                          aria-label={
                            isCurrent && isPlaying
                              ? `Pause ${track.title}`
                              : `Play ${track.title}`
                          }
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
                          <p className="text-xs text-[#5C534A] mt-0.5">
                            {track.artistName}
                          </p>
                          <p className="mt-2 text-[11px] text-[#5C534A]">
                            <span>{track.curatorHandle}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>
                              {track.provider === 'youtube' ? 'YouTube' : 'SoundCloud'}
                            </span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              {formatDuration(track.durationSeconds)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-[#DDD5C7]/70 pt-3 text-xs text-[#5C534A]">
                        <span className="truncate">
                          {track.tags.map((t) => `#${t}`).join(' · ')}
                        </span>
                        <button
                          type="button"
                          disabled={isCurrent || isQueued}
                          onClick={() => enqueueTrack(track)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DDD5C7] bg-[#F7F3EC] text-[11px] font-medium text-[#1F1B18] hover:border-[#B84A2E] hover:text-[#B84A2E] disabled:opacity-50 disabled:cursor-default shrink-0 cursor-pointer"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span>
                            {isCurrent ? 'Playing' : isQueued ? 'Queued' : 'Queue'}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Pane 3: Interactive Decorative Vinyl Hero (Right, lg+ only) */}
        <aside className="hidden lg:flex w-80 xl:w-[340px] shrink-0 border-l border-[#DDD5C7] bg-[#F7F3EC] p-6 pb-48 flex-col justify-center">
          <div className="sticky top-8">
            <VinylDisplay
              track={currentTrack}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />
          </div>
        </aside>
      </div>

      <PersistentFooter />
      <QueueDrawer />
      <AuthGateModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(user) => setSessionUser(user)}
      />
    </div>
  );
}
