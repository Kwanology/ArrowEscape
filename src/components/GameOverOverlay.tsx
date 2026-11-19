import React from 'react';
import { Heart, HeartCrack, RotateCcw } from 'lucide-react';
import { Difficulty } from '../engine/types';

interface GameOverOverlayProps {
  difficulty: Difficulty;
  levelId: number;
  theme: string;
  dailyDisplayDate?: string;
  maxLives: number;
  onRetry: () => void;
  onBackToMenu: () => void;
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  difficulty,
  levelId,
  theme,
  dailyDisplayDate,
  maxLives,
  onRetry,
  onBackToMenu,
}) => {
  const difficultyLabel =
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="relative z-10 bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-rose-200/80 text-center space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200/70 flex items-center justify-center">
            <HeartCrack className="w-9 h-9 text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: maxLives }, (_, idx) => (
              <Heart key={idx} className="w-4 h-4 text-slate-300" />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-rose-600">
            {dailyDisplayDate
              ? `Daily Puzzle · ${dailyDisplayDate} · ${theme}`
              : `${difficultyLabel} · Level ${levelId} · ${theme}`}
          </p>
          <h2
            id="gameover-title"
            className="font-display text-3xl font-bold text-slate-900 text-balance"
          >
            Game Over
          </h2>
          <p className="text-slate-600 text-sm">
            All {maxLives} lives were lost on blocked arrows. Try again with all lives restored.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            onClick={onRetry}
            className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-display font-bold text-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Try Again</span>
          </button>

          <button
            onClick={onBackToMenu}
            className="w-full min-h-[46px] px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
