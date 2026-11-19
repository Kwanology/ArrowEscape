import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart, Lightbulb, RotateCcw, Settings, ZoomIn, ZoomOut } from 'lucide-react';
import { getClearArrows, isArrowClear } from '../engine/collision';
import {
  ActivePuzzleSave,
  Arrow,
  Difficulty,
  Direction,
  getMaxLivesForDifficulty,
  Point,
  PuzzleLevel,
} from '../engine/types';
import { audioController } from '../services/audio';
import { GameOverOverlay } from './GameOverOverlay';

interface PuzzleBoardProps {
  puzzle: PuzzleLevel;
  initialSave?: ActivePuzzleSave;
  dailyDateKey?: string;
  dailyDisplayDate?: string;
  animationIntensity: number; // 1..10
  onSaveProgress: (save: ActivePuzzleSave) => void;
  onClearProgress: (difficulty: Difficulty, levelId: number, dailyDateKey?: string) => void;
  onCompletePuzzle: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

const CELL = 36; // Logical SVG units per grid cell
const STROKE_W = CELL * 0.17; // Sleek thin black ink line
const HINT_COOLDOWN_SECONDS = 60;

const INK_BLACK = '#111827';
const BLOCKED_RED = '#EF4444';
const HINT_GOLD = '#FACC15';

interface EscapingArrowState {
  arrow: Arrow;
  track: Point[];
  bodyLength: number;
  startTime: number;
  durationMs: number;
  progressDist: number;
  opacity: number;
}

interface SparkleBurst {
  id: string;
  x: number;
  y: number;
}

function dirToVec(dir: Direction): Point {
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

function buildPolylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

function slicePolylineByArcLength(
  track: Point[],
  startDist: number,
  endDist: number
): Point[] {
  const result: Point[] = [];
  let accum = 0;

  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen <= 0.0001) continue;
    const segStart = accum;
    const segEnd = accum + segLen;
    accum = segEnd;

    if (segEnd < startDist || segStart > endDist) {
      continue;
    }

    const t0 = Math.max(0, (startDist - segStart) / segLen);
    const t1 = Math.min(1, (endDist - segStart) / segLen);

    const p0 = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
    const p1 = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };

    if (result.length === 0) {
      result.push(p0);
    } else {
      const last = result[result.length - 1];
      if (Math.hypot(last.x - p0.x, last.y - p0.y) > 0.01) {
        result.push(p0);
      }
    }
    if (
      Math.hypot(
        p1.x - result[result.length - 1].x,
        p1.y - result[result.length - 1].y
      ) > 0.01
    ) {
      result.push(p1);
    }
  }

  return result;
}

function pointsToSvgPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * Sleek, sharp pointy dart arrowhead aligned to cell direction.
 */
function buildPointyArrowhead(tip: Point, dir: Direction, scale = 1): string {
  const v = dirToVec(dir);
  const px = -v.y;
  const py = v.x;
  const frontLen = CELL * 0.42 * scale;
  const wingBack = CELL * 0.16 * scale;
  const wingWidth = CELL * 0.23 * scale;
  const notchBack = CELL * 0.04 * scale;

  const front = { x: tip.x + v.x * frontLen, y: tip.y + v.y * frontLen };
  const wingL = {
    x: tip.x - v.x * wingBack + px * wingWidth,
    y: tip.y - v.y * wingBack + py * wingWidth,
  };
  const notch = { x: tip.x - v.x * notchBack, y: tip.y - v.y * notchBack };
  const wingR = {
    x: tip.x - v.x * wingBack - px * wingWidth,
    y: tip.y - v.y * wingBack - py * wingWidth,
  };

  return `${front.x.toFixed(1)},${front.y.toFixed(1)} ${wingL.x.toFixed(1)},${wingL.y.toFixed(1)} ${notch.x.toFixed(1)},${notch.y.toFixed(1)} ${wingR.x.toFixed(1)},${wingR.y.toFixed(1)}`;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  puzzle,
  initialSave,
  dailyDateKey,
  dailyDisplayDate,
  animationIntensity,
  onSaveProgress,
  onClearProgress,
  onCompletePuzzle,
  onOpenSettings,
  onBack,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const maxLives = getMaxLivesForDifficulty(puzzle.difficulty);

  const getInitialLives = useCallback(
    (save?: ActivePuzzleSave) => {
      if (save?.livesRemaining !== undefined && save.livesRemaining > 0) {
        return Math.min(maxLives, save.livesRemaining);
      }
      return maxLives;
    },
    [maxLives]
  );

  const [removedIds, setRemovedIds] = useState<string[]>(() =>
    initialSave && (initialSave.livesRemaining ?? maxLives) > 0
      ? initialSave.removedArrowIds
      : []
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    initialSave && (initialSave.livesRemaining ?? maxLives) > 0
      ? initialSave.elapsedSeconds
      : 0
  );
  const [hintCooldown, setHintCooldown] = useState<number>(() =>
    initialSave && (initialSave.livesRemaining ?? maxLives) > 0
      ? initialSave.hintCooldownRemaining
      : HINT_COOLDOWN_SECONDS
  );
  const [livesRemaining, setLivesRemaining] = useState<number>(() =>
    getInitialLives(initialSave)
  );

  const [blockedArrowId, setBlockedArrowId] = useState<string | null>(null);
  const [hintArrowId, setHintArrowId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [sparkles, setSparkles] = useState<SparkleBurst[]>([]);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [lostLifePulse, setLostLifePulse] = useState<boolean>(false);

  const escapingRef = useRef<EscapingArrowState[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const [, setAnimTick] = useState<number>(0);

  const elapsedRef = useRef(elapsedSeconds);
  const hintCooldownRef = useRef(hintCooldown);
  const removedRef = useRef(removedIds);
  const livesRef = useRef(livesRemaining);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    hintCooldownRef.current = hintCooldown;
  }, [hintCooldown]);

  useEffect(() => {
    removedRef.current = removedIds;
  }, [removedIds]);

  useEffect(() => {
    livesRef.current = livesRemaining;
  }, [livesRemaining]);

  useEffect(() => {
    const startLives = getInitialLives(initialSave);
    const hasActiveBoard =
      initialSave && (initialSave.livesRemaining ?? maxLives) > 0;
    isFinishedRef.current = false;
    setIsFinishing(false);
    setIsGameOver(false);
    setLostLifePulse(false);
    setBlockedArrowId(null);
    setHintArrowId(null);
    setSparkles([]);
    setZoom(1);
    escapingRef.current = [];
    const startRemoved = hasActiveBoard ? initialSave.removedArrowIds : [];
    const startElapsed = hasActiveBoard ? initialSave.elapsedSeconds : 0;
    const startHint = hasActiveBoard
      ? initialSave.hintCooldownRemaining
      : HINT_COOLDOWN_SECONDS;
    setRemovedIds(startRemoved);
    removedRef.current = startRemoved;
    setElapsedSeconds(startElapsed);
    elapsedRef.current = startElapsed;
    setHintCooldown(startHint);
    hintCooldownRef.current = startHint;
    setLivesRemaining(startLives);
    livesRef.current = startLives;
  }, [puzzle.difficulty, puzzle.id, dailyDateKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isFinishedRef.current) return;
      setElapsedSeconds((prev) => prev + 1);
      setHintCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [puzzle.difficulty, puzzle.id, dailyDateKey]);

  const persistCurrentState = useCallback(
    (
      nextRemoved: string[],
      nextHintCooldown: number,
      nextLives = livesRef.current
    ) => {
      if (isFinishedRef.current || nextLives <= 0) return;
      const removedSet = new Set(nextRemoved);
      const remainingIds = puzzle.arrows
        .filter((a) => !removedSet.has(a.id))
        .map((a) => a.id);

      onSaveProgress({
        difficulty: puzzle.difficulty,
        levelId: puzzle.id,
        isDaily: Boolean(dailyDateKey),
        dailyDateKey,
        removedArrowIds: nextRemoved,
        remainingArrowIds: remainingIds,
        elapsedSeconds: elapsedRef.current,
        hintCooldownRemaining: nextHintCooldown,
        livesRemaining: nextLives,
        updatedAt: Date.now(),
      });
    },
    [dailyDateKey, onSaveProgress, puzzle]
  );

  useEffect(() => {
    persistCurrentState(
      removedRef.current,
      hintCooldownRef.current,
      livesRef.current
    );
    const checkpoint = window.setInterval(() => {
      persistCurrentState(
        removedRef.current,
        hintCooldownRef.current,
        livesRef.current
      );
    }, 5000);
    return () => {
      window.clearInterval(checkpoint);
      persistCurrentState(
        removedRef.current,
        hintCooldownRef.current,
        livesRef.current
      );
    };
  }, [persistCurrentState]);

  const removedSet = useMemo(() => new Set(removedIds), [removedIds]);
  const remainingArrows = useMemo(
    () => puzzle.arrows.filter((a) => !removedSet.has(a.id)),
    [puzzle.arrows, removedSet]
  );

  const ensureEscapeLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    const step = (now: number) => {
      const active = escapingRef.current;
      if (active.length === 0) {
        rafIdRef.current = null;
        return;
      }

      const boardSpan = Math.max(puzzle.cols, puzzle.rows) * CELL;
      const nextActive: EscapingArrowState[] = [];

      for (const item of active) {
        const elapsed = now - item.startTime;
        const rawT = Math.min(1, elapsed / item.durationMs);
        const eased =
          rawT < 0.35
            ? 1.8 * rawT * rawT
            : 0.22 + 0.78 * Math.pow((rawT - 0.35) / 0.65, 1.15);
        const totalDist = item.bodyLength + boardSpan + CELL * 4;
        item.progressDist = eased * totalDist;
        item.opacity = rawT > 0.78 ? Math.max(0, 1 - (rawT - 0.78) / 0.22) : 1;

        if (rawT < 1) {
          nextActive.push(item);
        }
      }

      escapingRef.current = nextActive;
      setAnimTick((t) => (t + 1) % 100000);

      if (nextActive.length > 0) {
        rafIdRef.current = window.requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = window.requestAnimationFrame(step);
  }, [puzzle.cols, puzzle.rows]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const triggerArrowTap = useCallback(
    (arrow: Arrow) => {
      if (isFinishedRef.current) return;
      audioController.unlock();

      const clear = isArrowClear(arrow, remainingArrows, puzzle.cols, puzzle.rows);
      if (!clear) {
        if (livesRef.current <= 0) return;
        const nextLives = Math.max(0, livesRef.current - 1);
        livesRef.current = nextLives;
        setLivesRemaining(nextLives);
        setLostLifePulse(true);
        window.setTimeout(() => setLostLifePulse(false), 420);

        audioController.playBlocked();
        setBlockedArrowId(arrow.id);
        window.setTimeout(() => {
          setBlockedArrowId((curr) => (curr === arrow.id ? null : curr));
        }, 420);

        if (nextLives === 0) {
          isFinishedRef.current = true;
          setIsGameOver(true);
          onClearProgress(puzzle.difficulty, puzzle.id, dailyDateKey);
          window.setTimeout(() => {
            audioController.playGameOver();
          }, 220);
        } else {
          persistCurrentState(
            removedRef.current,
            hintCooldownRef.current,
            nextLives
          );
        }
        return;
      }

      audioController.playEscape();
      if (hintArrowId === arrow.id) {
        setHintArrowId(null);
      }

      const nextRemoved = [...removedIds, arrow.id];
      setRemovedIds(nextRemoved);
      removedRef.current = nextRemoved;

      const isLastArrow = nextRemoved.length >= puzzle.arrows.length;

      const bodyPts: Point[] = arrow.cells.map((c) => ({
        x: (c.x + 0.5) * CELL,
        y: (c.y + 0.5) * CELL,
      }));
      const headPt = bodyPts[bodyPts.length - 1];
      const vec = dirToVec(arrow.dir);
      const exitLen = (Math.max(puzzle.cols, puzzle.rows) + 10) * CELL;
      const track: Point[] = [
        ...bodyPts,
        { x: headPt.x + vec.x * exitLen, y: headPt.y + vec.y * exitLen },
      ];
      const bodyLength = buildPolylineLength(bodyPts);

      const baseMs = Math.max(480, 520 + (bodyLength / CELL) * 24);
      const speedFactor = 1.15 - (animationIntensity - 1) * 0.03;

      escapingRef.current = [
        ...escapingRef.current,
        {
          arrow,
          track,
          bodyLength,
          startTime: performance.now(),
          durationMs: baseMs * speedFactor,
          progressDist: 0,
          opacity: 1,
        },
      ];
      ensureEscapeLoop();

      if (animationIntensity >= 2) {
        const sparkX =
          arrow.dir === 'LEFT'
            ? 8
            : arrow.dir === 'RIGHT'
            ? puzzle.cols * CELL - 8
            : headPt.x;
        const sparkY =
          arrow.dir === 'UP'
            ? 8
            : arrow.dir === 'DOWN'
            ? puzzle.rows * CELL - 8
            : headPt.y;
        const sparkId = `${arrow.id}-${Date.now()}`;
        setSparkles((prev) => [...prev, { id: sparkId, x: sparkX, y: sparkY }]);
        window.setTimeout(() => {
          setSparkles((prev) => prev.filter((s) => s.id !== sparkId));
        }, 500);
      }

      if (isLastArrow) {
        isFinishedRef.current = true;
        setIsFinishing(true);
        onCompletePuzzle();
        window.setTimeout(() => {
          audioController.playVictory();
        }, 420);
      } else {
        persistCurrentState(nextRemoved, hintCooldownRef.current);
      }
    },
    [
      animationIntensity,
      dailyDateKey,
      ensureEscapeLoop,
      hintArrowId,
      onClearProgress,
      onCompletePuzzle,
      persistCurrentState,
      puzzle.arrows.length,
      puzzle.cols,
      puzzle.difficulty,
      puzzle.id,
      puzzle.rows,
      remainingArrows,
      removedIds,
    ]
  );

  const handleBoardPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isFinishedRef.current || !svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const vbWidth = puzzle.cols * CELL;
    const vbHeight = puzzle.rows * CELL;
    const px = ((e.clientX - rect.left) / rect.width) * vbWidth;
    const py = ((e.clientY - rect.top) / rect.height) * vbHeight;

    const gx = Math.floor(px / CELL);
    const gy = Math.floor(py / CELL);

    // 1. Exact cell hit check first
    for (const arrow of remainingArrows) {
      if (arrow.cells.some((c) => c.x === gx && c.y === gy)) {
        triggerArrowTap(arrow);
        return;
      }
    }

    // 2. Segment-distance fallback for finger taps
    let bestArrow: Arrow | null = null;
    let bestDist = CELL * 0.55;
    const tapPt = { x: px, y: py };

    for (const arrow of remainingArrows) {
      for (let i = 0; i < arrow.cells.length; i++) {
        const a = {
          x: (arrow.cells[i].x + 0.5) * CELL,
          y: (arrow.cells[i].y + 0.5) * CELL,
        };
        if (i === 0) {
          const d = Math.hypot(tapPt.x - a.x, tapPt.y - a.y);
          if (d < bestDist) {
            bestDist = d;
            bestArrow = arrow;
          }
        } else {
          const prev = {
            x: (arrow.cells[i - 1].x + 0.5) * CELL,
            y: (arrow.cells[i - 1].y + 0.5) * CELL,
          };
          const d = distToSegment(tapPt, prev, a);
          if (d < bestDist) {
            bestDist = d;
            bestArrow = arrow;
          }
        }
      }
    }

    if (bestArrow) {
      triggerArrowTap(bestArrow);
    }
  };

  const handleUseHint = () => {
    if (hintCooldown > 0 || isFinishedRef.current) return;
    audioController.unlock();

    const remainingMap = new Map(remainingArrows.map((a) => [a.id, a]));
    let chosen: Arrow | undefined;

    for (const solId of puzzle.solutionSequence) {
      const candidate = remainingMap.get(solId);
      if (
        candidate &&
        isArrowClear(candidate, remainingArrows, puzzle.cols, puzzle.rows)
      ) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) {
      const clearList = getClearArrows(remainingArrows, puzzle.cols, puzzle.rows);
      chosen = clearList[0];
    }

    if (chosen) {
      audioController.playHint();
      setHintArrowId(chosen.id);
      setHintCooldown(HINT_COOLDOWN_SECONDS);
      hintCooldownRef.current = HINT_COOLDOWN_SECONDS;
      persistCurrentState(removedRef.current, HINT_COOLDOWN_SECONDS);
    }
  };

  const handleBack = () => {
    persistCurrentState(
      removedRef.current,
      hintCooldownRef.current,
      livesRef.current
    );
    onBack();
  };

  const handleRetry = useCallback(() => {
    audioController.unlock();
    audioController.playSelect();
    isFinishedRef.current = false;
    setIsGameOver(false);
    setIsFinishing(false);
    setLostLifePulse(false);
    setBlockedArrowId(null);
    setHintArrowId(null);
    setSparkles([]);
    escapingRef.current = [];
    setRemovedIds([]);
    removedRef.current = [];
    setElapsedSeconds(0);
    elapsedRef.current = 0;
    setHintCooldown(HINT_COOLDOWN_SECONDS);
    hintCooldownRef.current = HINT_COOLDOWN_SECONDS;
    setLivesRemaining(maxLives);
    livesRef.current = maxLives;
    persistCurrentState([], HINT_COOLDOWN_SECONDS, maxLives);
  }, [maxLives, persistCurrentState]);

  const boardW = puzzle.cols * CELL;
  const boardH = puzzle.rows * CELL;
  const difficultyLabel =
    puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1);
  const animScale = Math.max(0.25, animationIntensity / 7);

  return (
    <div
      className="h-dvh w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none"
      style={{ ['--anim-scale' as string]: animScale }}
    >
      {/* Compact Top Bar */}
      <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 z-20">
        <button
          onClick={handleBack}
          className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-xl flex items-center gap-1.5 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all font-medium cursor-pointer shrink-0"
          aria-label={dailyDisplayDate ? 'Back to difficulty selection' : 'Back to level selection'}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline whitespace-nowrap">
            {dailyDisplayDate ? 'Modes' : 'Levels'}
          </span>
        </button>

        <div className="text-center min-w-0 flex-1">
          <div className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
            {dailyDisplayDate
              ? `Daily · ${dailyDisplayDate}`
              : `${difficultyLabel} · Level ${puzzle.id}`}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 truncate">
            <span>{puzzle.theme}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-slate-700">
              {remainingArrows.length} left
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUseHint}
            disabled={hintCooldown > 0 || isFinishing || remainingArrows.length === 0}
            className={`min-h-[44px] min-w-[82px] sm:min-w-[98px] px-2.5 sm:px-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all ${
              hintCooldown === 0 && !isFinishing
                ? 'bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 shadow-sm shadow-amber-400/30 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            aria-label={
              hintCooldown > 0
                ? `Hint available in ${hintCooldown} seconds`
                : 'Show hint'
            }
          >
            <Lightbulb
              className={`w-4 h-4 ${
                hintCooldown === 0 ? 'fill-amber-950/20 text-slate-950' : ''
              }`}
            />
            <span className="tabular-nums whitespace-nowrap">
              {hintCooldown > 0 ? formatTime(hintCooldown) : 'Hint'}
            </span>
          </button>

          <button
            onClick={() => {
              persistCurrentState(
                removedRef.current,
                hintCooldownRef.current,
                livesRef.current
              );
              onOpenSettings();
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Compact Hearts / Lives Strip */}
      <div
        className="shrink-0 bg-slate-50/95 border-b border-slate-200/60 px-4 py-1.5 flex items-center justify-center gap-3 z-10"
        aria-live="polite"
        aria-label={`Lives remaining: ${livesRemaining} of ${maxLives}`}
      >
        <div
          className={`flex items-center gap-1.5 transition-transform duration-200 ${
            lostLifePulse ? 'scale-105' : 'scale-100'
          }`}
        >
          {Array.from({ length: maxLives }, (_, idx) => {
            const active = idx < livesRemaining;
            return (
              <Heart
                key={idx}
                className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-all duration-200 ${
                  active
                    ? 'fill-rose-500 text-rose-500 drop-shadow-[0_1px_1px_rgba(244,63,94,0.25)]'
                    : 'fill-slate-200/70 text-slate-300 scale-90'
                }`}
                aria-hidden="true"
              />
            );
          })}
        </div>
        <span aria-hidden="true" className="text-slate-300 text-xs">
          ·
        </span>
        <span
          className={`text-xs font-semibold tabular-nums ${
            livesRemaining <= 1 ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          {livesRemaining}/{maxLives} {livesRemaining === 1 ? 'life' : 'lives'}
        </span>
      </div>

      {/* Main Board Viewport — no outer page scrollbar; pans smoothly if zoomed */}
      <main
        className={`flex-1 relative flex items-center justify-center p-2.5 sm:p-5 ${
          zoom > 1 ? 'overflow-auto' : 'overflow-hidden'
        }`}
      >
        <div
          className="relative flex items-center justify-center transition-transform duration-200"
          style={{
            width: zoom === 1 ? '100%' : `${Math.round(zoom * 100)}%`,
            height: zoom === 1 ? '100%' : `${Math.round(zoom * 100)}%`,
            maxWidth: zoom === 1 ? '760px' : undefined,
            maxHeight: zoom === 1 ? '100%' : undefined,
          }}
        >
          <div
            className="relative bg-white rounded-3xl shadow-sm border border-slate-200 p-2 sm:p-4 flex items-center justify-center overflow-visible"
            style={{
              aspectRatio: `${puzzle.cols} / ${puzzle.rows}`,
              width: '100%',
              maxHeight: '100%',
              maxWidth:
                zoom === 1
                  ? `min(100%, calc((100dvh - 156px) * ${puzzle.cols / puzzle.rows}))`
                  : undefined,
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${boardW} ${boardH}`}
              onPointerUp={handleBoardPointerUp}
              className="w-full h-full overflow-visible touch-manipulation cursor-pointer"
              role="img"
              aria-label={`Puzzle board ${puzzle.theme} with ${remainingArrows.length} arrows remaining`}
            >
              {/* Ultra-faint grid dots for crisp alignment */}
              <g opacity="0.22">
                {Array.from({ length: puzzle.rows }, (_, y) =>
                  Array.from({ length: puzzle.cols }, (_, x) => (
                    <circle
                      key={`${x}-${y}`}
                      cx={(x + 0.5) * CELL}
                      cy={(y + 0.5) * CELL}
                      r={1.1}
                      fill="#94A3B8"
                    />
                  ))
                )}
              </g>

              {/* Remaining Active Arrows — sleek thin black lines & pointy arrowheads */}
              {remainingArrows.map((arrow) => {
                const isBlocked = blockedArrowId === arrow.id;
                const isHinted = hintArrowId === arrow.id;
                const strokeColor = isBlocked ? BLOCKED_RED : INK_BLACK;

                const pts: Point[] = arrow.cells.map((c) => ({
                  x: (c.x + 0.5) * CELL,
                  y: (c.y + 0.5) * CELL,
                }));
                const pathD = pointsToSvgPath(pts);
                const head = pts[pts.length - 1];
                const headPoly = buildPointyArrowhead(head, arrow.dir, 1);

                return (
                  <g
                    key={arrow.id}
                    className={`${isBlocked ? 'animate-arrow-shake' : ''} ${
                      isHinted ? 'animate-hint-pulse' : ''
                    }`}
                  >
                    {/* Yellow Hint Aura */}
                    {isHinted && (
                      <>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={HINT_GOLD}
                          strokeWidth={STROKE_W + 10}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.8"
                        />
                        <polygon
                          points={buildPointyArrowhead(head, arrow.dir, 1.35)}
                          fill={HINT_GOLD}
                          opacity="0.8"
                        />
                      </>
                    )}

                    {/* Thin crisp black line (or red if blocked) */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={STROKE_W}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Sharp pointy arrowhead */}
                    <polygon points={headPoly} fill={strokeColor} />
                  </g>
                );
              })}

              {/* Escaping Snake-Animation Arrows */}
              {escapingRef.current.map((esc) => {
                const subPts = slicePolylineByArcLength(
                  esc.track,
                  esc.progressDist,
                  esc.progressDist + esc.bodyLength
                );
                if (subPts.length < 2) return null;
                const pathD = pointsToSvgPath(subPts);
                const head = subPts[subPts.length - 1];
                const headPoly = buildPointyArrowhead(head, esc.arrow.dir, 1);

                return (
                  <g key={`esc-${esc.arrow.id}`} opacity={esc.opacity}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={INK_BLACK}
                      strokeWidth={STROKE_W}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polygon points={headPoly} fill={INK_BLACK} />
                  </g>
                );
              })}

              {/* Subtle Exit Sparkles */}
              {sparkles.map((sp) => (
                <g key={sp.id} transform={`translate(${sp.x}, ${sp.y})`}>
                  <circle cx="-10" cy="-7" r="3.5" fill="#FBBF24" opacity="0.85" />
                  <circle cx="10" cy="7" r="3" fill="#38BDF8" opacity="0.85" />
                  <circle cx="7" cy="-10" r="2.8" fill="#34D399" opacity="0.85" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Compact Zoom Controls for Dense 2x Grids */}
        <div className="fixed bottom-3 right-3 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-1 shadow-sm">
          <button
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
            disabled={zoom <= 1}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {zoom > 1 && (
            <button
              onClick={() => setZoom(1)}
              className="min-h-[40px] px-2 rounded-xl text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{Math.round(zoom * 100)}%</span>
            </button>
          )}
          <button
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
            disabled={zoom >= 3}
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </main>

      {isGameOver && (
        <GameOverOverlay
          difficulty={puzzle.difficulty}
          levelId={puzzle.id}
          theme={puzzle.theme}
          dailyDisplayDate={dailyDisplayDate}
          maxLives={maxLives}
          onRetry={handleRetry}
          onBackToMenu={onBack}
        />
      )}
    </div>
  );
};
