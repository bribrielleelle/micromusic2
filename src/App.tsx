import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Heart,
  ListPlus,
  Menu,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  formatDuration,
  INITIAL_TRACKS,
  type NavSection,
  usePlayerStore,
} from './store/playerStore';
import {
  clearVibeProfile,
  getArchetypeById,
  loadVibeProfile,
  saveVibeProfile,
  type StoredVibeProfile,
  type VibeArchetype,
} from './store/vibeQuiz';
import {
  postToQueueTrack,
  type ArtistVerificationRequestItem,
  type CrateDetailResponse,
  type FeedPost,
  type HubCrate,
} from './types/hub';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AuthGateModal, type SessionUser } from './components/AuthGateModal';
import { CreateCrateModal } from './components/CreateCrateModal';
import { NowPlayingCard } from './components/NowPlayingCard';
import { PersistentFooter } from './components/PersistentFooter';
import { PostDetailModal } from './components/PostDetailModal';
import { ProfileDrawer } from './components/ProfileDrawer';
import { QueueDrawer } from './components/QueueDrawer';
import { ShareTrackModal } from './components/ShareTrackModal';
import { SidebarNav } from './components/SidebarNav';
import { VerifiedBadge } from './components/VerifiedBadge';
import { VibeQuizModal } from './components/VibeQuizModal';
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
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createCrateOpen, setCreateCrateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [profileTarget, setProfileTarget] = useState<string | null>(null);

  const [vibeProfile, setVibeProfile] = useState<StoredVibeProfile | null>(() =>
    loadVibeProfile(),
  );
  const [vibeQuizOpen, setVibeQuizOpen] = useState(false);
  const [vibeQuizInitialArchetype, setVibeQuizInitialArchetype] =
    useState<VibeArchetype | null>(null);
  const [vibeBannerDismissed, setVibeBannerDismissed] = useState(false);

  const vibeArchetype = useMemo(
    () => getArchetypeById(vibeProfile?.archetypeId),
    [vibeProfile],
  );

  // Phase 5: Verified Artist claim state (Settings)
  const [verificationRequest, setVerificationRequest] =
    useState<ArtistVerificationRequestItem | null>(null);
  const [claimArtistName, setClaimArtistName] = useState('');
  const [claimPortfolioUrl, setClaimPortfolioUrl] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

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
        } else if (!loadVibeProfile()) {
          setVibeQuizInitialArchetype(null);
          setVibeQuizOpen(true);
        }
      })
      .catch(() => {
        if (!loadVibeProfile()) {
          setVibeQuizInitialArchetype(null);
          setVibeQuizOpen(true);
        }
      });
    loadCrates();
  }, [loadCrates]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFeed(null);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleQuizSkip = () => {
    if (!vibeProfile?.archetypeId) {
      const skipped: StoredVibeProfile = {
        completedAt: null,
        skipped: true,
        archetypeId: null,
        answers: {},
        tagScores: {},
      };
      saveVibeProfile(skipped);
      setVibeProfile(skipped);
    }
    setVibeQuizOpen(false);
  };

  const handleQuizComplete = (profile: StoredVibeProfile) => {
    saveVibeProfile(profile);
    setVibeProfile(profile);
    setVibeBannerDismissed(false);
  };

  const handleExploreFeed = () => {
    setVibeQuizOpen(false);
    setActiveNav('Now Playing');
    setActiveCrateId(null);
    setBookmarksOnly(false);
    setActiveTag('all');
    setSearchQuery('');
    setVibeBannerDismissed(false);
  };

  const handleProceedToSignUp = () => {
    setVibeQuizOpen(false);
    openAuthModal('register');
  };

  const handleOpenQuizRetake = () => {
    setVibeQuizInitialArchetype(null);
    setVibeQuizOpen(true);
  };

  const handleOpenSavedReveal = () => {
    if (!vibeArchetype) return;
    setVibeQuizInitialArchetype(vibeArchetype);
    setVibeQuizOpen(true);
  };

  const handleResetVibeProfile = () => {
    clearVibeProfile();
    setVibeProfile(null);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setSessionUser(null);
    loadFeed(null);
  };

  const displayedPosts = useMemo(() => {
    const baseList = databaseConnected
      ? feedPosts
      : feedPosts.filter((post) => {
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

    if (
      vibeArchetype &&
      activeTag === 'all' &&
      !searchQuery.trim() &&
      !activeCrateId &&
      !bookmarksOnly
    ) {
      return [...baseList].sort((a, b) => {
        const matchA = a.tags.filter((t) => vibeArchetype.feedTags.includes(t)).length;
        const matchB = b.tags.filter((t) => vibeArchetype.feedTags.includes(t)).length;
        return matchB - matchA;
      });
    }

    return baseList;
  }, [
    databaseConnected,
    feedPosts,
    activeTag,
    searchQuery,
    bookmarksOnly,
    activeCrateId,
    vibeArchetype,
  ]);

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
      openAuthModal('login');
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
      openAuthModal('login');
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
      openAuthModal('login');
      return;
    }
    onAuthorized();
  };

  const isSettingsView =
    activeNav === 'Settings' && !activeCrateId && !bookmarksOnly;
  const isAdminView =
    activeNav === 'Admin' &&
    sessionUser?.role === 'admin' &&
    !activeCrateId &&
    !bookmarksOnly;

  useEffect(() => {
    if (!sessionUser) {
      setVerificationRequest(null);
      return;
    }
    fetch('/api/artist-verification/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.latestRequest) {
          setVerificationRequest(data.latestRequest);
        }
      })
      .catch(() => {});
  }, [sessionUser]);

  const handleSubmitVerificationClaim = async (e: FormEvent) => {
    e.preventDefault();
    setClaimFeedback(null);
    setClaimSubmitting(true);
    try {
      const res = await fetch('/api/artist-verification/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: claimArtistName,
          portfolioUrl: claimPortfolioUrl,
          notes: claimNotes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClaimFeedback(data?.error || 'Unable to submit Verified Artist claim.');
        return;
      }
      if (data?.request) {
        setVerificationRequest(data.request);
        setClaimArtistName('');
        setClaimPortfolioUrl('');
        setClaimNotes('');
        setClaimFeedback('Verification application submitted for admin review.');
      }
    } catch {
      setClaimFeedback('Network error submitting verification request.');
    } finally {
      setClaimSubmitting(false);
    }
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
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1F1B18]"
            >
              <span>@{sessionUser.username}</span>
              {sessionUser.isVerifiedArtist && (
                <VerifiedBadge artistName={sessionUser.verifiedArtistName} />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
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
                openAuthModal('login');
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
              onOpenAuth={() => openAuthModal('login')}
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

          {isSettingsView ? (
            <section className="space-y-6">
              <div className="border-b border-[#DDD5C7] pb-3">
                <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
                  Settings &amp; Taste Profile
                </h2>
                <p className="text-xs text-[#5C534A]">
                  Tune your listener archetype, matched artists, and SONA account access.
                </p>
              </div>

              {/* Taste Profile / Retake Quiz Card */}
              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <p className="text-xs font-semibold text-[#B84A2E]">
                      Vibe Quiz Profile
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-[#1F1B18]">
                      {vibeArchetype
                        ? vibeArchetype.name
                        : 'No taste profile saved yet'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5C534A] leading-relaxed">
                      {vibeArchetype
                        ? vibeArchetype.description
                        : 'Answer 7 quick questions across music, late-night foods, and daily rituals (~45 seconds) to get a custom archetype, artist recommendations, and a tuned feed.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {vibeArchetype && (
                      <button
                        type="button"
                        onClick={handleOpenSavedReveal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#B84A2E]" />
                        <span>View Taste Reveal</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenQuizRetake}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{vibeArchetype ? 'Retake Vibe Quiz' : 'Take Vibe Quiz'}</span>
                    </button>
                  </div>
                </div>

                {vibeArchetype && (
                  <div className="border-t border-[#DDD5C7] pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#5C534A]">
                      <span className="font-medium text-[#1F1B18]">
                        Matched Artists (Mainstream → Deep Cuts)
                      </span>
                      <button
                        type="button"
                        onClick={handleResetVibeProfile}
                        className="text-xs text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                      >
                        Clear saved taste profile
                      </button>
                    </div>
                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {vibeArchetype.artists.map((artist, idx) => (
                        <li
                          key={artist.name}
                          className="rounded-lg border border-[#DDD5C7] bg-[#F7F3EC] px-3.5 py-2.5 flex items-start gap-2.5"
                        >
                          <span className="font-mono-tabular text-[11px] font-semibold text-[#B84A2E] pt-0.5">
                            0{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#1F1B18]">
                              {artist.name}
                            </p>
                            <p className="text-[11px] text-[#5C534A] leading-snug">
                              {artist.reason}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Account & Invite Access Card */}
              <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#5C534A]">
                    Member Account
                  </p>
                  {sessionUser ? (
                    <>
                      <h3 className="font-display text-lg font-semibold text-[#1F1B18]">
                        @{sessionUser.username}
                      </h3>
                      <p className="text-xs text-[#5C534A]">
                        {sessionUser.email}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>Role: {sessionUser.role}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-display text-lg font-semibold text-[#1F1B18]">
                        Browsing as Guest
                      </h3>
                      <p className="text-xs text-[#5C534A]">
                        Join SONA with an invite code to share tracks, comment, and build crates.
                      </p>
                    </>
                  )}
                </div>

                {sessionUser ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileTarget(sessionUser.username)}
                      className="px-3.5 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3.5 py-2 rounded-md border border-[#DDD5C7] text-xs font-medium text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="px-3.5 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthModal('register')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Join with Invite</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Verified Artist Badge Claim Card (Phase 5 / v1.1) */}
              {sessionUser && (
                <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#B84A2E]">
                        Verified Artist Program
                      </p>
                      <h3 className="font-display text-lg font-semibold text-[#1F1B18] flex items-center gap-1.5">
                        {sessionUser.isVerifiedArtist ? (
                          <>
                            <span>Verified Artist Active</span>
                            <VerifiedBadge
                              artistName={sessionUser.verifiedArtistName}
                            />
                          </>
                        ) : (
                          <span>Claim Verified Artist Badge</span>
                        )}
                      </h3>
                      <p className="text-xs text-[#5C534A]">
                        {sessionUser.isVerifiedArtist
                          ? `Your profile carries the Verified Artist badge${sessionUser.verifiedArtistName ? ` as ${sessionUser.verifiedArtistName}` : ''} across feeds, crates, and comments.`
                          : 'Share your official SoundCloud, YouTube, or Bandcamp artist link for admin verification.'}
                      </p>
                    </div>
                  </div>

                  {!sessionUser.isVerifiedArtist && (
                    verificationRequest?.status === 'pending' ? (
                      <div className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-4 py-3 text-xs text-[#5C534A]">
                        Application pending review for{' '}
                        <span className="font-semibold text-[#1F1B18]">
                          {verificationRequest.artistName}
                        </span>{' '}
                        ({verificationRequest.portfolioUrl}).
                      </div>
                    ) : (
                      <form
                        onSubmit={handleSubmitVerificationClaim}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      >
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#1F1B18]">
                            Artist / Project Name
                          </span>
                          <input
                            type="text"
                            required
                            value={claimArtistName}
                            onChange={(e) => setClaimArtistName(e.target.value)}
                            placeholder="e.g. Forss"
                            className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#1F1B18]">
                            Official Artist Link (https://)
                          </span>
                          <input
                            type="url"
                            required
                            value={claimPortfolioUrl}
                            onChange={(e) => setClaimPortfolioUrl(e.target.value)}
                            placeholder="https://soundcloud.com/your-handle"
                            className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                          />
                        </label>
                        <label className="sm:col-span-2 block space-y-1">
                          <span className="text-xs font-medium text-[#1F1B18]">
                            Verification Notes (optional)
                          </span>
                          <input
                            type="text"
                            value={claimNotes}
                            onChange={(e) => setClaimNotes(e.target.value)}
                            placeholder="Link matching your artist bio or release catalog..."
                            className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                          />
                        </label>
                        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
                          {claimFeedback ? (
                            <p className="text-xs text-[#9E3D24]">{claimFeedback}</p>
                          ) : (
                            <span className="text-[11px] text-[#5C534A]">
                              {verificationRequest?.status === 'rejected'
                                ? 'Previous claim was declined — submit updated details.'
                                : 'Reviewed by SONA admins.'}
                            </span>
                          )}
                          <button
                            type="submit"
                            disabled={claimSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1F1B18] text-xs font-semibold text-[#FCF9F4] hover:bg-[#B84A2E] disabled:opacity-50 cursor-pointer"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>
                              {claimSubmitting ? 'Submitting...' : 'Submit Claim'}
                            </span>
                          </button>
                        </div>
                      </form>
                    )
                  )}
                </div>
              )}
            </section>
          ) : isAdminView && sessionUser ? (
            <AdminDashboardView
              sessionUser={sessionUser}
              onFeedChanged={() => loadFeed(null)}
            />
          ) : (
            <section className="space-y-4">
              {!vibeBannerDismissed && !activeCrateId && !bookmarksOnly && (
                vibeArchetype ? (
                  <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#B84A2E]">
                        Tuned for {vibeArchetype.name}
                      </p>
                      <p className="text-xs text-[#5C534A]">
                        Prioritizing{' '}
                        <span className="font-medium text-[#1F1B18]">
                          {vibeArchetype.artists
                            .slice(0, 3)
                            .map((a) => a.name)
                            .join(', ')}
                        </span>{' '}
                        vibes and{' '}
                        {vibeArchetype.feedTags.map((t) => `#${t}`).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenSavedReveal}
                        className="px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                      >
                        View Reveal
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenQuizRetake}
                        className="px-3 py-1.5 rounded-md border border-[#DDD5C7] text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                      >
                        Retake
                      </button>
                      {!sessionUser && (
                        <button
                          type="button"
                          onClick={() => openAuthModal('register')}
                          className="px-3 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                        >
                          Sign Up
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setVibeBannerDismissed(true)}
                        aria-label="Dismiss vibe summary"
                        className="p-1 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  !sessionUser && (
                    <div className="rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#5C534A]">
                        Want tailored artist &amp; track picks before joining? Take the 45-second Vibe Quiz.
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleOpenQuizRetake}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Take Vibe Quiz</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVibeBannerDismissed(true)}
                          aria-label="Dismiss vibe quiz prompt"
                          className="p-1 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )
              )}

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
                              className="inline-flex items-center gap-1 font-medium text-[#1F1B18] hover:text-[#B84A2E] cursor-pointer"
                            >
                              <span>@{post.author.username}</span>
                              {post.author.isVerifiedArtist && (
                                <VerifiedBadge artistName={post.author.verifiedArtistName} />
                              )}
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
          )}
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

      <VibeQuizModal
        isOpen={vibeQuizOpen}
        recommendedPool={feedPosts}
        initialArchetype={vibeQuizInitialArchetype}
        isSignedIn={Boolean(sessionUser)}
        onSkip={handleQuizSkip}
        onComplete={handleQuizComplete}
        onProceedToSignUp={handleProceedToSignUp}
        onExploreFeed={handleExploreFeed}
      />

      <AuthGateModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
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
