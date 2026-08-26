const MUTE_KEY = 'perec_audio_muted';

type AmbientHandle = {
  stop: () => void;
};

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class BuildingAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private muteGain: GainNode | null = null;
  private ambient: AmbientHandle | null = null;
  private muted = loadMuted();
  private unlocked = false;

  isMuted(): boolean {
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.duckGain = this.ctx.createGain();
      this.muteGain = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.duckGain.gain.value = 1;
      this.muteGain.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.duckGain);
      this.duckGain.connect(this.muteGain);
      this.muteGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.unlocked = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!this.ctx || !this.muteGain) return;
    const now = this.ctx.currentTime;
    this.muteGain.gain.cancelScheduledValues(now);
    this.muteGain.gain.setValueAtTime(this.muteGain.gain.value, now);
    this.muteGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.08);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  duck(amount: number, seconds = 0.25): void {
    if (!this.ctx || !this.duckGain) return;
    const now = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(this.duckGain.gain.value, now);
    this.duckGain.gain.linearRampToValueAtTime(Math.max(0.15, amount), now + seconds);
  }

  startAmbient(floor: number, moraleRatio: number): void {
    if (!this.ctx || !this.master || !this.unlocked) return;
    this.stopAmbient();
    const ctx = this.ctx;
    const out = this.master;
    const now = ctx.currentTime;

    const merger = ctx.createGain();
    merger.gain.value = 0;
    merger.connect(out);
    merger.gain.linearRampToValueAtTime(1, now + 1.2);

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = floor <= 0 ? 42 : floor >= 6 ? 68 : 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.045;
    drone.connect(droneGain);
    droneGain.connect(merger);
    drone.start();

    const fifth = ctx.createOscillator();
    fifth.type = 'sine';
    fifth.frequency.value = drone.frequency.value * (moraleRatio < 0.4 ? 1.414 : 1.498);
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = moraleRatio < 0.4 ? 0.028 : 0.018;
    fifth.connect(fifthGain);
    fifthGain.connect(merger);
    fifth.start();

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(2);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = floor <= 0 ? 280 : floor >= 6 ? 900 : 420;
    const hiss = ctx.createGain();
    hiss.gain.value = floor >= 6 ? 0.03 : 0.022;
    noise.connect(filter);
    filter.connect(hiss);
    hiss.connect(merger);
    noise.start();

    this.ambient = {
      stop: () => {
        const t = ctx.currentTime;
        merger.gain.cancelScheduledValues(t);
        merger.gain.setValueAtTime(merger.gain.value, t);
        merger.gain.linearRampToValueAtTime(0, t + 0.4);
        window.setTimeout(() => {
          try {
            drone.stop();
            fifth.stop();
            noise.stop();
            merger.disconnect();
          } catch {
            /* already stopped */
          }
        }, 450);
      },
    };
  }

  stopAmbient(): void {
    this.ambient?.stop();
    this.ambient = null;
  }

  ui(): void {
    this.blip(880, 0.05, 0.04, 'square');
  }

  typewriter(): void {
    this.noiseBurst(0.018, 0.05, 2400);
  }

  page(): void {
    this.noiseBurst(0.12, 0.07, 1800);
    this.blip(220, 0.08, 0.03, 'triangle');
  }

  walk(): void {
    this.thud(160, 0.07, 0.09);
    window.setTimeout(() => this.thud(140, 0.05, 0.07), 90);
  }

  knight(): void {
    this.thud(190, 0.08, 0.11);
    this.sweep(330, 620, 0.38, 0.08);
  }

  elevator(): void {
    this.sweep(90, 220, 0.55, 0.07);
    this.noiseBurst(0.25, 0.04, 600);
  }

  blocked(): void {
    this.thud(70, 0.12, 0.08);
  }

  diceRoll(): void {
    for (let i = 0; i < 9; i += 1) {
      window.setTimeout(() => this.noiseBurst(0.025, 0.06, 1600 - i * 90), i * 70);
    }
  }

  diceLand(): void {
    this.thud(210, 0.09, 0.12);
    window.setTimeout(() => this.thud(170, 0.07, 0.1), 70);
  }

  success(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      window.setTimeout(() => this.blip(freq, 0.55, 0.07, 'sine'), i * 70);
    });
  }

  fail(): void {
    this.sweep(180, 70, 0.45, 0.09);
    this.noiseBurst(0.35, 0.08, 400);
  }

  collect(): void {
    this.blip(660, 0.18, 0.06, 'triangle');
    window.setTimeout(() => this.blip(990, 0.28, 0.05, 'sine'), 80);
  }

  moraleDrain(): void {
    this.blip(196, 0.4, 0.08, 'sawtooth');
    this.blip(185, 0.4, 0.06, 'sine');
  }

  midnight(): void {
    this.thud(90, 0.2, 0.14);
    window.setTimeout(() => this.thud(90, 0.2, 0.14), 700);
  }

  weave(): void {
    this.sweep(110, 330, 0.9, 0.05);
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private noiseBurst(duration: number, gain: number, cutoff: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(Math.max(duration, 0.05));
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 1.1;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(now + duration + 0.02);
  }

  private thud(freq: number, duration: number, gain: number): void {
    this.blip(freq, duration, gain, 'triangle');
  }

  private blip(freq: number, duration: number, gain: number, type: OscillatorType): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const g = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

export const buildingAudio = new BuildingAudio();
