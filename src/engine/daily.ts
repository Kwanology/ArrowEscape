export interface DailyCalendarInfo {
  slotId: number; // 1..366 using fixed leap-year calendar (Feb 29 = 60)
  dateKey: string; // YYYY-MM-DD (local date)
  displayDate: string; // e.g., "Wed, Nov 18, 2026"
  shortDate: string; // e.g., "Nov 18, 2026"
  monthDay: string; // e.g., "Nov 18" (no year)
}

const LEAP_MONTH_OFFSETS = [
  0, // Jan
  31, // Feb (includes Feb 29 = 60)
  60, // Mar
  91, // Apr
  121, // May
  152, // Jun
  182, // Jul
  213, // Aug
  244, // Sep
  274, // Oct
  305, // Nov
  335, // Dec
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Maps any calendar date to a deterministic 1..366 daily puzzle slot.
 * Using a fixed 366-day leap-year calendar keeps every MM-DD date pinned to
 * its exact own secret puzzle (365 standard days + Feb 29 leap day = 366).
 */
export function getDailyCalendarInfo(date = new Date()): DailyCalendarInfo {
  const year = date.getFullYear();
  const monthIdx = date.getMonth(); // 0..11
  const day = date.getDate(); // 1..31
  const weekday = SHORT_WEEKDAYS[date.getDay()];
  const monthName = SHORT_MONTHS[monthIdx];

  const slotId = LEAP_MONTH_OFFSETS[monthIdx] + day;
  const dateKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const monthDay = `${monthName} ${day}`;
  const shortDate = `${monthDay}, ${year}`;
  const displayDate = `${weekday}, ${shortDate}`;

  return {
    slotId,
    dateKey,
    displayDate,
    shortDate,
    monthDay,
  };
}

export interface DailyStreakInfo {
  currentStreak: number;
  bestStreak: number;
  totalDailySolved: number;
  solvedToday: boolean;
  streakLost: boolean;
  freezeUnlocked: boolean;
  freezeActiveNow: boolean;
  freezeDaysUsed: number; // 0, 1, or 2 missed days currently bridged by Streak Freeze
  maxFreezeDays: number; // 2 if unlocked, else 0
  normalSolvedCount: number;
  normalRequiredForFreeze: number; // 10
}

const NORMAL_PUZZLES_FOR_FREEZE = 10;
const MAX_STREAK_FREEZE_DAYS = 2;

function parseDateKeyToDayNumber(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const utcCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    utcCheck.getUTCFullYear() !== year ||
    utcCheck.getUTCMonth() !== month - 1 ||
    utcCheck.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utcCheck.getTime() / 86_400_000);
}

/**
 * Computes the Daily Puzzle streak and Streak Freeze state.
 * - Normal streak advances on consecutive calendar days (missed = 0).
 * - When `normalSolvedCount >= 10`, Streak Freeze extends the streak across up to
 *   2 missed days without counting those frozen days in the streak total.
 * - On the 3rd missed day (missed >= 3, or >= 1 without Streak Freeze), the streak resets to 0.
 */
export function calculateDailyStreak(
  completedDailyDates: string[] | undefined,
  normalSolvedCount: number,
  todayDateKey: string
): DailyStreakInfo {
  const freezeUnlocked = normalSolvedCount >= NORMAL_PUZZLES_FOR_FREEZE;
  const maxFreezeDays = freezeUnlocked ? MAX_STREAK_FREEZE_DAYS : 0;
  const todayNum = parseDateKeyToDayNumber(todayDateKey);

  const uniqueDays = Array.from(
    new Set(
      (completedDailyDates ?? [])
        .map(parseDateKeyToDayNumber)
        .filter(
          (n): n is number =>
            n !== null && (todayNum === null || n <= todayNum)
        )
    )
  ).sort((a, b) => a - b);

  if (uniqueDays.length === 0 || todayNum === null) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalDailySolved: uniqueDays.length,
      solvedToday: false,
      streakLost: false,
      freezeUnlocked,
      freezeActiveNow: false,
      freezeDaysUsed: 0,
      maxFreezeDays,
      normalSolvedCount,
      normalRequiredForFreeze: NORMAL_PUZZLES_FOR_FREEZE,
    };
  }

  let run = 1;
  let bestStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const missedBetween = uniqueDays[i] - uniqueDays[i - 1] - 1;
    if (missedBetween <= maxFreezeDays) {
      // Only actual solved days count toward the streak; frozen days do not add to `run`.
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) {
      bestStreak = run;
    }
  }

  const lastDay = uniqueDays[uniqueDays.length - 1];
  const solvedToday = lastDay === todayNum;
  const missedSinceLast = solvedToday ? 0 : Math.max(0, todayNum - lastDay - 1);

  const isAlive = run >= 1 && missedSinceLast <= maxFreezeDays;
  const currentStreak = isAlive ? run : 0;
  const streakLost = !isAlive;
  const freezeActiveNow = isAlive && missedSinceLast > 0;
  const freezeDaysUsed = freezeActiveNow ? missedSinceLast : 0;

  return {
    currentStreak,
    bestStreak,
    totalDailySolved: uniqueDays.length,
    solvedToday,
    streakLost,
    freezeUnlocked,
    freezeActiveNow,
    freezeDaysUsed,
    maxFreezeDays,
    normalSolvedCount,
    normalRequiredForFreeze: NORMAL_PUZZLES_FOR_FREEZE,
  };
}

