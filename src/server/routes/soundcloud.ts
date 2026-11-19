import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { parseCookies } from '../auth.ts';
import type { SoundCloudTrackInput } from '../gemini.ts';

const soundcloudRouter = Router();

const SC_SESSION_COOKIE = 'sona_sc_session';
const SC_STATE_TTL_MS = 10 * 60 * 1000;

interface PendingOAuthState {
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

interface SoundCloudSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: {
    id: number;
    username: string;
    permalinkUrl: string | null;
    avatarUrl: string | null;
  };
  likedTracks: SoundCloudTrackInput[];
}

const pendingStates = new Map<string, PendingOAuthState>();
const scSessions = new Map<string, SoundCloudSession>();

function pruneExpiredStates() {
  const cutoff = Date.now() - SC_STATE_TTL_MS;
  for (const [key, entry] of pendingStates.entries()) {
    if (entry.createdAt < cutoff) pendingStates.delete(key);
  }
}

function isSoundCloudOAuthConfigured(): boolean {
  return Boolean(
    process.env.SOUNDCLOUD_CLIENT_ID?.trim() &&
      process.env.SOUNDCLOUD_CLIENT_SECRET?.trim(),
  );
}

function resolveCallbackUri(req: Request): string {
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl && configuredAppUrl !== 'MY_APP_URL') {
    return `${configuredAppUrl.replace(/\/+$/, '')}/api/soundcloud/callback`;
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string'
      ? protoHeader.split(',')[0].trim()
      : req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  return `${proto}://${host}/api/soundcloud/callback`;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim() === 'https';
  }
  return false;
}

function setSoundCloudSessionCookie(req: Request, res: Response, sessionId: string) {
  const https = isHttpsRequest(req);
  const attrs = [
    `${SC_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${60 * 60 * 24}`,
  ];
  if (https) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSoundCloudSessionCookie(req: Request, res: Response) {
  const https = isHttpsRequest(req);
  const attrs = [
    `${SC_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (https) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function normalizeSoundCloudTrack(raw: Record<string, unknown>): SoundCloudTrackInput {
  const userObj =
    raw.user && typeof raw.user === 'object'
      ? (raw.user as Record<string, unknown>)
      : null;
  const tagListRaw = typeof raw.tag_list === 'string' ? raw.tag_list : '';
  const parsedTags = Array.from(
    tagListRaw.matchAll(/"([^"]+)"|(\S+)/g),
    (m) => (m[1] || m[2] || '').trim().toLowerCase(),
  ).filter(Boolean);

  const durationMs = typeof raw.duration === 'number' ? raw.duration : 0;
  return {
    id:
      typeof raw.id === 'number' || typeof raw.id === 'string'
        ? raw.id
        : crypto.randomUUID(),
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Track',
    artist:
      (userObj && typeof userObj.username === 'string' && userObj.username) ||
      (typeof raw.artist === 'string' ? raw.artist : 'Unknown Artist'),
    genre: typeof raw.genre === 'string' && raw.genre.trim() ? raw.genre.trim() : null,
    bpm: typeof raw.bpm === 'number' && raw.bpm > 0 ? Math.round(raw.bpm) : null,
    tagList: parsedTags.slice(0, 10),
    playbackCount:
      typeof raw.playback_count === 'number' ? raw.playback_count : null,
    durationSeconds: durationMs > 0 ? Math.round(durationMs / 1000) : null,
    likedAt: typeof raw.created_at === 'string' ? raw.created_at : null,
    permalinkUrl: typeof raw.permalink_url === 'string' ? raw.permalink_url : null,
  };
}

async function fetchSoundCloudLikesFromApi(
  accessToken: string,
): Promise<SoundCloudTrackInput[]> {
  const likesRes = await fetch(
    'https://api.soundcloud.com/me/likes/tracks?limit=25&linked_partitioning=false',
    {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
      },
    },
  );
  if (!likesRes.ok) {
    throw new Error(`SoundCloud API returned HTTP ${likesRes.status} for liked tracks.`);
  }
  const payload = (await likesRes.json()) as unknown;
  const items = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { collection?: unknown[] }).collection)
      ? (payload as { collection: unknown[] }).collection
      : [];

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map(normalizeSoundCloudTrack);
}

export function getActiveSoundCloudSession(req: Request): SoundCloudSession | null {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SC_SESSION_COOKIE];
  if (!sid) return null;
  return scSessions.get(sid) ?? null;
}

// GET /api/soundcloud/status
soundcloudRouter.get('/soundcloud/status', (req: Request, res: Response) => {
  const session = getActiveSoundCloudSession(req);
  const callbackUrl = resolveCallbackUri(req);
  res.json({
    oauthConfigured: isSoundCloudOAuthConfigured(),
    callbackUrl,
    connected: Boolean(session),
    user: session?.user ?? null,
    likedTracks: session?.likedTracks ?? [],
  });
});

// GET /api/soundcloud/url - Return SoundCloud OAuth 2.1 PKCE authorization URL
soundcloudRouter.get('/soundcloud/url', (req: Request, res: Response) => {
  const callbackUrl = resolveCallbackUri(req);
  if (!isSoundCloudOAuthConfigured()) {
    return res.status(503).json({
      error:
        'SoundCloud OAuth credentials (SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET) are not configured yet.',
      callbackUrl,
    });
  }

  pruneExpiredStates();
  const state = crypto.randomBytes(20).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  pendingStates.set(state, {
    codeVerifier,
    redirectUri: callbackUrl,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: process.env.SOUNDCLOUD_CLIENT_ID!.trim(),
    redirect_uri: callbackUrl,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return res.json({
    url: `https://secure.soundcloud.com/authorize?${params.toString()}`,
    callbackUrl,
  });
});

// GET /api/soundcloud/callback - Handle OAuth redirect inside popup & postMessage to opener
async function handleSoundCloudCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

  if (oauthError) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px; background: #F7F3EC; color: #1F1B18;">
          <p>SoundCloud authorization was declined (${oauthError}). You may close this window.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'soundcloud', error: ${JSON.stringify(oauthError)} }, '*');
              window.close();
            }
          </script>
        </body>
      </html>
    `);
  }

  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!code || !pending) {
    return res.status(400).send('Invalid or expired SoundCloud OAuth state.');
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!.trim(),
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!.trim(),
      redirect_uri: pending.redirectUri,
      code_verifier: pending.codeVerifier,
      code,
    });

    const tokenRes = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json; charset=utf-8',
      },
      body: tokenParams.toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          `Token exchange failed (HTTP ${tokenRes.status}).`,
      );
    }

    const meRes = await fetch('https://api.soundcloud.com/me', {
      headers: {
        Authorization: `OAuth ${tokenData.access_token}`,
        Accept: 'application/json; charset=utf-8',
      },
    });
    if (!meRes.ok) {
      throw new Error(`Failed to fetch SoundCloud profile (HTTP ${meRes.status}).`);
    }
    const meJson = (await meRes.json()) as {
      id?: number;
      username?: string;
      permalink_url?: string;
      avatar_url?: string;
    };

    const likedTracks = await fetchSoundCloudLikesFromApi(tokenData.access_token);
    const sessionId = crypto.randomBytes(24).toString('hex');
    scSessions.set(sessionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      user: {
        id: Number(meJson.id ?? 0),
        username: meJson.username || 'soundcloud_listener',
        permalinkUrl: meJson.permalink_url ?? null,
        avatarUrl: meJson.avatar_url ?? null,
      },
      likedTracks,
    });

    setSoundCloudSessionCookie(req, res, sessionId);
    return res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px; background: #F7F3EC; color: #1F1B18;">
          <p>SoundCloud connected! Returning to SONA...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'soundcloud' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SoundCloud OAuth callback failed.';
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px; background: #F7F3EC; color: #9E3D24;">
          <p>${message}</p>
        </body>
      </html>
    `);
  }
}

soundcloudRouter.get(
  ['/soundcloud/callback', '/soundcloud/callback/'],
  handleSoundCloudCallback,
);

// GET /api/soundcloud/likes - Refresh live Liked Tracks from SoundCloud
soundcloudRouter.get('/soundcloud/likes', async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SC_SESSION_COOKIE];
  const session = sid ? scSessions.get(sid) : undefined;
  if (!session) {
    return res.status(401).json({ error: 'SoundCloud account is not connected.' });
  }

  try {
    const freshLikes = await fetchSoundCloudLikesFromApi(session.accessToken);
    session.likedTracks = freshLikes;
    return res.json({
      user: session.user,
      likedTracks: freshLikes,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to refresh SoundCloud Liked Tracks.',
    });
  }
});

// POST /api/soundcloud/disconnect
soundcloudRouter.post('/soundcloud/disconnect', (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SC_SESSION_COOKIE];
  if (sid) scSessions.delete(sid);
  clearSoundCloudSessionCookie(req, res);
  res.json({ disconnected: true });
});

export default soundcloudRouter;
