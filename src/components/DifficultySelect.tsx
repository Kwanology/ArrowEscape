import React from 'react';
import { ArrowLeft, Calendar, Check, ChevronRight } from 'lucide-react';
import { calculateDailyStreak, DailyCalendarInfo } from '../engine/daily';
import { Difficulty, SaveState } from '../engine/types';
import { dailyPuzzleSaveKey } from '../services/storage';
import { DailyStreakBanner } from './DailyStreakBanner';

interface DifficultySelectProps {
  saveState: SaveState;
  dailyInfo: DailyCalendarInfo;
  onSelectDaily: () => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onBack: () => void;
}

interface DifficultyCardConfig {
  id: Difficulty;
  title: string;
  subtitle: string;
  bgClass: string;
  borderClass: string;
  titleClass: string;
  accentColor: string;
}

const DIFFICULTIES: DifficultyCardConfig[] = [
  {
    id: 'easy',
    title: 'Easy',
    subtitle: 'Dense 2x shapes · Gentle paths',
    bgClass: 'bg-emerald-50/90 hover:bg-emerald-100/80',
    borderClass: 'border-emerald-200',
    titleClass: 'text-emerald-950',
    accentColor: '#111827',
  },
  {
    id: 'medium',
    title: 'Medium',
    subtitle: 'Winding lines · Plan ahead',
    bgClass: 'bg-amber-50/90 hover:bg-amber-100/80',
    borderClass: 'border-amber-200',
    titleClass: 'text-amber-950',
    accentColor: '#111827',
  },
  {
    id: 'hard',
    title: 'Hard',
    subtitle: 'High-density grids · Deep chains',
    bgClass: 'bg-violet-50/90 hover:bg-violet-100/80',
    borderClass: 'border-violet-200',
    titleClass: 'text-violet-950',
    accentColor: '#111827',
  },
];

const DifficultyIllustration: React.FC<{ difficulty: Difficulty; color: string }> = ({
  difficulty,
  color,
}) => {
  if (difficulty === 'easy') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" />
        <path d="M 14 38 L 14 26 L 42 26" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="51,26 39,20 42,26 39,32" fill={color} />
      </svg>
    );
  }
  if (difficulty === 'medium') {
    return (
      <svg viewBox="0 0 64 64" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" />
        <path
          d="M 16 46 L 16 20 L 42 20"
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polygon points="51,20 40,14 43,20 40,26" fill={color} />
        <path d="M 28 46 L 46 46 L 46 32" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="46,24 41,34 46,31 51,34" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#FFFFFF" />
      <path
        d="M 15 46 L 15 17 L 36 17 L 36 35 L 44 35"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="52,35 42,30 44,35 42,40" fill={color} />
      <path d="M 25 48 L 25 28 L 46 28" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="53,28 43,23 45,28 43,33" fill={color} />
    </svg>
  );
};

export const DifficultySelect: React.FC<DifficultySelectProps> = ({
  saveState,
  dailyInfo,
  onSelectDaily,
  onSelectDifficulty,
  onBack,
}) => {
  const isDailyCompleted = (saveState.completedDailyDates ?? []).includes(
    dailyInfo.dateKey
  );
  const isDailyInProgress = Boolean(
    !isDailyCompleted &&
      saveState.activePuzzles[dailyPuzzleSaveKey(dailyInfo.dateKey)]
  );
  const normalSolvedCount =
    saveState.completedLevels.easy.length +
    saveState.completedLevels.medium.length +
    saveState.completedLevels.hard.length;
  const dailyStreak = calculateDailyStreak(
    saveState.completedDailyDates,
    normalSolvedCount,
    dailyInfo.dateKey
  );

  return (
    <div className="h-dvh overflow-hidden bg-sky-50/60 text-slate-900 flex flex-col">
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl flex items-center gap-2 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all font-medium cursor-pointer"
          aria-label="Back to main menu"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="whitespace-nowrap">Menu</span>
        </button>
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
          Choose Difficulty
        </h1>
        <div className="w-[76px]" aria-hidden="true" />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl w-full min-h-full mx-auto px-4 py-3.5 sm:py-4 flex flex-col justify-start sm:justify-center space-y-2.5 sm:space-y-3.5">
          {/* Attractive Daily Streak Stat Banner at top of Choose Difficulty */}
          <DailyStreakBanner streak={dailyStreak} variant="difficulty" />

          {/* Daily Puzzle Card — positioned above the 300-puzzle text and Easy button */}
          <button
            onClick={onSelectDaily}
            disabled={isDailyCompleted}
            aria-label={
              isDailyCompleted
                ? `Daily puzzle for ${dailyInfo.displayDate} already completed today`
                : `Play Daily Puzzle for ${dailyInfo.displayDate}`
            }
            className={`w-full p-3.5 sm:p-4 rounded-3xl border shadow-xs transition-all flex items-center gap-3.5 sm:gap-4 text-left ${
              isDailyCompleted
                ? 'bg-slate-100/90 border-slate-200 text-slate-600 cursor-default'
                : 'bg-sky-100/80 hover:bg-sky-100 border-sky-300/80 active:scale-[0.99] cursor-pointer'
            }`}
          >
            <div
              className={`w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white flex items-center justify-center shrink-0 ${
                isDailyCompleted ? 'text-emerald-600' : 'text-sky-600'
              }`}
            >
              {isDailyCompleted ? (
                <Check className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
              ) : (
                <Calendar className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <h2
                  className={`font-display text-xl sm:text-2xl font-bold ${
                    isDailyCompleted ? 'text-slate-700' : 'text-sky-950'
                  }`}
                >
                  Daily Puzzle
                </h2>
                <span className="text-xs sm:text-sm font-semibold text-slate-600 tabular-nums shrink-0">
                  {dailyInfo.displayDate}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-snug">
                {isDailyCompleted
                  ? 'Solved today · Next tomorrow'
                  : isDailyInProgress
                  ? 'Medium · In progress'
                  : 'Medium · 1 puzzle per day'}
              </p>
            </div>
            {!isDailyCompleted && (
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600/70 shrink-0" />
            )}
          </button>

          <div className="text-center pt-0.5">
            <p className="text-xs sm:text-sm text-slate-600">
              All 300 puzzles open to play in any order.
            </p>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {DIFFICULTIES.map((diff) => {
              const completedCount = saveState.completedLevels[diff.id].length;
              return (
                <button
                  key={diff.id}
                  onClick={() => onSelectDifficulty(diff.id)}
                  className={`w-full p-3.5 sm:p-4 rounded-3xl border ${diff.bgClass} ${diff.borderClass} shadow-xs active:scale-[0.99] transition-all flex items-center gap-3.5 sm:gap-4 text-left cursor-pointer`}
                >
                  <DifficultyIllustration
                    difficulty={diff.id}
                    color={diff.accentColor}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2
                        className={`font-display text-xl sm:text-2xl font-bold ${diff.titleClass}`}
                      >
                        {diff.title}
                      </h2>
                      <span className="text-xs sm:text-sm font-semibold text-slate-600 tabular-nums shrink-0">
                        {completedCount} / 100
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-snug">
                      {diff.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
