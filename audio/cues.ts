export type Cue =
  | 'paper.peel'
  | 'paper.land'
  | 'paper.fan'
  | 'paper.flip'
  | 'book.open'
  | 'book.close'
  | 'map.open'
  | 'map.close'
  | 'cloth.lift'
  | 'pencil.tick'
  | 'lock.rattle'
  | 'drop.nothing'
  | 'dice.grab'
  | 'dice.shake'
  | 'dice.throw'
  | 'knight.land'
  | 'step.wood'
  | 'lift.gate'
  | 'lift.cable'
  | 'hour.bell'
  | 'bed.clock'
  | 'bed.boiler'
  | 'bed.rain'
  | 'music.chapter'
  | 'music.solved'
  | 'music.clinamen';

export interface AudioSettings {
  muted: boolean;
  master: number;
  ambience: number;
  music: number;
}

export interface CueLayer {
  path: string;
  gainDb: number;
  offsetMs?: number;
}

export interface CueDefinition {
  bus: 'sfx' | 'ambience' | 'music';
  variants: readonly (readonly CueLayer[])[];
  loop?: boolean;
  fadeOutMs?: number;
  maxConcurrent?: number;
}

const layer = (file: string, gainDb: number, offsetMs = 0): CueLayer => ({
  path: `/audio/${file}`,
  gainDb,
  ...(offsetMs ? { offsetMs } : {}),
});

const one = (
  file: string,
  gainDb: number,
  bus: CueDefinition['bus'] = 'sfx',
  options: Omit<CueDefinition, 'bus' | 'variants'> = {}
): CueDefinition => ({
  bus,
  variants: [[layer(file, gainDb)]],
  ...options,
});

export const CUE_MANIFEST: Record<Cue, CueDefinition> = {
  'paper.peel': {
    bus: 'sfx',
    variants: [
      [layer('paper-peel-1.ogg', -6)],
      [layer('paper-peel-3.ogg', -6)],
      [layer('paper-peel-5.ogg', -6)],
    ],
    maxConcurrent: 2,
  },
  'paper.land': {
    bus: 'sfx',
    variants: [
      [layer('paper-land-1.ogg', -6)],
      [layer('paper-land-2.ogg', -6)],
      [layer('paper-land-4.ogg', -6)],
    ],
    maxConcurrent: 2,
  },
  'paper.fan': {
    bus: 'sfx',
    variants: [[layer('paper-fan-1.ogg', -8)], [layer('paper-fan-2.ogg', -8)]],
    maxConcurrent: 1,
  },
  'paper.flip': {
    bus: 'sfx',
    variants: [
      [layer('paper-flip-1.ogg', -4)],
      [layer('paper-flip-2.ogg', -4)],
      [layer('paper-flip-4.ogg', -4)],
      [layer('paper-flip-9.ogg', -4)],
    ],
    maxConcurrent: 2,
  },
  'book.open': one('book-open.ogg', -4),
  'book.close': one('book-close.ogg', -4),
  'map.open': one('map-open.ogg', -6),
  'map.close': one('map-close.ogg', -6),
  'cloth.lift': {
    bus: 'sfx',
    variants: [
      [layer('cloth-lift-1.ogg', -6)],
      [layer('cloth-lift-2.ogg', -6)],
      [layer('cloth-lift-3.ogg', -6)],
      [layer('cloth-lift-4.ogg', -6)],
    ],
    maxConcurrent: 2,
  },
  'pencil.tick': {
    bus: 'sfx',
    variants: [
      [layer('pencil-tick-1.ogg', -10)],
      [layer('pencil-tick-3.ogg', -10)],
      [layer('pencil-tick-5.ogg', -10)],
    ],
    maxConcurrent: 2,
  },
  'lock.rattle': {
    bus: 'sfx',
    variants: [[layer('lock-metal-click.ogg', -8), layer('lock-creak.ogg', -8, 40)]],
    maxConcurrent: 1,
  },
  'drop.nothing': one('drop-nothing.ogg', -10, 'sfx', { maxConcurrent: 1 }),
  'dice.grab': {
    bus: 'sfx',
    variants: [[layer('dice-grab-1.ogg', -4)], [layer('dice-grab-2.ogg', -4)]],
    maxConcurrent: 1,
  },
  'dice.shake': {
    bus: 'sfx',
    variants: [
      [layer('dice-shake-1.ogg', -4)],
      [layer('dice-shake-2.ogg', -4)],
      [layer('dice-shake-3.ogg', -4)],
    ],
    maxConcurrent: 1,
  },
  'dice.throw': {
    bus: 'sfx',
    variants: [
      [layer('dice-throw-1.ogg', -2)],
      [layer('dice-throw-2.ogg', -2)],
      [layer('dice-throw-3.ogg', -2)],
    ],
    maxConcurrent: 1,
  },
  'knight.land': {
    bus: 'sfx',
    variants: [
      [layer('knight-land-0.ogg', -4)],
      [layer('knight-land-2.ogg', -4)],
      [layer('knight-land-4.ogg', -4)],
    ],
    maxConcurrent: 2,
  },
  'step.wood': {
    bus: 'sfx',
    variants: [
      [layer('step-wood-0.ogg', -10)],
      [layer('step-wood-2.ogg', -10)],
      [layer('step-wood-4.ogg', -10)],
    ],
    maxConcurrent: 2,
  },
  'lift.gate': {
    bus: 'sfx',
    variants: [[layer('lift-metal-latch.ogg', -6), layer('lift-door-close.ogg', -6, 120)]],
    maxConcurrent: 1,
  },
  'lift.cable': one('lift-cable.ogg', -14, 'sfx', { loop: true, maxConcurrent: 1 }),
  'hour.bell': one('hour-bell.ogg', -3, 'sfx', { fadeOutMs: 1500 }),
  'bed.clock': one('bed-clock.ogg', -20, 'ambience', { loop: true, fadeOutMs: 1500 }),
  'bed.boiler': one('bed-boiler.ogg', -18, 'ambience', { loop: true, fadeOutMs: 1500 }),
  'bed.rain': one('bed-rain.ogg', -24, 'ambience', { loop: true, fadeOutMs: 1500 }),
  'music.chapter': one('music-chapter.ogg', -12, 'music', { fadeOutMs: 2000 }),
  'music.solved': one('music-solved.ogg', -8, 'music', { fadeOutMs: 2500 }),
  'music.clinamen': one('music-clinamen.ogg', -14, 'music', { fadeOutMs: 2000 }),
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 70,
  ambience: 35,
  music: 30,
};

export const AUDIO_SETTINGS_KEY = 's3:audio-settings:v1';

export function clampAudioSettings(settings: Partial<AudioSettings>): AudioSettings {
  const clamp = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : fallback;
  return {
    muted: typeof settings.muted === 'boolean' ? settings.muted : DEFAULT_AUDIO_SETTINGS.muted,
    master: clamp(settings.master, DEFAULT_AUDIO_SETTINGS.master),
    ambience: clamp(settings.ambience, DEFAULT_AUDIO_SETTINGS.ambience),
    music: clamp(settings.music, DEFAULT_AUDIO_SETTINGS.music),
  };
}

export function serializeAudioSettings(settings: AudioSettings): string {
  return JSON.stringify(clampAudioSettings(settings));
}

export function parseAudioSettings(serialized: string | null | undefined): AudioSettings {
  if (!serialized) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_AUDIO_SETTINGS };
    return clampAudioSettings(parsed as Partial<AudioSettings>);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function stableVariantIndex(cue: Cue, key: string, variantCount: number): number {
  if (!Number.isInteger(variantCount) || variantCount <= 0) return 0;
  const text = `${cue}\u0000${key}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % variantCount;
}

export interface PlannedBed {
  cue: 'bed.clock' | 'bed.boiler' | 'bed.rain';
  gainDb: number;
}

export function planBeds(cellId: string, hour: 20 | 21 | 22 | 23): PlannedBed[] {
  const plan: PlannedBed[] = [];
  if (cellId === '0:3' || cellId === '3:1') plan.push({ cue: 'bed.clock', gainDb: -20 });
  if (cellId.startsWith('-1:')) plan.push({ cue: 'bed.boiler', gainDb: -18 });
  if (hour === 23) {
    plan.push({ cue: 'bed.rain', gainDb: cellId.startsWith('-1:') ? -30 : -24 });
  }
  return plan;
}
