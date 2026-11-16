import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Heart,
  ListPlus,
  Menu,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Radio,
  Trash2,
} from 'lucide-react';
import {
  formatDuration,
  INITIAL_TRACKS,
  type NavSection,
  usePlayerStore,
} from './store/playerStore';
import {
  postToQueueTrack,
  type CrateDetailResponse,
  type FeedPost,
  type HubCrate,
} from './types/hub';
import { AuthGateModal, type SessionUser } from './components/AuthGateModal';
import { CreateCrateModal } from './components/CreateCrateModal';
import { NowPlayingCard } from './components/NowPlayingCard';
import { PersistentFooter } from './components/PersistentFooter';
import { PostDetailModal } from './components/PostDetailModal';
import { ProfileDrawer } from './components/ProfileDrawer';
import { QueueDrawer } from './components/QueueDrawer';
import { ShareTrackModal } from './components/ShareTrackModal';
import { SidebarNav } from './components/SidebarNav';
import { VinylDisplay } from './components/VinylDisplay';

const FALLBACK_POSTS: FeedPost[] = INITIAL_TRACKS.map((trk, idx) => ({
  id: trk.id,
  userId: `seed-${idx}`,
  mediaUrl: trk.mediaUrl,
  provider: trk.provider,
  title: trk.title,
  artistName: trk.artistName,
  thumbnailUrl: null,
  durationSeconds: trk.durationSeconds,
  tags: trk.tags,
  viewCount: 12 + idx * 7,
  isHidden: false,
  createdAt: new Date(Date.now() - idx * 3600 * 1000).toISOString(),
  author: {
    id: `seed-${idx}`,
    username: trk.curatorHandle.replace(/^@/, ''),
    avatarUrl: null,
  },
  likeCount: 4 + idx,
  bookmarkCount: 2 + idx,
  commentCount: 0,
  likedByViewer: idx === 0,
  bookmarkedByViewer: idx === 1,
}));

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('Now Playing');
  const [activeCrateId, setActiveCrateId] = useState<string | null>(null);
  const [activeCrateDetail, setActiveCrateDetail] =
    useState<CrateDetailResponse | null>(null);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(FALLBACK_POSTS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [crates, setCrates] = useState<HubCrate[]>([]);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createCrateOpen, setCreateCrateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [profileTarget, setProfileTarget] = useState<string | null>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  const loadCrates = useCallback(async () => {
    try {
      const res = await fetch('/api/crates', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.databaseConfigured && Array.isArray(data.crates)) {
        setCrates(data.crates);
      }
    } catch {
      // Keep empty crate list if DB unreachable
    }
  }, []);

  const loadFeed = useCallback(
    async (cursor?: string | null) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoadingFeed(true);
      }
      setFeedNotice(null);

      try {
        if (activeCrateId) {
          const res = await fetch(
            `/api/crates/${encodeURIComponent(activeCrateId)}`,
            { credentials: 'include' },
          );
          if (res.ok) {
            const detail = (await res.json()) as CrateDetailResponse;
            setActiveCrateDetail(detail);
            setFeedPosts(detail.items.map((item) => item.post));
            setNextCursor(null);
            setDatabaseConnected(true);
          } else {
            const err = await res.json().catch(() => ({}));
            setFeedNotice(err?.error || 'Unable to load crate.');
            setFeedPosts([]);
          }
          return;
        }

        setActiveCrateDetail(null);

        const isSearching =
          activeTag !== 'all' || searchQuery.trim().length > 0;

        let url = '/api/posts?limit=12';
        if (bookmarksOnly) {
          url = '/api/posts?limit=12&bookmarked=true';
        } else if (isSearching) {
          const params = new URLSearchParams();
          if (activeTag !== 'all') params.set('tag', activeTag);
          if (searchQuery.trim()) params.set('q', searchQuery.trim());
          url = `/api/search?${params.toString()}`;
        }

        if (cursor) {
          url += `${url.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`;
        }

        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401 && bookmarksOnly) {
            setFeedPosts([]);
            setFeedNotice('Sign in to view your saved bookmarks.');
            return;
          }
          if (!cursor && !databaseConnected) {
            setFeedPosts(FALLBACK_POSTS);
          }
          if (err?.error) setFeedNotice(err.error);
          return;
        }

        const data = await res.json();
        if (data?.databaseConfigured) {
          setDatabaseConnected(true);
          const incoming = Array.isArray(data.items)
            ? (data.items as FeedPost[])
            : [];
          setFeedPosts((prev) => (cursor ? [...prev, ...incoming] : incoming));
          setNextCursor(data.nextCursor ?? null);
        } else {
          setDatabaseConnected(false);
          setFeedPosts(FALLBACK_POSTS);
          setNextCursor(null);
        }
      } catch {
        if (!cursor && !databaseConnected) {
          setFeedPosts(FALLBACK_POSTS);
        }
      } finally {
        setLoadingFeed(false);
        setLoadingMore(false);
      }
    },
    [activeCrateId, activeTag, searchQuery, bookmarksOnly, databaseConnected],
  );

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setSessionUser(data.user);
        }
      })
      .catch(() => {});
    loadCrates();
  }, [loadCrates]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFeed(null);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setSessionUser(null);
    loadFeed(null);
  };

  const displayedPosts = useMemo(() => {
    if (databaseConnected) return feedPosts;
    return feedPosts.filter((post) => {
      const matchesTag = activeTag === 'all' || post.tags.includes(activeTag);
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.artistName.toLowerCase().includes(q) ||
        post.tags.some((t) => t.toLowerCase().includes(q));
      const matchesBookmarks = !bookmarksOnly || post.bookmarkedByViewer;
      return matchesTag && matchesQuery && matchesBookmarks;
    });
  }, [databaseConnected, feedPosts, activeTag, searchQuery, bookmarksOnly]);

  const likedIds = useMemo(
    () => feedPosts.filter((p) => p.likedByViewer).map((p) => p.id),
    [feedPosts],
  );
  const bookmarkedIds = useMemo(
    () => feedPosts.filter((p) => p.bookmarkedByViewer).map((p) => p.id),
    [feedPosts],
  );

  const togglePostLike = async (post: FeedPost) => {
    if (!databaseConnected) {
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByViewer: !p.likedByViewer,
                likeCount: p.likedByViewer ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
              }
            : p,
        ),
      );
      return;
    }

    if (!sessionUser) {
      setAuthModalOpen(true);
      return;
    }

    const method = post.likedByViewer ? 'DELETE' : 'POST';
    const res = await fetch('/api/likes', {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByViewer: data.liked,
                likeCount: data.likeCount,
              }
            : p,
        ),
      );
      setSelectedPost((prev) =>
        prev && prev.id === post.id
          ? { ...prev, likedByViewer: data.liked, likeCount: data.likeCount }
          : prev,
      );
    }
  };

  const togglePostBookmark = async (post: FeedPost) => {
    if (!databaseConnected) {
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                bookmarkedByViewer: !p.bookmarkedByViewer,
                bookmarkCount: p.bookmarkedByViewer
                  ? Math.max(0, p.bookmarkCount - 1)
                  : p.bookmarkCount + 1,
              }
            : p,
        ),
      );
      return;
    }

    if (!sessionUser) {
      setAuthModalOpen(true);
      return;
    }

    const method = post.bookmarkedByViewer ? 'DELETE' : 'POST';
    const res = await fetch('/api/bookmarks', {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                bookmarkedByViewer: data.bookmarked,
                bookmarkCount: data.bookmarkCount,
              }
            : p,
        ),
      );
      setSelectedPost((prev) =>
        prev && prev.id === post.id
          ? {
              ...prev,
              bookmarkedByViewer: data.bookmarked,
              bookmarkCount: data.bookmarkCount,
            }
          : prev,
      );
    }
  };

  const handleAddToCrate = async (crateId: string, postId: string) => {
    const res = await fetch('/api/crates/items', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId, postId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to add track to crate.');
    }
    loadCrates();
  };

  const handleRemoveFromCrate = async (crateId: string, postId: string) => {
    const res = await fetch('/api/crates/items', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crateId, postId }),
    });
    if (res.ok) {
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      loadCrates();
    }
  };

  const handleSelectNav = (nav: NavSection) => {
    setActiveNav(nav);
    setActiveCrateId(null);
    setBookmarksOnly(false);
    setMobileMenuOpen(false);
  };

  const handleSelectBookmarks = () => {
    setBookmarksOnly(true);
    setActiveCrateId(null);
    setActiveNav('Browse');
    setMobileMenuOpen(false);
  };

  const handleSelectCrate = (crateId: string) => {
    setActiveCrateId(crateId);
    setBookmarksOnly(false);
    setActiveNav('Browse');
    setMobileMenuOpen(false);
  };

  const handleRequireAuthAction = (onAuthorized: () => void) => {
    if (!sessionUser) {
      setAuthModalOpen(true);
      return;
    }
    onAuthorized();
  };

  const feedTitle = activeCrateDetail
    ? activeCrateDetail.crate.title
    : bookmarksOnly
      ? 'Saved Bookmarks'
      : activeNav === 'Now Playing'
        ? 'Discovery Feed'
        : activeNav;

  const canManageCrate = Boolean(
    activeCrateDetail &&
      sessionUser &&
      (sessionUser.role === 'admin' ||
        sessionUser.id === activeCrateDetail.crate.ownerId),
  );

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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleRequireAuthAction(() => setShareModalOpen(true))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#B84A2E] text-[11px] font-semibold text-[#FCF9F4]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
          {sessionUser ? (
            <button
              type="button"
              onClick={() => setProfileTarget(sessionUser.username)}
              className="text-xs font-medium text-[#1F1B18]"
            >
              @{sessionUser.username}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="text-xs font-semibold text-[#B84A2E] hover:text-[#9E3D24]"
            >
              Sign in
            </button>
          )}
        </div>
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
              bookmarksOnly={bookmarksOnly}
              searchQuery={searchQuery}
              activeTag={activeTag}
              crates={crates}
              sessionUser={sessionUser}
              onSelectNav={handleSelectNav}
              onSelectBookmarks={handleSelectBookmarks}
              onSelectCrate={handleSelectCrate}
              onCreateCrate={() =>
                handleRequireAuthAction(() => setCreateCrateOpen(true))
              }
              onOpenShareTrack={() =>
                handleRequireAuthAction(() => setShareModalOpen(true))
              }
              onSearchChange={setSearchQuery}
              onTagChange={setActiveTag}
              onOpenAuth={() => {
                setMobileMenuOpen(false);
                setAuthModalOpen(true);
              }}
              onOpenProfile={(username) => {
                setMobileMenuOpen(false);
                setProfileTarget(username);
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
              bookmarksOnly={bookmarksOnly}
              searchQuery={searchQuery}
              activeTag={activeTag}
              crates={crates}
              sessionUser={sessionUser}
              onSelectNav={handleSelectNav}
              onSelectBookmarks={handleSelectBookmarks}
              onSelectCrate={handleSelectCrate}
              onCreateCrate={() =>
                handleRequireAuthAction(() => setCreateCrateOpen(true))
              }
              onOpenShareTrack={() =>
                handleRequireAuthAction(() => setShareModalOpen(true))
              }
              onSearchChange={setSearchQuery}
              onTagChange={setActiveTag}
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenProfile={(username) => setProfileTarget(username)}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        {/* Pane 2: Center Main Dashboard / Masonry Discovery Feed */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          <NowPlayingCard
            likedIds={likedIds}
            bookmarkedIds={bookmarkedIds}
            onToggleLike={(id) => {
              const found = feedPosts.find((p) => p.id === id);
              if (found) togglePostLike(found);
            }}
            onToggleBookmark={(id) => {
              const found = feedPosts.find((p) => p.id === id);
              if (found) togglePostBookmark(found);
            }}
          />

          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
                  {feedTitle}
                </h2>
                <p className="text-xs text-[#5C534A]">
                  {activeCrateDetail
                    ? activeCrateDetail.crate.description ||
                      `Curated by @${activeCrateDetail.crate.ownerUsername}`
                    : 'Curated SoundCloud and YouTube pressings from the community'}
                </p>
              </div>
              <span className="font-mono-tabular text-xs text-[#5C534A]">
                {displayedPosts.length} tracks
              </span>
            </div>

            {feedNotice && (
              <p className="rounded-md border border-[#DDD5C7] bg-[#FCF9F4] px-4 py-2.5 text-xs text-[#5C534A]">
                {feedNotice}
              </p>
            )}

            {/* Skeleton Loaders (Spec Section 7) */}
            {loadingFeed ? (
              <div className="columns-1 md:columns-2 gap-4 space-y-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="break-inside-avoid rounded-lg border border-[#DDD5C7] bg-[#FCF9F4] p-4 space-y-3"
                  >
                    <div
                      className={`w-full rounded bg-[#EFE9DE] animate-pulse ${
                        idx % 2 === 0 ? 'h-44' : 'h-32'
                      }`}
                    />
                    <div className="h-4 w-3/4 rounded bg-[#EFE9DE] animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-[#EFE9DE] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : displayedPosts.length === 0 ? (
              /* Spec Section 7 Empty States */
              <div className="rounded-lg border border-dashed border-[#DDD5C7] bg-[#FCF9F4] py-12 px-6 text-center">
                <p className="font-display text-lg text-[#1F1B18]">
                  {activeCrateId ? 'This crate is empty.' : 'No tracks found.'}
                </p>
                <p className="mt-1 text-xs text-[#5C534A]">
                  {activeCrateId
                    ? 'Open any track in the feed to add it to this crate.'
                    : 'Share a SoundCloud or YouTube link, or adjust your tag filters.'}
                </p>
              </div>
            ) : (
              <>
                {/* Masonry Discovery Grid */}
                <div className="columns-1 md:columns-2 gap-4 space-y-4">
                  {displayedPosts.map((post, idx) => {
                    const isCurrent = currentTrack?.id === post.id;
                    const isQueued = queue.some((q) => q.id === post.id);
                    const queueTrack = postToQueueTrack(post, feedTitle);

                    return (
                      <article
                        key={post.id}
                        className={`break-inside-avoid rounded-lg border bg-[#FCF9F4] overflow-hidden transition-colors ${
                          isCurrent ? 'border-[#B84A2E]' : 'border-[#DDD5C7]'
                        }`}
                      >
                        {/* Artwork Header with Zero-Broken-Image Fallback */}
                        <div
                          className={`relative w-full overflow-hidden border-b border-[#DDD5C7] flex items-center justify-center text-[#FCF9F4] ${
                            idx % 2 === 0 ? 'aspect-video' : 'aspect-[4/3]'
                          }`}
                          style={{ backgroundColor: queueTrack.coverTone }}
                        >
                          {post.thumbnailUrl ? (
                            <img
                              src={post.thumbnailUrl}
                              alt={`${post.title} cover artwork`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Radio className="w-8 h-8 opacity-75" />
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              isCurrent ? togglePlay() : playTrack(queueTrack)
                            }
                            aria-label={
                              isCurrent && isPlaying
                                ? `Pause ${post.title}`
                                : `Play ${post.title}`
                            }
                            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#B84A2E] text-[#FCF9F4] flex items-center justify-center shadow-md hover:bg-[#9E3D24] cursor-pointer"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="p-4 space-y-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedPost(post)}
                              className="text-left font-display text-base font-semibold text-[#1F1B18] hover:text-[#B84A2E] leading-snug cursor-pointer"
                            >
                              {post.title}
                            </button>
                            <p className="text-xs text-[#5C534A] mt-0.5">
                              {post.artistName}
                            </p>
                          </div>

                          <p className="text-[11px] text-[#5C534A]">
                            <button
                              type="button"
                              onClick={() => setProfileTarget(post.author.username)}
                              className="font-medium text-[#1F1B18] hover:text-[#B84A2E] cursor-pointer"
                            >
                              @{post.author.username}
                            </button>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span>
                              {post.provider === 'youtube' ? 'YouTube' : 'SoundCloud'}
                            </span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              {formatDuration(post.durationSeconds)}
                            </span>
                          </p>

                          {post.tags.length > 0 && (
                            <p className="text-xs text-[#5C534A] truncate">
                              {post.tags.map((t) => `#${t}`).join(' · ')}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 border-t border-[#DDD5C7]/70 pt-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => togglePostLike(post)}
                                aria-label="Like track"
                                className={`inline-flex items-center gap-1 text-xs cursor-pointer ${
                                  post.likedByViewer
                                    ? 'text-[#B84A2E] font-medium'
                                    : 'text-[#5C534A] hover:text-[#1F1B18]'
                                }`}
                              >
                                <Heart className="w-3.5 h-3.5" />
                                <span className="font-mono-tabular">
                                  {post.likeCount}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePostBookmark(post)}
                                aria-label="Bookmark track"
                                className={`inline-flex items-center gap-1 text-xs cursor-pointer ${
                                  post.bookmarkedByViewer
                                    ? 'text-[#9A6721] font-medium'
                                    : 'text-[#5C534A] hover:text-[#1F1B18]'
                                }`}
                              >
                                <Bookmark className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPost(post)}
                                aria-label="Open comments"
                                className="inline-flex items-center gap-1 text-xs text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="font-mono-tabular">
                                  {post.commentCount}
                                </span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {canManageCrate && activeCrateId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveFromCrate(activeCrateId, post.id)
                                  }
                                  aria-label="Remove from crate"
                                  className="p-1.5 rounded border border-[#DDD5C7] text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isCurrent || isQueued}
                                onClick={() => enqueueTrack(queueTrack)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DDD5C7] bg-[#F7F3EC] text-[11px] font-medium text-[#1F1B18] hover:border-[#B84A2E] hover:text-[#B84A2E] disabled:opacity-50 disabled:cursor-default shrink-0 cursor-pointer"
                              >
                                <ListPlus className="w-3.5 h-3.5" />
                                <span>
                                  {isCurrent
                                    ? 'Playing'
                                    : isQueued
                                      ? 'Queued'
                                      : 'Queue'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {nextCursor && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => loadFeed(nextCursor)}
                      className="px-5 py-2 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] disabled:opacity-50 cursor-pointer"
                    >
                      {loadingMore ? 'Loading more...' : 'Load more tracks'}
                    </button>
                  </div>
                )}
              </>
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
        onAuthenticated={(user) => {
          setSessionUser(user);
          loadFeed(null);
          loadCrates();
        }}
      />

      <ShareTrackModal
        isOpen={shareModalOpen}
        crates={crates}
        onClose={() => setShareModalOpen(false)}
        onCreated={(newPost) => {
          setFeedPosts((prev) => [newPost, ...prev]);
          loadCrates();
        }}
      />

      <CreateCrateModal
        isOpen={createCrateOpen}
        onClose={() => setCreateCrateOpen(false)}
        onCreated={(newCrate) => {
          setCrates((prev) => [newCrate, ...prev]);
          handleSelectCrate(newCrate.id);
        }}
      />

      <PostDetailModal
        post={selectedPost}
        crates={crates}
        sessionUser={sessionUser}
        onClose={() => setSelectedPost(null)}
        onToggleLike={togglePostLike}
        onToggleBookmark={togglePostBookmark}
        onAddToCrate={handleAddToCrate}
        onOpenProfile={(username) => {
          setSelectedPost(null);
          setProfileTarget(username);
        }}
        onPostRemoved={(postId) => {
          setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
        }}
      />

      <ProfileDrawer
        targetUser={profileTarget}
        sessionUser={sessionUser}
        onClose={() => setProfileTarget(null)}
        onSelectCrate={(crateId) => handleSelectCrate(crateId)}
      />
    </div>
  );
}
