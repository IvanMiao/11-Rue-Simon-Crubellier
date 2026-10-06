import {
  CUE_MANIFEST,
  type AudioSettings,
  type Cue,
  type CueDefinition,
  type CueLayer,
  DEFAULT_AUDIO_SETTINGS,
  clampAudioSettings,
  planBeds,
  stableVariantIndex,
} from './cues';

export interface AudioCueLogEntry {
  cue: Cue;
  key: string;
  at: number;
  delayMs: number;
}

export interface AudioPlayOptions {
  delayMs?: number;
  durationMs?: number;
  gainDbOffset?: number;
}

export interface AudioController {
  unlock(): Promise<void>;
  play(cue: Cue, key?: string, options?: AudioPlayOptions): void;
  setBed(cellId: string, hour: 20 | 21 | 22 | 23): void;
  setSettings(settings: AudioSettings): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

export interface AudioControllerOptions {
  now?: () => number;
  captureOnly?: boolean;
}

interface ActiveVoice {
  cue: Cue;
  source: AudioBufferSourceNode;
  gain: GainNode;
  bus: CueDefinition['bus'];
  category: 'oneshot' | 'bed' | 'music';
  stopped: boolean;
}

declare global {
  interface Window {
    __audioCueLog?: AudioCueLogEntry[];
  }
}

function queryEnabled(name: string): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(name) === '1';
}

function linearGain(db: number): number {
  return 10 ** (db / 20);
}

function clampDelay(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value || 0) : 0;
}

export function createAudioController(options: AudioControllerOptions = {}): AudioController {
  const captureLog = queryEnabled('audioLog');
  const manualClock =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('clock') === 'manual';
  const captureOnly = options.captureOnly ?? manualClock;
  const now = options.now ?? (() => performance.now());
  const cueLog: AudioCueLogEntry[] = [];
  let settings = { ...DEFAULT_AUDIO_SETTINGS };
  let context: AudioContext | null = null;
  let masterBus: GainNode | null = null;
  const buses: Partial<Record<CueDefinition['bus'], GainNode>> = {};
  const voices = new Set<ActiveVoice>();
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const activeByCue = new Map<Cue, ActiveVoice[]>();
  const activeBeds = new Map<Cue, { voice: ActiveVoice; gainDb: number }>();
  let desiredBed: { cellId: string; hour: 20 | 21 | 22 | 23 } | null = null;
  let unlocked = false;
  let disposed = false;
  let bedVersion = 0;
  let capturedBedKey = '';

  if (captureLog) window.__audioCueLog = cueLog;

  function record(cue: Cue, key: string, delayMs: number) {
    if (!captureLog) return;
    cueLog.push({ cue, key, at: now() + delayMs, delayMs });
  }

  function busGain(bus: CueDefinition['bus']): number {
    if (settings.muted) return 0;
    const busSetting = bus === 'ambience' ? settings.ambience : bus === 'music' ? settings.music : 100;
    return (settings.master / 100) * (busSetting / 100);
  }

  function applyBusSettings() {
    if (!context || !masterBus) return;
    const at = context.currentTime;
    masterBus.gain.setTargetAtTime(settings.muted ? 0 : settings.master / 100, at, 0.025);
    (Object.keys(buses) as CueDefinition['bus'][]).forEach((bus) => {
      const multiplier = bus === 'sfx' ? 1 : bus === 'ambience' ? settings.ambience / 100 : settings.music / 100;
      buses[bus]?.gain.setTargetAtTime(multiplier, at, 0.025);
    });
  }

  function createContext() {
    if (context) return;
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;
    context = new AudioContextConstructor();
    masterBus = context.createGain();
    masterBus.gain.value = settings.muted ? 0 : settings.master / 100;
    masterBus.connect(context.destination);
    (['sfx', 'ambience', 'music'] as const).forEach((bus) => {
      const node = context!.createGain();
      node.gain.value = bus === 'sfx' ? 1 : bus === 'ambience' ? settings.ambience / 100 : settings.music / 100;
      node.connect(masterBus!);
      buses[bus] = node;
    });
  }

  function loadBuffer(path: string): Promise<AudioBuffer> {
    const cached = buffers.get(path);
    if (cached) return cached;
    const promise = fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio fetch failed: ${path} (${response.status})`);
        return response.arrayBuffer();
      })
      .then((data) => {
        if (!context) throw new Error('AudioContext is unavailable.');
        return context.decodeAudioData(data);
      });
    buffers.set(path, promise);
    return promise;
  }

  function detachVoice(voice: ActiveVoice) {
    voices.delete(voice);
    const list = activeByCue.get(voice.cue);
    if (list) {
      const next = list.filter((item) => item !== voice);
      if (next.length) activeByCue.set(voice.cue, next);
      else activeByCue.delete(voice.cue);
    }
    for (const [cue, bed] of activeBeds) {
      if (bed.voice === voice) activeBeds.delete(cue);
    }
  }

  function fadeVoice(voice: ActiveVoice, durationMs: number) {
    if (voice.stopped || !context) return;
    voice.stopped = true;
    const at = context.currentTime;
    const duration = Math.max(0, durationMs) / 1000;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + duration);
    try {
      voice.source.stop(at + duration + 0.015);
    } catch {
      voice.source.disconnect();
      voice.gain.disconnect();
      detachVoice(voice);
    }
  }

  function stopCategory(category: ActiveVoice['category'], fadeMs: number) {
    voices.forEach((voice) => {
      if (voice.category === category) fadeVoice(voice, fadeMs);
    });
  }

  function stopAll(fadeMs: number) {
    voices.forEach((voice) => fadeVoice(voice, fadeMs));
    activeBeds.clear();
  }

  async function startVoice(
    cue: Cue,
    layer: CueLayer,
    category: ActiveVoice['category'],
    options: AudioPlayOptions,
    fadeInMs = 0
  ): Promise<ActiveVoice | null> {
    if (!context || disposed || settings.muted || document.hidden || busGain(CUE_MANIFEST[cue].bus) <= 0) {
      return null;
    }
    const buffer = await loadBuffer(layer.path);
    if (!context || disposed || settings.muted || document.hidden) return null;
    const definition = CUE_MANIFEST[cue];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = Boolean(definition.loop);
    if (cue === 'lift.cable') source.playbackRate.value = 0.8;
    const dbOffset = options.gainDbOffset || 0;
    const level = linearGain(layer.gainDb + dbOffset);
    gain.gain.value = fadeInMs > 0 ? 0 : level;
    source.connect(gain);
    gain.connect(buses[definition.bus]!);
    const voice: ActiveVoice = {
      cue,
      source,
      gain,
      bus: definition.bus,
      category,
      stopped: false,
    };
    voices.add(voice);
    const list = activeByCue.get(cue) ?? [];
    list.push(voice);
    activeByCue.set(cue, list);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      detachVoice(voice);
    };
    const at = context.currentTime + clampDelay(options.delayMs) / 1000 + (layer.offsetMs || 0) / 1000;
    source.start(at);
    if (fadeInMs > 0) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + fadeInMs / 1000);
    }
    if (definition.loop && options.durationMs !== undefined) {
      const end = at + Math.max(0, options.durationMs) / 1000;
      gain.gain.setValueAtTime(level, end);
      gain.gain.linearRampToValueAtTime(0, end + 0.08);
      source.stop(end + 0.1);
    } else if (definition.fadeOutMs) {
      const end = at + buffer.duration;
      const fadeStart = Math.max(at, end - definition.fadeOutMs / 1000);
      gain.gain.setValueAtTime(level, fadeStart);
      gain.gain.linearRampToValueAtTime(0, end);
    }
    return voice;
  }

  async function startCue(
    cue: Cue,
    key: string,
    options: AudioPlayOptions = {},
    category: ActiveVoice['category'] = 'oneshot',
    fadeInMs = 0
  ): Promise<ActiveVoice[]> {
    const definition = CUE_MANIFEST[cue];
    if (!definition || !context || disposed || settings.muted) return [];
    const variantIndex = stableVariantIndex(cue, key, definition.variants.length);
    const variant = definition.variants[variantIndex];
    const concurrent = activeByCue.get(cue) ?? [];
    const maxConcurrent = definition.maxConcurrent ?? 3;
    while (concurrent.length >= maxConcurrent) {
      fadeVoice(concurrent[0], 35);
      concurrent.shift();
    }
    const started = await Promise.all(
      variant.map((item) => startVoice(cue, item, category, options, fadeInMs))
    );
    return started.filter((voice): voice is ActiveVoice => voice !== null);
  }

  function syncBeds() {
    if (!desiredBed || !unlocked || settings.muted || document.hidden || captureOnly) return;
    const currentBed = desiredBed;
    const version = bedVersion;
    const plan = planBeds(currentBed.cellId, currentBed.hour);
    const wanted = new Map<Cue, number>(plan.map((bed) => [bed.cue, bed.gainDb]));
    for (const [cue, active] of activeBeds) {
      if (wanted.get(cue) === active.gainDb) continue;
      fadeVoice(active.voice, CUE_MANIFEST[cue].fadeOutMs ?? 1500);
      activeBeds.delete(cue);
    }
    for (const [cue, gainDb] of wanted) {
      if (activeBeds.has(cue)) continue;
      const defaultDb = CUE_MANIFEST[cue].variants[0][0].gainDb;
      void startCue(
        cue,
        `${currentBed.cellId}:${currentBed.hour}`,
        { gainDbOffset: gainDb - defaultDb },
        'bed',
        CUE_MANIFEST[cue].fadeOutMs ?? 1500
      ).then((started) => {
        const voice = started[0];
        if (version !== bedVersion || !wanted.has(cue)) {
          if (voice) fadeVoice(voice, 150);
          return;
        }
        if (voice) activeBeds.set(cue, { voice, gainDb });
      });
    }
  }

  function onVisibilityChange() {
    if (document.hidden) suspend();
    else resume();
  }

  async function unlock(): Promise<void> {
    if (document.hidden) return;
    if (disposed || unlocked) {
      if (context && !settings.muted && context.state === 'suspended') await context.resume();
      return;
    }
    unlocked = true;
    if (captureOnly) return;
    createContext();
    if (!context) return;
    await context.resume();
    syncBeds();
  }

  function play(cue: Cue, key = '', playOptions: AudioPlayOptions = {}) {
    if (disposed) return;
    const delayMs = clampDelay(playOptions.delayMs);
    if (captureOnly) {
      record(cue, key, delayMs);
      return;
    }
    if (!unlocked || settings.muted || document.hidden || busGain(CUE_MANIFEST[cue].bus) <= 0) return;
    record(cue, key, delayMs);
    const isMusic = CUE_MANIFEST[cue].bus === 'music';
    if (isMusic) stopCategory('music', 600);
    void startCue(cue, key, playOptions, isMusic ? 'music' : 'oneshot', isMusic ? 600 : 0);
  }

  function setBed(cellId: string, hour: 20 | 21 | 22 | 23) {
    desiredBed = { cellId, hour };
    bedVersion += 1;
    const plan = planBeds(cellId, hour);
    if (captureOnly) {
      const bedKey = plan.map(({ cue, gainDb }) => `${cue}:${gainDb}`).join('|');
      if (bedKey !== capturedBedKey) {
        plan.forEach(({ cue, gainDb }, index) =>
          record(cue, `${cellId}:${hour}:${gainDb}`, index === 0 ? 0 : 1500)
        );
        capturedBedKey = bedKey;
      }
      return;
    }
    syncBeds();
  }

  function setSettings(nextSettings: AudioSettings) {
    const wasMuted = settings.muted;
    settings = clampAudioSettings(nextSettings);
    applyBusSettings();
    if (settings.muted) {
      stopAll(120);
      return;
    }
    if (wasMuted && unlocked) {
      if (!document.hidden) {
        if (context?.state === 'suspended') void context.resume();
        syncBeds();
      }
    }
  }

  function suspend() {
    if (context && context.state === 'running') void context.suspend();
  }

  function resume() {
    if (!unlocked || settings.muted || !context || document.hidden) return;
    if (context.state === 'suspended') void context.resume();
    syncBeds();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stopAll(0);
    if (captureLog && window.__audioCueLog === cueLog) delete window.__audioCueLog;
    if (context) void context.close();
    context = null;
    masterBus = null;
    Object.keys(buses).forEach((bus) => delete buses[bus as CueDefinition['bus']]);
    buffers.clear();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    unlock,
    play,
    setBed,
    setSettings,
    suspend,
    resume,
    dispose,
  };
}
