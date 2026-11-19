import React, { useMemo } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Difficulty } from '../engine/types';
import { HappyFaceIcon } from './HappyFaceIcon';

interface VictoryOverlayProps {
  difficulty: Difficulty;
  levelId: number;
  theme: string;
  dailyDisplayDate?: string;
  dailyStreak?: number;
  animationIntensity: number; // 1..10
  onContinue: () => void; // Returns to Level Selection or Difficulty Selection
  onNextLevel?: () => void;
}

const MESSAGES = [
  'Congratulations!',
  'Wonderful Job!',
  'Board Cleared!',
  'Smooth Escape!',
  'Way to Go!',
];

const HAPPY_COLORS = ['#FBBF24', '#38BDF8', '#34D399', '#F472B6', '#A78BFA', '#FB923C'];
const CONFETTI_COLORS = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#2DD4BF'];

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
  difficulty,
  levelId,
  theme,
  dailyDisplayDate,
  dailyStreak,
  animationIntensity,
  onContinue,
  onNextLevel,
}) => {
  const message = MESSAGES[(levelId - 1) % MESSAGES.length];

  const floatingFaces = useMemo(() => {
    const count = Math.max(3, Math.round(animationIntensity * 1.4));
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${6 + ((i * 89) % 88)}%`,
      delay: `${(i % 5) * 0.22}s`,
      duration: `${2.8 + (i % 4) * 0.45}s`,
      drift: `${((i % 2 === 0 ? 1 : -1) * (15 + (i * 11) % 35))}px`,
      size: 36 + (i % 3) * 10,
      color: HAPPY_COLORS[i % HAPPY_COLORS.length],
    }));
  }, [animationIntensity]);

  const confettiPieces = useMemo(() => {
    const count = Math.max(8, Math.round(animationIntensity * 4.5));
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${(i * 97) % 100}%`,
      delay: `${(i % 7) * 0.14}s`,
      duration: `${2.4 + (i % 5) * 0.35}s`,
      sway: `${((i % 2 === 0 ? 1 : -1) * (18 + (i * 13) % 45))}px`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      isRound: i % 3 === 0,
    }));
  }, [animationIntensity]);

  const difficultyLabel =
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      {/* Rainbow Arc Backdrop */}
      <div className="pointer-events-none fixed inset-x-0 top-6 flex justify-center animate-rainbow-bloom">
        <svg viewBox="0 0 400 180" className="w-[340px] sm:w-[460px] opacity-85" aria-hidden="true">
          <path d="M 20 170 A 180 150 0 0 1 380 170" fill="none" stroke="#FCA5A5" strokeWidth="14" strokeLinecap="round" opacity="0.65" />
          <path d="M 36 170 A 164 134 0 0 1 364 170" fill="none" stroke="#FCD34D" strokeWidth="14" strokeLinecap="round" opacity="0.65" />
          <path d="M 52 170 A 148 118 0 0 1 348 170" fill="none" stroke="#6EE7B7" strokeWidth="14" strokeLinecap="round" opacity="0.65" />
          <path d="M 68 170 A 132 102 0 0 1 332 170" fill="none" stroke="#7DD3FC" strokeWidth="14" strokeLinecap="round" opacity="0.65" />
          <path d="M 84 170 A 116 86 0 0 1 316 170" fill="none" stroke="#C4B5FD" strokeWidth="14" strokeLinecap="round" opacity="0.65" />
        </svg>
      </div>

      {/* Falling Confetti */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {confettiPieces.map((c) => (
          <div
            key={c.id}
            className={`absolute top-0 animate-confetti-fall ${
              c.isRound ? 'w-3 h-3 rounded-full' : 'w-2.5 h-4 rounded-sm'
            }`}
            style={{
              left: c.left,
              backgroundColor: c.color,
              animationDelay: c.delay,
              ['--fall-dur' as string]: c.duration,
              ['--sway-x' as string]: c.sway,
            }}
          />
        ))}
      </div>

      {/* Floating Happy Faces */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {floatingFaces.map((f) => (
          <div
            key={f.id}
            className="absolute -bottom-16 animate-happy-float"
            style={{
              left: f.left,
              animationDelay: f.delay,
              ['--float-dur' as string]: f.duration,
              ['--drift-x' as string]: f.drift,
            }}
          >
            <HappyFaceIcon
              color={f.color}
              className="drop-shadow-md"
              style={{ width: f.size, height: f.size }}
            />
          </div>
        ))}
      </div>

      {/* Victory Card */}
      <div className="relative z-10 bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-amber-200/80 text-center space-y-5">
        <div className="flex justify-center">
          <div className="relative">
            <HappyFaceIcon className="w-20 h-20 animate-gentle-bob drop-shadow-sm" />
            <Sparkles className="w-6 h-6 text-amber-500 absolute -top-1 -right-2" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-sky-600">
            {dailyDisplayDate
              ? `Daily Puzzle · ${dailyDisplayDate} · ${theme}`
              : `${difficultyLabel} · Level ${levelId} · ${theme}`}
          </p>
          <h2
            id="victory-title"
            className="font-display text-3xl font-bold text-slate-900"
          >
            {message}
          </h2>
          <p className="text-slate-600 text-sm">
            Every single arrow escaped. Great job!
          </p>
          {dailyDisplayDate && dailyStreak !== undefined && dailyStreak > 0 && (
            <p className="text-sm font-bold text-orange-600 tabular-nums pt-0.5">
              {dailyStreak} day streak! Keep going!
            </p>
          )}
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            onClick={onContinue}
            className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-display font-bold text-lg shadow-sm transition-all cursor-pointer"
          >
            Back to Menu
          </button>

          {onNextLevel && levelId < 100 && (
            <button
              onClick={onNextLevel}
              className="w-full min-h-[46px] px-6 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 active:scale-[0.98] text-sky-700 font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Play Level {levelId + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
