import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Settings, VoiceBench } from '../types';
import { PRONUNCIATION_VERSION, spokenText } from './pronunciation';

type NeuralModel = 'piper' | 'kokoro' | 'supertonic';

export type InstalledModels = Record<NeuralModel, boolean>;

interface NeuralVoicePlugin {
  info(): Promise<InstalledModels & { cores: number; ramMb: number }>;
  benchmark(): Promise<VoiceBench>;
  prepare(options: { id: string; text: string; speed: number; model: NeuralModel; sid: number; steps: number }): Promise<{ cached: boolean }>;
  play(options: { id: string }): Promise<{ stopped: boolean }>;
  stop(options?: { cancelQueued: boolean }): Promise<void>;
  startSession(options: {
    title: string;
    lines: { id: string; text: string; pauseMs: number }[];
    model: NeuralModel;
    sid: number;
    speed: number;
    steps: number;
    lead: number;
  }): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  skipSession(options: { by: number }): Promise<void>;
  stopSession(): Promise<void>;
  sessionState(): Promise<SessionState>;
  addListener(event: 'sessionState', handler: (state: SessionState) => void): Promise<PluginListenerHandle>;
  clearCache(options?: { prefix: string }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
}

const NeuralVoice = registerPlugin<NeuralVoicePlugin>('NeuralVoice');

export type VoiceGroup = 'Recommended' | 'Studio voices' | 'Natural voices' | 'Basic';

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
  // Supertonic 3: 44 kHz, quick to prepare, and sentence endings trail off. Ruth tested best.
  { id: 'ruth', group: 'Studio voices', label: 'Ruth', detail: 'Woman · lower, unhurried', model: 'supertonic', sid: 4 },
  { id: 'clara', group: 'Studio voices', label: 'Clara', detail: 'Woman · endings trail off the most', model: 'supertonic', sid: 0 },
  { id: 'iris', group: 'Studio voices', label: 'Iris', detail: 'Woman', model: 'supertonic', sid: 2 },
  { id: 'nora', group: 'Studio voices', label: 'Nora', detail: 'Woman', model: 'supertonic', sid: 3 },
  { id: 'maya', group: 'Studio voices', label: 'Maya', detail: 'Woman · brighter', model: 'supertonic', sid: 1 },
  { id: 'theo', group: 'Studio voices', label: 'Theo', detail: 'Man · lighter', model: 'supertonic', sid: 5 },
  { id: 'sam', group: 'Studio voices', label: 'Sam', detail: 'Man', model: 'supertonic', sid: 8 },
  { id: 'luke', group: 'Studio voices', label: 'Luke', detail: 'Man', model: 'supertonic', sid: 7 },
  { id: 'owen', group: 'Studio voices', label: 'Owen', detail: 'Man · deep, level', model: 'supertonic', sid: 6 },
  { id: 'hugo', group: 'Studio voices', label: 'Hugo', detail: 'Man · deep', model: 'supertonic', sid: 9 },
  // Kokoro. Listed only when its model is bundled (it isn't by default; see scripts/fetch-voice.py).
  { id: 'emma', group: 'Natural voices', label: 'Emma', detail: 'British woman · very even', model: 'kokoro', sid: 21 },
  { id: 'river', group: 'Natural voices', label: 'River', detail: 'American woman · very even', model: 'kokoro', sid: 8 },
  { id: 'nicole', group: 'Natural voices', label: 'Nicole', detail: 'American woman · soft, close to a whisper', model: 'kokoro', sid: 6 },
  { id: 'sky', group: 'Natural voices', label: 'Sky', detail: 'American woman', model: 'kokoro', sid: 10 },
  { id: 'alloy', group: 'Natural voices', label: 'Alloy', detail: 'American woman · lower', model: 'kokoro', sid: 0 },
  { id: 'lily', group: 'Natural voices', label: 'Lily', detail: 'British woman', model: 'kokoro', sid: 23 },
  { id: 'adam', group: 'Natural voices', label: 'Adam', detail: 'American man · even', model: 'kokoro', sid: 11 },
  { id: 'onyx', group: 'Natural voices', label: 'Onyx', detail: 'American man · deep', model: 'kokoro', sid: 17 },
  { id: 'daniel', group: 'Natural voices', label: 'Daniel', detail: 'British man', model: 'kokoro', sid: 24 },
  { id: 'george', group: 'Natural voices', label: 'George', detail: 'British man', model: 'kokoro', sid: 26 },
  { id: 'jenny', group: 'Basic', label: 'Jenny', detail: 'British woman · ready instantly, less natural', model: 'piper', sid: 0 },
  { id: 'system', group: 'Basic', label: 'Phone voice', detail: "Your phone's built-in voice · least natural" },
];

export const VOICE_GROUPS: { group: VoiceGroup; note: string }[] = [
  { group: 'Recommended', note: '' },
  { group: 'Studio voices', note: 'High-quality sound, ready in a few seconds.' },
  { group: 'Natural voices', note: 'Chosen for a steady tone that settles at the end of each sentence. Slower to prepare.' },
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

export interface SessionState {
  status: 'preparing' | 'playing' | 'paused' | 'done' | 'error' | 'stopped' | 'none';
  index: number;
}

/** A whole meditation played by the phone itself, so it carries on with the screen off. */
export interface BackgroundSession {
  start(
    title: string,
    lines: { key: string; text: string; pauseSeconds: number }[],
    onState: (state: SessionState) => void,
  ): Promise<void>;
  pause(): void;
  resume(): void;
  skip(by: number): void;
  /** Ask where playback is now, after the app was in the background. */
  sync(): Promise<SessionState>;
  stop(): Promise<void>;
}

export interface VoiceEngine {
  /** Which voice is actually speaking (never "auto"). */
  voice: VoiceOption;
  /** Multiply silences by this: voices that can't speak as slowly as asked make it up in the gaps. */
  pauseStretch: number;
  /** True when lines take noticeably long to generate, so the player should buffer more first. */
  slowToPrepare: boolean;
  /** Present for the natural voices: playback that doesn't depend on the app staying on screen. */
  background?: BackgroundSession;
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

// Refinement passes for the studio voices: more passes sound cleaner and take longer.
const STEPS = { best: 16, fast: 5 };
export const MIN_STUDIO_SPEED = 0.75;

function neuralEngine(voice: VoiceOption, speed: number, quality: 'best' | 'fast'): VoiceEngine {
  const model = voice.model!;
  const sid = voice.sid ?? 0;
  const steps = model === 'supertonic' ? STEPS[quality] : 0;
  // The studio voices start repeating words when asked to speak slower than this.
  const genSpeed = model === 'supertonic' ? Math.max(speed, MIN_STUDIO_SPEED) : speed;
  const ready = new Map<string, Promise<unknown>>();
  // Generated speech is cached per line, voice and speed, so changing either never replays a stale file.
  const fileId = (key: string) => `${key}-${voice.id}-${Math.round(genSpeed * 100)}-p${PRONUNCIATION_VERSION}-s${steps}`;
  const prepare = (key: string, text: string) =>
    NeuralVoice.prepare({ id: fileId(key), text: spokenText(text, model !== 'supertonic'), speed: genSpeed, model, sid, steps });
  // Bumped on halt/stop so a line that was still being generated doesn't start playing afterwards.
  let generation = 0;
  let stateListener: Promise<PluginListenerHandle> | null = null;
  const background: BackgroundSession = {
    async start(title, lines, onState) {
      // The playback controls live in a notification; ask once if we may show it.
      try {
        const permission = await LocalNotifications.checkPermissions();
        if (permission.display.startsWith('prompt')) await LocalNotifications.requestPermissions();
      } catch {
        // playback works without the notification
      }
      stateListener?.then(l => l.remove());
      stateListener = NeuralVoice.addListener('sessionState', onState);
      await NeuralVoice.startSession({
        title,
        lines: lines.map(l => ({
          id: fileId(l.key),
          text: spokenText(l.text, model !== 'supertonic'),
          pauseMs: Math.round(l.pauseSeconds * 1000),
        })),
        model,
        sid,
        speed: genSpeed,
        steps,
        lead: model === 'kokoro' || steps > STEPS.fast ? 4 : 2,
      });
    },
    pause: () => void NeuralVoice.pauseSession(),
    resume: () => void NeuralVoice.resumeSession(),
    skip: by => void NeuralVoice.skipSession({ by }),
    sync: () => NeuralVoice.sessionState(),
    async stop() {
      stateListener?.then(l => l.remove());
      stateListener = null;
      await NeuralVoice.stopSession();
    },
  };
  return {
    voice,
    background,
    pauseStretch: genSpeed / speed,
    slowToPrepare: model === 'kokoro' || steps > STEPS.fast,
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
    pauseStretch: 1,
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
const STUDIO_COST = { fast: 2.5, best: 6.5 };

/** Which voice "Automatic" resolves to on this device. */
export function automaticVoice(bench: VoiceBench | null, installed: InstalledModels): VoiceOption {
  if (benchVerdict(bench) !== 'ok') return voiceOption('system');
  if (installed.supertonic && bench!.rtf * STUDIO_COST.fast <= MAX_RTF) return voiceOption('ruth');
  return voiceOption('jenny');
}

type VoiceSettings = Pick<Settings, 'voiceChoice' | 'voiceBench' | 'speechSpeed' | 'voiceQuality'>;

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
    return installed[choice.model] ? neuralEngine(choice, speed, settings.voiceQuality) : systemEngine(speed);
  }
  if (choice.id === 'system' || !installed.piper) return systemEngine(speed);

  let bench = settings.voiceBench;
  if (!bench) {
    bench = await runBenchmark();
    if (bench) saveBench(bench);
  }
  const picked = automaticVoice(bench, installed);
  if (!picked.model) return systemEngine(speed);
  // Automatic never asks for more than the device can keep up with.
  const canDoBest = picked.model !== 'supertonic' || bench!.rtf * STUDIO_COST.best <= MAX_RTF;
  return neuralEngine(picked, speed, canDoBest ? settings.voiceQuality : 'fast');
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
