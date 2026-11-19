import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { getLevelsForDifficulty } from '../engine/levelLoader';
import { Difficulty, SaveState } from '../engine/types';
import { puzzleSaveKey } from '../services/storage';
import { HappyFaceIcon } from './HappyFaceIcon';

interface LevelSelectProps {
  difficulty: Difficulty;
  saveState: SaveState;
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
}

const ACCENT_THEMES: Record<
  Difficulty,
  {
    headerBg: string;
    title: string;
    buttonHover: string;
    startedRing: string;
    startedBar: string;
    completedBg: string;
  }
> = {
  easy: {
    headerBg: 'bg-emerald-50/90',
    title: 'Easy Puzzles',
    buttonHover: 'hover:border-emerald-400 hover:bg-emerald-50/50',
    startedRing: 'border-emerald-400 bg-emerald-50/40',
    startedBar: 'bg-emerald-500',
    completedBg: 'bg-emerald-50 border-emerald-300',
  },
  medium: {
    headerBg: 'bg-amber-50/90',
    title: 'Medium Puzzles',
    buttonHover: 'hover:border-amber-400 hover:bg-amber-50/50',
    startedRing: 'border-amber-400 bg-amber-50/40',
    startedBar: 'bg-amber-500',
    completedBg: 'bg-amber-50 border-amber-300',
  },
  hard: {
    headerBg: 'bg-violet-50/90',
    title: 'Hard Puzzles',
    buttonHover: 'hover:border-violet-400 hover:bg-violet-50/50',
    startedRing: 'border-violet-400 bg-violet-50/40',
    startedBar: 'bg-violet-500',
    completedBg: 'bg-violet-50 border-violet-300',
  },
};

export const LevelSelect: React.FC<LevelSelectProps> = ({
  difficulty,
  saveState,
  onSelectLevel,
  onBack,
}) => {
  const levels = getLevelsForDifficulty(difficulty);
  const completedSet = new Set(saveState.completedLevels[difficulty]);
  const theme = ACCENT_THEMES[difficulty];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Compact Sticky Header (<15% mobile height) */}
      <header
        className={`sticky top-0 z-20 ${theme.headerBg} backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between`}
      >
        <button
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl flex items-center gap-2 text-slate-800 hover:bg-white/70 active:scale-95 transition-all font-medium cursor-pointer"
          aria-label="Back to difficulty selection"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="whitespace-nowrap">Back</span>
        </button>

        <div className="text-center min-w-0">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 truncate">
            {theme.title}
          </h1>
          <p className="text-xs text-slate-600 tabular-nums">
            {completedSet.size} / 100 Completed
          </p>
        </div>

        <div className="w-[76px]" aria-hidden="true" />
      </header>

      {/* 4 columns x 25 rows = 100 levels */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-5">
        <div
          className="grid grid-cols-4 gap-2.5 sm:gap-3.5"
          role="grid"
          aria-label={`${theme.title} grid`}
        >
          {levels.map((level) => {
            const isCompleted = completedSet.has(level.id);
            const activeSave =
              saveState.activePuzzles[puzzleSaveKey(difficulty, level.id)];
            const isStarted =
              !isCompleted &&
              activeSave !== undefined &&
              activeSave.removedArrowIds.length > 0;
            const isLastOpened =
              saveState.lastOpenedLevel?.difficulty === difficulty &&
              saveState.lastOpenedLevel?.levelId === level.id;

            const progressRatio = isStarted
              ? activeSave.removedArrowIds.length / Math.max(1, level.arrows.length)
              : 0;

            return (
              <button
                key={level.id}
                onClick={() => onSelectLevel(level.id)}
                aria-label={`Level ${level.id}, ${level.theme}${
                  isCompleted ? ', completed' : isStarted ? ', in progress' : ''
                }`}
                className={`relative min-h-[68px] sm:min-h-[78px] rounded-2xl border-2 p-2 flex flex-col items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isCompleted
                    ? theme.completedBg
                    : isStarted || isLastOpened
                    ? theme.startedRing
                    : `bg-white border-slate-200 ${theme.buttonHover}`
                }`}
              >
                {isCompleted ? (
                  <div className="relative flex flex-col items-center justify-center">
                    <HappyFaceIcon className="w-8 h-8 sm:w-9 sm:h-9" />
                    <span className="text-[11px] font-bold tabular-nums text-slate-700 mt-0.5 leading-none">
                      {level.id}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="font-display text-xl sm:text-2xl font-bold tabular-nums text-slate-800 leading-none">
                      {level.id}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate max-w-full px-1">
                      {level.theme}
                    </span>
                    {(isStarted || isLastOpened) && (
                      <div className="w-4/5 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full ${theme.startedBar}`}
                          style={{
                            width: `${Math.max(15, Math.round(progressRatio * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
};
