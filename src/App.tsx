import { useCallback, useEffect, useRef, useState } from 'react';
import { DifficultySelect } from './components/DifficultySelect';
import { HowToPlay } from './components/HowToPlay';
import { LevelSelect } from './components/LevelSelect';
import { MainMenu } from './components/MainMenu';
import { PuzzleBoard } from './components/PuzzleBoard';
import { SettingsScreen } from './components/SettingsModal';
import { VictoryOverlay } from './components/VictoryOverlay';
import {
  calculateDailyStreak,
  DailyCalendarInfo,
  getDailyCalendarInfo,
} from './engine/daily';
import { getDailyLevel, getLevel } from './engine/levelLoader';
import {
  ActivePuzzleSave,
  Difficulty,
  GameSettings,
  SaveState,
} from './engine/types';
import { audioController } from './services/audio';
import {
  clearActivePuzzleProgress,
  dailyPuzzleSaveKey,
  loadSaveState,
  puzzleSaveKey,
  resetAllSavedProgress,
  saveActivePuzzleProgress,
  saveCompletedDailyPuzzle,
  saveCompletedLevel,
  saveSettingsUpdate,
} from './services/storage';

type Screen =
  | 'MAIN_MENU'
  | 'DIFFICULTY_SELECT'
  | 'LEVEL_SELECT'
  | 'PLAY'
  | 'SETTINGS'
  | 'HOW_TO_PLAY';

export function App() {
  const [saveState, setSaveState] = useState<SaveState>(() => loadSaveState());
  const [dailyInfo, setDailyInfo] = useState<DailyCalendarInfo>(() =>
    getDailyCalendarInfo()
  );
  const [screen, setScreen] = useState<Screen>('MAIN_MENU');
  const [returnScreen, setReturnScreen] = useState<Screen>('MAIN_MENU');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(
    () => saveState.currentDifficulty
  );
  const [activeLevelId, setActiveLevelId] = useState<number>(
    () => saveState.currentLevel
  );
  const [isDailyMode, setIsDailyMode] = useState<boolean>(false);
  const [showVictory, setShowVictory] = useState<boolean>(false);
  const victoryTimerRef = useRef<number | null>(null);

  const clearVictoryTimer = useCallback(() => {
    if (victoryTimerRef.current !== null) {
      window.clearTimeout(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearVictoryTimer, [clearVictoryTimer]);

  // Keep daily date synchronized across midnight or returning to app
  useEffect(() => {
    const syncDailyDate = () => {
      const next = getDailyCalendarInfo();
      setDailyInfo((prev) => (prev.dateKey === next.dateKey ? prev : next));
    };

    const interval = window.setInterval(syncDailyDate, 60000);
    window.addEventListener('focus', syncDailyDate);
    document.addEventListener('visibilitychange', syncDailyDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncDailyDate);
      document.removeEventListener('visibilitychange', syncDailyDate);
    };
  }, []);

  // Sync audio settings
  useEffect(() => {
    audioController.updateSettings(saveState.settings);
  }, [saveState.settings]);

  // Unlock Web Audio on first user interaction
  useEffect(() => {
    const handleUnlock = () => {
      audioController.unlock();
    };
    window.addEventListener('pointerdown', handleUnlock, { once: true });
    return () => window.removeEventListener('pointerdown', handleUnlock);
  }, []);

  const handleOpenSettings = (from: Screen) => {
    setReturnScreen(from);
    setScreen('SETTINGS');
  };

  const handleOpenHowToPlay = (from: Screen) => {
    setReturnScreen(from);
    setScreen('HOW_TO_PLAY');
  };

  const handleSelectDifficulty = (difficulty: Difficulty) => {
    audioController.playSelect();
    setIsDailyMode(false);
    setSelectedDifficulty(difficulty);
    setScreen('LEVEL_SELECT');
  };

  const handleStartLevel = (difficulty: Difficulty, levelId: number) => {
    clearVictoryTimer();
    audioController.playSelect();
    setIsDailyMode(false);
    setSelectedDifficulty(difficulty);
    setActiveLevelId(levelId);
    setShowVictory(false);
    setScreen('PLAY');
  };

  const handleStartDaily = () => {
    const currentDaily = getDailyCalendarInfo();
    setDailyInfo(currentDaily);
    if ((saveState.completedDailyDates ?? []).includes(currentDaily.dateKey)) {
      return;
    }
    clearVictoryTimer();
    audioController.playSelect();
    setIsDailyMode(true);
    setSelectedDifficulty('medium');
    setActiveLevelId(currentDaily.slotId);
    setShowVictory(false);
    setScreen('PLAY');
  };

  const handleSaveProgress = useCallback((active: ActivePuzzleSave) => {
    setSaveState((prev) => saveActivePuzzleProgress(prev, active));
  }, []);

  const handleClearProgress = useCallback(
    (difficulty: Difficulty, levelId: number, dailyDateKey?: string) => {
      setSaveState((prev) =>
        clearActivePuzzleProgress(prev, difficulty, levelId, dailyDateKey)
      );
    },
    []
  );

  const handleCompletePuzzle = useCallback(() => {
    // Save completion immediately BEFORE displaying victory celebration
    clearVictoryTimer();
    if (isDailyMode) {
      const completedDateKey = dailyInfo.dateKey;
      setSaveState((prev) => saveCompletedDailyPuzzle(prev, completedDateKey));
    } else {
      setSaveState((prev) =>
        saveCompletedLevel(prev, selectedDifficulty, activeLevelId)
      );
    }
    victoryTimerRef.current = window.setTimeout(() => {
      victoryTimerRef.current = null;
      setShowVictory(true);
    }, 580);
  }, [activeLevelId, clearVictoryTimer, dailyInfo.dateKey, isDailyMode, selectedDifficulty]);

  const handleUpdateSettings = (patch: Partial<GameSettings>) => {
    setSaveState((prev) => saveSettingsUpdate(prev, patch));
  };

  const handleResetProgress = () => {
    setSaveState((prev) => resetAllSavedProgress(prev));
    setIsDailyMode(false);
    setSelectedDifficulty('easy');
    setActiveLevelId(1);
    setShowVictory(false);
  };

  if (screen === 'MAIN_MENU') {
    return (
      <MainMenu
        saveState={saveState}
        dailyInfo={dailyInfo}
        onPlay={() => {
          audioController.playSelect();
          setScreen('DIFFICULTY_SELECT');
        }}
        onContinue={(diff, lvl) => handleStartLevel(diff, lvl)}
        onContinueDaily={handleStartDaily}
        onOpenSettings={() => handleOpenSettings('MAIN_MENU')}
        onOpenHowToPlay={() => handleOpenHowToPlay('MAIN_MENU')}
      />
    );
  }

  if (screen === 'DIFFICULTY_SELECT') {
    return (
      <DifficultySelect
        saveState={saveState}
        dailyInfo={dailyInfo}
        onSelectDaily={handleStartDaily}
        onSelectDifficulty={handleSelectDifficulty}
        onBack={() => setScreen('MAIN_MENU')}
      />
    );
  }

  if (screen === 'LEVEL_SELECT') {
    return (
      <LevelSelect
        difficulty={selectedDifficulty}
        saveState={saveState}
        onSelectLevel={(lvl) => handleStartLevel(selectedDifficulty, lvl)}
        onBack={() => setScreen('DIFFICULTY_SELECT')}
      />
    );
  }

  if (screen === 'SETTINGS') {
    return (
      <SettingsScreen
        settings={saveState.settings}
        onUpdateSettings={handleUpdateSettings}
        onResetProgress={handleResetProgress}
        onOpenHowToPlay={() => handleOpenHowToPlay('SETTINGS')}
        onReturnMainMenu={() => setScreen('MAIN_MENU')}
        onBack={() => setScreen(returnScreen)}
        showReturnToMenu={returnScreen !== 'MAIN_MENU'}
      />
    );
  }

  if (screen === 'HOW_TO_PLAY') {
    return <HowToPlay onBack={() => setScreen(returnScreen)} />;
  }

  const puzzle = isDailyMode
    ? getDailyLevel(dailyInfo.slotId)
    : getLevel(selectedDifficulty, activeLevelId);

  if (!puzzle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-slate-700 font-medium">Could not load this puzzle.</p>
        <button
          onClick={() => setScreen(isDailyMode ? 'DIFFICULTY_SELECT' : 'LEVEL_SELECT')}
          className="px-5 py-2.5 rounded-xl bg-sky-500 text-white font-semibold cursor-pointer"
        >
          {isDailyMode ? 'Back to Difficulty' : 'Back to Levels'}
        </button>
      </div>
    );
  }

  const initialSave = isDailyMode
    ? saveState.activePuzzles[dailyPuzzleSaveKey(dailyInfo.dateKey)]
    : saveState.activePuzzles[puzzleSaveKey(selectedDifficulty, activeLevelId)];

  const exitPlayScreen = () => {
    clearVictoryTimer();
    setShowVictory(false);
    setScreen(isDailyMode ? 'DIFFICULTY_SELECT' : 'LEVEL_SELECT');
  };

  const normalSolvedCount =
    saveState.completedLevels.easy.length +
    saveState.completedLevels.medium.length +
    saveState.completedLevels.hard.length;
  const currentDailyStreak = isDailyMode
    ? calculateDailyStreak(
        saveState.completedDailyDates,
        normalSolvedCount,
        dailyInfo.dateKey
      ).currentStreak
    : undefined;

  return (
    <>
      <PuzzleBoard
        key={
          isDailyMode
            ? `daily-${dailyInfo.dateKey}`
            : `${selectedDifficulty}-${activeLevelId}`
        }
        puzzle={puzzle}
        initialSave={initialSave}
        dailyDateKey={isDailyMode ? dailyInfo.dateKey : undefined}
        dailyDisplayDate={isDailyMode ? dailyInfo.displayDate : undefined}
        animationIntensity={saveState.settings.animationIntensity}
        onSaveProgress={handleSaveProgress}
        onClearProgress={handleClearProgress}
        onCompletePuzzle={handleCompletePuzzle}
        onOpenSettings={() => handleOpenSettings('PLAY')}
        onBack={exitPlayScreen}
      />

      {showVictory && (
        <VictoryOverlay
          difficulty={selectedDifficulty}
          levelId={activeLevelId}
          theme={puzzle.theme}
          dailyDisplayDate={isDailyMode ? dailyInfo.displayDate : undefined}
          dailyStreak={currentDailyStreak}
          animationIntensity={saveState.settings.animationIntensity}
          onContinue={exitPlayScreen}
          onNextLevel={
            !isDailyMode && activeLevelId < 100
              ? () => handleStartLevel(selectedDifficulty, activeLevelId + 1)
              : undefined
          }
        />
      )}
    </>
  );
}

export default App;

