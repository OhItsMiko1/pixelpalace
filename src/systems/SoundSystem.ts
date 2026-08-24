import type { Phase } from './DayNightCycle';

const MUTE_KEY = 'pixelpalace-muted';
const MASTER_VOLUME = 0.35;

/**
 * All sound effects are synthesized on the fly with the Web Audio API — no
 * audio files, same "hand-authored, not lifted from anywhere" approach as
 * the procedural pixel art. Browsers block audio before a user gesture, so
 * `unlock()` must be called from inside a click/keydown handler.
 */
class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // localStorage unavailable (private browsing, etc.) — default unmuted.
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : MASTER_VOLUME;
    return this.muted;
  }

  private tone(freq: number, startOffset: number, duration: number, type: OscillatorType, peakGain: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  footstep(): void {
    this.tone(170 + Math.random() * 25, 0, 0.045, 'square', 0.04);
  }

  menuMove(): void {
    this.tone(520, 0, 0.04, 'square', 0.07);
  }

  menuSelect(): void {
    this.tone(660, 0, 0.05, 'square', 0.1);
    this.tone(990, 0.05, 0.08, 'square', 0.09);
  }

  interact(): void {
    this.tone(660, 0, 0.05, 'square', 0.1);
    this.tone(880, 0.05, 0.06, 'square', 0.08);
  }

  purchase(): void {
    this.tone(784, 0, 0.06, 'square', 0.11);
    this.tone(1046.5, 0.06, 0.1, 'square', 0.11);
  }

  error(): void {
    this.tone(220, 0, 0.09, 'sawtooth', 0.08);
    this.tone(160, 0.08, 0.13, 'sawtooth', 0.07);
  }

  questStep(): void {
    this.tone(523.25, 0, 0.07, 'triangle', 0.13);
    this.tone(659.25, 0.07, 0.09, 'triangle', 0.12);
  }

  questComplete(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => this.tone(freq, i * 0.09, 0.16, 'triangle', 0.14));
  }

  jobComplete(): void {
    this.tone(659.25, 0, 0.05, 'square', 0.09);
    this.tone(987.77, 0.05, 0.09, 'square', 0.11);
  }

  phaseChime(phase: Phase): void {
    if (phase === 'day') return;
    const pairs: Record<Exclude<Phase, 'day'>, [number, number]> = {
      dawn: [392, 523.25],
      dusk: [493.88, 392],
      night: [349.23, 261.63],
    };
    const [a, b] = pairs[phase];
    this.tone(a, 0, 0.2, 'sine', 0.07);
    this.tone(b, 0.16, 0.24, 'sine', 0.06);
  }
}

export const soundSystem = new SoundSystem();
