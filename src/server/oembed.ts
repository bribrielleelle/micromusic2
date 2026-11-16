export type AllowedProvider = 'youtube' | 'soundcloud';

export interface OEmbedMetadata {
  provider: AllowedProvider;
  canonicalUrl: string;
  title: string;
  artistName: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
]);

export function validateAllowlistedMediaUrl(rawUrl: string): {
  provider: AllowedProvider;
  normalizedUrl: string;
} | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = extractYouTubeIdStrict(parsed);
    if (!videoId) return null;
    return {
      provider: 'youtube',
      normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (SOUNDCLOUD_HOSTS.has(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    const cleanUrl = `https://soundcloud.com/${segments.join('/')}`;
    return {
      provider: 'soundcloud',
      normalizedUrl: cleanUrl,
    };
  }

  return null;
}

function extractYouTubeIdStrict(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (parsed.searchParams.get('v')) {
    candidate = parsed.searchParams.get('v');
  } else {
    const parts = parsed.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx !== -1 && parts[embedIdx + 1]) {
      candidate = parts[embedIdx + 1];
    }
  }

  if (!candidate || !/^[a-zA-Z0-9_-]{6,20}$/.test(candidate)) {
    return null;
  }
  return candidate;
}

export async function fetchProviderOEmbed(
  rawUrl: string,
): Promise<OEmbedMetadata> {
  const validated = validateAllowlistedMediaUrl(rawUrl);
  if (!validated) {
    throw new Error('INVALID_MEDIA_URL');
  }

  // SSRF Guard: Only query hardcoded provider oEmbed endpoints with encoded URL
  const endpoint =
    validated.provider === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(validated.normalizedUrl)}`
      : `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(validated.normalizedUrl)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SONA-Fan-Hub/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('OEMBED_UNAVAILABLE');
    }

    const payload = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    const rawTitle = typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'Untitled Track';

    const rawAuthor =
      typeof payload.author_name === 'string' && payload.author_name.trim()
        ? payload.author_name.trim()
        : validated.provider === 'youtube'
          ? 'YouTube Creator'
          : 'SoundCloud Artist';

    const thumbnailUrl =
      typeof payload.thumbnail_url === 'string' &&
      payload.thumbnail_url.startsWith('https://')
        ? payload.thumbnail_url
        : null;

    return {
      provider: validated.provider,
      canonicalUrl: validated.normalizedUrl,
      title: rawTitle,
      artistName: rawAuthor,
      thumbnailUrl,
      durationSeconds: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
