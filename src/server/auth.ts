import crypto from 'node:crypto';
import { verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../db/index.ts';
import { users } from '../db/schema.ts';

export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isVerifiedArtist: boolean;
  verifiedArtistName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export interface AuthRequest extends Request {
  authUser?: AuthUser;
  clerkUserId?: string;
}

const SESSION_COOKIE_NAME = 'sona_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

let ephemeralSecret: string | null = null;
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

interface SessionPayload {
  sub: string;
  exp: number;
}

export function signSessionToken(userId: string): string {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const encoded = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (!decoded.sub || typeof decoded.exp !== 'number') return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim() === 'https';
  }
  return false;
}

export function setSessionCookie(req: Request, res: Response, userId: string): void {
  const token = signSessionToken(userId);
  const https = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (https) {
    attrs.push('Secure');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (https) {
    attrs.push('Secure');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

async function resolveAuthenticatedUserId(req: Request): Promise<{
  userId: string | null;
  clerkSub: string | null;
}> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && process.env.CLERK_SECRET_KEY) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    try {
      const verified = await verifyToken(bearerToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      if (verified?.sub) {
        return { userId: verified.sub, clerkSub: verified.sub };
      }
    } catch {
      return { userId: null, clerkSub: null };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload?.sub) {
      return { userId: payload.sub, clerkSub: null };
    }
  }

  return { userId: null, clerkSub: null };
}

export function requireDatabase(_req: Request, res: Response, next: NextFunction) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      error: 'Replit PostgreSQL DATABASE_URL is not configured yet.',
    });
  }
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!isDatabaseConfigured()) {
    return next();
  }

  try {
    const { userId, clerkSub } = await resolveAuthenticatedUserId(req);
    if (clerkSub) req.clerkUserId = clerkSub;
    if (!userId) return next();

    const db = getDb();
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (row) {
      req.authUser = row;
    }
  } catch (error) {
    const classified = classifyDatabaseError(error);
    console.warn('Optional auth unavailable:', classified.message);
  }
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      error: 'Replit PostgreSQL DATABASE_URL is not configured yet.',
    });
  }

  try {
    const { userId, clerkSub } = await resolveAuthenticatedUserId(req);
    if (clerkSub) req.clerkUserId = clerkSub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const db = getDb();
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isVerifiedArtist: users.isVerifiedArtist,
        verifiedArtistName: users.verifiedArtistName,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) {
      return res.status(401).json({
        error: 'Account not registered or invite code not yet consumed.',
      });
    }

    req.authUser = row;
    next();
  } catch (error) {
    const classified = classifyDatabaseError(error);
    if (classified.status === 503) {
      console.warn('Auth middleware database unavailable:', classified.message);
      return res.status(503).json({ error: classified.message });
    }
    console.error('Authentication middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired credentials.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
  }
  next();
}

export function isOwnerOrAdmin(user: AuthUser, resourceOwnerId: string): boolean {
  return user.role === 'admin' || user.id === resourceOwnerId;
}
