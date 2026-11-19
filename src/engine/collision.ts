import { Arrow, Direction, Point, PuzzleLevel } from './types';

export function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function getDirectionVector(dir: Direction): Point {
  switch (dir) {
    case 'UP':
      return { x: 0, y: -1 };
    case 'DOWN':
      return { x: 0, y: 1 };
    case 'LEFT':
      return { x: -1, y: 0 };
    case 'RIGHT':
      return { x: 1, y: 0 };
  }
}

export function inferDirection(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === -1) return 'UP';
  if (dx === 0 && dy === 1) return 'DOWN';
  if (dx === -1 && dy === 0) return 'LEFT';
  if (dx === 1 && dy === 0) return 'RIGHT';
  return null;
}

/**
 * Returns every grid coordinate along the arrow's exit ray starting strictly
 * one cell past its head up to the board boundary.
 */
export function getExitRayCells(
  head: Point,
  dir: Direction,
  cols: number,
  rows: number
): Point[] {
  const vec = getDirectionVector(dir);
  const ray: Point[] = [];
  let cx = head.x + vec.x;
  let cy = head.y + vec.y;
  while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
    ray.push({ x: cx, y: cy });
    cx += vec.x;
    cy += vec.y;
  }
  return ray;
}

/**
 * Builds a lookup map of occupied grid cells -> arrow ID for fast collision checks.
 */
export function buildOccupiedMap(arrows: Arrow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const arrow of arrows) {
    for (const cell of arrow.cells) {
      map.set(pointKey(cell.x, cell.y), arrow.id);
    }
  }
  return map;
}

/**
 * Checks whether an arrow has an unobstructed exit path to the edge of the board
 * against all remaining arrows (including itself).
 */
export function isArrowClear(
  arrow: Arrow,
  remainingArrows: Arrow[],
  cols: number,
  rows: number,
  occupiedMap?: Map<string, string>
): boolean {
  const map = occupiedMap ?? buildOccupiedMap(remainingArrows);
  const head = arrow.cells[arrow.cells.length - 1];
  const vec = getDirectionVector(arrow.dir);
  let cx = head.x + vec.x;
  let cy = head.y + vec.y;

  while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
    const blockerId = map.get(pointKey(cx, cy));
    if (blockerId !== undefined) {
      return false;
    }
    cx += vec.x;
    cy += vec.y;
  }

  return true;
}

/**
 * Returns all remaining arrows that are currently clear to escape.
 */
export function getClearArrows(
  remainingArrows: Arrow[],
  cols: number,
  rows: number
): Arrow[] {
  const map = buildOccupiedMap(remainingArrows);
  return remainingArrows.filter((arrow) =>
    isArrowClear(arrow, remainingArrows, cols, rows, map)
  );
}

/**
 * Independent solver that verifies a puzzle can be completely cleared
 * and measures the topological dependency wave depth.
 */
export function solvePuzzle(
  arrows: Arrow[],
  cols: number,
  rows: number
): { solvable: boolean; sequence: string[]; dependencyDepth: number } {
  let remaining = [...arrows];
  const sequence: string[] = [];
  let waves = 0;

  while (remaining.length > 0) {
    const map = buildOccupiedMap(remaining);
    const clearBatch = remaining.filter((a) =>
      isArrowClear(a, remaining, cols, rows, map)
    );
    if (clearBatch.length === 0) {
      return { solvable: false, sequence, dependencyDepth: waves };
    }
    waves += 1;
    for (const a of clearBatch) {
      sequence.push(a.id);
    }
    const removedSet = new Set(clearBatch.map((a) => a.id));
    remaining = remaining.filter((a) => !removedSet.has(a.id));
  }

  return { solvable: true, sequence, dependencyDepth: waves };
}

/**
 * Full structural and solvability validator matching GDD section 5.4.
 */
export function validatePuzzle(puzzle: PuzzleLevel): {
  valid: boolean;
  errors: string[];
  dependencyDepth: number;
} {
  const errors: string[] = [];
  const { cols, rows, arrows, solutionSequence } = puzzle;

  if (cols <= 0 || rows <= 0) {
    errors.push('Invalid board dimensions');
  }
  if (arrows.length === 0) {
    errors.push('Puzzle contains zero arrows');
  }

  const globalCells = new Set<string>();
  const arrowById = new Map<string, Arrow>();

  for (const arrow of arrows) {
    if (arrowById.has(arrow.id)) {
      errors.push(`Duplicate arrow ID: ${arrow.id}`);
    }
    arrowById.set(arrow.id, arrow);

    if (arrow.cells.length < 2) {
      errors.push(`Arrow ${arrow.id} must have at least 2 cells`);
      continue;
    }

    const localCells = new Set<string>();
    for (let i = 0; i < arrow.cells.length; i++) {
      const c = arrow.cells[i];
      if (c.x < 0 || c.x >= cols || c.y < 0 || c.y >= rows) {
        errors.push(`Arrow ${arrow.id} cell (${c.x},${c.y}) out of bounds`);
      }
      const key = pointKey(c.x, c.y);
      if (localCells.has(key)) {
        errors.push(`Arrow ${arrow.id} self-intersects at (${c.x},${c.y})`);
      }
      localCells.add(key);

      if (globalCells.has(key)) {
        errors.push(`Overlap at (${c.x},${c.y}) involving ${arrow.id}`);
      }
      globalCells.add(key);

      if (i > 0) {
        const prev = arrow.cells[i - 1];
        const dist = Math.abs(c.x - prev.x) + Math.abs(c.y - prev.y);
        if (dist !== 1) {
          errors.push(`Arrow ${arrow.id} has non-adjacent segment at index ${i}`);
        }
      }
    }

    const neck = arrow.cells[arrow.cells.length - 2];
    const head = arrow.cells[arrow.cells.length - 1];
    const expectedDir = inferDirection(neck, head);
    if (expectedDir !== arrow.dir) {
      errors.push(
        `Arrow ${arrow.id} direction ${arrow.dir} does not match head segment ${expectedDir}`
      );
    }
  }

  // Verify stored solution sequence step-by-step
  if (solutionSequence.length !== arrows.length) {
    errors.push(
      `Solution length ${solutionSequence.length} !== arrow count ${arrows.length}`
    );
  } else {
    let remaining = [...arrows];
    const seenIds = new Set<string>();
    for (let step = 0; step < solutionSequence.length; step++) {
      const id = solutionSequence[step];
      if (seenIds.has(id)) {
        errors.push(`Duplicate arrow ${id} in solutionSequence`);
        break;
      }
      seenIds.add(id);
      const target = remaining.find((a) => a.id === id);
      if (!target) {
        errors.push(`Missing arrow ${id} at step ${step}`);
        break;
      }
      if (!isArrowClear(target, remaining, cols, rows)) {
        errors.push(`Arrow ${id} is blocked at solution step ${step}`);
        break;
      }
      remaining = remaining.filter((a) => a.id !== id);
    }
    if (remaining.length !== 0 && errors.length === 0) {
      errors.push('Board not empty at end of solution sequence');
    }
  }

  // Run independent wave solver
  const solverResult = solvePuzzle(arrows, cols, rows);
  if (!solverResult.solvable) {
    errors.push('Independent solver failed to solve puzzle');
  }

  return {
    valid: errors.length === 0,
    errors,
    dependencyDepth: solverResult.dependencyDepth,
  };
}

/**
 * Returns true if the arrow's exit direction has a positive dot product
 * with the vector from its head to the geometric center of the board.
 */
export function isArrowInward(arrow: Arrow, cols: number, rows: number): boolean {
  const head = arrow.cells[arrow.cells.length - 1];
  const vec = getDirectionVector(arrow.dir);
  const gcx = (cols - 1) / 2;
  const gcy = (rows - 1) / 2;
  return vec.x * (gcx - head.x) + vec.y * (gcy - head.y) > 0;
}

export function countInwardArrows(
  arrows: Arrow[],
  cols: number,
  rows: number
): number {
  let count = 0;
  for (const a of arrows) {
    if (isArrowInward(a, cols, rows)) count++;
  }
  return count;
}

/**
 * Runs forward simulations checking that at t=0 and after every removal,
 * the number of unobstructed (in-degree = 0) arrows is in [1, maxClear].
 * Checks:
 *  1) The canonical solutionSequence
 *  2) An adversarial greedy simulation that always removes the clear arrow
 *     yielding the largest next clearCount (1-step lookahead)
 *  3) Deterministic spread playouts across available choices
 */
export function checkBottleneckCascade(
  arrows: Arrow[],
  cols: number,
  rows: number,
  solutionSequence?: string[],
  maxClear = 5
): { valid: boolean; maxClearObserved: number } {
  const total = cols * rows;
  const idToIdx = new Map<string, number>();
  arrows.forEach((a, i) => idToIdx.set(a.id, i));

  // Precompute cell ownership grid (-1 = empty, >=0 = arrow index)
  const baseGrid = new Int16Array(total).fill(-1);
  for (let i = 0; i < arrows.length; i++) {
    for (const c of arrows[i].cells) {
      baseGrid[c.y * cols + c.x] = i;
    }
  }

  // Precompute ray dependencies: blockers[i] = list of arrow indices lying on arrow i's exit ray
  const blockers: number[][] = arrows.map((a) => {
    const head = a.cells[a.cells.length - 1];
    const vec = getDirectionVector(a.dir);
    const deps: number[] = [];
    const seen = new Set<number>();
    let cx = head.x + vec.x;
    let cy = head.y + vec.y;
    while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      const occ = baseGrid[cy * cols + cx];
      if (occ !== -1 && !seen.has(occ)) {
        seen.add(occ);
        deps.push(occ);
      }
      cx += vec.x;
      cy += vec.y;
    }
    return deps;
  });

  // Reverse adjacency: dependents[b] = arrows that have b on their ray
  const dependents: number[][] = arrows.map(() => []);
  for (let i = 0; i < arrows.length; i++) {
    for (const b of blockers[i]) {
      dependents[b].push(i);
    }
  }

  let maxClearObserved = 0;

  const runOrder = (
    chooseNext: (clearList: number[], inDeg: Int32Array, step: number) => number
  ): boolean => {
    const n = arrows.length;
    const inDeg = new Int32Array(n);
    const removed = new Uint8Array(n);
    let clearList: number[] = [];
    for (let i = 0; i < n; i++) {
      inDeg[i] = blockers[i].length;
      if (inDeg[i] === 0) clearList.push(i);
    }

    for (let step = 0; step < n; step++) {
      if (clearList.length === 0) return false;
      if (clearList.length > maxClearObserved) maxClearObserved = clearList.length;
      if (clearList.length > maxClear) return false;

      const pick = chooseNext(clearList, inDeg, step);
      if (pick === -1 || removed[pick] === 1 || inDeg[pick] !== 0) return false;

      removed[pick] = 1;
      clearList = clearList.filter((id) => id !== pick);
      for (const dep of dependents[pick]) {
        if (removed[dep] === 1) continue;
        inDeg[dep]--;
        if (inDeg[dep] === 0) {
          clearList.push(dep);
        }
      }
    }
    return true;
  };

  // 1) Canonical solutionSequence (if provided)
  if (solutionSequence && solutionSequence.length === arrows.length) {
    const ok = runOrder((_cl, _deg, step) => {
      const idx = idToIdx.get(solutionSequence[step]);
      return idx !== undefined ? idx : -1;
    });
    if (!ok) return { valid: false, maxClearObserved };
  }

  // 2) Adversarial max-fanout simulation (maximizes next clearCount at every step)
  const okAdv = runOrder((clearList, inDeg) => {
    let best = clearList[0];
    let bestUnlock = -1;
    for (const cand of clearList) {
      let unlocks = 0;
      for (const dep of dependents[cand]) {
        if (inDeg[dep] === 1) unlocks++;
      }
      if (unlocks > bestUnlock) {
        bestUnlock = unlocks;
        best = cand;
      }
    }
    return best;
  });
  if (!okAdv) return { valid: false, maxClearObserved };

  // 3) Deterministic spread playouts (pick min-unlock, first, last, middle)
  for (const mode of [0, 1, 2] as const) {
    const okSpread = runOrder((clearList, inDeg) => {
      if (mode === 0) return clearList[0];
      if (mode === 1) return clearList[clearList.length - 1];
      // Min-unlock
      let best = clearList[0];
      let minUnlock = Infinity;
      for (const cand of clearList) {
        let unlocks = 0;
        for (const dep of dependents[cand]) {
          if (inDeg[dep] === 1) unlocks++;
        }
        if (unlocks < minUnlock) {
          minUnlock = unlocks;
          best = cand;
        }
      }
      return best;
    });
    if (!okSpread) return { valid: false, maxClearObserved };
  }

  return { valid: maxClearObserved >= 1 && maxClearObserved <= maxClear, maxClearObserved };
}

/**
 * Fast array-based DAG solver + cascade analyzer (no Map/string allocations).
 * Computes solvability, a valid sequence, worst-case clear count, and total excess
 * above `maxClear` across steps so mutations get smooth gradient feedback.
 */
export function analyzeBoardCascade(
  arrows: Arrow[],
  cols: number,
  rows: number,
  maxClear = 5
): {
  solvable: boolean;
  sequence: string[];
  maxClearObserved: number;
  excessSum: number;
  bottleneckIndices: number[];
} {
  const n = arrows.length;
  const total = cols * rows;
  const baseGrid = new Int16Array(total).fill(-1);
  for (let i = 0; i < n; i++) {
    for (const c of arrows[i].cells) {
      baseGrid[c.y * cols + c.x] = i;
    }
  }

  const blockers: number[][] = arrows.map((a) => {
    const head = a.cells[a.cells.length - 1];
    const vec = getDirectionVector(a.dir);
    const deps: number[] = [];
    const seen = new Set<number>();
    let cx = head.x + vec.x;
    let cy = head.y + vec.y;
    while (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      const occ = baseGrid[cy * cols + cx];
      if (occ !== -1 && !seen.has(occ)) {
        seen.add(occ);
        deps.push(occ);
      }
      cx += vec.x;
      cy += vec.y;
    }
    return deps;
  });

  const dependents: number[][] = arrows.map(() => []);
  for (let i = 0; i < n; i++) {
    for (const b of blockers[i]) {
      dependents[b].push(i);
    }
  }

  let maxClearObserved = 0;
  let excessSum = 0;
  let bestSequence: string[] = [];
  const bottleneckFlags = new Uint8Array(n);

  const runSim = (mode: 'adv' | 'min' | 'first' | 'last'): boolean => {
    const inDeg = new Int32Array(n);
    const removed = new Uint8Array(n);
    const clearList: number[] = [];
    for (let i = 0; i < n; i++) {
      inDeg[i] = blockers[i].length;
      if (inDeg[i] === 0) clearList.push(i);
    }
    const seq: string[] = [];

    for (let step = 0; step < n; step++) {
      if (clearList.length === 0) return false;
      if (clearList.length > maxClearObserved) maxClearObserved = clearList.length;
      if (clearList.length > maxClear) {
        excessSum += clearList.length - maxClear;
        for (let k = 0; k < clearList.length; k++) {
          bottleneckFlags[clearList[k]] = 1;
        }
      }

      let pickPos = 0;
      if (mode === 'last') {
        pickPos = clearList.length - 1;
      } else if (mode === 'adv') {
        let bestUnlock = -1;
        for (let k = 0; k < clearList.length; k++) {
          const cand = clearList[k];
          let unlocks = 0;
          for (const dep of dependents[cand]) {
            if (inDeg[dep] === 1) unlocks++;
          }
          if (unlocks > bestUnlock) {
            bestUnlock = unlocks;
            pickPos = k;
          }
        }
      } else if (mode === 'min') {
        let minUnlock = Infinity;
        for (let k = 0; k < clearList.length; k++) {
          const cand = clearList[k];
          let unlocks = 0;
          for (const dep of dependents[cand]) {
            if (inDeg[dep] === 1) unlocks++;
          }
          if (unlocks < minUnlock) {
            minUnlock = unlocks;
            pickPos = k;
          }
        }
      }

      const pick = clearList[pickPos];
      clearList.splice(pickPos, 1);
      removed[pick] = 1;
      seq.push(arrows[pick].id);

      for (const dep of dependents[pick]) {
        if (removed[dep] === 1) continue;
        inDeg[dep]--;
        if (inDeg[dep] === 0) {
          clearList.push(dep);
        }
      }
    }

    if (mode === 'min') {
      bestSequence = seq;
    } else if (bestSequence.length === 0) {
      bestSequence = seq;
    }
    return true;
  };

  if (!runSim('min') || !runSim('adv') || !runSim('first') || !runSim('last')) {
    return {
      solvable: false,
      sequence: [],
      maxClearObserved,
      excessSum: 9999,
      bottleneckIndices: [],
    };
  }

  const bottleneckIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (bottleneckFlags[i] === 1) bottleneckIndices.push(i);
  }

  return {
    solvable: true,
    sequence: bestSequence,
    maxClearObserved,
    excessSum,
    bottleneckIndices,
  };
}

/**
 * Returns the escape lane key for an arrow:
 * - UP / DOWN escape along their head's column (`dir:c:x`)
 * - LEFT / RIGHT escape along their head's row (`dir:r:y`)
 */
export function getEscapeLaneKey(head: Point, dir: Direction): string {
  return dir === 'UP' || dir === 'DOWN' ? `${dir}:c:${head.x}` : `${dir}:r:${head.y}`;
}

/**
 * Enforces that no more than `maxPerLane` (default 3) arrows in a puzzle share
 * the same escape lane (column+dir for vertical arrows, row+dir for horizontal arrows).
 */
export function checkEscapeLaneLimit(
  arrows: Arrow[],
  maxPerLane = 3
): { valid: boolean; maxObserved: number; excessSum: number } {
  const counts = new Map<string, number>();
  let maxObserved = 0;
  let excessSum = 0;

  for (const arrow of arrows) {
    const head = arrow.cells[arrow.cells.length - 1];
    const key = getEscapeLaneKey(head, arrow.dir);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    if (next > maxObserved) maxObserved = next;
    if (next > maxPerLane) excessSum += next - maxPerLane;
  }

  return { valid: maxObserved <= maxPerLane, maxObserved, excessSum };
}

/**
 * Measures spatial clustering of arrows pointing in the same escape direction.
 * Used both as a penalty during repair mutations and to audit cluster spread.
 */
export function analyzeDirectionClusters(arrows: Arrow[]): {
  maxNeighborsWithin4: number;
  clusterPenalty: number;
} {
  const n = arrows.length;
  const heads: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    heads[i] = arrows[i].cells[arrows[i].cells.length - 1];
  }

  let maxNeighborsWithin4 = 0;
  let clusterPenalty = 0;

  for (let i = 0; i < n; i++) {
    let nearCount = 0;
    const hi = heads[i];
    const di = arrows[i].dir;
    for (let j = i + 1; j < n; j++) {
      if (arrows[j].dir !== di) continue;
      const hj = heads[j];
      const dist = Math.hypot(hi.x - hj.x, hi.y - hj.y);
      if (dist <= 2.5) {
        clusterPenalty += 12;
        nearCount++;
      } else if (dist <= 4.0) {
        clusterPenalty += 5;
        nearCount++;
      } else if (dist <= 5.5) {
        clusterPenalty += 1.5;
      }
    }
    if (nearCount > maxNeighborsWithin4) maxNeighborsWithin4 = nearCount;
  }

  // Compute true per-arrow max neighbor count within radius 4.0 (symmetric check)
  maxNeighborsWithin4 = 0;
  for (let i = 0; i < n; i++) {
    let near = 0;
    const hi = heads[i];
    const di = arrows[i].dir;
    for (let j = 0; j < n; j++) {
      if (i === j || arrows[j].dir !== di) continue;
      const hj = heads[j];
      if (Math.hypot(hi.x - hj.x, hi.y - hj.y) <= 4.0) near++;
    }
    if (near > maxNeighborsWithin4) maxNeighborsWithin4 = near;
  }

  return { maxNeighborsWithin4, clusterPenalty };
}



