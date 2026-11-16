import { useEffect, useState, type FormEvent } from 'react';
import {
  Bookmark,
  CornerDownRight,
  Flag,
  Heart,
  Play,
  Radio,
  Trash2,
  X,
} from 'lucide-react';
import { formatDuration, usePlayerStore } from '../store/playerStore';
import { postToQueueTrack, type CommentItem, type FeedPost, type HubCrate } from '../types/hub';
import type { SessionUser } from './AuthGateModal';

interface PostDetailModalProps {
  post: FeedPost | null;
  crates: HubCrate[];
  sessionUser: SessionUser | null;
  onClose: () => void;
  onToggleLike: (post: FeedPost) => void;
  onToggleBookmark: (post: FeedPost) => void;
  onAddToCrate: (crateId: string, postId: string) => Promise<void>;
  onOpenProfile: (userIdOrHandle: string) => void;
  onPostRemoved: (postId: string) => void;
}

export function PostDetailModal({
  post,
  crates,
  sessionUser,
  onClose,
  onToggleLike,
  onToggleBookmark,
  onAddToCrate,
  onOpenProfile,
  onPostRemoved,
}: PostDetailModalProps) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const enqueueTrack = usePlayerStore((s) => s.enqueueTrack);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewCount, setViewCount] = useState<number>(post?.viewCount ?? 0);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [selectedCrateId, setSelectedCrateId] = useState('');
  const [crateNotice, setCrateNotice] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!post) return;
    setViewCount(post.viewCount);
    setReplyTo(null);
    setCommentError(null);
    setCrateNotice(null);

    let cancelled = false;
    setLoadingComments(true);

    // Fetch detail + comments on open
    fetch(`/api/posts/${encodeURIComponent(post.id)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.comments) {
          setComments(data.comments);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });

    // Log unique view when signed in
    if (sessionUser) {
      fetch(`/api/posts/${encodeURIComponent(post.id)}/view`, {
        method: 'POST',
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && typeof data?.viewCount === 'number') {
            setViewCount(data.viewCount);
          }
        })
        .catch(() => {});
    }

    // Client polling every 6 seconds for new comments (Spec Section 2 & Phase 4)
    const pollId = window.setInterval(() => {
      fetch(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.comments)) {
            setComments(data.comments);
          }
        })
        .catch(() => {});
    }, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [post?.id, sessionUser]);

  if (!post) return null;

  const topLevelComments = comments.filter((c) => c.parentId === null);
  const repliesByParent = new Map<string, CommentItem[]>();
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
  }

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setCommentError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          parentId: replyTo ? replyTo.id : null,
          body: commentBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data?.error || 'Unable to post comment.');
        return;
      }
      if (data?.comment) {
        setComments((prev) => [...prev, data.comment]);
        setCommentBody('');
        setReplyTo(null);
      }
    } catch {
      setCommentError('Network error posting comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parentId !== commentId),
      );
    }
  };

  const handleFlagPost = async () => {
    const res = await fetch(`/api/admin/posts/${encodeURIComponent(post.id)}/flag`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (res.ok) {
      onPostRemoved(post.id);
      onClose();
    }
  };

  const handleDeletePost = async () => {
    const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      onPostRemoved(post.id);
      onClose();
    }
  };

  const handleAddCrateSubmit = async () => {
    if (!selectedCrateId) return;
    setCrateNotice(null);
    try {
      await onAddToCrate(selectedCrateId, post.id);
      setCrateNotice('Added to crate.');
    } catch (err) {
      setCrateNotice(err instanceof Error ? err.message : 'Unable to add to crate.');
    }
  };

  const canDeletePost =
    sessionUser && (sessionUser.role === 'admin' || sessionUser.id === post.userId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-detail-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[#DDD5C7] bg-[#FCF9F4] shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDD5C7] px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs text-[#5C534A]">
              <button
                type="button"
                onClick={() => onOpenProfile(post.author.username)}
                className="font-semibold text-[#B84A2E] hover:underline cursor-pointer"
              >
                @{post.author.username}
              </button>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{post.provider === 'youtube' ? 'YouTube' : 'SoundCloud'}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span className="font-mono-tabular">{viewCount} views</span>
            </p>
            <h2
              id="post-detail-title"
              className="mt-1 font-display text-2xl font-semibold text-[#1F1B18] leading-snug"
            >
              {post.title}
            </h2>
            <p className="text-sm text-[#5C534A]">{post.artistName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post details"
            className="p-1.5 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cover + Actions */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-full sm:w-44 aspect-square shrink-0 rounded-lg border border-[#DDD5C7] bg-[#2E2622] overflow-hidden flex items-center justify-center text-[#FCF9F4]">
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
            </div>

            <div className="flex-1 space-y-4">
              {post.tags.length > 0 && (
                <p className="text-xs text-[#5C534A]">
                  {post.tags.map((t) => `#${t}`).join(' · ')}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => playTrack(postToQueueTrack(post))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Now ({formatDuration(post.durationSeconds)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => enqueueTrack(postToQueueTrack(post))}
                  className="px-3 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-medium text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                >
                  Add to Queue
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLike(post)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium cursor-pointer ${
                    post.likedByViewer
                      ? 'border-[#B84A2E]/40 bg-[#B84A2E]/10 text-[#B84A2E]'
                      : 'border-[#DDD5C7] bg-[#F7F3EC] text-[#5C534A]'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span className="font-mono-tabular">{post.likeCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(post)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium cursor-pointer ${
                    post.bookmarkedByViewer
                      ? 'border-[#C68B3C]/50 bg-[#C68B3C]/15 text-[#9A6721]'
                      : 'border-[#DDD5C7] bg-[#F7F3EC] text-[#5C534A]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{post.bookmarkedByViewer ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {crates.length > 0 && sessionUser && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedCrateId}
                    onChange={(e) => setSelectedCrateId(e.target.value)}
                    aria-label="Select crate"
                    className="rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-2.5 py-1.5 text-xs text-[#1F1B18]"
                  >
                    <option value="">Add to crate...</option>
                    {crates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedCrateId}
                    onClick={handleAddCrateSubmit}
                    className="px-3 py-1.5 rounded-md border border-[#DDD5C7] bg-[#EFE9DE] text-xs font-medium text-[#1F1B18] disabled:opacity-50 cursor-pointer"
                  >
                    Add
                  </button>
                  {crateNotice && (
                    <span className="text-xs text-[#5C534A]">{crateNotice}</span>
                  )}
                </div>
              )}

              {sessionUser && (
                <div className="flex items-center gap-4 pt-1 text-xs text-[#5C534A]">
                  <button
                    type="button"
                    onClick={handleFlagPost}
                    className="inline-flex items-center gap-1 hover:text-[#B84A2E] cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Flag for review</span>
                  </button>
                  {canDeletePost && (
                    <button
                      type="button"
                      onClick={handleDeletePost}
                      className="inline-flex items-center gap-1 hover:text-[#B84A2E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete post</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2-Tier Comments Section */}
          <div className="border-t border-[#DDD5C7] pt-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold text-[#1F1B18]">
                Discussion ({comments.length})
              </h3>
              <span className="text-[11px] text-[#5C534A]">
                2-tier thread · Auto-refreshes
              </span>
            </div>

            {sessionUser ? (
              <form onSubmit={handleSubmitComment} className="space-y-2">
                {replyTo && (
                  <div className="flex items-center justify-between rounded bg-[#EFE9DE] px-3 py-1.5 text-xs text-[#5C534A]">
                    <span>Replying to @{replyTo.username}</span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-[#B84A2E] font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={
                      replyTo
                        ? `Write a reply to @${replyTo.username}...`
                        : 'Share listening notes with the community...'
                    }
                    className="flex-1 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] px-3 py-2 text-sm text-[#1F1B18] focus:outline-none focus:border-[#B84A2E]"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !commentBody.trim()}
                    className="px-4 py-2 rounded-md bg-[#1F1B18] text-xs font-semibold text-[#FCF9F4] disabled:opacity-50 cursor-pointer"
                  >
                    Post
                  </button>
                </div>
                {commentError && (
                  <p className="text-xs text-[#9E3D24]">{commentError}</p>
                )}
              </form>
            ) : (
              <p className="text-xs text-[#5C534A]">
                Sign in with your member account to leave comments.
              </p>
            )}

            {loadingComments ? (
              <div className="space-y-2">
                <div className="h-12 rounded bg-[#EFE9DE] animate-pulse" />
                <div className="h-12 rounded bg-[#EFE9DE] animate-pulse" />
              </div>
            ) : topLevelComments.length === 0 ? (
              <p className="text-xs text-[#5C534A] py-4 text-center">
                No comments yet. Start the thread above.
              </p>
            ) : (
              <ul className="space-y-3">
                {topLevelComments.map((comment) => {
                  const replies = repliesByParent.get(comment.id) ?? [];
                  const canDeleteComment =
                    sessionUser &&
                    (sessionUser.role === 'admin' || sessionUser.id === comment.userId);
                  return (
                    <li
                      key={comment.id}
                      className="rounded-lg border border-[#DDD5C7] bg-[#F7F3EC] p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenProfile(comment.username)}
                            className="text-xs font-semibold text-[#1F1B18] hover:text-[#B84A2E] cursor-pointer"
                          >
                            @{comment.username}
                          </button>
                          <p className="mt-1 text-sm text-[#1F1B18] leading-relaxed">
                            {comment.body}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[11px] text-[#5C534A]">
                          {sessionUser && (
                            <button
                              type="button"
                              onClick={() => setReplyTo(comment)}
                              className="hover:text-[#B84A2E] cursor-pointer"
                            >
                              Reply
                            </button>
                          )}
                          {canDeleteComment && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              aria-label="Delete comment"
                              className="hover:text-[#B84A2E] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Tier 2 Replies */}
                      {replies.length > 0 && (
                        <ul className="pl-4 border-l border-[#DDD5C7] space-y-2">
                          {replies.map((reply) => {
                            const canDeleteReply =
                              sessionUser &&
                              (sessionUser.role === 'admin' ||
                                sessionUser.id === reply.userId);
                            return (
                              <li
                                key={reply.id}
                                className="flex items-start justify-between gap-2 pt-1"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <CornerDownRight className="w-3.5 h-3.5 text-[#5C534A] mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => onOpenProfile(reply.username)}
                                      className="text-xs font-semibold text-[#1F1B18] hover:text-[#B84A2E] cursor-pointer"
                                    >
                                      @{reply.username}
                                    </button>
                                    <p className="text-xs text-[#1F1B18] mt-0.5 leading-relaxed">
                                      {reply.body}
                                    </p>
                                  </div>
                                </div>
                                {canDeleteReply && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reply.id)}
                                    aria-label="Delete reply"
                                    className="text-[#5C534A] hover:text-[#B84A2E] shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
