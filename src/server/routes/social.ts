import { and, count, desc, eq, or } from 'drizzle-orm';
import { Router, type Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../../db/index.ts';
import {
  bookmarks,
  comments,
  crates,
  follows,
  likes,
  posts,
  users,
} from '../../db/schema.ts';
import {
  isOwnerOrAdmin,
  optionalAuth,
  requireAuth,
  requireDatabase,
  type AuthRequest,
} from '../auth.ts';
import { dbRateLimit } from '../rateLimit.ts';

const socialRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// POST /api/likes & DELETE /api/likes
socialRouter.post(
  '/likes',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { postId } = req.body ?? {};
    if (typeof postId !== 'string' || !isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }

    try {
      const db = getDb();
      await db
        .insert(likes)
        .values({ postId, userId: req.authUser!.id })
        .onConflictDoNothing();
      const [{ total }] = await db
        .select({ total: count() })
        .from(likes)
        .where(eq(likes.postId, postId));
      return res.json({ liked: true, likeCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

socialRouter.delete(
  '/likes',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const postId =
      typeof req.body?.postId === 'string'
        ? req.body.postId
        : typeof req.query.postId === 'string'
          ? req.query.postId
          : '';
    if (!isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }

    try {
      const db = getDb();
      await db
        .delete(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userId, req.authUser!.id)));
      const [{ total }] = await db
        .select({ total: count() })
        .from(likes)
        .where(eq(likes.postId, postId));
      return res.json({ liked: false, likeCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/bookmarks & DELETE /api/bookmarks
socialRouter.post(
  '/bookmarks',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { postId } = req.body ?? {};
    if (typeof postId !== 'string' || !isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }

    try {
      const db = getDb();
      await db
        .insert(bookmarks)
        .values({ postId, userId: req.authUser!.id })
        .onConflictDoNothing();
      const [{ total }] = await db
        .select({ total: count() })
        .from(bookmarks)
        .where(eq(bookmarks.postId, postId));
      return res.json({ bookmarked: true, bookmarkCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

socialRouter.delete(
  '/bookmarks',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const postId =
      typeof req.body?.postId === 'string'
        ? req.body.postId
        : typeof req.query.postId === 'string'
          ? req.query.postId
          : '';
    if (!isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }

    try {
      const db = getDb();
      await db
        .delete(bookmarks)
        .where(
          and(eq(bookmarks.postId, postId), eq(bookmarks.userId, req.authUser!.id)),
        );
      const [{ total }] = await db
        .select({ total: count() })
        .from(bookmarks)
        .where(eq(bookmarks.postId, postId));
      return res.json({ bookmarked: false, bookmarkCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/follows & DELETE /api/follows
socialRouter.post(
  '/follows',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { followedId } = req.body ?? {};
    if (typeof followedId !== 'string' || !followedId.trim()) {
      return res.status(400).json({ error: 'followedId is required.' });
    }
    if (followedId === req.authUser!.id) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    try {
      const db = getDb();
      await db
        .insert(follows)
        .values({ followerId: req.authUser!.id, followedId })
        .onConflictDoNothing();
      const [{ total }] = await db
        .select({ total: count() })
        .from(follows)
        .where(eq(follows.followedId, followedId));
      return res.json({ following: true, followerCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

socialRouter.delete(
  '/follows',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const followedId =
      typeof req.body?.followedId === 'string'
        ? req.body.followedId
        : typeof req.query.followedId === 'string'
          ? req.query.followedId
          : '';
    if (!followedId.trim()) {
      return res.status(400).json({ error: 'followedId is required.' });
    }

    try {
      const db = getDb();
      await db
        .delete(follows)
        .where(
          and(
            eq(follows.followerId, req.authUser!.id),
            eq(follows.followedId, followedId),
          ),
        );
      const [{ total }] = await db
        .select({ total: count() })
        .from(follows)
        .where(eq(follows.followedId, followedId));
      return res.json({ following: false, followerCount: Number(total ?? 0) });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// POST /api/comments - Max depth: 2 tiers via app logic
socialRouter.post(
  '/comments',
  requireDatabase,
  requireAuth,
  dbRateLimit({ action: 'comment_creation', maxRequests: 25, windowSeconds: 300 }),
  async (req: AuthRequest, res: Response) => {
    const { postId, parentId, body } = req.body ?? {};
    if (typeof postId !== 'string' || !isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid postId is required.' });
    }
    if (typeof body !== 'string' || body.trim().length < 1 || body.length > 1000) {
      return res.status(400).json({ error: 'Comment must be 1–1000 characters.' });
    }

    let resolvedParentId: string | null = null;
    if (parentId !== undefined && parentId !== null && parentId !== '') {
      if (typeof parentId !== 'string' || !isValidUuid(parentId)) {
        return res.status(400).json({ error: 'Invalid parentId.' });
      }
      resolvedParentId = parentId;
    }

    try {
      const db = getDb();
      if (resolvedParentId) {
        const [parentComment] = await db
          .select({
            id: comments.id,
            postId: comments.postId,
            parentId: comments.parentId,
          })
          .from(comments)
          .where(eq(comments.id, resolvedParentId))
          .limit(1);

        if (!parentComment || parentComment.postId !== postId) {
          return res.status(404).json({ error: 'Parent comment not found on this post.' });
        }

        // Enforce 2-tier maximum depth
        if (parentComment.parentId !== null) {
          return res.status(400).json({
            error: 'Replies are limited to 2 tiers deep. Reply to the top-level comment instead.',
          });
        }
      }

      const [created] = await db
        .insert(comments)
        .values({
          postId,
          parentId: resolvedParentId,
          userId: req.authUser!.id,
          body: body.trim(),
        })
        .returning();

      return res.status(201).json({
        comment: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          username: req.authUser!.username,
          avatarUrl: req.authUser!.avatarUrl,
          isVerifiedArtist: req.authUser!.isVerifiedArtist,
          verifiedArtistName: req.authUser!.verifiedArtistName,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// DELETE /api/comments/:id - Owner or Admin only
socialRouter.delete(
  '/comments/:id',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid comment identifier.' });
    }

    try {
      const db = getDb();
      const [existing] = await db
        .select({ id: comments.id, userId: comments.userId })
        .from(comments)
        .where(eq(comments.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'Comment not found.' });
      }
      if (!isOwnerOrAdmin(req.authUser!, existing.userId)) {
        return res.status(403).json({ error: 'Forbidden: Only the author or an admin can delete this comment.' });
      }

      await db.delete(comments).where(eq(comments.id, id));
      return res.json({ deleted: true, id });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// GET /api/users/:id - Fetch user profile (by ID or username)
socialRouter.get('/users/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database is not configured.' });
  }

  const lookup = req.params.id.trim();
  try {
    const db = getDb();
    const [profile] = await db
      .select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        links: users.links,
        avatarUrl: users.avatarUrl,
        role: users.role,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(or(eq(users.id, lookup), eq(users.username, lookup.toLowerCase())))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const [{ followerCount }] = await db
      .select({ followerCount: count() })
      .from(follows)
      .where(eq(follows.followedId, profile.id));

    const [{ followingCount }] = await db
      .select({ followingCount: count() })
      .from(follows)
      .where(eq(follows.followerId, profile.id));

    let isFollowedByViewer = false;
    if (req.authUser && req.authUser.id !== profile.id) {
      const [rel] = await db
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, req.authUser.id),
            eq(follows.followedId, profile.id),
          ),
        )
        .limit(1);
      isFollowedByViewer = Boolean(rel);
    }

    const userCrates = await db
      .select()
      .from(crates)
      .where(
        req.authUser && isOwnerOrAdmin(req.authUser, profile.id)
          ? eq(crates.ownerId, profile.id)
          : and(eq(crates.ownerId, profile.id), eq(crates.isPublic, true)),
      )
      .orderBy(desc(crates.createdAt));

    const likedPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        artistName: posts.artistName,
        mediaUrl: posts.mediaUrl,
        thumbnailUrl: posts.thumbnailUrl,
      })
      .from(likes)
      .innerJoin(posts, eq(likes.postId, posts.id))
      .where(and(eq(likes.userId, profile.id), eq(posts.isHidden, false)))
      .orderBy(desc(posts.createdAt))
      .limit(12);

    return res.json({
      profile: {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        followerCount: Number(followerCount ?? 0),
        followingCount: Number(followingCount ?? 0),
        isFollowedByViewer,
      },
      crates: userCrates.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      likedPosts,
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// PATCH /api/users/me - Update own bio/links
socialRouter.patch(
  '/users/me',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { bio, links, avatarUrl } = req.body ?? {};
    const updates: Partial<{
      bio: string | null;
      links: Record<string, string> | null;
      avatarUrl: string | null;
    }> = {};

    if (typeof bio === 'string') {
      updates.bio = bio.trim().slice(0, 400);
    }
    if (links && typeof links === 'object' && !Array.isArray(links)) {
      const cleanLinks: Record<string, string> = {};
      for (const [k, v] of Object.entries(links as Record<string, unknown>)) {
        if (typeof v === 'string' && v.startsWith('https://')) {
          cleanLinks[k.slice(0, 32)] = v.slice(0, 200);
        }
      }
      updates.links = cleanLinks;
    }
    if (avatarUrl === null || avatarUrl === '') {
      updates.avatarUrl = null;
    } else if (typeof avatarUrl === 'string' && avatarUrl.startsWith('https://')) {
      updates.avatarUrl = avatarUrl.slice(0, 400);
    }

    try {
      const db = getDb();
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, req.authUser!.id))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          role: users.role,
          isVerifiedArtist: users.isVerifiedArtist,
          verifiedArtistName: users.verifiedArtistName,
          bio: users.bio,
          links: users.links,
          avatarUrl: users.avatarUrl,
        });

      return res.json({ user: updated });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// GET /api/communities - Curators, Verified Artists, and follower counts
socialRouter.get('/communities', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ curators: [], databaseConfigured: false });
  }

  try {
    const db = getDb();
    const memberRows = await db
      .select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        role: users.role,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.isVerifiedArtist), desc(users.createdAt))
      .limit(40);

    const followerRows = await db
      .select({ followedId: follows.followedId, total: count() })
      .from(follows)
      .groupBy(follows.followedId);

    const followerMap = new Map<string, number>();
    for (const r of followerRows) {
      followerMap.set(r.followedId, Number(r.total ?? 0));
    }

    const viewerFollows = new Set<string>();
    if (req.authUser) {
      const rels = await db
        .select({ followedId: follows.followedId })
        .from(follows)
        .where(eq(follows.followerId, req.authUser.id));
      for (const r of rels) {
        viewerFollows.add(r.followedId);
      }
    }

    return res.json({
      databaseConfigured: true,
      curators: memberRows.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        followerCount: followerMap.get(m.id) ?? 0,
        isFollowedByViewer: viewerFollows.has(m.id),
      })),
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

export default socialRouter;
