export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Point {
  x: number;
  y: number;
}

export interface Arrow {
  id: string;
  cells: Point[];
  dir: Direction;
  colorIndex: number;
}

export interface PuzzleLevel {
  id: number; // 1..100 within difficulty
  difficulty: Difficulty;
  seed: number;
  theme: string;
  cols: number;
  rows: number;
  arrows: Arrow[];
  solutionSequence: string[];
  validated: boolean;
  dependencyDepth: number;
}

export function getMaxLivesForDifficulty(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 3;
    case 'medium':
      return 4;
    case 'hard':
      return 5;
  }
}

export interface ActivePuzzleSave {
  difficulty: Difficulty;
  levelId: number;
  isDaily?: boolean;
  dailyDateKey?: string;
  removedArrowIds: string[];
  remainingArrowIds: string[];
  elapsedSeconds: number;
  hintCooldownRemaining: number; // seconds remaining before hint unlocks (0 = ready)
  livesRemaining?: number;
  updatedAt: number;
}

export interface GameSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  animationIntensity: number; // 1..10
}

export interface SaveState {
  currentDifficulty: Difficulty;
  currentLevel: number;
  lastOpenedLevel: {
    difficulty: Difficulty;
    levelId: number;
    isDaily?: boolean;
    dailyDateKey?: string;
  } | null;
  completedLevels: {
    easy: number[];
    medium: number[];
    hard: number[];
  };
  completedDailyDates?: string[];
  activePuzzles: Record<string, ActivePuzzleSave>; // key: `${difficulty}-${levelId}` or `daily-${dateKey}`
  settings: GameSettings;
}
