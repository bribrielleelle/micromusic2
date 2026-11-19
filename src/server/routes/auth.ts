import crypto from 'node:crypto';
import { and, count, eq, isNull, or } from 'drizzle-orm';
import { Router, type Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../../db/index.ts';
import { inviteCodes, users } from '../../db/schema.ts';
import {
  clearSessionCookie,
  hashPassword,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireDatabase,
  setSessionCookie,
  verifyPassword,
  type AuthRequest,
} from '../auth.ts';
import { dbRateLimit } from '../rateLimit.ts';

const authRouter = Router();

authRouter.get('/me', optionalAuth, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.authUser ?? null,
    inviteOnly: true,
    databaseConfigured: isDatabaseConfigured(),
    clerkConfigured: Boolean(
      process.env.CLERK_SECRET_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY,
    ),
  });
});

authRouter.post(
  '/register',
  requireDatabase,
  dbRateLimit({ action: 'auth_register', maxRequests: 10, windowSeconds: 300 }),
  async (req: AuthRequest, res: Response) => {
    const { username, email, password, inviteCode } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof inviteCode !== 'string'
    ) {
      return res.status(400).json({
        error: 'Username, email, password, and a valid invite code are required.',
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = inviteCode.trim();

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({
        error: 'Username must be 3–30 characters (letters, numbers, underscores).',
      });
    }
    if (!cleanEmail.includes('@') || password.length < 8) {
      return res.status(400).json({
        error: 'Provide a valid email and a password of at least 8 characters.',
      });
    }
    if (!cleanCode) {
      return res.status(403).json({
        error: 'SONA is invite-only. A valid invite code is required to register.',
      });
    }

    try {
      const db = getDb();
      const createdUser = await db.transaction(async (tx) => {
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(or(eq(users.email, cleanEmail), eq(users.username, cleanUsername)))
          .limit(1);

        if (existingUser) {
          throw new Error('CONFLICT_USER');
        }

        const [{ totalUsers }] = await tx.select({ totalUsers: count() }).from(users);
        const isBootstrapCode =
          Number(totalUsers) === 0 &&
          Boolean(process.env.ADMIN_BOOTSTRAP_CODE) &&
          cleanCode === process.env.ADMIN_BOOTSTRAP_CODE;

        if (!isBootstrapCode) {
          const [invite] = await tx
            .select()
            .from(inviteCodes)
            .where(and(eq(inviteCodes.code, cleanCode), isNull(inviteCodes.usedBy)))
            .limit(1);

          if (!invite) {
            if (Number(totalUsers) === 0 && !process.env.ADMIN_BOOTSTRAP_CODE) {
              throw new Error('NO_BOOTSTRAP_CONFIG');
            }
            throw new Error('INVALID_INVITE');
          }
        }

        const userId = `usr_${crypto.randomUUID()}`;
        const [inserted] = await tx
          .insert(users)
          .values({
            id: userId,
            username: cleanUsername,
            email: cleanEmail,
            passwordHash: hashPassword(password),
            role: isBootstrapCode ? 'admin' : 'user',
          })
          .returning({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            isVerifiedArtist: users.isVerifiedArtist,
            verifiedArtistName: users.verifiedArtistName,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
          });

        if (isBootstrapCode) {
          await tx
            .insert(inviteCodes)
            .values({
              code: cleanCode,
              createdBy: inserted.id,
              usedBy: inserted.id,
            })
            .onConflictDoUpdate({
              target: inviteCodes.code,
              set: { usedBy: inserted.id },
            });
        } else {
          const [consumed] = await tx
            .update(inviteCodes)
            .set({ usedBy: inserted.id })
            .where(and(eq(inviteCodes.code, cleanCode), isNull(inviteCodes.usedBy)))
            .returning();

          if (!consumed) {
            throw new Error('INVALID_INVITE');
          }
        }

        return inserted;
      });

      setSessionCookie(req, res, createdUser.id);
      return res.status(201).json({ user: createdUser });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'CONFLICT_USER') {
          return res.status(409).json({ error: 'Username or email is already registered.' });
        }
        if (error.message === 'NO_BOOTSTRAP_CONFIG') {
          return res.status(403).json({
            error:
              'No users or invite codes exist yet. Set ADMIN_BOOTSTRAP_CODE in Secrets to register the first admin account.',
          });
        }
        if (error.message === 'INVALID_INVITE') {
          return res.status(403).json({ error: 'Invite code is invalid or has already been used.' });
        }
      }
      const classified = classifyDatabaseError(error);
      console.warn('Registration DB error:', classified.message);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

authRouter.post(
  '/login',
  requireDatabase,
  dbRateLimit({ action: 'auth_login', maxRequests: 15, windowSeconds: 300 }),
  async (req: AuthRequest, res: Response) => {
    const { identifier, password } = req.body ?? {};
    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email or username and password are required.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    try {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(
          or(eq(users.email, cleanIdentifier), eq(users.username, cleanIdentifier)),
        )
        .limit(1);

      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      setSessionCookie(req, res, user.id);
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerifiedArtist: user.isVerifiedArtist,
          verifiedArtistName: user.verifiedArtistName,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      console.warn('Login DB error:', classified.message);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

authRouter.post('/logout', (req: AuthRequest, res: Response) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.post(
  '/invite/consume',
  requireDatabase,
  dbRateLimit({ action: 'invite_consume', maxRequests: 10, windowSeconds: 300 }),
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { code } = req.body ?? {};
    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Invite code is required.' });
    }

    try {
      const db = getDb();
      const [consumed] = await db
        .update(inviteCodes)
        .set({ usedBy: req.authUser!.id })
        .where(and(eq(inviteCodes.code, code.trim()), isNull(inviteCodes.usedBy)))
        .returning();

      if (!consumed) {
        return res.status(404).json({ error: 'Invite code is invalid or already consumed.' });
      }

      return res.json({ invite: consumed });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      console.warn('Consume invite DB error:', classified.message);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

authRouter.post(
  '/invite/create',
  requireDatabase,
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const customCode =
      typeof req.body?.code === 'string' && req.body.code.trim()
        ? req.body.code.trim().toUpperCase()
        : `SONA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      const db = getDb();
      const [created] = await db
        .insert(inviteCodes)
        .values({
          code: customCode,
          createdBy: req.authUser!.id,
        })
        .returning();

      return res.status(201).json({ invite: created });
    } catch (error) {
      const classified = classifyDatabaseError(error);
      console.warn('Create invite DB error:', classified.message);
      return res.status(classified.status).json({ error: classified.message });
    }
  },
);

export default authRouter;
