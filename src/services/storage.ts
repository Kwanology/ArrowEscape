import { ActivePuzzleSave, Difficulty, GameSettings, SaveState } from '../engine/types';

const STORAGE_KEY = 'arrow_escape_save_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.35,
  sfxVolume: 0.7,
  animationIntensity: 7,
};

export function createDefaultSaveState(): SaveState {
  return {
    currentDifficulty: 'easy',
    currentLevel: 1,
    lastOpenedLevel: null,
    completedLevels: {
      easy: [],
      medium: [],
      hard: [],
    },
    completedDailyDates: [],
    activePuzzles: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function puzzleSaveKey(difficulty: Difficulty, levelId: number): string {
  return `${difficulty}-${levelId}`;
}

export function dailyPuzzleSaveKey(dateKey: string): string {
  return `daily-${dateKey}`;
}

export function loadSaveState(): SaveState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSaveState();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const defaults = createDefaultSaveState();
    return {
      currentDifficulty: parsed.currentDifficulty ?? defaults.currentDifficulty,
      currentLevel: parsed.currentLevel ?? defaults.currentLevel,
      lastOpenedLevel: parsed.lastOpenedLevel ?? null,
      completedLevels: {
        easy: Array.isArray(parsed.completedLevels?.easy)
          ? parsed.completedLevels.easy
          : [],
        medium: Array.isArray(parsed.completedLevels?.medium)
          ? parsed.completedLevels.medium
          : [],
        hard: Array.isArray(parsed.completedLevels?.hard)
          ? parsed.completedLevels.hard
          : [],
      },
      completedDailyDates: Array.isArray(parsed.completedDailyDates)
        ? parsed.completedDailyDates
        : [],
      activePuzzles: parsed.activePuzzles ?? {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return createDefaultSaveState();
  }
}

export function persistSaveState(state: SaveState): void {
  try {
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Graceful fallback if storage quota exceeded or private mode restricts localStorage
  }
}

export function saveActivePuzzleProgress(
  prev: SaveState,
  active: ActivePuzzleSave
): SaveState {
  const key =
    active.isDaily && active.dailyDateKey
      ? dailyPuzzleSaveKey(active.dailyDateKey)
      : puzzleSaveKey(active.difficulty, active.levelId);
  const next: SaveState = {
    ...prev,
    currentDifficulty: active.isDaily ? prev.currentDifficulty : active.difficulty,
    currentLevel: active.isDaily ? prev.currentLevel : active.levelId,
    lastOpenedLevel: {
      difficulty: active.difficulty,
      levelId: active.levelId,
      isDaily: active.isDaily,
      dailyDateKey: active.dailyDateKey,
    },
    activePuzzles: {
      ...prev.activePuzzles,
      [key]: active,
    },
  };
  persistSaveState(next);
  return next;
}

export function clearActivePuzzleProgress(
  prev: SaveState,
  difficulty: Difficulty,
  levelId: number,
  dailyDateKey?: string
): SaveState {
  const key = dailyDateKey
    ? dailyPuzzleSaveKey(dailyDateKey)
    : puzzleSaveKey(difficulty, levelId);
  if (!(key in prev.activePuzzles)) return prev;
  const nextActive = { ...prev.activePuzzles };
  delete nextActive[key];

  const nextLastOpened =
    prev.lastOpenedLevel &&
    (dailyDateKey
      ? prev.lastOpenedLevel.isDaily &&
        prev.lastOpenedLevel.dailyDateKey === dailyDateKey
      : !prev.lastOpenedLevel.isDaily &&
        prev.lastOpenedLevel.difficulty === difficulty &&
        prev.lastOpenedLevel.levelId === levelId)
      ? null
      : prev.lastOpenedLevel;

  const next: SaveState = {
    ...prev,
    lastOpenedLevel: nextLastOpened,
    activePuzzles: nextActive,
  };
  persistSaveState(next);
  return next;
}

export function saveCompletedDailyPuzzle(
  prev: SaveState,
  dateKey: string
): SaveState {
  const key = dailyPuzzleSaveKey(dateKey);
  const existing = prev.completedDailyDates ?? [];
  const nextDailyDates = existing.includes(dateKey)
    ? existing
    : [...existing, dateKey];

  const nextActive = { ...prev.activePuzzles };
  delete nextActive[key];

  const nextLastOpened =
    prev.lastOpenedLevel?.isDaily &&
    prev.lastOpenedLevel.dailyDateKey === dateKey
      ? null
      : prev.lastOpenedLevel;

  const next: SaveState = {
    ...prev,
    lastOpenedLevel: nextLastOpened,
    completedDailyDates: nextDailyDates,
    activePuzzles: nextActive,
  };
  persistSaveState(next);
  return next;
}

export function saveCompletedLevel(
  prev: SaveState,
  difficulty: Difficulty,
  levelId: number
): SaveState {
  const key = puzzleSaveKey(difficulty, levelId);
  const existing = prev.completedLevels[difficulty];
  const nextCompleted = existing.includes(levelId)
    ? existing
    : [...existing, levelId].sort((a, b) => a - b);

  const nextActive = { ...prev.activePuzzles };
  delete nextActive[key];

  // If the completed level was the lastOpenedLevel, clear lastOpenedLevel or keep?
  // Clearing it if it matches ensures "Continue" doesn't reopen an already-finished empty board.
  const nextLastOpened =
    prev.lastOpenedLevel &&
    !prev.lastOpenedLevel.isDaily &&
    prev.lastOpenedLevel.difficulty === difficulty &&
    prev.lastOpenedLevel.levelId === levelId
      ? null
      : prev.lastOpenedLevel;

  const next: SaveState = {
    ...prev,
    currentDifficulty: difficulty,
    currentLevel: levelId,
    lastOpenedLevel: nextLastOpened,
    completedLevels: {
      ...prev.completedLevels,
      [difficulty]: nextCompleted,
    },
    activePuzzles: nextActive,
  };
  persistSaveState(next);
  return next;
}

export function saveSettingsUpdate(
  prev: SaveState,
  patch: Partial<GameSettings>
): SaveState {
  const next: SaveState = {
    ...prev,
    settings: {
      ...prev.settings,
      ...patch,
    },
  };
  persistSaveState(next);
  return next;
}

export function resetAllSavedProgress(prev: SaveState): SaveState {
  const fresh = createDefaultSaveState();
  fresh.settings = { ...prev.settings };
  persistSaveState(fresh);
  return fresh;
}
