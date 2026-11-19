import React from 'react';
import { Snowflake } from 'lucide-react';
import { DailyStreakInfo } from '../engine/daily';

interface DailyStreakBannerProps {
  streak: DailyStreakInfo;
  variant: 'menu' | 'difficulty';
}

const StreakEmblem: React.FC<{
  active: boolean;
  frozen: boolean;
  sizeClass: string;
}> = ({ active, frozen, sizeClass }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${sizeClass} shrink-0`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="streak-flame-outer" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={frozen ? '#0284C7' : active ? '#EA580C' : '#94A3B8'} />
          <stop offset="55%" stopColor={frozen ? '#38BDF8' : active ? '#F97316' : '#CBD5E1'} />
          <stop offset="100%" stopColor={frozen ? '#7DD3FC' : active ? '#FBBF24' : '#E2E8F0'} />
        </linearGradient>
        <linearGradient id="streak-flame-inner" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor={frozen ? '#E0F2FE' : active ? '#FDE047' : '#F1F5F9'} />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      <circle
        cx="32"
        cy="32"
        r="28"
        fill={frozen ? '#E0F2FE' : active ? '#FEF3C7' : '#F1F5F9'}
      />

      <path
        d="M34.5 10C34.5 10 46 20.5 46 33.5C46 43.2 39.6 51 32 51C24.4 51 18 43.4 18 34.2C18 26.8 22.8 20.5 25.2 18.2C25.2 22.4 27.6 25.2 27.6 25.2C27.6 25.2 28.4 15.6 34.5 10Z"
        fill="url(#streak-flame-outer)"
      />

      <path
        d="M32.4 27C32.4 27 38.5 32.5 38.5 38.8C38.5 43.5 35.6 47.2 32 47.2C28.4 47.2 25.5 43.5 25.5 38.8C25.5 35.2 27.8 31.8 29.2 30.2C29.2 32.2 30.4 33.4 30.4 33.4C30.4 33.4 30.8 29.6 32.4 27Z"
        fill="url(#streak-flame-inner)"
      />
    </svg>
  );
};

export const DailyStreakBanner: React.FC<DailyStreakBannerProps> = ({
  streak,
  variant,
}) => {
  const isHot = streak.currentStreak >= 1;
  const isFrozen = isHot && streak.freezeActiveNow;
  const isHero = variant === 'difficulty';

  const containerStyle = isFrozen
    ? 'bg-gradient-to-r from-sky-50 via-cyan-50/80 to-amber-50/60 border-sky-300/80'
    : isHot
    ? 'bg-gradient-to-r from-amber-50 via-orange-50/90 to-rose-50/60 border-amber-300/80'
    : streak.streakLost
    ? 'bg-gradient-to-r from-rose-50/70 via-white to-amber-50/40 border-rose-200/80'
    : 'bg-gradient-to-r from-white via-amber-50/50 to-orange-50/40 border-slate-200';

  const headlineColor = isFrozen
    ? 'text-sky-950'
    : isHot
    ? 'text-orange-950'
    : streak.streakLost
    ? 'text-rose-950'
    : 'text-slate-900';

  const headlineText = isFrozen
    ? `${streak.currentStreak} day streak! Streak Frozen!`
    : isHot
    ? `${streak.currentStreak} day streak!`
    : streak.streakLost
    ? 'Streak lost! Start your streak!'
    : "0 day streak! Let's start!";

  const statusText = isFrozen
    ? 'Play today to keep it'
    : isHot
    ? streak.solvedToday
      ? 'Solved today · Keep going!'
      : 'Keep going!'
    : streak.streakLost
    ? 'Play today to begin again'
    : "Play today's Daily";

  return (
    <section
      aria-label="Daily Streak"
      className={`w-full rounded-3xl border shadow-xs ${containerStyle} ${
        isHero ? 'p-3.5 sm:p-4' : 'px-3.5 py-2.5 sm:px-4 sm:py-3'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 w-full text-left">
        <StreakEmblem
          active={isHot}
          frozen={isFrozen}
          sizeClass={isHero ? 'w-11 h-11 sm:w-13 sm:h-13' : 'w-10 h-10 sm:w-11 sm:h-11'}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <p
              className={`font-display font-extrabold tracking-tight tabular-nums leading-snug ${
                isHero ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'
              } ${headlineColor}`}
            >
              {headlineText}
            </p>
            {isHero && streak.bestStreak > 0 && (
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                Best {streak.bestStreak}d
              </span>
            )}
          </div>

          <p
            className={`text-xs mt-0.5 leading-snug flex items-center gap-1.5 flex-wrap ${
              isFrozen ? 'text-sky-800 font-medium' : 'text-slate-600'
            }`}
          >
            {isFrozen && (
              <Snowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden="true" />
            )}
            <span>{statusText}</span>
          </p>
        </div>
      </div>
    </section>
  );
};
