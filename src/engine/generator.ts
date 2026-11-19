import {
  analyzeBoardCascade,
  analyzeDirectionClusters,
  checkBottleneckCascade,
  checkEscapeLaneLimit,
  countInwardArrows,
  getDirectionVector,
  getEscapeLaneKey,
  getExitRayCells,
  inferDirection,
  isArrowInward,
  pointKey,
  validatePuzzle,
} from './collision';
import { getDailySilhouette, getSilhouetteForLevel } from './silhouettes';
import { Arrow, Difficulty, Direction, Point, PuzzleLevel } from './types';

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const MIN_ARROW_CELLS = 6; // >= 5 segments per arrow

export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface DifficultyConfig {
  minArrows: number;
  maxArrows: number;
  targetMinLen: number;
  targetMaxLen: number;
  turnBias: number;
  blockerWeight: number;
  minDepth: number;
}

function getConfigForLevel(difficulty: Difficulty, levelId: number): DifficultyConfig {
  const t = (levelId - 1) / 99;
  if (difficulty === 'easy') {
    return {
      minArrows: Math.round(12 + t * 6),
      maxArrows: Math.round(20 + t * 6),
      targetMinLen: 8,
      targetMaxLen: Math.round(14 + t * 4),
      turnBias: 0.6 + t * 0.15,
      blockerWeight: 3 + t * 2,
      minDepth: 3,
    };
  }
  if (difficulty === 'medium') {
    return {
      minArrows: Math.round(18 + t * 10),
      maxArrows: Math.round(32 + t * 18),
      targetMinLen: 10,
      targetMaxLen: Math.round(18 + t * 6),
      turnBias: 0.74 + t * 0.12,
      blockerWeight: 5 + t * 3,
      minDepth: 4,
    };
  }
  return {
    minArrows: Math.round(28 + t * 14),
    maxArrows: Math.round(52 + t * 28),
    targetMinLen: 8,
    targetMaxLen: Math.round(17 + t * 4),
    turnBias: 0.80 + t * 0.10,
    blockerWeight: 7 + t * 4,
    minDepth: 5,
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isRayClearOfSet(
  head: Point,
  dir: Direction,
  cols: number,
  rows: number,
  blockedSet: Set<string>
): boolean {
  const vec = getDirectionVector(dir);
  let cx = head.x + vec.x;
  let cy = head.y + vec.y;
  while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
    if (blockedSet.has(pointKey(cx, cy))) {
      return false;
    }
    cx += vec.x;
    cy += vec.y;
  }
  return true;
}

function isRayClearOfMask(
  hx: number,
  hy: number,
  dir: Direction,
  cols: number,
  rows: number,
  blockedMask: Uint8Array
): boolean {
  const vec = getDirectionVector(dir);
  let cx = hx + vec.x;
  let cy = hy + vec.y;
  while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
    if (blockedMask[cy * cols + cx] === 1) {
      return false;
    }
    cx += vec.x;
    cy += vec.y;
  }
  return true;
}

function setToGridMask(set: Set<string>, cols: number, rows: number, out?: Uint8Array): Uint8Array {
  const mask = out ?? new Uint8Array(cols * rows);
  if (out) mask.fill(0);
  for (const key of set) {
    const comma = key.indexOf(',');
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));
    mask[y * cols + x] = 1;
  }
  return mask;
}

/**
 * Checks every 4-connected component of `freeMask \ excludePts`:
 * 1) Every component must have size >= MIN_ARROW_CELLS (6).
 * 2) Every component must have at least one cell with an adjacent neighbor in
 *    the same component and a clear exit ray against `placedMask U excludePts`.
 * Returns 0 if invalid, or the number of connected components (>= 1) if valid.
 */
function countValidRemainingComponentsFast(
  baseFreeMask: Uint8Array,
  basePlacedMask: Uint8Array,
  excludePts: Point[],
  cols: number,
  rows: number,
  scratchActive: Uint8Array,
  scratchBlocked: Uint8Array,
  scratchQueue: Int32Array
): number {
  const total = cols * rows;
  scratchActive.set(baseFreeMask);
  scratchBlocked.set(basePlacedMask);

  for (let i = 0; i < excludePts.length; i++) {
    const p = excludePts[i];
    const idx = p.y * cols + p.x;
    scratchActive[idx] = 0;
    scratchBlocked[idx] = 1;
  }

  let remainingCount = 0;
  for (let idx = 0; idx < total; idx++) {
    if (scratchActive[idx] === 1) remainingCount++;
  }

  if (remainingCount === 0) return 1;
  if (remainingCount < MIN_ARROW_CELLS) return 0;

  let compCount = 0;
  for (let idx = 0; idx < total; idx++) {
    if (scratchActive[idx] === 0) continue;
    compCount++;
    scratchActive[idx] = 0;
    let head = 0;
    let tail = 0;
    scratchQueue[tail++] = idx;

    while (head < tail) {
      const curr = scratchQueue[head++];
      const cx = curr % cols;
      const cy = (curr - cx) / cols;

      if (cx + 1 < cols && scratchActive[curr + 1] === 1) {
        scratchActive[curr + 1] = 0;
        scratchQueue[tail++] = curr + 1;
      }
      if (cx > 0 && scratchActive[curr - 1] === 1) {
        scratchActive[curr - 1] = 0;
        scratchQueue[tail++] = curr - 1;
      }
      if (cy + 1 < rows && scratchActive[curr + cols] === 1) {
        scratchActive[curr + cols] = 0;
        scratchQueue[tail++] = curr + cols;
      }
      if (cy > 0 && scratchActive[curr - cols] === 1) {
        scratchActive[curr - cols] = 0;
        scratchQueue[tail++] = curr - cols;
      }
    }

    if (tail < MIN_ARROW_CELLS) return 0;

    const reqExits = tail > 96 ? 3 : tail > 32 ? 2 : 1;
    let exitCellCount = 0;
    for (let i = 0; i < tail && exitCellCount < reqExits; i++) {
      const cIdx = scratchQueue[i];
      const cx = cIdx % cols;
      const cy = (cIdx - cx) / cols;

      for (const dir of DIRECTIONS) {
        const dv = getDirectionVector(dir);
        const nx = cx - dv.x;
        const ny = cy - dv.y;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const nIdx = ny * cols + nx;
        if (baseFreeMask[nIdx] === 0 || scratchBlocked[nIdx] === 1) continue;

        let rx = cx + dv.x;
        let ry = cy + dv.y;
        let clear = true;
        while (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          if (scratchBlocked[ry * cols + rx] === 1) {
            clear = false;
            break;
          }
          rx += dv.x;
          ry += dv.y;
        }
        if (clear) {
          exitCellCount++;
          break;
        }
      }
    }

    if (exitCellCount < reqExits) return 0;
  }

  return compCount;
}

function isRemainingRegionValidFast(
  baseFreeMask: Uint8Array,
  basePlacedMask: Uint8Array,
  excludePts: Point[],
  cols: number,
  rows: number,
  scratchActive: Uint8Array,
  scratchBlocked: Uint8Array,
  scratchQueue: Int32Array
): boolean {
  return (
    countValidRemainingComponentsFast(
      baseFreeMask,
      basePlacedMask,
      excludePts,
      cols,
      rows,
      scratchActive,
      scratchBlocked,
      scratchQueue
    ) > 0
  );
}

function isRemainingRegionValid(
  freeSet: Set<string>,
  excludeSet: Set<string>,
  placedSet: Set<string>,
  cols: number,
  rows: number
): boolean {
  const total = cols * rows;
  const freeMask = setToGridMask(freeSet, cols, rows);
  const placedMask = setToGridMask(placedSet, cols, rows);
  const excludePts: Point[] = [];
  for (const key of excludeSet) {
    const comma = key.indexOf(',');
    excludePts.push({
      x: Number(key.slice(0, comma)),
      y: Number(key.slice(comma + 1)),
    });
  }
  return isRemainingRegionValidFast(
    freeMask,
    placedMask,
    excludePts,
    cols,
    rows,
    new Uint8Array(total),
    new Uint8Array(total),
    new Int32Array(total)
  );
}

/**
 * Extracts 4-connected components of `freeSet` as arrays of point keys.
 */
function getConnectedComponents(
  freeSet: Set<string>,
  cols: number,
  rows: number
): string[][] {
  const visited = new Set<string>();
  const comps: string[][] = [];

  for (const startKey of freeSet) {
    if (visited.has(startKey)) continue;
    const comp: string[] = [];
    const queue: string[] = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      const comma = curr.indexOf(',');
      const cx = Number(curr.slice(0, comma));
      const cy = Number(curr.slice(comma + 1));

      for (const d of DIRECTIONS) {
        const dv = getDirectionVector(d);
        const nx = cx + dv.x;
        const ny = cy + dv.y;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const nk = pointKey(nx, ny);
        if (freeSet.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push(nk);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Safe tail absorption & 2-cell detour expansion to fill remaining
 * silhouette cells with zero gaps while preserving guaranteed solvability.
 */
function absorbRemainingCells(
  reverseArrows: { cells: Point[]; dir: Direction; rayKeys: Set<string> }[],
  freeSet: Set<string>,
  placedSet: Set<string>
): void {
  if (freeSet.size === 0 || reverseArrows.length === 0) return;

  const buildForbiddenForIdx = (idx: number): Set<string> => {
    const forbidden = new Set<string>();
    for (let j = idx; j < reverseArrows.length; j++) {
      for (const rk of reverseArrows[j].rayKeys) {
        forbidden.add(rk);
      }
    }
    return forbidden;
  };

  let progress = true;
  while (freeSet.size > 0 && progress) {
    progress = false;

    // Pass 1: Safe tail extension (prepend to cells[0])
    for (let idx = reverseArrows.length - 1; idx >= 0 && freeSet.size > 0; idx--) {
      const arrow = reverseArrows[idx];
      const forbidden = buildForbiddenForIdx(idx);

      let extended = true;
      while (extended && freeSet.size > 0) {
        extended = false;
        const tail = arrow.cells[0];
        let bestCell: Point | null = null;
        let bestDeg = 99;

        for (const d of DIRECTIONS) {
          const dv = getDirectionVector(d);
          const nx = tail.x + dv.x;
          const ny = tail.y + dv.y;
          const nk = pointKey(nx, ny);
          if (!freeSet.has(nk) || forbidden.has(nk)) continue;

          let deg = 0;
          for (const nd of DIRECTIONS) {
            const ndv = getDirectionVector(nd);
            if (freeSet.has(pointKey(nx + ndv.x, ny + ndv.y))) deg++;
          }
          if (deg < bestDeg) {
            bestDeg = deg;
            bestCell = { x: nx, y: ny };
          }
        }

        if (bestCell) {
          const ck = pointKey(bestCell.x, bestCell.y);
          arrow.cells.unshift(bestCell);
          freeSet.delete(ck);
          placedSet.add(ck);
          extended = true;
          progress = true;
        }
      }
    }

    if (freeSet.size === 0) break;

    // Pass 1b: Safe head-forward extension
    for (let idx = reverseArrows.length - 1; idx >= 0 && freeSet.size > 0; idx--) {
      const arrow = reverseArrows[idx];
      const earlierRays = new Set<string>();
      for (let j = idx + 1; j < reverseArrows.length; j++) {
        for (const rk of reverseArrows[j].rayKeys) earlierRays.add(rk);
      }

      const dv = getDirectionVector(arrow.dir);
      let advanced = true;
      while (advanced && freeSet.size > 0) {
        advanced = false;
        const head = arrow.cells[arrow.cells.length - 1];
        const nextHead = { x: head.x + dv.x, y: head.y + dv.y };
        const nk = pointKey(nextHead.x, nextHead.y);
        if (freeSet.has(nk) && !earlierRays.has(nk)) {
          arrow.cells.push(nextHead);
          arrow.rayKeys.delete(nk);
          freeSet.delete(nk);
          placedSet.add(nk);
          advanced = true;
          progress = true;
        }
      }
    }

    if (freeSet.size === 0) break;

    // Pass 2: Safe 2-cell detour loop insertion on body segments (never split final neck->head segment!)
    for (let idx = reverseArrows.length - 1; idx >= 0 && freeSet.size > 0; idx--) {
      const arrow = reverseArrows[idx];
      const forbidden = buildForbiddenForIdx(idx);

      for (let s = 0; s < arrow.cells.length - 2; s++) {
        const a = arrow.cells[s];
        const b = arrow.cells[s + 1];
        const dx = b.x - a.x;
        const perps =
          dx !== 0
            ? [
                { x: 0, y: 1 },
                { x: 0, y: -1 },
              ]
            : [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
              ];

        let inserted = false;
        for (const p of perps) {
          const aPrime = { x: a.x + p.x, y: a.y + p.y };
          const bPrime = { x: b.x + p.x, y: b.y + p.y };
          const ak = pointKey(aPrime.x, aPrime.y);
          const bk = pointKey(bPrime.x, bPrime.y);
          if (
            freeSet.has(ak) &&
            freeSet.has(bk) &&
            !forbidden.has(ak) &&
            !forbidden.has(bk)
          ) {
            arrow.cells.splice(s + 1, 0, aPrime, bPrime);
            freeSet.delete(ak);
            freeSet.delete(bk);
            placedSet.add(ak);
            placedSet.add(bk);
            progress = true;
            inserted = true;
            break;
          }
        }
        if (inserted) break;
      }
    }
  }
}

/**
 * Bounded Warnsdorff backtracking tiler that partitions a single connected
 * `compSet` (<= 34 cells) into valid arrows of length >= MIN_ARROW_CELLS
 * with clear exit rays against `placedSet`.
 */
function tileComponentExact(
  compSet: Set<string>,
  placedSet: Set<string>,
  cols: number,
  rows: number,
  reverseArrows: { cells: Point[]; dir: Direction; rayKeys: Set<string> }[],
  maxSteps = 1200,
  inwardCenter?: { x: number; y: number },
  laneCounts?: Map<string, number>
): boolean {
  let steps = 0;
  const total = cols * rows;
  const compMask = setToGridMask(compSet, cols, rows);
  const placedMask = setToGridMask(placedSet, cols, rows);
  const scratchActive = new Uint8Array(total);
  const scratchBlocked = new Uint8Array(total);
  const scratchQueue = new Int32Array(total);

  const parsePt = (k: string): Point => {
    const comma = k.indexOf(',');
    return { x: Number(k.slice(0, comma)), y: Number(k.slice(comma + 1)) };
  };

  const degInComp = (x: number, y: number, exclude: Set<string>): number => {
    let d = 0;
    for (const dir of DIRECTIONS) {
      const v = getDirectionVector(dir);
      const nk = pointKey(x + v.x, y + v.y);
      if (compSet.has(nk) && !exclude.has(nk)) d++;
    }
    return d;
  };

  const solve = (depth: number): boolean => {
    if (compSet.size === 0) return true;
    if (compSet.size < MIN_ARROW_CELLS) return false;
    if (steps >= maxSteps) return false;

    const starts: {
      head: Point;
      neck: Point;
      dir: Direction;
      deg: number;
      rayOverlap: number;
      inward: number;
      laneCount: number;
    }[] = [];
    for (const k of compSet) {
      const head = parsePt(k);
      const deg = degInComp(head.x, head.y, new Set());
      for (const dir of DIRECTIONS) {
        const lk = getEscapeLaneKey(head, dir);
        const laneCount = laneCounts ? (laneCounts.get(lk) ?? 0) : 0;
        const v = getDirectionVector(dir);
        const neck = { x: head.x - v.x, y: head.y - v.y };
        if (!compSet.has(pointKey(neck.x, neck.y))) continue;
        if (!isRayClearOfMask(head.x, head.y, dir, cols, rows, placedMask)) continue;
        let rayOverlap = 0;
        let rx = head.x + v.x;
        let ry = head.y + v.y;
        while (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          if (compMask[ry * cols + rx] === 1) rayOverlap++;
          rx += v.x;
          ry += v.y;
        }
        const inward = inwardCenter
          ? v.x * (inwardCenter.x - head.x) + v.y * (inwardCenter.y - head.y) > 0
            ? 1
            : 0
          : 0;
        starts.push({ head, neck, dir, deg, rayOverlap, inward, laneCount });
      }
    }

    if (starts.length === 0) return false;
    starts.sort((a, b) => {
      const aOver = a.laneCount >= 3 ? a.laneCount - 2 : 0;
      const bOver = b.laneCount >= 3 ? b.laneCount - 2 : 0;
      return (
        aOver - bOver ||
        (inwardCenter ? b.inward - a.inward : 0) ||
        a.laneCount - b.laneCount ||
        a.rayOverlap - b.rayOverlap ||
        a.deg - b.deg
      );
    });

    const startLimit = depth === 0 ? Math.min(8, starts.length) : Math.min(4, starts.length);
    for (let si = 0; si < startLimit; si++) {
      const st = starts[si];
      const ownRay = new Set<string>(
        getExitRayCells(st.head, st.dir, cols, rows).map((p) => pointKey(p.x, p.y))
      );

      const path: Point[] = [st.head, st.neck];
      const used = new Set<string>([
        pointKey(st.head.x, st.head.y),
        pointKey(st.neck.x, st.neck.y),
      ]);
      const startBranchCap = depth === 0 ? Math.min(maxSteps, steps + 180) : maxSteps;

      const extend = (): boolean => {
        if (++steps > startBranchCap) return false;

        const rem = compSet.size - path.length;
        if (path.length >= MIN_ARROW_CELLS && (rem === 0 || rem >= MIN_ARROW_CELLS)) {
          if (rem === 0 || path.length >= 7) {
            if (
              rem === 0 ||
              isRemainingRegionValidFast(
                compMask,
                placedMask,
                path,
                cols,
                rows,
                scratchActive,
                scratchBlocked,
                scratchQueue
              )
            ) {
              const cells = [...path].reverse();
              const head = cells[cells.length - 1];
              const neck = cells[cells.length - 2];
              const dir = inferDirection(neck, head);
              if (dir) {
                const lk = getEscapeLaneKey(head, dir);
                for (const c of cells) {
                  const ck = pointKey(c.x, c.y);
                  compSet.delete(ck);
                  placedSet.add(ck);
                  const idx = c.y * cols + c.x;
                  compMask[idx] = 0;
                  placedMask[idx] = 1;
                }
                reverseArrows.push({ cells, dir, rayKeys: ownRay });
                if (laneCounts) laneCounts.set(lk, (laneCounts.get(lk) ?? 0) + 1);
                if (solve(depth + 1)) return true;
                if (laneCounts) laneCounts.set(lk, Math.max(0, (laneCounts.get(lk) ?? 1) - 1));
                reverseArrows.pop();
                for (const c of cells) {
                  const ck = pointKey(c.x, c.y);
                  placedSet.delete(ck);
                  compSet.add(ck);
                  const idx = c.y * cols + c.x;
                  placedMask[idx] = 0;
                  compMask[idx] = 1;
                }
              }
            }
            if (rem === 0) return false;
          }
        }

        if (path.length >= (inwardCenter ? 28 : 22)) return false;

        const tail = path[path.length - 1];
        const nexts: { pt: Point; key: string; deg: number }[] = [];
        for (const d of DIRECTIONS) {
          const v = getDirectionVector(d);
          const nx = tail.x + v.x;
          const ny = tail.y + v.y;
          const nk = pointKey(nx, ny);
          if (!compSet.has(nk) || used.has(nk) || ownRay.has(nk)) continue;
          nexts.push({ pt: { x: nx, y: ny }, key: nk, deg: degInComp(nx, ny, used) });
        }

        nexts.sort((a, b) => a.deg - b.deg);
        const branchLimit = Math.min(2, nexts.length);
        for (let bi = 0; bi < branchLimit; bi++) {
          const nxt = nexts[bi];
          path.push(nxt.pt);
          used.add(nxt.key);
          if (extend()) return true;
          used.delete(nxt.key);
          path.pop();
        }

        if (path.length === MIN_ARROW_CELLS && rem >= MIN_ARROW_CELLS) {
          if (
            isRemainingRegionValidFast(
              compMask,
              placedMask,
              path,
              cols,
              rows,
              scratchActive,
              scratchBlocked,
              scratchQueue
            )
          ) {
            const cells = [...path].reverse();
            const head = cells[cells.length - 1];
            const neck = cells[cells.length - 2];
            const dir = inferDirection(neck, head);
            if (dir) {
              const lk = getEscapeLaneKey(head, dir);
              for (const c of cells) {
                const ck = pointKey(c.x, c.y);
                compSet.delete(ck);
                placedSet.add(ck);
                const idx = c.y * cols + c.x;
                compMask[idx] = 0;
                placedMask[idx] = 1;
              }
              reverseArrows.push({ cells, dir, rayKeys: ownRay });
              if (laneCounts) laneCounts.set(lk, (laneCounts.get(lk) ?? 0) + 1);
              if (solve(depth + 1)) return true;
              if (laneCounts) laneCounts.set(lk, Math.max(0, (laneCounts.get(lk) ?? 1) - 1));
              reverseArrows.pop();
              for (const c of cells) {
                const ck = pointKey(c.x, c.y);
                placedSet.delete(ck);
                compSet.add(ck);
                const idx = c.y * cols + c.x;
                placedMask[idx] = 0;
                compMask[idx] = 1;
              }
            }
          }
        }

        return false;
      };

      if (extend()) return true;
    }

    return false;
  };

  return solve(0);
}

function absorbComponentsCleanly(
  reverseArrows: { cells: Point[]; dir: Direction; rayKeys: Set<string> }[],
  freeSet: Set<string>,
  placedSet: Set<string>,
  cols: number,
  rows: number
): void {
  if (freeSet.size === 0) return;
  const comps = getConnectedComponents(freeSet, cols, rows);
  for (const comp of comps) {
    if (comp.length > 18) continue;
    const compSet = new Set<string>(comp);
    const savedArrows = reverseArrows.map((a) => ({
      cells: [...a.cells],
      dir: a.dir,
      rayKeys: new Set(a.rayKeys),
    }));
    const savedPlaced = new Set(placedSet);
    absorbRemainingCells(reverseArrows, compSet, placedSet);
    if (compSet.size === 0) {
      for (const k of comp) freeSet.delete(k);
    } else {
      reverseArrows.length = 0;
      for (const a of savedArrows) reverseArrows.push(a);
      placedSet.clear();
      for (const k of savedPlaced) placedSet.add(k);
    }
  }
}

function finishRemainingZeroGap(
  freeSet: Set<string>,
  placedSet: Set<string>,
  cols: number,
  rows: number,
  reverseArrows: { cells: Point[]; dir: Direction; rayKeys: Set<string> }[],
  inwardCenter?: { x: number; y: number }
): boolean {
  const tryTileAllComponents = (): boolean => {
    if (freeSet.size === 0) return true;
    const comps = getConnectedComponents(freeSet, cols, rows);
    if (comps.some((c) => c.length < MIN_ARROW_CELLS || c.length > 46)) {
      return false;
    }

    // Tile larger (interior) components before smaller (outer) components so outer tips remain free to exit first
    comps.sort((a, b) => b.length - a.length);
    const savedLen = reverseArrows.length;
    const laneCounts = new Map<string, number>();
    for (const a of reverseArrows) {
      const h = a.cells[a.cells.length - 1];
      const lk = getEscapeLaneKey(h, a.dir);
      laneCounts.set(lk, (laneCounts.get(lk) ?? 0) + 1);
    }

    for (const comp of comps) {
      const compSet = new Set<string>(comp);
      if (
        !tileComponentExact(
          compSet,
          placedSet,
          cols,
          rows,
          reverseArrows,
          comp.length > 36 ? 2400 : 1500,
          inwardCenter,
          laneCounts
        )
      ) {
        while (reverseArrows.length > savedLen) {
          const popped = reverseArrows.pop()!;
          for (const c of popped.cells) {
            placedSet.delete(pointKey(c.x, c.y));
          }
        }
        return false;
      }
    }

    freeSet.clear();
    return true;
  };

  absorbComponentsCleanly(reverseArrows, freeSet, placedSet, cols, rows);

  for (let pops = 0; pops <= 5 && reverseArrows.length >= 0; pops++) {
    if (freeSet.size === 0) return true;
    if (tryTileAllComponents()) return true;

    const savedArrows = reverseArrows.map((a) => ({
      cells: [...a.cells],
      dir: a.dir,
      rayKeys: new Set(a.rayKeys),
    }));
    const savedFree = new Set(freeSet);
    const savedPlaced = new Set(placedSet);

    absorbRemainingCells(reverseArrows, freeSet, placedSet);
    if (freeSet.size === 0 || tryTileAllComponents()) {
      return true;
    }

    reverseArrows.length = 0;
    for (const a of savedArrows) reverseArrows.push(a);
    freeSet.clear();
    for (const k of savedFree) freeSet.add(k);
    placedSet.clear();
    for (const k of savedPlaced) placedSet.add(k);

    const popped = reverseArrows.pop();
    if (!popped) break;
    for (const c of popped.cells) {
      const ck = pointKey(c.x, c.y);
      placedSet.delete(ck);
      freeSet.add(ck);
    }
    absorbComponentsCleanly(reverseArrows, freeSet, placedSet, cols, rows);
  }

  return freeSet.size === 0;
}

/**
 * Computes for each arrow index the set of kept arrows that transitively depend
 * on it (cannot escape until it escapes). Used so Mutation B allows re-tiled
 * arrows to point inward at independent kept arrows rather than only empty air.
 */
function buildDependentGraph(arrows: Arrow[], cols: number, rows: number): number[][] {
  const n = arrows.length;
  const grid = new Int16Array(cols * rows).fill(-1);
  for (let i = 0; i < n; i++) {
    for (const c of arrows[i].cells) {
      grid[c.y * cols + c.x] = i;
    }
  }
  const dependents: number[][] = arrows.map(() => []);
  for (let i = 0; i < n; i++) {
    const a = arrows[i];
    const head = a.cells[a.cells.length - 1];
    const vec = getDirectionVector(a.dir);
    const seen = new Set<number>();
    let cx = head.x + vec.x;
    let cy = head.y + vec.y;
    while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      const occ = grid[cy * cols + cx];
      if (occ !== -1 && occ !== i && !seen.has(occ)) {
        seen.add(occ);
        dependents[occ].push(i);
      }
      cx += vec.x;
      cy += vec.y;
    }
  }
  return dependents;
}

/**
 * Step 2 Forward Simulation & Zero-Gap Mutation:
 * Mutates an already-valid, zero-gap, 6+ cell DAG board using:
 *  A) Single-arrow tail/head reversals (preserves exact silhouette cells & zero gaps)
 *  B) Local 2-arrow pair re-tiling (merges an excess-free or outward arrow with a neighbor
 *     and re-tiles their union with inward-pointing / blocking heads)
 *  C) 2-arrow simultaneous reversal to break single-reversal cycle deadlocks
 * until >50% of arrows point inward and every forward step has 1..5 clear arrows.
 */
function repairCascadeBoard(
  arrows: Arrow[],
  cols: number,
  rows: number,
  rng: () => number,
  maxPairCells = 42
): { arrows: Arrow[]; solutionSequence: string[]; ok: boolean } {
  const gcx = (cols - 1) / 2;
  const gcy = (rows - 1) / 2;

  const evaluate = (
    cand: Arrow[],
    cutoffPenalty = Infinity
  ): {
    solvable: boolean;
    sequence: string[];
    inward: number;
    maxClear: number;
    laneExcess: number;
    maxClusterNeighbors: number;
    penalty: number;
    bottleneckIndices: number[];
  } => {
    const inward = countInwardArrows(cand, cols, rows);
    const minInward = Math.floor(cand.length / 2) + 1;
    const inwardDeficit = Math.max(0, minInward - inward);
    const laneCheck = checkEscapeLaneLimit(cand, 3);
    const cluster = analyzeDirectionClusters(cand);
    const clusterHotspot = Math.max(0, cluster.maxNeighborsWithin4 - 2) * 80;
    const minPossiblePenalty =
      laneCheck.excessSum * 5000 +
      inwardDeficit * 350 +
      cluster.clusterPenalty * 14 +
      clusterHotspot +
      10 -
      inward * 2;
    if (minPossiblePenalty >= cutoffPenalty) {
      return {
        solvable: false,
        sequence: [],
        inward,
        maxClear: 999,
        laneExcess: laneCheck.excessSum,
        maxClusterNeighbors: cluster.maxNeighborsWithin4,
        penalty: minPossiblePenalty,
        bottleneckIndices: [],
      };
    }

    const analysis = analyzeBoardCascade(cand, cols, rows, 5);
    if (!analysis.solvable) {
      return {
        solvable: false,
        sequence: [],
        inward: 0,
        maxClear: 999,
        laneExcess: 999,
        maxClusterNeighbors: 99,
        penalty: 1e9,
        bottleneckIndices: [],
      };
    }
    const clearExcess = Math.max(0, analysis.maxClearObserved - 5);
    const penalty =
      laneCheck.excessSum * 5000 +
      clearExcess * 1500 +
      analysis.excessSum * 200 +
      inwardDeficit * 350 +
      cluster.clusterPenalty * 14 +
      clusterHotspot +
      analysis.maxClearObserved * 10 -
      inward * 2;
    return {
      solvable: true,
      sequence: analysis.sequence,
      inward,
      maxClear: analysis.maxClearObserved,
      laneExcess: laneCheck.excessSum,
      maxClusterNeighbors: cluster.maxNeighborsWithin4,
      penalty,
      bottleneckIndices: analysis.bottleneckIndices,
    };
  };

  let current = arrows.map((a) => ({ ...a, cells: [...a.cells] }));
  let bestEval = evaluate(current);
  if (!bestEval.solvable) {
    return { arrows: current, solutionSequence: [], ok: false };
  }

  for (let pass = 0; pass < 75; pass++) {
    const coreValid =
      bestEval.laneExcess === 0 &&
      bestEval.inward * 2 > current.length &&
      bestEval.maxClear <= 5;
    if (coreValid && (bestEval.maxClusterNeighbors <= 2 || pass >= (bestEval.maxClusterNeighbors >= 4 ? 6 : 3))) {
      return { arrows: current, solutionSequence: bestEval.sequence, ok: true };
    }

    let improved = false;
    let nextBestArrows: Arrow[] | null = null;
    let nextBestEval = bestEval;

    // Mutation A: Single-arrow head/tail reversal (zero-gap preserving)
    const indices = current.map((_, i) => i);
    shuffleInPlace(indices, rng);
    for (const idx of indices) {
      const a = current[idx];
      const revCells = [...a.cells].reverse();
      const revDir = inferDirection(
        revCells[revCells.length - 2],
        revCells[revCells.length - 1]
      );
      if (!revDir) continue;

      const trial = current.map((item, j) =>
        j === idx ? { ...item, cells: revCells, dir: revDir } : item
      );
      const ev = evaluate(trial, nextBestEval.penalty);
      if (ev.solvable && ev.penalty < nextBestEval.penalty) {
        nextBestEval = ev;
        nextBestArrows = trial;
        improved = true;
        if (
          ev.laneExcess === 0 &&
          ev.inward * 2 > trial.length &&
          ev.maxClear <= 5 &&
          ev.maxClusterNeighbors <= 2
        ) {
          break;
        }
      }
    }

    // Mutation B: Local 2-arrow pair re-tiling if reversals alone plateau near target
    const bottleneckSet = new Set<number>(bestEval.bottleneckIndices);
    if (!coreValid && !improved && (bestEval.maxClear <= 12 || bestEval.laneExcess > 0)) {
      const cellOwner = new Map<string, number>();
      current.forEach((a, idx) => {
        for (const c of a.cells) cellOwner.set(pointKey(c.x, c.y), idx);
      });
      const depGraph = buildDependentGraph(current, cols, rows);

      const pairsTried = new Set<string>();
      const pairCandidates: { pair: [number, number]; prio: number }[] = [];
      for (let i = 0; i < current.length; i++) {
        const a = current[i];
        const aOutward = !isArrowInward(a, cols, rows);
        const aBottleneck = bottleneckSet.has(i);
        for (const c of a.cells) {
          for (const d of DIRECTIONS) {
            const dv = getDirectionVector(d);
            const j = cellOwner.get(pointKey(c.x + dv.x, c.y + dv.y));
            if (j === undefined || j === i) continue;
            const lo = Math.min(i, j);
            const hi = Math.max(i, j);
            const pk = `${lo}-${hi}`;
            if (pairsTried.has(pk)) continue;
            pairsTried.add(pk);
            if (current[i].cells.length + current[j].cells.length > maxPairCells) continue;
            const bOutward = !isArrowInward(current[j], cols, rows);
            const bBottleneck = bottleneckSet.has(j);
            const prio =
              (aBottleneck ? 10 : 0) +
              (bBottleneck ? 10 : 0) +
              (aOutward ? 2 : 0) +
              (bOutward ? 2 : 0) +
              rng();
            pairCandidates.push({ pair: [i, j], prio });
          }
        }
      }

      pairCandidates.sort((a, b) => b.prio - a.prio);
      for (const { pair: [i, j] } of pairCandidates.slice(0, 32)) {
        // Only forbid rays from hitting kept arrows that transitively depend on i or j
        const blockedOut = new Uint8Array(current.length);
        const q = [i, j];
        blockedOut[i] = 1;
        blockedOut[j] = 1;
        for (let qi = 0; qi < q.length; qi++) {
          const u = q[qi];
          for (const v of depGraph[u]) {
            if (blockedOut[v] === 0) {
              blockedOut[v] = 1;
              q.push(v);
            }
          }
        }

        const compSet = new Set<string>();
        const placedSet = new Set<string>();
        const keptLaneCounts = new Map<string, number>();
        current.forEach((item, idx) => {
          if (idx !== i && idx !== j) {
            const lk = getEscapeLaneKey(item.cells[item.cells.length - 1], item.dir);
            keptLaneCounts.set(lk, (keptLaneCounts.get(lk) ?? 0) + 1);
          }
          for (const c of item.cells) {
            const k = pointKey(c.x, c.y);
            if (idx === i || idx === j) compSet.add(k);
            else if (blockedOut[idx] === 1) placedSet.add(k);
          }
        });

        const tiled: { cells: Point[]; dir: Direction; rayKeys: Set<string> }[] = [];
        if (
          !tileComponentExact(
            compSet,
            placedSet,
            cols,
            rows,
            tiled,
            1000,
            { x: gcx, y: gcy },
            keptLaneCounts
          )
        ) {
          continue;
        }
        if (tiled.some((t) => t.cells.length < MIN_ARROW_CELLS)) continue;

        const kept = current.filter((_, idx) => idx !== i && idx !== j);

        // Test orientation combinations of the re-tiled arrows (almost zero extra cost)
        const baseArrows: Arrow[] = tiled.map((t, k) => ({
          id: `m${pass}_${k}_${i}_${j}`,
          cells: t.cells,
          dir: t.dir,
          colorIndex: 0,
        }));
        const comboLimit = Math.min(8, 1 << Math.min(3, baseArrows.length));
        for (let mask = 0; mask < comboLimit; mask++) {
          let validCombo = true;
          const oriented = baseArrows.map((ba, bit) => {
            if (((mask >> bit) & 1) === 0) return ba;
            const revCells = [...ba.cells].reverse();
            const revDir = inferDirection(
              revCells[revCells.length - 2],
              revCells[revCells.length - 1]
            );
            if (!revDir) {
              validCombo = false;
              return ba;
            }
            return { ...ba, cells: revCells, dir: revDir };
          });
          if (!validCombo) continue;

          const combined: Arrow[] = [...kept, ...oriented].map((item, idx) => ({
            ...item,
            id: `a${idx}`,
          }));

          const ev = evaluate(combined, nextBestEval.penalty);
          if (ev.solvable && ev.penalty < nextBestEval.penalty) {
            nextBestEval = ev;
            nextBestArrows = combined;
            improved = true;
            if (
              ev.laneExcess === 0 &&
              ev.inward * 2 > combined.length &&
              ev.maxClear <= 5 &&
              ev.maxClusterNeighbors <= 2
            ) {
              break;
            }
          }
        }
        if (
          nextBestEval.laneExcess === 0 &&
          nextBestEval.inward * 2 > current.length &&
          nextBestEval.maxClear <= 5 &&
          nextBestEval.maxClusterNeighbors <= 2
        ) {
          break;
        }
      }
    }

    // Mutation C: 2-arrow simultaneous reversal to break single-reversal cycle deadlocks
    if (!coreValid && !improved && (bestEval.maxClear <= 10 || bestEval.laneExcess > 0)) {
      const revOptions: { idx: number; cells: Point[]; dir: Direction; prio: number }[] = [];
      for (let i = 0; i < current.length; i++) {
        const revCells = [...current[i].cells].reverse();
        const revDir = inferDirection(
          revCells[revCells.length - 2],
          revCells[revCells.length - 1]
        );
        if (revDir) {
          const wasOutward = !isArrowInward(current[i], cols, rows);
          const isBottleneck = bottleneckSet.has(i);
          revOptions.push({
            idx: i,
            cells: revCells,
            dir: revDir,
            prio: (isBottleneck ? 10 : 0) + (wasOutward ? 2 : 0) + rng(),
          });
        }
      }
      revOptions.sort((a, b) => b.prio - a.prio);
      const cap = Math.min(18, revOptions.length);
      for (let a = 0; a < cap && !improved; a++) {
        for (let b = a + 1; b < cap; b++) {
          const ra = revOptions[a];
          const rb = revOptions[b];
          const trial = current.map((item, j) =>
            j === ra.idx
              ? { ...item, cells: ra.cells, dir: ra.dir }
              : j === rb.idx
                ? { ...item, cells: rb.cells, dir: rb.dir }
                : item
          );
          const ev = evaluate(trial, nextBestEval.penalty);
          if (ev.solvable && ev.penalty < nextBestEval.penalty) {
            nextBestEval = ev;
            nextBestArrows = trial;
            improved = true;
            if (
              ev.laneExcess === 0 &&
              ev.inward * 2 > trial.length &&
              ev.maxClear <= 5 &&
              ev.maxClusterNeighbors <= 2
            ) {
              break;
            }
          }
        }
      }
    }

    if (!improved || !nextBestArrows) break;
    current = nextBestArrows;
    bestEval = nextBestEval;
  }

  return {
    arrows: current,
    solutionSequence: bestEval.sequence,
    ok:
      bestEval.laneExcess === 0 &&
      bestEval.inward * 2 > current.length &&
      bestEval.maxClear <= 5,
  };
}

function buildPuzzleAttempt(
  difficulty: Difficulty,
  levelId: number,
  seed: number,
  relaxBounds = false,
  silhouetteOverride?: { name: string; cols: number; rows: number; cells: Point[] }
): PuzzleLevel | null {
  const rng = createRng(seed);
  const silhouette = silhouetteOverride ?? getSilhouetteForLevel(difficulty, levelId);
  const { cols, rows, cells: silhouetteCells, name: theme } = silhouette;
  const cfg = getConfigForLevel(difficulty, ((levelId - 1) % 100) + 1);

  const maskSet = new Set<string>(silhouetteCells.map((c) => pointKey(c.x, c.y)));
  const freeSet = new Set<string>(maskSet);
  const placedSet = new Set<string>();
  const placedRayCells = new Set<string>();

  const totalCells = cols * rows;
  const freeMask = setToGridMask(freeSet, cols, rows);
  const placedMask = new Uint8Array(totalCells);
  const scratchActive = new Uint8Array(totalCells);
  const scratchBlocked = new Uint8Array(totalCells);
  const scratchQueue = new Int32Array(totalCells);

  let cxSum = 0;
  let cySum = 0;
  for (const c of silhouetteCells) {
    cxSum += c.x;
    cySum += c.y;
  }
  const centerX = cxSum / silhouetteCells.length;
  const centerY = cySum / silhouetteCells.length;

  const reverseArrows: {
    cells: Point[];
    dir: Direction;
    rayKeys: Set<string>;
  }[] = [];

  const desiredArrows = Math.max(
    cfg.minArrows,
    Math.min(
      cfg.maxArrows,
      Math.round(silhouetteCells.length / ((cfg.targetMinLen + cfg.targetMaxLen) * 0.5))
    )
  );
  const avgLen = Math.max(
    cfg.targetMinLen,
    Math.round(silhouetteCells.length / desiredArrows)
  );

  const isInwardPlacement = true;
  const isMediumMode = true;
  const gcx = (cols - 1) / 2;
  const gcy = (rows - 1) / 2;
  const anchorSide = Math.abs(seed) % 4;
  const anchorX = anchorSide === 0 ? 0 : anchorSide === 1 ? cols - 1 : gcx;
  const anchorY = anchorSide === 2 ? 0 : anchorSide === 3 ? rows - 1 : gcy;

  let guard = 0;
  let rewinds = 0;
  while (freeSet.size >= MIN_ARROW_CELLS && guard < 240) {
    guard++;

    const currComps =
      freeSet.size <= 320
        ? countValidRemainingComponentsFast(
            freeMask,
            placedMask,
            [],
            cols,
            rows,
            scratchActive,
            scratchBlocked,
            scratchQueue
          )
        : 0;

    // Count how many already-placed arrows currently have NO freeSet cell on their exit ray,
    // plus current escape lane counts and directional head positions for anti-clustering
    let permFreeAtStart = 0;
    let inwardPlacedCount = 0;
    const laneCounts = new Map<string, number>();
    const placedHeads: { x: number; y: number; dir: Direction }[] = [];
    for (const a of reverseArrows) {
      const h = a.cells[a.cells.length - 1];
      const v = getDirectionVector(a.dir);
      if (v.x * (gcx - h.x) + v.y * (gcy - h.y) > 0) inwardPlacedCount++;
      const lk = getEscapeLaneKey(h, a.dir);
      laneCounts.set(lk, (laneCounts.get(lk) ?? 0) + 1);
      placedHeads.push({ x: h.x, y: h.y, dir: a.dir });
      if (isMediumMode && freeSet.size > 30) {
        let blockedByFree = false;
        for (const rk of a.rayKeys) {
          if (freeSet.has(rk)) {
            blockedByFree = true;
            break;
          }
        }
        if (!blockedByFree) permFreeAtStart++;
      }
    }
    const inwardSurplus =
      reverseArrows.length >= 10 && inwardPlacedCount >= Math.ceil(reverseArrows.length * 0.62);
    const inEndgame = freeSet.size <= Math.max(120, Math.round(silhouetteCells.length * 0.36));

    const candidates: {
      head: Point;
      neck: Point;
      dir: Direction;
      score: number;
    }[] = [];

    const freeKeys = Array.from(freeSet);
    const maxSample = isMediumMode ? 240 : 96;
    if (freeKeys.length > maxSample) {
      shuffleInPlace(freeKeys, rng);
    }
    const sampleCount = Math.min(maxSample, freeKeys.length);

    for (let si = 0; si < sampleCount; si++) {
      const key = freeKeys[si];
      const comma = key.indexOf(',');
      const hx = Number(key.slice(0, comma));
      const hy = Number(key.slice(comma + 1));
      const head = { x: hx, y: hy };

      for (const dir of DIRECTIONS) {
        const laneCount = laneCounts.get(getEscapeLaneKey(head, dir)) ?? 0;

        const vec = getDirectionVector(dir);
        const neck = { x: hx - vec.x, y: hy - vec.y };
        const neckKey = pointKey(neck.x, neck.y);
        if (!freeSet.has(neckKey)) continue;
        if (!isRayClearOfMask(hx, hy, dir, cols, rows, placedMask)) continue;

        let rayFreeCount = 0;
        let rx = hx + vec.x;
        let ry = hy + vec.y;
        while (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          if (freeMask[ry * cols + rx] === 1) rayFreeCount++;
          rx += vec.x;
          ry += vec.y;
        }

        const distCenter = Math.hypot(hx - centerX, hy - centerY);
        const isInteriorPhase =
          !isInwardPlacement && reverseArrows.length < Math.max(3, desiredArrows * 0.25);
        let score = 0;

        if (laneCount >= 3) score -= 10.0;
        else if (laneCount === 2) score -= 4.0;
        else if (laneCount === 1) score -= 1.0;

        // Anti-clustering: gently discourage placing same-direction arrows close together without breaking wavefront
        let clusterPenaltyLocal = 0;
        for (let hi = 0; hi < placedHeads.length; hi++) {
          const ph = placedHeads[hi];
          if (ph.dir !== dir) continue;
          const dist = Math.hypot(hx - ph.x, hy - ph.y);
          if (dist <= 2.5) clusterPenaltyLocal += 2.5;
          else if (dist <= 4.0) clusterPenaltyLocal += 1.2;
        }
        score -= Math.min(5.5, clusterPenaltyLocal);

        if (isInwardPlacement) {
          // Rule 2: Inward Orientation Bias (>50% dot product > 0 toward grid center)
          // Strong early/mid-game; relaxed in endgame if >62% inward is already banked
          const inwardDot = vec.x * (gcx - hx) + vec.y * (gcy - hy);
          if (inwardDot > 0) {
            score += (inwardSurplus && inEndgame ? 6 : 13) + Math.min(8, inwardDot) * 0.4;
          } else {
            score -= inwardSurplus && inEndgame ? 0 : 4;
          }

          if (reverseArrows.length < 2) {
            // Anchor the initial core on one side/edge so placedSet grows as ONE contiguous wavefront
            const distAnchor = Math.hypot(hx - anchorX, hy - anchorY);
            score += Math.max(0, 24 - distAnchor) * 2.5;
          } else {
            let adjPlaced = 0;
            for (const d of DIRECTIONS) {
              const dv = getDirectionVector(d);
              if (placedSet.has(pointKey(hx + dv.x, hy + dv.y))) adjPlaced++;
            }
            score += adjPlaced * 4.5;
          }

          // Rule 3: Bottleneck Cascade — cross earlier rays AND ensure future arrows block this one
          let blocksRay = 0;
          if (placedRayCells.has(key)) blocksRay += 1;
          if (placedRayCells.has(neckKey)) blocksRay += 1;
          score += blocksRay * (cfg.blockerWeight * 1.4);

          if (freeSet.size > 32) {
            if (rayFreeCount > 0) {
              score += Math.min(6, rayFreeCount) * (inEndgame ? 0.5 : 1.5);
            } else if (!inEndgame) {
              score -= permFreeAtStart >= 4 ? 18 : 6;
            }
          }
        } else if (isInteriorPhase) {
          score += Math.max(0, 14 - distCenter) * 2.2;
        } else {
          let blocksRay = 0;
          if (placedRayCells.has(key)) blocksRay += 1;
          if (placedRayCells.has(neckKey)) blocksRay += 1;
          score += blocksRay * cfg.blockerWeight;

          let adjPlaced = 0;
          for (const d of DIRECTIONS) {
            const dv = getDirectionVector(d);
            if (placedSet.has(pointKey(hx + dv.x, hy + dv.y))) adjPlaced++;
          }
          // Prefer growing outward from existing placed core so freeSet stays outer & unenclosed
          score += adjPlaced * 2.2;
          // Strongly prefer heads pointing outward away from remaining freeSet
          if (rayFreeCount === 0) score += 5.0;
          else score -= rayFreeCount * 1.4;
        }

        let freeDeg = 0;
        for (const d of DIRECTIONS) {
          const dv = getDirectionVector(d);
          if (freeSet.has(pointKey(hx + dv.x, hy + dv.y))) freeDeg++;
        }
        score += (4 - freeDeg) * 1.1;
        score += rng() * 2.8;
        candidates.push({ head, neck, dir, score });
      }
    }

    if (candidates.length === 0) break;

    candidates.sort((a, b) => b.score - a.score);
    const tryLimit = Math.min(
      isMediumMode
        ? freeSet.size <= 160
          ? 42
          : 20
        : freeSet.size <= 120
          ? 32
          : 12,
      candidates.length
    );
    let committed = false;
    let bestSplitFallback: {
      body: Point[];
      ownRaySet: Set<string>;
      newComps: number;
    } | null = null;

    const commitArrow = (bodyRev: Point[], ownRaySet: Set<string>): boolean => {
      const cells = [...bodyRev].reverse();
      const head = cells[cells.length - 1];
      const neck = cells[cells.length - 2];
      const finalDir = inferDirection(neck, head);
      if (!finalDir) return false;

      reverseArrows.push({ cells, dir: finalDir, rayKeys: ownRaySet });
      for (const c of cells) {
        const k = pointKey(c.x, c.y);
        freeSet.delete(k);
        placedSet.add(k);
        const idx = c.y * cols + c.x;
        freeMask[idx] = 0;
        placedMask[idx] = 1;
      }
      for (const rk of ownRaySet) {
        placedRayCells.add(rk);
      }
      return true;
    };

    for (let cIdx = 0; cIdx < tryLimit; cIdx++) {
      const pickOffset =
        cIdx === 0
          ? rewinds > 0
            ? Math.floor(rng() * Math.min(8, candidates.length))
            : Math.floor(Math.pow(rng(), 2) * Math.min(4, candidates.length))
          : cIdx;
      const chosen = candidates[pickOffset];

      const ownRaySet = new Set<string>(
        getExitRayCells(chosen.head, chosen.dir, cols, rows).map((p) =>
          pointKey(p.x, p.y)
        )
      );

      const maxGrowth =
        freeSet.size <= cfg.targetMaxLen + 6
          ? freeSet.size
          : Math.max(
              cfg.targetMinLen,
              Math.min(
                cfg.targetMaxLen,
                avgLen + Math.floor((rng() - 0.5) * 6)
              )
            );

      const bodyReverse: Point[] = [chosen.head, chosen.neck];
      const usedLocal = new Set<string>([
        pointKey(chosen.head.x, chosen.head.y),
        pointKey(chosen.neck.x, chosen.neck.y),
      ]);
      let currentDir: Direction = chosen.dir;

      while (bodyReverse.length < maxGrowth) {
        const tail = bodyReverse[bodyReverse.length - 1];
        const nextOptions: { pt: Point; dir: Direction; score: number }[] = [];

        for (const d of DIRECTIONS) {
          const dv = getDirectionVector(d);
          const nx = tail.x + dv.x;
          const ny = tail.y + dv.y;
          const nKey = pointKey(nx, ny);
          if (!freeSet.has(nKey)) continue;
          if (usedLocal.has(nKey)) continue;
          if (ownRaySet.has(nKey)) continue;

          let s = 0;
          if (placedRayCells.has(nKey)) {
            s += cfg.blockerWeight * (isMediumMode ? 1.8 : 1.0);
          }
          if (d !== currentDir) s += cfg.turnBias * 4.5;
          else s += (1 - cfg.turnBias) * 2.5;

          let freeNeighbors = 0;
          for (const nd of DIRECTIONS) {
            const ndv = getDirectionVector(nd);
            const adjKey = pointKey(nx + ndv.x, ny + ndv.y);
            if (freeSet.has(adjKey) && !usedLocal.has(adjKey)) freeNeighbors++;
          }
          if (freeNeighbors === 0 && bodyReverse.length + 1 < MIN_ARROW_CELLS) {
            s -= 15;
          } else {
            s += (4 - freeNeighbors) * 2.4;
          }

          s += rng() * 1.4;
          nextOptions.push({ pt: { x: nx, y: ny }, dir: d, score: s });
        }

        if (nextOptions.length === 0) break;
        nextOptions.sort((a, b) => b.score - a.score);
        const bestNext = nextOptions[0];
        bodyReverse.push(bestNext.pt);
        usedLocal.add(pointKey(bestNext.pt.x, bestNext.pt.y));
        currentDir = bestNext.dir;
      }

      if (bodyReverse.length < MIN_ARROW_CELLS) continue;

      // Trim prefix back toward MIN_ARROW_CELLS, preferring non-splitting cuts
      let nonSplitBody: Point[] | null = null;
      while (bodyReverse.length >= MIN_ARROW_CELLS) {
        const newComps = countValidRemainingComponentsFast(
          freeMask,
          placedMask,
          bodyReverse,
          cols,
          rows,
          scratchActive,
          scratchBlocked,
          scratchQueue
        );
        if (newComps > 0) {
          if (currComps === 0 || newComps <= currComps) {
            nonSplitBody = [...bodyReverse];
            break;
          }
          if (!bestSplitFallback || newComps < bestSplitFallback.newComps) {
            bestSplitFallback = {
              body: [...bodyReverse],
              ownRaySet,
              newComps,
            };
          }
        }
        const poppedPt = bodyReverse.pop()!;
        usedLocal.delete(pointKey(poppedPt.x, poppedPt.y));
      }

      if (nonSplitBody && commitArrow(nonSplitBody, ownRaySet)) {
        committed = true;
        break;
      }
    }

    if (!committed && bestSplitFallback) {
      if (commitArrow(bestSplitFallback.body, bestSplitFallback.ownRaySet)) {
        committed = true;
      }
    }

    // Mini 2-branch fallback within this step if all single greedy walks split freeSet
    if (!committed) {
      const miniLimit = Math.min(12, candidates.length);
      for (let cIdx = 0; cIdx < miniLimit && !committed; cIdx++) {
        const chosen = candidates[cIdx];
        const ownRaySet = new Set<string>(
          getExitRayCells(chosen.head, chosen.dir, cols, rows).map((p) => pointKey(p.x, p.y))
        );
        const path: Point[] = [chosen.head, chosen.neck];
        const usedLocal = new Set<string>([
          pointKey(chosen.head.x, chosen.head.y),
          pointKey(chosen.neck.x, chosen.neck.y),
        ]);
        let nodes = 0;
        const dfsFind = (): boolean => {
          if (++nodes > 70) return false;
          if (path.length >= MIN_ARROW_CELLS && path.length <= 14) {
            if (
              isRemainingRegionValidFast(
                freeMask,
                placedMask,
                path,
                cols,
                rows,
                scratchActive,
                scratchBlocked,
                scratchQueue
              )
            ) {
              return true;
            }
          }
          if (path.length >= 14) return false;
          const tail = path[path.length - 1];
          const nexts: { pt: Point; key: string; deg: number }[] = [];
          for (const d of DIRECTIONS) {
            const dv = getDirectionVector(d);
            const nx = tail.x + dv.x;
            const ny = tail.y + dv.y;
            const nk = pointKey(nx, ny);
            if (!freeSet.has(nk) || usedLocal.has(nk) || ownRaySet.has(nk)) continue;
            let deg = 0;
            for (const nd of DIRECTIONS) {
              const ndv = getDirectionVector(nd);
              const ak = pointKey(nx + ndv.x, ny + ndv.y);
              if (freeSet.has(ak) && !usedLocal.has(ak)) deg++;
            }
            nexts.push({ pt: { x: nx, y: ny }, key: nk, deg });
          }
          nexts.sort((a, b) => a.deg - b.deg);
          for (let bi = 0; bi < Math.min(2, nexts.length); bi++) {
            const nxt = nexts[bi];
            path.push(nxt.pt);
            usedLocal.add(nxt.key);
            if (dfsFind()) return true;
            usedLocal.delete(nxt.key);
            path.pop();
          }
          return false;
        };

        if (dfsFind()) {
          if (commitArrow(path, ownRaySet)) {
            committed = true;
          }
        }
      }
    }

    if (!committed) {
      if (rewinds < 3 && reverseArrows.length > 10) {
        rewinds++;
        const popCount = Math.min(reverseArrows.length - 4, 6 + rewinds * 2);
        for (let p = 0; p < popCount; p++) {
          const popped = reverseArrows.pop()!;
          for (const c of popped.cells) {
            const k = pointKey(c.x, c.y);
            placedSet.delete(k);
            freeSet.add(k);
            const idx = c.y * cols + c.x;
            placedMask[idx] = 0;
            freeMask[idx] = 1;
          }
        }
        placedRayCells.clear();
        for (const a of reverseArrows) {
          for (const rk of a.rayKeys) placedRayCells.add(rk);
        }
        continue;
      }
      break;
    }
  }

  if (freeSet.size > 0) {
    finishRemainingZeroGap(
      freeSet,
      placedSet,
      cols,
      rows,
      reverseArrows,
      isMediumMode ? { x: gcx, y: gcy } : undefined
    );
  }

  // Strictly enforce zero gaps across the entire silhouette!
  if (freeSet.size > 0) {
    return null;
  }

  // Forward removal order is the reverse of construction order
  const orderedReverse = [...reverseArrows].reverse();
  let arrows: Arrow[] = orderedReverse.map((item, idx) => ({
    id: `a${idx}`,
    cells: item.cells,
    dir: item.dir,
    colorIndex: 0, // Single ink black styling
  }));

  // Verify every arrow has >= 6 cells (>= 5 segments)
  if (arrows.some((a) => a.cells.length < MIN_ARROW_CELLS)) {
    return null;
  }

  let solutionSequence = arrows.map((a) => a.id);
  shuffleInPlace(arrows, rng);

  // Step 2: Forward Simulation Check & Zero-Gap Mutation for all difficulties
  if (isMediumMode) {
    const repaired = repairCascadeBoard(
      arrows,
      cols,
      rows,
      rng,
      difficulty === 'hard' ? 46 : 40
    );
    if (!repaired.ok) {
      return null;
    }
    arrows = repaired.arrows;
    solutionSequence = repaired.solutionSequence;
  }

  const puzzle: PuzzleLevel = {
    id: levelId,
    difficulty,
    seed,
    theme,
    cols,
    rows,
    arrows,
    solutionSequence,
    validated: false,
    dependencyDepth: 0,
  };

  const validation = validatePuzzle(puzzle);
  if (!validation.valid) {
    return null;
  }

  if (isMediumMode) {
    const inwardCount = countInwardArrows(arrows, cols, rows);
    const cascade = checkBottleneckCascade(arrows, cols, rows, solutionSequence, 5);
    const laneCheck = checkEscapeLaneLimit(arrows, 3);
    if (inwardCount * 2 <= arrows.length || !cascade.valid || !laneCheck.valid) {
      return null;
    }
  }

  if (!relaxBounds) {
    const effectiveMinArrows = Math.max(
      8,
      Math.min(cfg.minArrows, Math.floor(silhouetteCells.length / 20))
    );

    if (
      arrows.length < effectiveMinArrows ||
      arrows.length > cfg.maxArrows + 16 ||
      validation.dependencyDepth < cfg.minDepth
    ) {
      return null;
    }
  }

  puzzle.validated = true;
  puzzle.dependencyDepth = validation.dependencyDepth;
  return puzzle;
}

/**
 * Generates and validates a dense, zero-gap 2x resolution puzzle where every
 * arrow has at least 5 segments (6+ cells).
 */
export function generateValidatedPuzzle(
  difficulty: Difficulty,
  levelId: number
): PuzzleLevel {
  const diffOffset =
    difficulty === 'easy' ? 400000 : difficulty === 'medium' ? 500000 : 600000;
  const baseSeed = diffOffset + levelId * 104729;

  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = buildPuzzleAttempt(difficulty, levelId, baseSeed + attempt, false);
    if (candidate) return candidate;
  }

  // Relaxed depth/count bounds fallback — STILL strictly enforces zero gaps, >= 6 cells/arrow, inward >50%, bottleneck <=5, and 100% solvability
  const maxAttempts = difficulty === 'hard' ? 500 : 360;
  for (let attempt = 80; attempt < maxAttempts; attempt++) {
    const candidate = buildPuzzleAttempt(difficulty, levelId, baseSeed + attempt, true);
    if (candidate) return candidate;
  }

  throw new Error(`Failed to generate zero-gap puzzle for ${difficulty} level ${levelId}`);
}

/**
 * Generates and validates a secret Medium-difficulty Daily puzzle (slotId 1..366)
 * satisfying all constraints (DAG, >50% inward, 1..5 cascade, max 3/lane, anti-cluster).
 */
export function generateDailyValidatedPuzzle(slotId: number): PuzzleLevel {
  const baseSeed = 700000 + slotId * 104729;
  const silhouette = getDailySilhouette(slotId);

  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = buildPuzzleAttempt(
      'medium',
      slotId,
      baseSeed + attempt,
      false,
      silhouette
    );
    if (candidate) return candidate;
  }

  for (let attempt = 80; attempt < 360; attempt++) {
    const candidate = buildPuzzleAttempt(
      'medium',
      slotId,
      baseSeed + attempt,
      true,
      silhouette
    );
    if (candidate) return candidate;
  }

  throw new Error(`Failed to generate daily puzzle for slot ${slotId}`);
}
