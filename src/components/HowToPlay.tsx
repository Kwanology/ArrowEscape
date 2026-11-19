import React from 'react';
import { ArrowLeft, Lightbulb, Sparkles } from 'lucide-react';

interface HowToPlayProps {
  onBack: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onBack }) => {
  return (
    <div className="h-dvh overflow-hidden bg-sky-50/70 text-slate-900 flex flex-col">
      <header className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl flex items-center gap-2 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all font-medium cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="whitespace-nowrap">Back</span>
        </button>
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
          How to Play
        </h1>
        <div className="w-[76px]" aria-hidden="true" />
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-3 sm:py-5 flex flex-col justify-center gap-3 sm:gap-4 min-h-0">
        <section className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 space-y-3">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
              Clear Every Arrow at Your Own Pace
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Each puzzle is a woven mosaic of interlocking arrows pointing up, down, left, or right. Release every arrow off the board in the right order.
            </p>
          </div>

          {/* Visual example diagram */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 140 90" className="w-28 h-18 sm:w-32 sm:h-20" aria-hidden="true">
                <rect x="6" y="6" width="128" height="78" rx="12" fill="#FFFFFF" stroke="#A7F3D0" strokeWidth="2" />
                <path d="M 28 62 L 62 62 L 62 72" fill="none" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="62,78 57,68 62,71 67,68" fill="#94A3B8" />
                <path
                  d="M 26 44 L 26 30 L 72 30"
                  fill="none"
                  stroke="#111827"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polygon points="84,30 70,23 73,30 70,37" fill="#111827" />
                <line x1="88" y1="30" x2="128" y2="30" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              <div>
                <p className="font-display font-bold text-sm text-emerald-900">Clear Path</p>
                <p className="text-xs text-emerald-800/80 mt-0.5 leading-snug">
                  Nothing sits in front. Tap to slither off the screen!
                </p>
              </div>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3 flex flex-col items-center text-center gap-2">
              <svg viewBox="0 0 140 90" className="w-28 h-18 sm:w-32 sm:h-20" aria-hidden="true">
                <rect x="6" y="6" width="128" height="78" rx="12" fill="#FFFFFF" stroke="#FECDD3" strokeWidth="2" />
                <path d="M 24 58 L 24 44 L 60 44" fill="none" stroke="#EF4444" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="71,44 58,37 61,44 58,51" fill="#EF4444" />
                <path d="M 96 68 L 96 28" fill="none" stroke="#111827" strokeWidth="4.2" strokeLinecap="round" />
                <polygon points="96,17 89,30 96,27 103,30" fill="#111827" />
              </svg>
              <div>
                <p className="font-display font-bold text-sm text-rose-900">Blocked Path</p>
                <p className="text-xs text-rose-800/80 mt-0.5 leading-snug">
                  Another arrow is in the way. Costs 1 life if tapped!
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 space-y-2.5">
          <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
            Helpful Tips
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                ♥
              </span>
              <span>
                <strong>Watch your lives:</strong> You start with <strong>3</strong> hearts on Easy, <strong>4</strong> on Medium, and <strong>5</strong> on Hard. Lose all lives and you must try again.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                <strong>Start from the edges:</strong> Outer arrows often have open paths first and unlock deeper arrows inside.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="w-3.5 h-3.5" />
              </span>
              <span>
                <strong>Need a nudge?</strong> The <strong>Hint</strong> button lights up after 60 seconds and highlights a ready arrow.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span>
                <strong>Auto-saved locally:</strong> Every move saves automatically so you can continue anytime.
              </span>
            </li>
          </ul>
        </section>

        <div className="flex justify-center shrink-0">
          <button
            onClick={onBack}
            className="w-full sm:w-auto min-w-[200px] min-h-[46px] px-8 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white font-display font-bold text-base shadow-sm transition-all cursor-pointer"
          >
            Got It
          </button>
        </div>
      </main>
    </div>
  );
};
