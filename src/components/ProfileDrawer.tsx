import { useEffect, useState } from 'react';
import { UserCheck, UserPlus, X } from 'lucide-react';
import type { UserProfileResponse } from '../types/hub';
import type { SessionUser } from './AuthGateModal';

interface ProfileDrawerProps {
  targetUser: string | null;
  sessionUser: SessionUser | null;
  onClose: () => void;
  onSelectCrate: (crateId: string) => void;
}

export function ProfileDrawer({
  targetUser,
  sessionUser,
  onClose,
  onSelectCrate,
}: ProfileDrawerProps) {
  const [data, setData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => {
    if (!targetUser) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/users/${encodeURIComponent(targetUser)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'Unable to load profile.');
        }
        return json as UserProfileResponse;
      })
      .then((profileData) => {
        if (!cancelled) {
          setData(profileData);
          setBioDraft(profileData.profile.bio ?? '');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load profile.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetUser]);

  if (!targetUser) return null;

  const isOwnProfile = Boolean(sessionUser && data && sessionUser.id === data.profile.id);

  const handleToggleFollow = async () => {
    if (!data || !sessionUser) return;
    const method = data.profile.isFollowedByViewer ? 'DELETE' : 'POST';
    const res = await fetch('/api/follows', {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followedId: data.profile.id }),
    });
    if (res.ok) {
      const json = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                isFollowedByViewer: json.following,
                followerCount: json.followerCount,
              },
            }
          : prev,
      );
    }
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft }),
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  bio: json.user.bio ?? null,
                },
              }
            : prev,
        );
      }
    } finally {
      setSavingBio(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#1F1B18]/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-full max-w-md h-full bg-[#FCF9F4] border-l border-[#DDD5C7] flex flex-col shadow-xl">
        <div className="flex items-center justify-between border-b border-[#DDD5C7] px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-[#1F1B18]">
            Curator Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile drawer"
            className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-40 rounded bg-[#EFE9DE] animate-pulse" />
              <div className="h-16 rounded bg-[#EFE9DE] animate-pulse" />
            </div>
          ) : error ? (
            <p className="text-sm text-[#9E3D24]">{error}</p>
          ) : data ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-semibold text-[#1F1B18]">
                      @{data.profile.username}
                    </h3>
                    <p className="mt-1 font-mono-tabular text-xs text-[#5C534A]">
                      {data.profile.followerCount} followers ·{' '}
                      {data.profile.followingCount} following
                    </p>
                  </div>

                  {sessionUser && !isOwnProfile && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer ${
                        data.profile.isFollowedByViewer
                          ? 'border border-[#DDD5C7] bg-[#EFE9DE] text-[#1F1B18]'
                          : 'bg-[#B84A2E] text-[#FCF9F4]'
                      }`}
                    >
                      {data.profile.isFollowedByViewer ? (
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

                {isOwnProfile ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      placeholder="Write a short note about your taste and crates..."
                      className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]"
                    />
                    <button
                      type="button"
                      disabled={savingBio}
                      onClick={handleSaveBio}
                      className="px-3 py-1.5 rounded bg-[#1F1B18] text-xs font-medium text-[#FCF9F4] cursor-pointer"
                    >
                      {savingBio ? 'Saving...' : 'Save Bio'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#5C534A] leading-relaxed">
                    {data.profile.bio || 'No bio added yet.'}
                  </p>
                )}
              </div>

              <div className="border-t border-[#DDD5C7] pt-5 space-y-3">
                <h4 className="text-xs font-semibold tracking-wider text-[#5C534A] uppercase">
                  Crates ({data.crates.length})
                </h4>
                {data.crates.length === 0 ? (
                  <p className="text-xs text-[#5C534A]">No public crates yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.crates.map((crate) => (
                      <li key={crate.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCrate(crate.id);
                            onClose();
                          }}
                          className="w-full text-left rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                        >
                          {crate.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-[#DDD5C7] pt-5 space-y-3">
                <h4 className="text-xs font-semibold tracking-wider text-[#5C534A] uppercase">
                  Liked Tracks ({data.likedPosts.length})
                </h4>
                {data.likedPosts.length === 0 ? (
                  <p className="text-xs text-[#5C534A]">No liked tracks yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.likedPosts.map((liked) => (
                      <li
                        key={liked.id}
                        className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2"
                      >
                        <p className="text-xs font-medium text-[#1F1B18] truncate">
                          {liked.title || 'Untitled Track'}
                        </p>
                        <p className="text-[11px] text-[#5C534A] truncate">
                          {liked.artistName || 'Unknown Artist'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
