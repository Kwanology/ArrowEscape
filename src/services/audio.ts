import { GameSettings } from '../engine/types';

// Gentle offline Web Audio API sound & relaxing pentatonic music engine
class AudioController {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private stepIdx = 0;
  private settings: GameSettings = {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.35,
    sfxVolume: 0.7,
    animationIntensity: 7,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && this.settings.musicEnabled && this.musicTimer === null) {
      this.startMusicLoop();
    }
  }

  public updateSettings(next: GameSettings): void {
    this.settings = next;
    if (next.musicEnabled && next.musicVolume > 0) {
      if (this.ctx && this.musicTimer === null) {
        this.startMusicLoop();
      }
    } else {
      this.stopMusicLoop();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || volume <= 0.001) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, endFreq),
        now + duration
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.14 * this.settings.sfxVolume;
    this.playTone(523.25, 0.09, 'sine', vol, 0, 620);
  }

  public playEscape(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.18 * this.settings.sfxVolume;
    // Cheerful ascending slide + gentle sparkle chime
    this.playTone(440, 0.22, 'triangle', vol, 0, 880);
    this.playTone(659.25, 0.2, 'sine', vol * 0.7, 0.06, 987.77);
  }

  public playBlocked(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.16 * this.settings.sfxVolume;
    // Gentle soft wooden bump (never harsh!)
    this.playTone(190, 0.11, 'sine', vol, 0, 130);
    this.playTone(145, 0.12, 'triangle', vol * 0.8, 0.08, 110);
  }

  public playHint(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.16 * this.settings.sfxVolume;
    this.playTone(587.33, 0.18, 'sine', vol, 0);
    this.playTone(880, 0.28, 'sine', vol * 0.85, 0.09);
  }

  public playVictory(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.2 * this.settings.sfxVolume;
    // C major pentatonic joyful arpeggio: C5 E5 G5 A5 C6
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.35, 'triangle', vol, i * 0.09);
      this.playTone(freq * 2, 0.25, 'sine', vol * 0.3, i * 0.09 + 0.02);
    });
  }

  public playGameOver(): void {
    if (!this.settings.sfxEnabled) return;
    const vol = 0.16 * this.settings.sfxVolume;
    const notes = [392.0, 329.63, 261.63];
    notes.forEach((freq, i) => {
      this.playTone(freq, 0.26, 'sine', vol, i * 0.12);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    // Gentle C-major pentatonic ambient wind-chime melody
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const pattern = [0, 2, 4, 5, 4, 3, 2, 1, 0, 4, 3, 5, 7, 5, 4, 2];

    this.musicTimer = window.setInterval(() => {
      if (!this.settings.musicEnabled || this.settings.musicVolume <= 0.01) return;
      if (!this.ctx || this.ctx.state !== 'running') return;
      const note = scale[pattern[this.stepIdx % pattern.length]];
      const vol = 0.055 * this.settings.musicVolume;
      this.playTone(note, 0.9, 'sine', vol);
      if (this.stepIdx % 4 === 0) {
        this.playTone(note * 0.5, 1.4, 'triangle', vol * 0.65);
      }
      this.stepIdx++;
    }, 680);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audioController = new AudioController();
