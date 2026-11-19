import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface SoundCloudTrackInput {
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

export interface PlatformTrackCandidate {
  id: string;
  title: string;
  artistName: string;
  provider: 'youtube' | 'soundcloud';
  tags: string[];
  curatorUsername: string;
  likeCount: number;
  viewCount: number;
}

export interface PlatformCuratorCandidate {
  id: string;
  username: string;
  bio: string | null;
  isVerifiedArtist: boolean;
  verifiedArtistName: string | null;
  sampleTags: string[];
  sampleArtists: string[];
}

export interface TasteAnalysisResult {
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
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in Secrets. Add GEMINI_API_KEY in Settings > Secrets to run AI taste analysis.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function analyzeSoundCloudTasteProfile(params: {
  soundcloudTracks: SoundCloudTrackInput[];
  newlyAddedTrackTitles: string[];
  platformTracks: PlatformTrackCandidate[];
  platformCurators: PlatformCuratorCandidate[];
}): Promise<TasteAnalysisResult> {
  const ai = getGeminiClient();

  const systemInstruction = `You are SONA's music curator and sonic taste analyst.
Analyze the user's real-time SoundCloud Liked Tracks payload to:
1. Extract their core sonic profile: dominant genres, moods, tempo/BPM range, and exact balance of underground vs. mainstream artists (as an integer undergroundPercentage 0-100 plus a concise analytical note).
2. Curate a personalized aesthetic Discovery Crate using ONLY postId values present in the provided platformTracks list. Recommend up to 6 tracks (or all available if fewer than 6 exist) ordered from highest to lowest fit. Never invent a postId.
3. Recommend 2-3 other users/Tastemakers using ONLY username values present in the provided platformCurators list who share overlapping genres, moods, or sonic aesthetics. Never invent a username.
4. Provide a concise realtimeAdaptationNote explaining how the user's latest SoundCloud Liked Tracks (especially any newlyAddedTrackTitles if present) shape today's crate.
Keep descriptions vivid, grounded, editorial, and free of hype clichés.`;

  const promptPayload = {
    soundcloudLikedTracks: params.soundcloudTracks,
    newlyAddedTrackTitles: params.newlyAddedTrackTitles,
    platformTracks: params.platformTracks,
    platformCurators: params.platformCurators,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this SoundCloud listening history and generate today's personalized Discovery Crate and recommended Tastemakers:\n\n${JSON.stringify(promptPayload, null, 2)}`,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sonicProfile: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              dominantGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
              moods: { type: Type.ARRAY, items: { type: Type.STRING } },
              tempoRangeBpm: { type: Type.STRING },
              undergroundPercentage: { type: Type.INTEGER },
              mainstreamVsUndergroundBalance: { type: Type.STRING },
              vibeKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'summary',
              'dominantGenres',
              'moods',
              'tempoRangeBpm',
              'undergroundPercentage',
              'mainstreamVsUndergroundBalance',
              'vibeKeywords',
            ],
          },
          discoveryCrate: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              aestheticMood: { type: Type.STRING },
              tracks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    postId: { type: Type.STRING },
                    whyItFits: { type: Type.STRING },
                    matchScore: { type: Type.INTEGER },
                  },
                  required: ['postId', 'whyItFits', 'matchScore'],
                },
              },
            },
            required: ['title', 'description', 'aestheticMood', 'tracks'],
          },
          recommendedTastemakers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                username: { type: Type.STRING },
                overlapPercent: { type: Type.INTEGER },
                sharedGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
                reason: { type: Type.STRING },
              },
              required: ['username', 'overlapPercent', 'sharedGenres', 'reason'],
            },
          },
          realtimeAdaptationNote: { type: Type.STRING },
        },
        required: [
          'sonicProfile',
          'discoveryCrate',
          'recommendedTastemakers',
          'realtimeAdaptationNote',
        ],
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Gemini returned an empty taste analysis response.');
  }

  const parsed = JSON.parse(text) as TasteAnalysisResult;
  const validPostIds = new Set(params.platformTracks.map((t) => t.id));
  const validUsernames = new Map(
    params.platformCurators.map((c) => [c.username.toLowerCase(), c.username]),
  );

  parsed.discoveryCrate.tracks = (parsed.discoveryCrate.tracks ?? []).filter((t) =>
    validPostIds.has(t.postId),
  );
  parsed.recommendedTastemakers = (parsed.recommendedTastemakers ?? [])
    .filter((u) => validUsernames.has(u.username.replace(/^@/, '').toLowerCase()))
    .map((u) => ({
      ...u,
      username: validUsernames.get(u.username.replace(/^@/, '').toLowerCase()) ?? u.username,
    }))
    .slice(0, 3);

  return parsed;
}
