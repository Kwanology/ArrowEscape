import rawDailyLevels from '../data/dailyLevels.json';
import rawLevels from '../data/levels.json';
import { Arrow, Difficulty, Direction, Point, PuzzleLevel } from './types';

interface CompactArrow {
  i: string;
  c: number[];
  d: 'U' | 'D' | 'L' | 'R';
  k: number;
}

interface CompactLevel {
  id: number;
  df: 'e' | 'm' | 'h' | 'd';
  sd: number;
  th: string;
  co: number;
  ro: number;
  ar: CompactArrow[];
  so: string[];
  va: boolean;
  dp: number;
}

const dirExpand: Record<'U' | 'D' | 'L' | 'R', Direction> = {
  U: 'UP',
  D: 'DOWN',
  L: 'LEFT',
  R: 'RIGHT',
};

const diffExpand: Record<'e' | 'm' | 'h' | 'd', Difficulty> = {
  e: 'easy',
  m: 'medium',
  h: 'hard',
  d: 'medium',
};

let cachedAll: PuzzleLevel[] | null = null;
let cachedDaily: PuzzleLevel[] | null = null;
const byDifficultyCache: Partial<Record<Difficulty, PuzzleLevel[]>> = {};

function expandLevel(item: CompactLevel): PuzzleLevel {
  const arrows: Arrow[] = item.ar.map((a) => {
    const cells: Point[] = [];
    for (let idx = 0; idx < a.c.length; idx += 2) {
      cells.push({ x: a.c[idx], y: a.c[idx + 1] });
    }
    return {
      id: a.i,
      cells,
      dir: dirExpand[a.d],
      colorIndex: a.k,
    };
  });

  return {
    id: item.id,
    difficulty: diffExpand[item.df],
    seed: item.sd,
    theme: item.th,
    cols: item.co,
    rows: item.ro,
    arrows,
    solutionSequence: item.so,
    validated: item.va,
    dependencyDepth: item.dp,
  };
}

export function getAllLevels(): PuzzleLevel[] {
  if (!cachedAll) {
    cachedAll = (rawLevels as CompactLevel[]).map(expandLevel);
  }
  return cachedAll;
}

export function getLevelsForDifficulty(difficulty: Difficulty): PuzzleLevel[] {
  if (!byDifficultyCache[difficulty]) {
    byDifficultyCache[difficulty] = getAllLevels().filter(
      (l) => l.difficulty === difficulty
    );
  }
  return byDifficultyCache[difficulty]!;
}

export function getLevel(
  difficulty: Difficulty,
  levelId: number
): PuzzleLevel | undefined {
  return getLevelsForDifficulty(difficulty).find((l) => l.id === levelId);
}

export function getDailyLevel(slotId: number): PuzzleLevel | undefined {
  if (!cachedDaily) {
    cachedDaily = (rawDailyLevels as CompactLevel[]).map(expandLevel);
  }
  return cachedDaily.find((l) => l.id === slotId);
}
