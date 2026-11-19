import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  HelpCircle,
  Home,
  Music,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameSettings } from '../engine/types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onResetProgress: () => void;
  onOpenHowToPlay: () => void;
  onReturnMainMenu: () => void;
  onBack: () => void;
  showReturnToMenu?: boolean;
}

export const SettingsScreen: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetProgress,
  onOpenHowToPlay,
  onReturnMainMenu,
  onBack,
  showReturnToMenu = true,
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const allMuted = !settings.musicEnabled && !settings.sfxEnabled;

  const toggleAllAudio = () => {
    if (allMuted) {
      onUpdateSettings({ musicEnabled: true, sfxEnabled: true });
    } else {
      onUpdateSettings({ musicEnabled: false, sfxEnabled: false });
    }
  };

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
          Settings
        </h1>
        <div className="w-[76px]" aria-hidden="true" />
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-3 sm:py-4 flex flex-col justify-center gap-3 min-h-0">
        {/* Audio Section */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">Audio</h2>
            <button
              onClick={toggleAllAudio}
              className="min-h-[36px] px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              {allMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span>Unmute All</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-sky-600" />
                  <span>Mute All</span>
                </>
              )}
            </button>
          </div>

          {/* Music toggle & volume */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Music className="w-4 h-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm text-slate-900">Relaxing Music</p>
                  <p className="text-xs text-slate-500">Gentle ambient chimes</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.musicEnabled}
                onClick={() => onUpdateSettings({ musicEnabled: !settings.musicEnabled })}
                className={`w-13 h-7 rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.musicEnabled ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                    settings.musicEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-3 pl-12">
              <span className="text-xs font-medium text-slate-500 w-12">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.musicVolume * 100)}
                disabled={!settings.musicEnabled}
                onChange={(e) =>
                  onUpdateSettings({ musicVolume: Number(e.target.value) / 100 })
                }
                aria-label="Music volume"
                className="flex-1 accent-sky-500 h-2 bg-slate-200 rounded-lg cursor-pointer disabled:opacity-40"
              />
              <span className="text-xs font-semibold tabular-nums text-slate-700 w-9 text-right">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* SFX toggle & volume */}
          <div className="space-y-2 pt-2.5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm text-slate-900">Sound Effects</p>
                  <p className="text-xs text-slate-500">Taps, escapes, and celebration</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.sfxEnabled}
                onClick={() => onUpdateSettings({ sfxEnabled: !settings.sfxEnabled })}
                className={`w-13 h-7 rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.sfxEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`block w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                    settings.sfxEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-3 pl-12">
              <span className="text-xs font-medium text-slate-500 w-12">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.sfxVolume * 100)}
                disabled={!settings.sfxEnabled}
                onChange={(e) =>
                  onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })
                }
                aria-label="Sound effects volume"
                className="flex-1 accent-emerald-500 h-2 bg-slate-200 rounded-lg cursor-pointer disabled:opacity-40"
              />
              <span className="text-xs font-semibold tabular-nums text-slate-700 w-9 text-right">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
          </div>
        </section>

        {/* Visuals / Animation Intensity */}
        <section className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                  Animation Intensity
                </h2>
                <p className="text-xs text-slate-500">
                  Confetti, shakes, and celebration (1–10)
                </p>
              </div>
            </div>
            <span className="font-display text-lg font-bold tabular-nums text-amber-600">
              {settings.animationIntensity}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">1 (Calm)</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.animationIntensity}
              onChange={(e) =>
                onUpdateSettings({ animationIntensity: Number(e.target.value) })
              }
              aria-label="Animation intensity"
              className="flex-1 accent-amber-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-500">10 (Lively)</span>
          </div>
        </section>

        {/* Actions */}
        <section className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/70 space-y-2">
          <button
            onClick={onOpenHowToPlay}
            className="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.99] text-slate-800 text-sm font-semibold flex items-center justify-between transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>How to Play</span>
            </span>
            <span className="text-slate-400 text-xs">Instructions</span>
          </button>

          {showReturnToMenu && (
            <button
              onClick={onReturnMainMenu}
              className="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-[0.99] text-slate-800 text-sm font-semibold flex items-center justify-between transition-all cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <Home className="w-4 h-4 text-indigo-600" />
                <span>Return to Main Menu</span>
              </span>
            </button>
          )}

          <button
            onClick={() => setConfirmingReset(true)}
            className="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100/80 active:scale-[0.99] text-rose-700 text-sm font-semibold flex items-center justify-between transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Reset Progress</span>
            </span>
            <span className="text-xs text-rose-500">Clear all saves</span>
          </button>
        </section>
      </main>

      {/* Reset Progress Confirmation Modal */}
      {confirmingReset && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3
                id="reset-dialog-title"
                className="font-display text-xl font-bold text-slate-900"
              >
                Reset All Progress?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Warning: All completed levels, daily puzzle progress, active puzzle saves, and hint timers across Easy, Medium, Hard, and Daily will be permanently erased. This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setConfirmingReset(false)}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetProgress();
                  setConfirmingReset(false);
                }}
                className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors cursor-pointer"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
