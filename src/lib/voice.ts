import { Capacitor, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Settings, VoiceBench } from '../types';

type NeuralModel = 'piper' | 'kokoro' | 'supertonic';

export type InstalledModels = Record<NeuralModel, boolean>;

interface NeuralVoicePlugin {
  info(): Promise<InstalledModels & { cores: number; ramMb: number }>;
  benchmark(): Promise<VoiceBench>;
  prepare(options: { id: string; text: string; speed: number; model: NeuralModel; sid: number }): Promise<{ cached: boolean }>;
  play(options: { id: string }): Promise<{ stopped: boolean }>;
  stop(options?: { cancelQueued: boolean }): Promise<void>;
  clearCache(options?: { prefix: string }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
}

const NeuralVoice = registerPlugin<NeuralVoicePlugin>('NeuralVoice');

export type VoiceGroup = 'Recommended' | 'Studio voices' | 'Expressive voices' | 'Basic';

export interface VoiceOption {
  id: string;
  label: string;
  detail: string;
  group: VoiceGroup;
  /** Absent for "auto" and the phone's built-in voice. */
  model?: NeuralModel;
  sid?: number;
}

export const VOICES: VoiceOption[] = [
  { id: 'auto', group: 'Recommended', label: 'Automatic', detail: 'The best voice your phone can run smoothly' },
  // Supertonic 3: 44 kHz, quick to prepare.
  { id: 'clara', group: 'Studio voices', label: 'Clara', detail: 'Woman', model: 'supertonic', sid: 0 },
  { id: 'maya', group: 'Studio voices', label: 'Maya', detail: 'Woman · brighter', model: 'supertonic', sid: 1 },
  { id: 'iris', group: 'Studio voices', label: 'Iris', detail: 'Woman', model: 'supertonic', sid: 2 },
  { id: 'nora', group: 'Studio voices', label: 'Nora', detail: 'Woman', model: 'supertonic', sid: 3 },
  { id: 'ruth', group: 'Studio voices', label: 'Ruth', detail: 'Woman · lower', model: 'supertonic', sid: 4 },
  { id: 'theo', group: 'Studio voices', label: 'Theo', detail: 'Man · lighter', model: 'supertonic', sid: 5 },
  { id: 'owen', group: 'Studio voices', label: 'Owen', detail: 'Man · deep', model: 'supertonic', sid: 6 },
  { id: 'luke', group: 'Studio voices', label: 'Luke', detail: 'Man', model: 'supertonic', sid: 7 },
  { id: 'sam', group: 'Studio voices', label: 'Sam', detail: 'Man', model: 'supertonic', sid: 8 },
  { id: 'hugo', group: 'Studio voices', label: 'Hugo', detail: 'Man · deep', model: 'supertonic', sid: 9 },
  // Kokoro: slower to prepare.
  { id: 'heart', group: 'Expressive voices', label: 'Heart', detail: 'American woman', model: 'kokoro', sid: 3 },
  { id: 'bella', group: 'Expressive voices', label: 'Bella', detail: 'American woman', model: 'kokoro', sid: 2 },
  { id: 'nicole', group: 'Expressive voices', label: 'Nicole', detail: 'American woman · soft, close to a whisper', model: 'kokoro', sid: 6 },
  { id: 'sarah', group: 'Expressive voices', label: 'Sarah', detail: 'American woman', model: 'kokoro', sid: 9 },
  { id: 'emma', group: 'Expressive voices', label: 'Emma', detail: 'British woman', model: 'kokoro', sid: 21 },
  { id: 'lily', group: 'Expressive voices', label: 'Lily', detail: 'British woman', model: 'kokoro', sid: 23 },
  { id: 'michael', group: 'Expressive voices', label: 'Michael', detail: 'American man', model: 'kokoro', sid: 16 },
  { id: 'george', group: 'Expressive voices', label: 'George', detail: 'British man', model: 'kokoro', sid: 26 },
  { id: 'jenny', group: 'Basic', label: 'Jenny', detail: 'British woman · ready instantly, less natural', model: 'piper', sid: 0 },
  { id: 'system', group: 'Basic', label: 'Phone voice', detail: "Your phone's built-in voice · least natural" },
];

export const VOICE_GROUPS: { group: VoiceGroup; note: string }[] = [
  { group: 'Recommended', note: '' },
  { group: 'Studio voices', note: 'High-quality sound, ready in a few seconds.' },
  { group: 'Expressive voices', note: 'Natural phrasing. Slow to prepare: up to a minute for a new meditation.' },
  { group: 'Basic', note: '' },
];

export const SPEEDS = [
  { value: 0.55, label: 'Slowest' },
  { value: 0.65, label: 'Slower' },
  { value: 0.75, label: 'Slow' },
  { value: 0.85, label: 'Relaxed' },
  { value: 1, label: 'Natural' },
];

export const PAUSE_SCALES = [
  { value: 0.6, label: 'Shorter' },
  { value: 1, label: 'As written' },
  { value: 1.5, label: 'Longer' },
  { value: 2, label: 'Longest' },
];

export function voiceOption(id: string): VoiceOption {
  // 'neural' was the setting's name before there was more than one natural voice.
  const wanted = id === 'neural' ? 'jenny' : id;
  return VOICES.find(v => v.id === wanted) ?? VOICES[0];
}

// Seconds of work per second of speech. About half of a meditation is silence, so a device a little
// slower than real time still keeps ahead once the first lines are ready.
const MAX_RTF = 1.2;
const MIN_RAM_MB = 2500;

export interface VoiceEngine {
  /** Which voice is actually speaking (never "auto"). */
  voice: VoiceOption;
  /** True when lines take noticeably long to generate, so the player should buffer more first. */
  slowToPrepare: boolean;
  /** Queue every line for generation up front (natural voices only). */
  preload(lines: { key: string; text: string }[]): void;
  /** Resolves once these lines can be spoken without a wait. */
  whenReady(keys: string[]): Promise<void>;
  /** Speak one line; resolves when it has finished or was halted, rejects if the voice can't speak. */
  speak(key: string, text: string): Promise<void>;
  /** Silence the current line but keep generated speech, so playback can resume. */
  halt(): Promise<void>;
  /** End the session and discard queued work. */
  stop(): Promise<void>;
}

function neuralEngine(voice: VoiceOption, speed: number): VoiceEngine {
  const model = voice.model!;
  const sid = voice.sid ?? 0;
  const ready = new Map<string, Promise<unknown>>();
  // Generated speech is cached per line, voice and speed, so changing either never replays a stale file.
  const fileId = (key: string) => `${key}-${voice.id}-${Math.round(speed * 100)}`;
  const prepare = (key: string, text: string) => NeuralVoice.prepare({ id: fileId(key), text, speed, model, sid });
  // Bumped on halt/stop so a line that was still being generated doesn't start playing afterwards.
  let generation = 0;
  return {
    voice,
    slowToPrepare: model === 'kokoro',
    preload(lines) {
      for (const { key, text } of lines) {
        const p = prepare(key, text);
        p.catch(() => {});
        ready.set(key, p);
      }
    },
    async whenReady(keys) {
      await Promise.all(keys.map(key => ready.get(key)?.catch(() => {})));
    },
    async speak(key, text) {
      const started = generation;
      await (ready.get(key) ?? prepare(key, text));
      if (started !== generation) return;
      await NeuralVoice.play({ id: fileId(key) });
    },
    async halt() {
      generation++;
      await NeuralVoice.stop({ cancelQueued: false });
    },
    async stop() {
      generation++;
      ready.clear();
      await NeuralVoice.stop({ cancelQueued: true });
    },
  };
}

let systemLang: string | undefined | null = null;

// Not every phone has a US English voice installed; fall back to the phone's own language.
async function resolveSystemLang(): Promise<string | undefined> {
  if (systemLang !== null) return systemLang;
  systemLang = undefined;
  for (const lang of ['en-US', 'en-GB', navigator.language]) {
    try {
      if ((await TextToSpeech.isLanguageSupported({ lang })).supported) {
        systemLang = lang;
        break;
      }
    } catch {
      break;
    }
  }
  return systemLang;
}

function systemEngine(speed: number): VoiceEngine {
  let finish: (() => void) | null = null;
  return {
    voice: voiceOption('system'),
    slowToPrepare: false,
    preload() {},
    async whenReady() {},
    async speak(_key, text) {
      const lang = await resolveSystemLang();
      // Some phones never report that speech finished; don't let one line stall the whole session.
      const limitMs = (text.split(/\s+/).length / (1.8 * speed) + 6) * 1000;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => settle(), limitMs);
        function settle(error?: unknown) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          finish = null;
          if (error) reject(error);
          else resolve();
        }
        finish = () => settle();
        TextToSpeech.speak({ text, lang, rate: speed, pitch: 0.95, category: 'playback' })
          .then(() => settle(), e => settle(e ?? new Error('speech failed')));
      });
    },
    async halt() {
      finish?.();
      await TextToSpeech.stop().catch(() => {});
    },
    async stop() {
      await this.halt();
    },
  };
}

/** Which natural-voice models are installed in this build of the app. */
export async function installedModels(): Promise<InstalledModels> {
  const none = { piper: false, kokoro: false, supertonic: false };
  if (!Capacitor.isNativePlatform()) return none;
  try {
    const { piper, kokoro, supertonic } = await NeuralVoice.info();
    return { piper: !!piper, kokoro: !!kokoro, supertonic: !!supertonic };
  } catch {
    return none;
  }
}

export async function runBenchmark(): Promise<VoiceBench | null> {
  if (!(await installedModels()).piper) return null;
  try {
    return await NeuralVoice.benchmark();
  } catch {
    return null;
  }
}

export type BenchVerdict = 'untested' | 'ok' | 'slow' | 'low-memory';

export function benchVerdict(bench: VoiceBench | null): BenchVerdict {
  if (!bench) return 'untested';
  if (bench.ramMb < MIN_RAM_MB) return 'low-memory';
  return bench.rtf <= MAX_RTF ? 'ok' : 'slow';
}

// The studio voices take roughly this many times longer to generate than the benchmark voice.
const STUDIO_COST = 2.5;

/** Which voice "Automatic" resolves to on this device. */
export function automaticVoice(bench: VoiceBench | null, installed: InstalledModels): VoiceOption {
  if (benchVerdict(bench) !== 'ok') return voiceOption('system');
  if (installed.supertonic && bench!.rtf * STUDIO_COST <= MAX_RTF) return voiceOption('clara');
  return voiceOption('jenny');
}

type VoiceSettings = Pick<Settings, 'voiceChoice' | 'voiceBench' | 'speechSpeed'>;

/**
 * Builds the engine for the chosen voice. "Automatic" uses a one-off speed test to pick the best
 * voice the device keeps up with. A chosen voice whose model isn't
 * installed also falls back to the phone voice.
 */
export async function chooseEngine(settings: VoiceSettings, saveBench: (b: VoiceBench) => void): Promise<VoiceEngine> {
  const speed = settings.speechSpeed;
  const choice = voiceOption(settings.voiceChoice);
  const installed = await installedModels();

  if (choice.model) {
    return installed[choice.model] ? neuralEngine(choice, speed) : systemEngine(speed);
  }
  if (choice.id === 'system' || !installed.piper) return systemEngine(speed);

  let bench = settings.voiceBench;
  if (!bench) {
    bench = await runBenchmark();
    if (bench) saveBench(bench);
  }
  const picked = automaticVoice(bench, installed);
  return picked.model ? neuralEngine(picked, speed) : systemEngine(speed);
}

export function fallbackEngine(speed: number): VoiceEngine {
  return systemEngine(speed);
}

export function keepScreenAwake(on: boolean): void {
  if (Capacitor.isNativePlatform()) NeuralVoice.keepAwake({ on }).catch(() => {});
}

/** Removes generated speech files: for one meditation (by id prefix) or all of them. */
export function clearVoiceCache(prefix = ''): void {
  if (Capacitor.isNativePlatform()) NeuralVoice.clearCache({ prefix }).catch(() => {});
}
