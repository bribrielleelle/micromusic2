import { and, asc, count, desc, eq, or } from 'drizzle-orm';
import { Router, type Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../../db/index.ts';
import { crateItems, crates, posts, users } from '../../db/schema.ts';
import {
  isOwnerOrAdmin,
  optionalAuth,
  requireAuth,
  requireDatabase,
  type AuthRequest,
} from '../auth.ts';
import { checkAndRecordRateLimit, getClientIdentifier } from '../rateLimit.ts';
import { hydratePosts } from './posts.ts';

const cratesRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// GET /api/crates - List public crates + authenticated user's crates
cratesRouter.get('/crates', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!isDatabaseConfigured()) {
    return res.json({ crates: [], databaseConfigured: false });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: crates.id,
        ownerId: crates.ownerId,
        ownerUsername: users.username,
        title: crates.title,
        description: crates.description,
        coverUrl: crates.coverUrl,
        isPublic: crates.isPublic,
        createdAt: crates.createdAt,
      })
      .from(crates)
      .innerJoin(users, eq(crates.ownerId, users.id))
      .where(
        req.authUser
          ? or(eq(crates.isPublic, true), eq(crates.ownerId, req.authUser.id))
          : eq(crates.isPublic, true),
      )
      .orderBy(desc(crates.createdAt));

    const itemCounts = await db
      .select({ crateId: crateItems.crateId, total: count() })
      .from(crateItems)
      .groupBy(crateItems.crateId);

    const countMap = new Map<string, number>();
    for (const c of itemCounts) {
      countMap.set(c.crateId, Number(c.total ?? 0));
    }

    return res.json({
      crates: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        itemCount: countMap.get(row.id) ?? 0,
      })),
      databaseConfigured: true,
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// POST /api/crates - Create new crate
cratesRouter.post(
  '/crates',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { title, description, isPublic, coverUrl } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 2 || title.length > 80) {
      return res.status(400).json({ error: 'Crate title must be 2–80 characters.' });
    }

    let safeCoverUrl: string | null = null;
    if (typeof coverUrl === 'string' && coverUrl.trim()) {
      try {
        const parsed = new URL(coverUrl.trim());
        if (parsed.protocol === 'https:') {
          safeCoverUrl = parsed.toString().slice(0, 400);
        }
      } catch {
        return res.status(400).json({ error: 'Cover URL must be a valid https:// URL.' });
      }
    }

    try {
      const db = getDb();
      const [created] = await db
        .insert(crates)
        .values({
          ownerId: req.authUser!.id,
          title: title.trim(),
          description: typeof description === 'string' ? description.trim().slice(0, 300) : null,
          coverUrl: safeCoverUrl,
          isPublic: typeof isPublic === 'boolean' ? isPublic : true,
        })
        .returning();

      return res.status(201).json({
        crate: {
          ...created,
          ownerUsername: req.authUser!.username,
          createdAt: created.createdAt.toISOString(),
          itemCount: 0,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// GET /api/crates/:id - Fetch crate metadata and joined CrateItems
cratesRouter.get('/crates/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!isValidUuid(id)) {
    return res.status(400).json({ error: 'Invalid crate identifier.' });
  }
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database is not configured.' });
  }

  try {
    const db = getDb();
    const [crate] = await db
      .select({
        id: crates.id,
        ownerId: crates.ownerId,
        ownerUsername: users.username,
        title: crates.title,
        description: crates.description,
        coverUrl: crates.coverUrl,
        isPublic: crates.isPublic,
        createdAt: crates.createdAt,
      })
      .from(crates)
      .innerJoin(users, eq(crates.ownerId, users.id))
      .where(eq(crates.id, id))
      .limit(1);

    if (!crate) {
      return res.status(404).json({ error: 'Crate not found.' });
    }
    if (!crate.isPublic && (!req.authUser || !isOwnerOrAdmin(req.authUser, crate.ownerId))) {
      return res.status(403).json({ error: 'This crate is private.' });
    }

    const joinedItems = await db
      .select({
        crateId: crateItems.crateId,
        postId: crateItems.postId,
        addedBy: crateItems.addedBy,
        position: crateItems.position,
        addedAt: crateItems.addedAt,
        mediaUrl: posts.mediaUrl,
        title: posts.title,
        artistName: posts.artistName,
        thumbnailUrl: posts.thumbnailUrl,
        durationSeconds: posts.durationSeconds,
        tags: posts.tags,
        viewCount: posts.viewCount,
        isHidden: posts.isHidden,
        postUserId: posts.userId,
        postCreatedAt: posts.createdAt,
        curatorUsername: users.username,
        curatorAvatarUrl: users.avatarUrl,
        curatorIsVerifiedArtist: users.isVerifiedArtist,
        curatorVerifiedArtistName: users.verifiedArtistName,
      })
      .from(crateItems)
      .innerJoin(posts, eq(crateItems.postId, posts.id))
      .innerJoin(users, eq(posts.userId, users.id))
      .where(and(eq(crateItems.crateId, id), eq(posts.isHidden, false)))
      .orderBy(asc(crateItems.position), desc(crateItems.addedAt));

    const hydratedPosts = await hydratePosts(
      joinedItems.map((item) => ({
        id: item.postId,
        userId: item.postUserId,
        mediaUrl: item.mediaUrl,
        title: item.title,
        artistName: item.artistName,
        thumbnailUrl: item.thumbnailUrl,
        durationSeconds: item.durationSeconds,
        tags: item.tags,
        viewCount: item.viewCount,
        isHidden: item.isHidden,
        createdAt: item.postCreatedAt,
        authorUsername: item.curatorUsername,
        authorAvatarUrl: item.curatorAvatarUrl,
        authorIsVerifiedArtist: item.curatorIsVerifiedArtist,
        authorVerifiedArtistName: item.curatorVerifiedArtistName,
      })),
      req.authUser?.id,
    );

    return res.json({
      crate: {
        ...crate,
        createdAt: crate.createdAt.toISOString(),
      },
      items: joinedItems.map((item, idx) => ({
        crateId: item.crateId,
        postId: item.postId,
        addedBy: item.addedBy,
        position: item.position,
        addedAt: item.addedAt.toISOString(),
        post: hydratedPosts[idx],
      })),
    });
  } catch (error) {
    const classified = classifyDatabaseError(error);
    return res.status(classified.status).json({ error: classified.message });
  }
});

// POST /api/crates/items - Add post to crate (rate-limited for public crates)
cratesRouter.post(
  '/crates/items',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { crateId, postId } = req.body ?? {};
    if (
      typeof crateId !== 'string' ||
      !isValidUuid(crateId) ||
      typeof postId !== 'string' ||
      !isValidUuid(postId)
    ) {
      return res.status(400).json({ error: 'Valid crateId and postId are required.' });
    }

    try {
      const db = getDb();
      const [crate] = await db
        .select()
        .from(crates)
        .where(eq(crates.id, crateId))
        .limit(1);

      if (!crate) {
        return res.status(404).json({ error: 'Crate not found.' });
      }

      if (!crate.isPublic && !isOwnerOrAdmin(req.authUser!, crate.ownerId)) {
        return res.status(403).json({ error: 'Forbidden: Only the crate owner can add to a private crate.' });
      }

      // Rate-limit additions to public crates via RateLimits DB table
      if (crate.isPublic) {
        const outcome = await checkAndRecordRateLimit(getClientIdentifier(req), {
          action: 'crate_add',
          maxRequests: 20,
          windowSeconds: 300,
        });
        if (!outcome.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded for adding items to public crates.',
          });
        }
      }

      const [{ total }] = await db
        .select({ total: count() })
        .from(crateItems)
        .where(eq(crateItems.crateId, crateId));

      await db
        .insert(crateItems)
        .values({
          crateId,
          postId,
          addedBy: req.authUser!.id,
          position: Number(total ?? 0),
        })
        .onConflictDoNothing();

      return res.status(201).json({ added: true, crateId, postId });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

// DELETE /api/crates/items - Remove item (Crate owner can remove any item; contributor can remove own)
cratesRouter.delete(
  '/crates/items',
  requireDatabase,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const crateId =
      typeof req.body?.crateId === 'string'
        ? req.body.crateId
        : typeof req.query.crateId === 'string'
          ? req.query.crateId
          : '';
    const postId =
      typeof req.body?.postId === 'string'
        ? req.body.postId
        : typeof req.query.postId === 'string'
          ? req.query.postId
          : '';

    if (!isValidUuid(crateId) || !isValidUuid(postId)) {
      return res.status(400).json({ error: 'Valid crateId and postId are required.' });
    }

    try {
      const db = getDb();
      const [crate] = await db
        .select()
        .from(crates)
        .where(eq(crates.id, crateId))
        .limit(1);

      if (!crate) {
        return res.status(404).json({ error: 'Crate not found.' });
      }

      const [item] = await db
        .select()
        .from(crateItems)
        .where(and(eq(crateItems.crateId, crateId), eq(crateItems.postId, postId)))
        .limit(1);

      if (!item) {
        return res.status(404).json({ error: 'Crate item not found.' });
      }

      const canRemove =
        isOwnerOrAdmin(req.authUser!, crate.ownerId) ||
        item.addedBy === req.authUser!.id;
      if (!canRemove) {
        return res.status(403).json({
          error: 'Forbidden: Only the crate owner, item contributor, or an admin can remove this item.',
        });
      }

      await db
        .delete(crateItems)
        .where(and(eq(crateItems.crateId, crateId), eq(crateItems.postId, postId)));

      return res.json({ removed: true, crateId, postId });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

export default cratesRouter;
