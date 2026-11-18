import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Disc3,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { formatDuration, usePlayerStore } from '../store/playerStore';
import {
  scoreVibeQuiz,
  VIBE_QUIZ_DATA,
  type StoredVibeProfile,
  type VibeArchetype,
} from '../store/vibeQuiz';
import { postToQueueTrack, type FeedPost } from '../types/hub';

interface VibeQuizModalProps {
  isOpen: boolean;
  recommendedPool: FeedPost[];
  initialArchetype?: VibeArchetype | null;
  isSignedIn?: boolean;
  onSkip: () => void;
  onComplete: (profile: StoredVibeProfile, archetype: VibeArchetype) => void;
  onProceedToSignUp: () => void;
  onExploreFeed: (archetype: VibeArchetype) => void;
}

type QuizPhase = 'questions' | 'loading' | 'reveal';

const CATEGORY_LABELS: Record<'music' | 'food' | 'lifestyle', string> = {
  music: 'Sound & Taste',
  food: 'Late-Night Fuel',
  lifestyle: 'Daily Rhythm',
};

export function VibeQuizModal({
  isOpen,
  recommendedPool,
  initialArchetype = null,
  isSignedIn = false,
  onSkip,
  onComplete,
  onProceedToSignUp,
  onExploreFeed,
}: VibeQuizModalProps) {
  const playTrack = usePlayerStore((s) => s.playTrack);

  const [phase, setPhase] = useState<QuizPhase>(
    initialArchetype ? 'reveal' : 'questions',
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealedArchetype, setRevealedArchetype] = useState<VibeArchetype | null>(
    initialArchetype,
  );
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialArchetype) {
      setPhase('reveal');
      setRevealedArchetype(initialArchetype);
    } else {
      setPhase('questions');
      setStepIndex(0);
      setAnswers({});
      setRevealedArchetype(null);
    }
    setCopiedShare(false);
  }, [isOpen, initialArchetype]);

  if (!isOpen) return null;

  const questions = VIBE_QUIZ_DATA.questions;
  const currentQuestion = questions[stepIndex];

  const handleSelectOption = (optionId: string) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: optionId };
    setAnswers(nextAnswers);

    if (stepIndex < questions.length - 1) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    // Short loading moment between quiz and reveal
    setPhase('loading');
    const { archetype, tagScores } = scoreVibeQuiz(nextAnswers);
    const profile: StoredVibeProfile = {
      completedAt: new Date().toISOString(),
      skipped: false,
      archetypeId: archetype.id,
      answers: nextAnswers,
      tagScores,
    };

    window.setTimeout(() => {
      setRevealedArchetype(archetype);
      setPhase('reveal');
      onComplete(profile, archetype);
    }, 1350);
  };

  const handleRetake = () => {
    setAnswers({});
    setStepIndex(0);
    setRevealedArchetype(null);
    setCopiedShare(false);
    setPhase('questions');
  };

  const handleShare = async () => {
    if (!revealedArchetype) return;
    const sharePayload = `${revealedArchetype.shareText}\n${revealedArchetype.description}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `SONA Vibe: ${revealedArchetype.name}`,
          text: sharePayload,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(sharePayload);
      }
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // Fallback clipboard if user canceled native share
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(sharePayload).catch(() => {});
        setCopiedShare(true);
        window.setTimeout(() => setCopiedShare(false), 2500);
      }
    }
  };

  const matchedTracks = revealedArchetype
    ? [...recommendedPool]
        .sort((a, b) => {
          const scoreA = a.tags.filter((t) =>
            revealedArchetype.feedTags.includes(t),
          ).length;
          const scoreB = b.tags.filter((t) =>
            revealedArchetype.feedTags.includes(t),
          ).length;
          return scoreB - scoreA;
        })
        .slice(0, 3)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vibe-quiz-heading"
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-[#DDD5C7] bg-[#FCF9F4] shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-[#DDD5C7] px-6 py-4 bg-[#EFE9DE]/70">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-lg font-semibold text-[#1F1B18]">
              SONA
            </span>
            <span className="text-[#5C534A]" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-[#5C534A]">
              {phase === 'reveal'
                ? 'Your Taste Profile'
                : `${VIBE_QUIZ_DATA.title} (~${VIBE_QUIZ_DATA.estimatedSeconds}s)`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {phase === 'questions' && (
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
              >
                Skip for now
              </button>
            )}
            <button
              type="button"
              onClick={onSkip}
              aria-label="Close vibe quiz"
              className="p-1 text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {phase === 'questions' && currentQuestion && (
            <div className="space-y-6">
              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#5C534A]">
                  <span className="font-medium text-[#B84A2E]">
                    {CATEGORY_LABELS[currentQuestion.category]}
                  </span>
                  <span className="font-mono-tabular">
                    {stepIndex + 1} / {questions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EFE9DE] overflow-hidden">
                  <div
                    className="h-full bg-[#B84A2E] rounded-full transition-all duration-300"
                    style={{
                      width: `${((stepIndex + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <h2
                  id="vibe-quiz-heading"
                  className="font-display text-2xl sm:text-3xl font-semibold text-[#1F1B18] leading-snug text-balance"
                >
                  {currentQuestion.question}
                </h2>
                {stepIndex === 0 && (
                  <p className="mt-2 text-xs text-[#5C534A]">
                    {VIBE_QUIZ_DATA.subtitle}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((option) => {
                  const selected = answers[currentQuestion.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectOption(option.id)}
                      className={`group text-left rounded-xl border p-4 transition-all cursor-pointer flex items-start gap-3.5 ${
                        selected
                          ? 'border-[#B84A2E] bg-[#B84A2E]/8 shadow-xs'
                          : 'border-[#DDD5C7] bg-[#F7F3EC] hover:border-[#1F1B18]/40 hover:bg-[#EFE9DE]/60'
                      }`}
                    >
                      <span
                        className="text-2xl leading-none shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        {option.emoji}
                      </span>
                      <span className="text-sm font-medium text-[#1F1B18] leading-snug">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="text-[11px] text-[#5C534A]">
                  Tap an answer to continue
                </span>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-5">
              <div className="w-16 h-16 rounded-full border border-[#DDD5C7] bg-[#EFE9DE] flex items-center justify-center text-[#B84A2E] animate-spin">
                <Disc3 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2
                  id="vibe-quiz-heading"
                  className="font-display text-2xl font-semibold text-[#1F1B18]"
                >
                  {VIBE_QUIZ_DATA.loadingMessage}
                </h2>
                <p className="text-xs text-[#5C534A]">
                  Matching your sound, late-night snacks, and daily rhythm
                </p>
              </div>
            </div>
          )}

          {phase === 'reveal' && revealedArchetype && (
            <div className="space-y-8">
              {/* STEP 1 OF REVEAL: Personality Type Reveal (shown first & shareable) */}
              <section className="rounded-xl border border-[#DDD5C7] bg-[#F7F3EC] p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-[#B84A2E]">
                      Your Listener Archetype
                    </p>
                    <h2
                      id="vibe-quiz-heading"
                      className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#1F1B18] text-balance"
                    >
                      {revealedArchetype.name}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#DDD5C7] bg-[#FCF9F4] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer shrink-0"
                  >
                    {copiedShare ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#B84A2E]" />
                        <span>Copied to share!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Vibe</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-sm sm:text-base leading-relaxed text-[#1F1B18]">
                  {revealedArchetype.description}
                </p>

                <p className="text-xs text-[#5C534A]">
                  Tuned for: {revealedArchetype.feedTags.map((t) => `#${t}`).join(' · ')}
                </p>
              </section>

              {/* STEP 2 OF REVEAL: Matched Artists (Most to Least Mainstream) */}
              <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 border-b border-[#DDD5C7] pb-2">
                  <h3 className="font-display text-xl font-semibold text-[#1F1B18]">
                    Artists Made for Your Ears
                  </h3>
                  <span className="text-[11px] text-[#5C534A]">
                    Mainstream → Deep Cuts
                  </span>
                </div>

                <ol className="divide-y divide-[#DDD5C7] rounded-xl border border-[#DDD5C7] bg-[#FCF9F4]">
                  {revealedArchetype.artists.map((artist, idx) => (
                    <li
                      key={artist.name}
                      className="flex items-start gap-3.5 px-4 py-3"
                    >
                      <span className="font-mono-tabular text-xs font-semibold text-[#B84A2E] pt-0.5 w-5 shrink-0">
                        0{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1F1B18]">
                          {artist.name}
                        </p>
                        <p className="text-xs text-[#5C534A] leading-relaxed">
                          {artist.reason}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* STEP 3: Recommended SONA Tracks */}
              {matchedTracks.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-display text-lg font-semibold text-[#1F1B18]">
                    Recommended Tracks to Spin First
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {matchedTracks.map((trk) => (
                      <button
                        key={trk.id}
                        type="button"
                        onClick={() => playTrack(postToQueueTrack(trk))}
                        className="text-left rounded-lg border border-[#DDD5C7] bg-[#F7F3EC] p-3 hover:border-[#B84A2E] transition-colors cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#5C534A]">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#B84A2E]">
                            <Play className="w-3 h-3" />
                            <span>Spin</span>
                          </span>
                          <span className="font-mono-tabular">
                            {formatDuration(trk.durationSeconds)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#1F1B18] line-clamp-1">
                          {trk.title}
                        </p>
                        <p className="text-[11px] text-[#5C534A] truncate">
                          {trk.artistName}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions: Sign up / Explore / Retake */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDD5C7] pt-5">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C534A] hover:text-[#1F1B18] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Quiz</span>
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onExploreFeed(revealedArchetype)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#DDD5C7] bg-[#F7F3EC] text-xs font-semibold text-[#1F1B18] hover:border-[#B84A2E] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#B84A2E]" />
                    <span>Explore Recommended Feed</span>
                  </button>
                  {!isSignedIn && (
                    <button
                      type="button"
                      onClick={onProceedToSignUp}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#B84A2E] text-xs font-semibold text-[#FCF9F4] hover:bg-[#9E3D24] cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Sign Up with Invite</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
