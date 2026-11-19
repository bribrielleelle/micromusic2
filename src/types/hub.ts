import type { MediaProvider, QueueTrack } from '../store/playerStore';

export interface PostAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
  isVerifiedArtist?: boolean;
  verifiedArtistName?: string | null;
}

export interface FeedPost {
  id: string;
  userId: string;
  mediaUrl: string;
  provider: MediaProvider;
  title: string;
  artistName: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  tags: string[];
  viewCount: number;
  isHidden: boolean;
  createdAt: string;
  author: PostAuthor;
  likeCount: number;
  bookmarkCount: number;
  commentCount: number;
  likedByViewer: boolean;
  bookmarkedByViewer: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  body: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
  isVerifiedArtist?: boolean;
  verifiedArtistName?: string | null;
}

export interface HubCrate {
  id: string;
  ownerId: string;
  ownerUsername?: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  itemCount: number;
}

export interface CrateDetailResponse {
  crate: Omit<HubCrate, 'itemCount'>;
  items: Array<{
    crateId: string;
    postId: string;
    addedBy: string;
    position: number;
    addedAt: string;
    post: FeedPost;
  }>;
}

export interface UserProfileResponse {
  profile: {
    id: string;
    username: string;
    bio: string | null;
    links: Record<string, string> | null;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    isVerifiedArtist?: boolean;
    verifiedArtistName?: string | null;
    createdAt: string;
    followerCount: number;
    followingCount: number;
    isFollowedByViewer: boolean;
  };
  crates: Array<Omit<HubCrate, 'itemCount'>>;
  likedPosts: Array<{
    id: string;
    title: string | null;
    artistName: string | null;
    mediaUrl: string;
    thumbnailUrl: string | null;
  }>;
}

export interface ArtistVerificationRequestItem {
  id: string;
  userId: string;
  artistName: string;
  portfolioUrl: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  username?: string;
  email?: string;
}

export interface DmcaReportItem {
  id: string;
  postId: string | null;
  claimantName: string;
  reporterEmail: string;
  reason: string;
  rightsUrl: string | null;
  status: 'open' | 'takedown_applied' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
  postTitle: string | null;
  postMediaUrl: string | null;
  postIsHidden: boolean | null;
}

export interface EmailAlertLogItem {
  id: string;
  recipientEmail: string;
  alertType: string;
  subject: string;
  providerMessageId: string | null;
  deliveryStatus: 'sent' | 'logged_unconfigured' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminOverviewResponse {
  stats: {
    usersCount: number;
    postsCount: number;
    flaggedPostsCount: number;
    verifiedArtistsCount: number;
    openDmcaCount: number;
    pendingVerificationsCount: number;
  };
  resendConfigured: boolean;
  adminAlertEmail: string | null;
  flaggedPosts: Array<{
    id: string;
    title: string | null;
    artistName: string | null;
    mediaUrl: string;
    isHidden: boolean;
    createdAt: string;
    authorUsername: string;
    authorIsVerifiedArtist: boolean;
  }>;
  dmcaReports: DmcaReportItem[];
  verificationRequests: ArtistVerificationRequestItem[];
  members: Array<{
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
    isVerifiedArtist: boolean;
    verifiedArtistName: string | null;
    createdAt: string;
  }>;
  invites: Array<{
    code: string;
    createdBy: string | null;
    usedBy: string | null;
    createdAt: string;
  }>;
  emailAlerts: EmailAlertLogItem[];
}

export interface CommunityCuratorItem {
  id: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  isVerifiedArtist: boolean;
  verifiedArtistName: string | null;
  createdAt: string;
  followerCount: number;
  isFollowedByViewer: boolean;
}

export interface SoundCloudTrackPayload {
  id: string | number;
  title: string;
  artist: string;
  genre?: string | null;
  bpm?: number | null;
  tagList?: string[];
  mood?: string | null;
  playbackCount?: number | null;
  durationSeconds?: number | null;
  likedAt?: string | null;
  permalinkUrl?: string | null;
}

export interface SoundCloudOAuthStatus {
  oauthConfigured: boolean;
  callbackUrl: string;
  connected: boolean;
  user: {
    id: number;
    username: string;
    permalinkUrl: string | null;
    avatarUrl: string | null;
  } | null;
  likedTracks: SoundCloudTrackPayload[];
}

export interface TasteEngineResponse {
  analyzedCount: number;
  trackIds: string[];
  newlyAddedCount: number;
  newlyAddedTrackTitles: string[];
  analysis: {
    sonicProfile: {
      summary: string;
      dominantGenres: string[];
      moods: string[];
      tempoRangeBpm: string;
      undergroundPercentage: number;
      mainstreamVsUndergroundBalance: string;
      vibeKeywords: string[];
    };
    discoveryCrate: {
      title: string;
      description: string;
      aestheticMood: string;
      tracks: Array<{
        postId: string;
        whyItFits: string;
        matchScore: number;
      }>;
    };
    recommendedTastemakers: Array<{
      username: string;
      overlapPercent: number;
      sharedGenres: string[];
      reason: string;
    }>;
    realtimeAdaptationNote: string;
  };
  hydratedPosts: Record<string, FeedPost> | null;
  generatedAt: string;
}

const COVER_TONES = ['#2E2622', '#394037', '#523B2B', '#23282D', '#43302E'];
const COVER_ACCENTS = ['#B84A2E', '#C68B3C', '#9E3D24', '#8A6331'];

export function postToQueueTrack(post: FeedPost, crateName = 'Discovery Feed'): QueueTrack {
  const hash = post.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return {
    id: post.id,
    mediaUrl: post.mediaUrl,
    provider: post.provider,
    title: post.title,
    artistName: post.artistName,
    curatorHandle: `@${post.author.username}`,
    curatorVerified: Boolean(post.author.isVerifiedArtist),
    curatorArtistName: post.author.verifiedArtistName ?? null,
    thumbnailUrl: post.thumbnailUrl,
    durationSeconds: post.durationSeconds || 240,
    tags: post.tags,
    crateName,
    coverTone: COVER_TONES[hash % COVER_TONES.length],
    coverAccent: COVER_ACCENTS[hash % COVER_ACCENTS.length],
  };
}
