import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeDirectionClusters,
  checkBottleneckCascade,
  checkEscapeLaneLimit,
  countInwardArrows,
  validatePuzzle,
} from '../src/engine/collision';
import { generateValidatedPuzzle } from '../src/engine/generator';
import { getSilhouetteForLevel } from '../src/engine/silhouettes';
import { Difficulty, PuzzleLevel } from '../src/engine/types';

// Compact serialized representation to keep bundle super fast & lightweight
interface CompactArrow {
  i: string; // id
  c: number[]; // flat [x0, y0, x1, y1, ...]
  d: 'U' | 'D' | 'L' | 'R';
  k: number; // colorIndex
}

interface CompactLevel {
  id: number;
  df: 'e' | 'm' | 'h';
  sd: number;
  th: string;
  co: number;
  ro: number;
  ar: CompactArrow[];
  so: string[];
  va: boolean;
  dp: number;
}

const dirMap = { UP: 'U', DOWN: 'D', LEFT: 'L', RIGHT: 'R' } as const;
const diffMap = { easy: 'e', medium: 'm', hard: 'h' } as const;

function compactLevel(p: PuzzleLevel): CompactLevel {
  return {
    id: p.id,
    df: diffMap[p.difficulty],
    sd: p.seed,
    th: p.theme,
    co: p.cols,
    ro: p.rows,
    ar: p.arrows.map((a) => ({
      i: a.id,
      c: a.cells.flatMap((pt) => [pt.x, pt.y]),
      d: dirMap[a.dir],
      k: a.colorIndex,
    })),
    so: p.solutionSequence,
    va: p.validated,
    dp: p.dependencyDepth,
  };
}

const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] as
  | Difficulty
  | undefined;
const rangeArg = process.argv.find((a) => a.startsWith('--range='))?.split('=')[1];
const [rangeStart, rangeEnd] = rangeArg
  ? rangeArg.split('-').map(Number)
  : [1, 100];

const outDir = path.resolve(process.cwd(), 'src/data');
const outPath = path.join(outDir, 'levels.json');

let existingByDiff: Record<Difficulty, CompactLevel[]> = {
  easy: [],
  medium: [],
  hard: [],
};

if ((onlyArg || rangeArg) && fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as CompactLevel[];
  for (const item of existing) {
    const d: Difficulty = item.df === 'e' ? 'easy' : item.df === 'm' ? 'medium' : 'hard';
    existingByDiff[d].push(item);
  }
}

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const allCompact: CompactLevel[] = [];

for (const diff of difficulties) {
  if (onlyArg && diff !== onlyArg && existingByDiff[diff].length === 100) {
    allCompact.push(...existingByDiff[diff]);
    console.log(`[${diff.toUpperCase()}] Preserved 100/100 existing validated levels`);
    continue;
  }

  let minArrows = Infinity;
  let maxArrows = 0;
  let minDepth = Infinity;
  let maxDepth = 0;
  let minCells = Infinity;
  let maxCells = 0;
  let minInwardPct = 100;
  let maxInwardPct = 0;
  let maxClearSeen = 0;
  let maxLaneSeen = 0;
  let maxClusterSeen = 0;

  const existingById = new Map<number, CompactLevel>();
  for (const item of existingByDiff[diff]) {
    existingById.set(item.id, item);
  }

  for (let id = 1; id <= 100; id++) {
    if (rangeArg && (id < rangeStart || id > rangeEnd) && existingById.has(id)) {
      allCompact.push(existingById.get(id)!);
      continue;
    }

    const puzzle = generateValidatedPuzzle(diff, id);
    const check = validatePuzzle(puzzle);
    if (!check.valid) {
      throw new Error(`Validation failed on ${diff} #${id}: ${check.errors.join(', ')}`);
    }
    const sil = getSilhouetteForLevel(diff, id);
    const totalOccupied = puzzle.arrows.reduce((acc, a) => acc + a.cells.length, 0);
    if (totalOccupied !== sil.cells.length) {
      throw new Error(`Gap detected on ${diff} #${id}: ${totalOccupied} !== ${sil.cells.length}`);
    }
    for (const a of puzzle.arrows) {
      if (a.cells.length < 6) {
        throw new Error(`Short arrow on ${diff} #${id}: ${a.cells.length} cells`);
      }
      minCells = Math.min(minCells, a.cells.length);
      maxCells = Math.max(maxCells, a.cells.length);
    }

    const inward = countInwardArrows(puzzle.arrows, puzzle.cols, puzzle.rows);
    if (inward * 2 <= puzzle.arrows.length) {
      throw new Error(
        `${diff} #${id} inward ratio too low: ${inward}/${puzzle.arrows.length}`
      );
    }
    const cascade = checkBottleneckCascade(
      puzzle.arrows,
      puzzle.cols,
      puzzle.rows,
      puzzle.solutionSequence,
      5
    );
    if (!cascade.valid) {
      throw new Error(
        `${diff} #${id} bottleneck cascade exceeded 5 (maxClear=${cascade.maxClearObserved})`
      );
    }
    const laneCheck = checkEscapeLaneLimit(puzzle.arrows, 3);
    if (!laneCheck.valid) {
      throw new Error(
        `${diff} #${id} exceeded max 3 per escape lane (max=${laneCheck.maxObserved})`
      );
    }
    const clusterInfo = analyzeDirectionClusters(puzzle.arrows);
    const pct = Math.round((inward / puzzle.arrows.length) * 100);
    minInwardPct = Math.min(minInwardPct, pct);
    maxInwardPct = Math.max(maxInwardPct, pct);
    maxClearSeen = Math.max(maxClearSeen, cascade.maxClearObserved);
    maxLaneSeen = Math.max(maxLaneSeen, laneCheck.maxObserved);
    maxClusterSeen = Math.max(maxClusterSeen, clusterInfo.maxNeighborsWithin4);

    minArrows = Math.min(minArrows, puzzle.arrows.length);
    maxArrows = Math.max(maxArrows, puzzle.arrows.length);
    minDepth = Math.min(minDepth, puzzle.dependencyDepth);
    maxDepth = Math.max(maxDepth, puzzle.dependencyDepth);
    allCompact.push(compactLevel(puzzle));
    if (id % 10 === 0) {
      console.log(`  [${diff.toUpperCase()}] ${id}/100 validated...`);
    }
  }

  const extra = ` | inward: ${minInwardPct}-${maxInwardPct}% | maxClear: <=${maxClearSeen} | maxLane: <=${maxLaneSeen} | maxCluster4: ${maxClusterSeen}`;
  console.log(
    `[${diff.toUpperCase()}] Range ${rangeStart}-${rangeEnd} zero-gap validated | arrows: ${minArrows}-${maxArrows} | len: ${minCells}-${maxCells} cells | depth: ${minDepth}-${maxDepth}${extra}`
  );
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(allCompact));
const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Wrote ${allCompact.length} validated puzzles to ${outPath} (${sizeKb} KB)`);


