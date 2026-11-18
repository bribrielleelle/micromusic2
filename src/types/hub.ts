import type { MediaProvider, QueueTrack } from '../store/playerStore';

export interface PostAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
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
    thumbnailUrl: post.thumbnailUrl,
    durationSeconds: post.durationSeconds || 240,
    tags: post.tags,
    crateName,
    coverTone: COVER_TONES[hash % COVER_TONES.length],
    coverAccent: COVER_ACCENTS[hash % COVER_ACCENTS.length],
  };
}
