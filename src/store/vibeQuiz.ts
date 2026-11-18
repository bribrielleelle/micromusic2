import quizJson from '../data/vibeQuiz.json';

export type QuizCategory = 'music' | 'food' | 'lifestyle';

export interface QuizOption {
  id: string;
  emoji: string;
  label: string;
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  options: QuizOption[];
}

export interface MatchedArtist {
  name: string;
  mainstreamTier: number;
  reason: string;
}

export interface VibeArchetype {
  id: string;
  name: string;
  tagline: string;
  description: string;
  shareText: string;
  matchTags: string[];
  feedTags: string[];
  artists: MatchedArtist[];
}

export interface VibeQuizSpec {
  version: string;
  title: string;
  subtitle: string;
  estimatedSeconds: number;
  loadingMessage: string;
  weights: Record<QuizCategory, number>;
  questions: QuizQuestion[];
  archetypes: VibeArchetype[];
}

export interface StoredVibeProfile {
  completedAt: string | null;
  skipped: boolean;
  archetypeId: string | null;
  answers: Record<string, string>;
  tagScores: Record<string, number>;
}

export const VIBE_QUIZ_DATA = quizJson as VibeQuizSpec;
const STORAGE_KEY = 'sona-vibe-quiz-v1';

export function loadVibeProfile(): StoredVibeProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredVibeProfile;
  } catch {
    return null;
  }
}

export function saveVibeProfile(profile: StoredVibeProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearVibeProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getArchetypeById(id: string | null | undefined): VibeArchetype | null {
  if (!id) return null;
  return VIBE_QUIZ_DATA.archetypes.find((a) => a.id === id) ?? null;
}

export function scoreVibeQuiz(answers: Record<string, string>): {
  archetype: VibeArchetype;
  tagScores: Record<string, number>;
} {
  const tagScores: Record<string, number> = {};

  for (const question of VIBE_QUIZ_DATA.questions) {
    const selectedOptionId = answers[question.id];
    if (!selectedOptionId) continue;
    const option = question.options.find((opt) => opt.id === selectedOptionId);
    if (!option) continue;

    const weight = VIBE_QUIZ_DATA.weights[question.category] ?? 1;
    for (const tag of option.tags) {
      tagScores[tag] = (tagScores[tag] ?? 0) + weight;
    }
  }

  let bestArchetype = VIBE_QUIZ_DATA.archetypes[0];
  let bestScore = -1;

  for (const archetype of VIBE_QUIZ_DATA.archetypes) {
    const rawScore = archetype.matchTags.reduce(
      (sum, tag) => sum + (tagScores[tag] ?? 0),
      0,
    );
    const normalizedScore = rawScore / Math.max(archetype.matchTags.length, 1);
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestArchetype = archetype;
    }
  }

  return { archetype: bestArchetype, tagScores };
}
