import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeDirectionClusters,
  checkBottleneckCascade,
  checkEscapeLaneLimit,
  countInwardArrows,
  validatePuzzle,
} from '../src/engine/collision';
import { generateDailyValidatedPuzzle } from '../src/engine/generator';
import { getDailySilhouette } from '../src/engine/silhouettes';
import { PuzzleLevel } from '../src/engine/types';

interface CompactArrow {
  i: string;
  c: number[];
  d: 'U' | 'D' | 'L' | 'R';
  k: number;
}

interface CompactDailyLevel {
  id: number;
  df: 'd';
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

function compactDaily(p: PuzzleLevel): CompactDailyLevel {
  return {
    id: p.id,
    df: 'd',
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

const rangeArg = process.argv.find((a) => a.startsWith('--range='))?.split('=')[1];
const [rangeStart, rangeEnd] = rangeArg
  ? rangeArg.split('-').map(Number)
  : [1, 366];

const outDir = path.resolve(process.cwd(), 'src/data');
const outPath = path.join(outDir, 'dailyLevels.json');

const existingById = new Map<number, CompactDailyLevel>();
if (fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as CompactDailyLevel[];
  for (const item of existing) {
    existingById.set(item.id, item);
  }
}

let minInwardPct = 100;
let maxInwardPct = 0;
let maxClearSeen = 0;
let maxLaneSeen = 0;
let maxClusterSeen = 0;

for (let slotId = rangeStart; slotId <= rangeEnd; slotId++) {
  const puzzle = generateDailyValidatedPuzzle(slotId);
  const check = validatePuzzle(puzzle);
  if (!check.valid) {
    throw new Error(`Daily validation failed on #${slotId}: ${check.errors.join(', ')}`);
  }
  const sil = getDailySilhouette(slotId);
  const totalOccupied = puzzle.arrows.reduce((acc, a) => acc + a.cells.length, 0);
  if (totalOccupied !== sil.cells.length) {
    throw new Error(`Gap detected on daily #${slotId}: ${totalOccupied} !== ${sil.cells.length}`);
  }
  for (const a of puzzle.arrows) {
    if (a.cells.length < 6) {
      throw new Error(`Short arrow on daily #${slotId}: ${a.cells.length} cells`);
    }
  }
  const inward = countInwardArrows(puzzle.arrows, puzzle.cols, puzzle.rows);
  if (inward * 2 <= puzzle.arrows.length) {
    throw new Error(`Daily #${slotId} inward too low: ${inward}/${puzzle.arrows.length}`);
  }
  const cascade = checkBottleneckCascade(
    puzzle.arrows,
    puzzle.cols,
    puzzle.rows,
    puzzle.solutionSequence,
    5
  );
  if (!cascade.valid) {
    throw new Error(`Daily #${slotId} cascade > 5: ${cascade.maxClearObserved}`);
  }
  const laneCheck = checkEscapeLaneLimit(puzzle.arrows, 3);
  if (!laneCheck.valid) {
    throw new Error(`Daily #${slotId} lane > 3: ${laneCheck.maxObserved}`);
  }
  const cluster = analyzeDirectionClusters(puzzle.arrows);
  const pct = Math.round((inward / puzzle.arrows.length) * 100);
  minInwardPct = Math.min(minInwardPct, pct);
  maxInwardPct = Math.max(maxInwardPct, pct);
  maxClearSeen = Math.max(maxClearSeen, cascade.maxClearObserved);
  maxLaneSeen = Math.max(maxLaneSeen, laneCheck.maxObserved);
  maxClusterSeen = Math.max(maxClusterSeen, cluster.maxNeighborsWithin4);

  existingById.set(slotId, compactDaily(puzzle));
  if (slotId % 10 === 0 || slotId === rangeEnd) {
    console.log(`  [DAILY] ${slotId}/366 validated...`);
  }
}

const ordered = Array.from(existingById.values()).sort((a, b) => a.id - b.id);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(ordered));
const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(
  `[DAILY] Range ${rangeStart}-${rangeEnd} validated | inward: ${minInwardPct}-${maxInwardPct}% | maxClear: <=${maxClearSeen} | maxLane: <=${maxLaneSeen} | maxCluster4: ${maxClusterSeen}`
);
console.log(`Wrote ${ordered.length}/366 daily puzzles to ${outPath} (${sizeKb} KB)`);
