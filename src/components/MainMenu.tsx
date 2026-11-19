import React from 'react';
import { HelpCircle, Play, RotateCw, Settings } from 'lucide-react';
import { calculateDailyStreak, DailyCalendarInfo } from '../engine/daily';
import { Difficulty, SaveState } from '../engine/types';
import { dailyPuzzleSaveKey, puzzleSaveKey } from '../services/storage';
import { DailyStreakBanner } from './DailyStreakBanner';

interface MainMenuProps {
  saveState: SaveState;
  dailyInfo: DailyCalendarInfo;
  onPlay: () => void;
  onContinue: (difficulty: Difficulty, levelId: number) => void;
  onContinueDaily: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveState,
  dailyInfo,
  onPlay,
  onContinue,
  onContinueDaily,
  onOpenSettings,
  onOpenHowToPlay,
}) => {
  const lastOpened = saveState.lastOpenedLevel;
  const isDailyContinue = Boolean(
    lastOpened?.isDaily &&
      lastOpened.dailyDateKey === dailyInfo.dateKey &&
      !(saveState.completedDailyDates ?? []).includes(dailyInfo.dateKey) &&
      saveState.activePuzzles[dailyPuzzleSaveKey(dailyInfo.dateKey)]
  );
  const standardKey =
    lastOpened && !lastOpened.isDaily
      ? puzzleSaveKey(lastOpened.difficulty, lastOpened.levelId)
      : null;
  const isStandardContinue = Boolean(
    standardKey && saveState.activePuzzles[standardKey]
  );
  const hasActiveContinue = isDailyContinue || isStandardContinue;

  const totalCompleted =
    saveState.completedLevels.easy.length +
    saveState.completedLevels.medium.length +
    saveState.completedLevels.hard.length;

  const dailyStreak = calculateDailyStreak(
    saveState.completedDailyDates,
    totalCompleted,
    dailyInfo.dateKey
  );

  const continueLabel = isDailyContinue
    ? `Daily · ${dailyInfo.monthDay}`
    : lastOpened
    ? `${lastOpened.difficulty.charAt(0).toUpperCase() + lastOpened.difficulty.slice(1)} · Level ${lastOpened.levelId}`
    : '';

  return (
    <div className="h-dvh overflow-hidden bg-gradient-to-b from-sky-50 via-white to-emerald-50/60 text-slate-900 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Progress Bar + Settings */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between min-h-[44px] shrink-0">
        <span className="text-sm font-medium text-slate-500 tabular-nums">
          {totalCompleted} / 300 Puzzles Solved
        </span>
        <button
          onClick={onOpenSettings}
          className="min-h-[44px] min-w-[44px] px-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs text-slate-700 hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden sm:inline text-sm font-semibold">Settings</span>
        </button>
      </div>

      {/* Prominent Daily Streak at Top of Main Menu */}
      <div className="max-w-lg w-full mx-auto pt-2 shrink-0">
        <DailyStreakBanner streak={dailyStreak} variant="menu" />
      </div>

      {/* Main Center Hero & Controls */}
      <main className="max-w-lg w-full mx-auto my-auto py-2 flex flex-col items-center text-center space-y-4 sm:space-y-5">
        {/* Cheerful Interlocking Arrow Emblem — thin black ink arrows */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center animate-gentle-bob shrink-0">
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full drop-shadow-sm"
            aria-hidden="true"
          >
            <rect
              x="12"
              y="12"
              width="136"
              height="136"
              rx="34"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="3"
            />
            <path
              d="M 38 66 L 38 42 L 106 42"
              fill="none"
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points="124,42 102,32 107,42 102,52" fill="#111827" />
            <path
              d="M 116 68 L 116 108"
              fill="none"
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <polygon points="116,126 106,104 116,109 126,104" fill="#111827" />
            <path
              d="M 94 118 L 52 118"
              fill="none"
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <polygon points="34,118 56,108 51,118 56,128" fill="#111827" />
            <path
              d="M 76 96 L 76 70 L 50 70"
              fill="none"
              stroke="#111827"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points="34,70 54,61 50,70 54,79" fill="#111827" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance">
            ARROW ESCAPE
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
            Release arrows in order to clear the board.
          </p>
        </div>

        {/* Action Stack */}
        <div className="w-full max-w-xs space-y-2.5 sm:space-y-3">
          <button
            onClick={onPlay}
            className="w-full min-h-[54px] sm:min-h-[58px] px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white font-display font-bold text-xl shadow-md shadow-sky-500/20 flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>Play</span>
          </button>

          {hasActiveContinue && lastOpened ? (
            <button
              onClick={() =>
                isDailyContinue
                  ? onContinueDaily()
                  : onContinue(lastOpened.difficulty, lastOpened.levelId)
              }
              className="w-full min-h-[50px] sm:min-h-[54px] px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-display font-bold text-lg shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <RotateCw className="w-5 h-5" />
              <span className="truncate">Continue · {continueLabel}</span>
            </button>
          ) : (
            <button
              disabled
              className="w-full min-h-[48px] px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-400 font-display font-semibold text-base flex items-center justify-center gap-2 cursor-not-allowed"
              title="Start any puzzle to enable Continue"
            >
              <RotateCw className="w-4 h-4" />
              <span>Continue</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <button
              onClick={onOpenHowToPlay}
              className="min-h-[46px] px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span className="whitespace-nowrap">How to Play</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="min-h-[46px] px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-sky-500" />
              <span className="whitespace-nowrap">Settings</span>
            </button>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl w-full mx-auto text-center py-1 shrink-0">
        <p className="text-xs text-slate-400">
          300 Puzzles + Daily · Offline
        </p>
      </footer>
    </div>
  );
};

