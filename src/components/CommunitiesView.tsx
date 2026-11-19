import { useEffect, useState } from 'react';
import { Disc3, FolderPlus, UserCheck, UserPlus } from 'lucide-react';
import type { CommunityCuratorItem, FeedPost, HubCrate } from '../types/hub';
import type { SessionUser } from './AuthGateModal';
import { VerifiedBadge } from './VerifiedBadge';

interface CommunitiesViewProps {
  crates: HubCrate[];
  fallbackPosts: FeedPost[];
  sessionUser: SessionUser | null;
  databaseConnected: boolean;
  onSelectCrate: (crateId: string) => void;
  onCreateCrate: () => void;
  onOpenProfile: (username: string) => void;
  onRequireAuth: () => void;
}

export function CommunitiesView({
  crates,
  fallbackPosts,
  sessionUser,
  databaseConnected,
  onSelectCrate,
  onCreateCrate,
  onOpenProfile,
  onRequireAuth,
}: CommunitiesViewProps) {
  const [curators, setCurators] = useState<CommunityCuratorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/communities', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.databaseConfigured && Array.isArray(data.curators)) {
          setCurators(data.curators as CommunityCuratorItem[]);
        } else {
          // Derive clean curator cards from local feed posts when offline
          const seen = new Map<string, CommunityCuratorItem>();
          for (const post of fallbackPosts) {
            if (!seen.has(post.author.username)) {
              seen.set(post.author.username, {
                id: post.author.id,
                username: post.author.username,
                bio: 'Community crate selector & analog music enthusiast.',
                avatarUrl: post.author.avatarUrl,
                role: 'user',
                isVerifiedArtist: Boolean(post.author.isVerifiedArtist),
                verifiedArtistName: post.author.verifiedArtistName ?? null,
                createdAt: post.createdAt,
                followerCount: 12 + seen.size * 5,
                isFollowedByViewer: false,
              });
            }
          }
          setCurators(Array.from(seen.values()));
        }
      })
      .catch(() => {
        if (!cancelled) setCurators([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackPosts, sessionUser?.id]);

  const handleToggleFollow = async (curator: CommunityCuratorItem) => {
    if (!databaseConnected) {
      setCurators((prev) =>
        prev.map((c) =>
          c.id === curator.id
            ? {
                ...c,
                isFollowedByViewer: !c.isFollowedByViewer,
                followerCount: c.isFollowedByViewer
                  ? Math.max(0, c.followerCount - 1)
                  : c.followerCount + 1,
              }
            : c,
        ),
      );
      return;
    }

    if (!sessionUser) {
      onRequireAuth();
      return;
    }

    const method = curator.isFollowedByViewer ? 'DELETE' : 'POST';
    const res = await fetch('/api/follows', {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followedId: curator.id }),
    });
    if (res.ok) {
      const json = await res.json();
      setCurators((prev) =>
        prev.map((c) =>
          c.id === curator.id
            ? {
                ...c,
                isFollowedByViewer: Boolean(json.following),
                followerCount: Number(json.followerCount ?? c.followerCount),
              }
            : c,
        ),
      );
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-[#DDD5C7] pb-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            Communities &amp; Selectors
          </h2>
          <p className="text-xs text-[#5C534A]">
            Verified artists, crate curators, and public listening boards across SONA
          </p>
        </div>
        <span className="font-mono-tabular text-xs text-[#5C534A]">
          {curators.length} curators
        </span>
      </div>

      {/* Curators & Verified Artists */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wider text-[#5C534A] uppercase">
          Curators &amp; Verified Artists
        </h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-28 rounded-lg border border-[#DDD5C7] bg-[#FCF9F4] animate-pulse"
              />
            ))}
          </div>
        ) : curators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#DDD5C7] bg-[#FCF9F4] py-8 px-5 text-center">
            <p className="text-xs text-[#5C534A]">
              No community curators registered yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curators.map((curator) => {
              const isSelf = sessionUser?.id === curator.id;
              return (
                <article
                  key={curator.id}
                  className="rounded-lg border border-[#DDD5C7] bg-[#FCF9F4] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 shrink-0 rounded-full border border-[#DDD5C7] bg-[#EFE9DE] overflow-hidden flex items-center justify-center font-display text-base font-semibold text-[#1F1B18]">
                        {curator.avatarUrl && !failedAvatars[curator.id] ? (
                          <img
                            src={curator.avatarUrl}
                            alt={`${curator.username} avatar`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedAvatars((prev) => ({ ...prev, [curator.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{curator.username.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenProfile(curator.username)}
                          className="inline-flex items-center gap-1 font-display text-base font-semibold text-[#1F1B18] hover:text-[#B84A2E] truncate cursor-pointer"
                        >
                          <span className="truncate">@{curator.username}</span>
                          {curator.isVerifiedArtist && (
                            <VerifiedBadge artistName={curator.verifiedArtistName} />
                          )}
                        </button>
                        <p className="font-mono-tabular text-[11px] text-[#5C534A]">
                          {curator.followerCount} followers
                          {curator.isVerifiedArtist ? ' · Verified Artist' : ''}
                        </p>
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(curator)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold shrink-0 cursor-pointer ${
                          curator.isFollowedByViewer
                            ? 'border border-[#DDD5C7] bg-[#EFE9DE] text-[#1F1B18]'
                            : 'bg-[#B84A2E] text-[#FCF9F4] hover:bg-[#9E3D24]'
                        }`}
                      >
                        {curator.isFollowedByViewer ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[#5C534A] line-clamp-2 leading-relaxed">
                    {curator.bio || 'Curating SoundCloud and YouTube deep cuts on SONA.'}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Public Listening Crates */}
      <div className="border-t border-[#DDD5C7] pt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold tracking-wider text-[#5C534A] uppercase">
            Public Listening Crates ({crates.length})
          </h3>
          <button
            type="button"
            onClick={onCreateCrate}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Crate</span>
          </button>
        </div>

        {crates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#DDD5C7] bg-[#FCF9F4] py-8 px-5 text-center">
            <p className="text-xs text-[#5C534A]">
              No public crates yet. Start one to organize community tracks by mood or scene.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crates.map((crate) => (
              <button
                key={crate.id}
                type="button"
                onClick={() => onSelectCrate(crate.id)}
                className="text-left rounded-lg border border-[#DDD5C7] bg-[#FCF9F4] p-4 hover:border-[#B84A2E] transition-colors flex items-start gap-3.5 cursor-pointer"
              >
                <div className="w-16 h-16 shrink-0 rounded-md border border-[#DDD5C7] bg-[#EFE9DE] overflow-hidden flex items-center justify-center text-[#5C534A]">
                  {crate.coverUrl && !failedCovers[crate.id] ? (
                    <img
                      src={crate.coverUrl}
                      alt={`${crate.title} cover`}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedCovers((prev) => ({ ...prev, [crate.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Disc3 className="w-6 h-6 opacity-75" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-display text-base font-semibold text-[#1F1B18] truncate">
                      {crate.title}
                    </h4>
                    <span className="font-mono-tabular text-[11px] text-[#5C534A] shrink-0">
                      {crate.itemCount} tracks
                    </span>
                  </div>
                  {crate.ownerUsername && (
                    <p className="text-[11px] text-[#5C534A]">
                      Curated by @{crate.ownerUsername}
                    </p>
                  )}
                  <p className="text-xs text-[#5C534A] line-clamp-2">
                    {crate.description || 'Collaborative community listening crate.'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
