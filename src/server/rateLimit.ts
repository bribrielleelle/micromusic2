import { and, count, eq, gte } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { classifyDatabaseError, getDb, isDatabaseConfigured } from '../db/index.ts';
import { rateLimits } from '../db/schema.ts';
import type { AuthRequest } from './auth.ts';

export interface RateLimitOptions {
  action: string;
  maxRequests: number;
  windowSeconds: number;
}

export function getClientIdentifier(req: AuthRequest): string {
  if (req.authUser?.id) {
    return `user:${req.authUser.id}`;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

export async function checkAndRecordRateLimit(
  userIdOrIp: string,
  options: RateLimitOptions,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const db = getDb();
  const windowStart = new Date(Date.now() - options.windowSeconds * 1000);

  const [result] = await db
    .select({ total: count() })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.userIdOrIp, userIdOrIp),
        eq(rateLimits.action, options.action),
        gte(rateLimits.timestamp, windowStart),
      ),
    );

  const currentCount = Number(result?.total ?? 0);
  if (currentCount >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: options.windowSeconds,
    };
  }

  await db.insert(rateLimits).values({
    userIdOrIp,
    action: options.action,
  });

  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - currentCount - 1),
    retryAfterSeconds: 0,
  };
}

export function dbRateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({
        error: 'Database is not configured. Set DATABASE_URL to enable protected endpoints.',
      });
    }

    try {
      const identifier = getClientIdentifier(req as AuthRequest);
      const outcome = await checkAndRecordRateLimit(identifier, options);
      if (!outcome.allowed) {
        res.setHeader('Retry-After', String(outcome.retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many requests. Please wait before trying again.',
          action: options.action,
        });
      }
      next();
    } catch (error) {
      const classified = classifyDatabaseError(error);
      console.warn('Rate limit check unavailable:', classified.message);
      return res.status(classified.status).json({ error: classified.message });
    }
  };
}
