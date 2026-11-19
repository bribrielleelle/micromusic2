import { useEffect, useState, type ChangeEvent } from 'react';
import { ExternalLink, ImagePlus, Trash2, UserCheck, UserPlus, X } from 'lucide-react';
import type { UserProfileResponse } from '../types/hub';
import type { SessionUser } from './AuthGateModal';
import { VerifiedBadge } from './VerifiedBadge';

interface ProfileDrawerProps {
  targetUser: string | null;
  sessionUser: SessionUser | null;
  onClose: () => void;
  onSelectCrate: (crateId: string) => void;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
  const [avatarDraft, setAvatarDraft] = useState('');
  const [soundcloudLink, setSoundcloudLink] = useState('');
  const [bandcampLink, setBandcampLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    if (!targetUser) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaveNotice(null);
    setAvatarFailed(false);

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
          setAvatarDraft(profileData.profile.avatarUrl ?? '');
          const links = profileData.profile.links ?? {};
          setSoundcloudLink(links.soundcloud ?? '');
          setBandcampLink(links.bandcamp ?? '');
          setWebsiteLink(links.website ?? '');
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

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSaveNotice(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveNotice('Please choose a JPEG, PNG, or WebP avatar image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSaveNotice('Avatar image must be 5MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setUploadingAvatar(true);
      try {
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, folder: 'avatars' }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaveNotice(payload?.error || 'Avatar upload failed.');
          return;
        }
        if (payload?.url) {
          setAvatarDraft(payload.url);
          setAvatarFailed(false);
          setSaveNotice('Avatar uploaded — click Save Profile to publish.');
        }
      } catch {
        setSaveNotice('Network error uploading avatar.');
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSaveNotice(null);
    const linksPayload: Record<string, string> = {};
    if (soundcloudLink.trim().startsWith('https://')) {
      linksPayload.soundcloud = soundcloudLink.trim();
    }
    if (bandcampLink.trim().startsWith('https://')) {
      linksPayload.bandcamp = bandcampLink.trim();
    }
    if (websiteLink.trim().startsWith('https://')) {
      linksPayload.website = websiteLink.trim();
    }

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bioDraft,
          avatarUrl: avatarDraft.trim() || null,
          links: linksPayload,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveNotice(json?.error || 'Unable to update profile.');
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                bio: json.user.bio ?? null,
                avatarUrl: json.user.avatarUrl ?? null,
                links: json.user.links ?? null,
              },
            }
          : prev,
      );
      setAvatarFailed(false);
      setSaveNotice('Profile updated.');
    } catch {
      setSaveNotice('Network error updating profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const displayedAvatarUrl = isOwnProfile
    ? avatarDraft.trim() || null
    : data?.profile.avatarUrl || null;
  const profileLinks = Object.entries(data?.profile.links ?? {}).filter(
    ([, url]) => typeof url === 'string' && url.startsWith('https://'),
  );

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
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 shrink-0 rounded-full border border-[#DDD5C7] bg-[#EFE9DE] overflow-hidden flex items-center justify-center font-display text-lg font-semibold text-[#1F1B18]">
                      {displayedAvatarUrl && !avatarFailed ? (
                        <img
                          src={displayedAvatarUrl}
                          alt={`${data.profile.username} avatar`}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{data.profile.username.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl font-semibold text-[#1F1B18] flex items-center gap-1.5 flex-wrap">
                        <span>@{data.profile.username}</span>
                        {data.profile.isVerifiedArtist && (
                          <VerifiedBadge
                            showLabel
                            artistName={data.profile.verifiedArtistName}
                          />
                        )}
                      </h3>
                      <p className="mt-1 font-mono-tabular text-xs text-[#5C534A]">
                        {data.profile.followerCount} followers ·{' '}
                        {data.profile.followingCount} following
                      </p>
                    </div>
                  </div>

                  {sessionUser && !isOwnProfile && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold shrink-0 cursor-pointer ${
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
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#1F1B18]">
                          Avatar Image (max 5MB)
                        </span>
                        <label className="inline-flex items-center gap-1 text-xs font-medium text-[#B84A2E] hover:text-[#9E3D24] cursor-pointer">
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>{uploadingAvatar ? 'Uploading...' : 'Upload photo'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={uploadingAvatar}
                            onChange={handleAvatarUpload}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={avatarDraft}
                          onChange={(e) => {
                            setAvatarDraft(e.target.value);
                            setAvatarFailed(false);
                          }}
                          placeholder="https://... avatar URL"
                          className="flex-1 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-1.5 text-xs text-[#1F1B18]"
                        />
                        {avatarDraft && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarDraft('');
                              setAvatarFailed(false);
                            }}
                            aria-label="Clear avatar URL"
                            className="p-1.5 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-[#5C534A] hover:text-[#B84A2E] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-[#1F1B18]">Bio</span>
                      <textarea
                        rows={3}
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        placeholder="Write a short note about your taste and crates..."
                        className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-xs text-[#1F1B18]"
                      />
                    </label>

                    <div className="space-y-2">
                      <span className="text-xs font-medium text-[#1F1B18]">
                        External Links (https://)
                      </span>
                      <input
                        type="url"
                        value={soundcloudLink}
                        onChange={(e) => setSoundcloudLink(e.target.value)}
                        placeholder="SoundCloud URL (https://soundcloud.com/...)"
                        className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-1.5 text-xs text-[#1F1B18]"
                      />
                      <input
                        type="url"
                        value={bandcampLink}
                        onChange={(e) => setBandcampLink(e.target.value)}
                        placeholder="Bandcamp URL (https://...bandcamp.com)"
                        className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-1.5 text-xs text-[#1F1B18]"
                      />
                      <input
                        type="url"
                        value={websiteLink}
                        onChange={(e) => setWebsiteLink(e.target.value)}
                        placeholder="Personal Site / Catalog (https://...)"
                        className="w-full rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-1.5 text-xs text-[#1F1B18]"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        disabled={savingProfile || uploadingAvatar}
                        onClick={handleSaveProfile}
                        className="px-3.5 py-2 rounded bg-[#1F1B18] text-xs font-medium text-[#FCF9F4] hover:bg-[#B84A2E] disabled:opacity-50 cursor-pointer"
                      >
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                      </button>
                      {saveNotice && (
                        <span className="text-[11px] text-[#5C534A]">{saveNotice}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-sm text-[#5C534A] leading-relaxed">
                      {data.profile.bio || 'No bio added yet.'}
                    </p>
                    {profileLinks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                        {profileLinks.map(([label, url]) => (
                          <a
                            key={label}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#B84A2E] hover:underline capitalize"
                          >
                            <span>{label}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
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
