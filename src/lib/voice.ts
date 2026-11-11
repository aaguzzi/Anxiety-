import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Settings, VoiceBench } from '../types';
import { PRONUNCIATION_VERSION, spokenText } from './pronunciation';

type NeuralModel = 'piper' | 'kokoro' | 'supertonic';

export type InstalledModels = Record<NeuralModel, boolean>;

/** Everything the phone needs to know about how a line should sound. */
interface VoiceSpec {
  model: NeuralModel;
  sid: number;
  speed: number;
  steps: number;
  softness: number;
  space: number;
}

interface NeuralVoicePlugin {
  info(): Promise<InstalledModels & { cores: number; ramMb: number }>;
  benchmark(): Promise<VoiceBench>;
  prepare(options: VoiceSpec & { id: string; text: string }): Promise<{ cached: boolean }>;
  play(options: VoiceSpec & { id: string }): Promise<{ stopped: boolean }>;
  stop(options?: { cancelQueued: boolean }): Promise<void>;
  startSession(options: VoiceSpec & {
    title: string;
    lines: { id: string; text: string; pauseMs: number }[];
    lead: number;
    startIndex: number;
  }): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  skipSession(options: { by: number }): Promise<void>;
  seekSession(options: { index: number }): Promise<void>;
  stopSession(): Promise<void>;
  sessionState(): Promise<SessionState>;
  addListener(event: 'sessionState', handler: (state: SessionState) => void): Promise<PluginListenerHandle>;
  clearCache(options?: { prefix: string }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
}

const NeuralVoice = registerPlugin<NeuralVoicePlugin>('NeuralVoice');

export type VoiceGroup = 'Recommended' | 'Women' | 'Men' | 'Natural voices' | 'Basic';

export interface VoiceOption {
  id: string;
  label: string;
  detail: string;
  group: VoiceGroup;
  /** Absent for "auto" and the phone's built-in voice. */
  model?: NeuralModel;
  sid?: number;
  /**
   * Softness this voice gets before the listener's own setting. The brighter voices get more, so
   * that one Softness setting suits every voice. From measuring each voice's treble against Ruth's.
   */
  soften?: number;
}

export const VOICES: VoiceOption[] = [
  { id: 'auto', group: 'Recommended', label: 'Automatic', detail: 'The best voice your phone can run smoothly' },
  // Supertonic 3: 44 kHz, quick to prepare, and sentence endings trail off. Ruth tested best.
  // Numbers 10 and up are blends added by scripts/fetch-voice.py.
  { id: 'ruth', group: 'Women', label: 'Ruth', detail: 'Low and unhurried', model: 'supertonic', sid: 4 },
  { id: 'ruth-soft', group: 'Women', label: 'Ruth, gentler', detail: "Ruth with some of Clara's soft endings", model: 'supertonic', sid: 10 },
  { id: 'clara', group: 'Women', label: 'Clara', detail: 'Gentle, soft endings', model: 'supertonic', sid: 0 },
  { id: 'iris', group: 'Women', label: 'Iris', detail: 'Clear and even', model: 'supertonic', sid: 2, soften: 0.15 },
  { id: 'nora', group: 'Women', label: 'Nora', detail: 'Clear and bright', model: 'supertonic', sid: 3, soften: 0.3 },
  { id: 'maya', group: 'Women', label: 'Maya', detail: 'Brighter', model: 'supertonic', sid: 1, soften: 0.25 },
  { id: 'theo', group: 'Men', label: 'Theo', detail: 'Light and warm', model: 'supertonic', sid: 5, soften: 0.4 },
  { id: 'theo-soft', group: 'Men', label: 'Theo, softer', detail: "Theo with some of Sam's softness", model: 'supertonic', sid: 11, soften: 0.05 },
  { id: 'sam', group: 'Men', label: 'Sam', detail: 'The softest', model: 'supertonic', sid: 8 },
  { id: 'owen', group: 'Men', label: 'Owen', detail: 'Deep and level', model: 'supertonic', sid: 6, soften: 0.1 },
  { id: 'luke', group: 'Men', label: 'Luke', detail: 'Clear', model: 'supertonic', sid: 7, soften: 0.4 },
  { id: 'hugo', group: 'Men', label: 'Hugo', detail: 'Deep', model: 'supertonic', sid: 9, soften: 0.15 },
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

export const VOICE_GROUPS: VoiceGroup[] = ['Recommended', 'Women', 'Men', 'Natural voices', 'Basic'];

/** One control for how unhurried a meditation feels: speaking speed and silence length together. */
export const PACES = [
  { id: 'brisk', label: 'Brisk', speed: 0.85, pauseScale: 0.6 },
  { id: 'calm', label: 'Calm', speed: 0.75, pauseScale: 1 },
  { id: 'slow', label: 'Very slow', speed: 0.75, pauseScale: 2 },
] as const;

/** Slider ranges for the fine controls. */
export const SPEED_RANGE = { min: 0.6, max: 1.1, step: 0.05 };
export const PAUSE_RANGE = { min: 0.5, max: 2.5, step: 0.1 };

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
    startIndex?: number,
  ): Promise<void>;
  pause(): void;
  resume(): void;
  skip(by: number): void;
  /** Jump to a line. */
  seek(index: number): void;
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

/** Bump when the voice models change, so speech generated by an older build isn't replayed. */
const ENGINE_VERSION = '2';

export interface VoiceTuning {
  speed: number;
  quality: 'best' | 'fast';
  softness: number;
  space: number;
}

function neuralEngine(voice: VoiceOption, tuning: VoiceTuning): VoiceEngine {
  const { speed } = tuning;
  const model = voice.model!;
  const sid = voice.sid ?? 0;
  const steps = model === 'supertonic' ? STEPS[tuning.quality] : 0;
  // The studio voices start repeating words when asked to speak slower than this.
  const genSpeed = model === 'supertonic' ? Math.max(speed, MIN_STUDIO_SPEED) : speed;
  const spec: VoiceSpec = {
    model,
    sid,
    speed: genSpeed,
    steps,
    softness: Math.min(1, Math.max(0, tuning.softness + (voice.soften ?? 0))),
    space: Math.min(1, Math.max(0, tuning.space)),
  };
  const ready = new Map<string, Promise<unknown>>();
  // Generated speech is cached per line, voice and speed, so changing either never replays a stale file.
  // Softness and room aren't part of the id: the phone derives those from the cached speech.
  const fileId = (key: string) =>
    `${key}-${voice.id}-${Math.round(genSpeed * 100)}-p${PRONUNCIATION_VERSION}-s${steps}-e${ENGINE_VERSION}`;
  const prepare = (key: string, text: string) =>
    NeuralVoice.prepare({ ...spec, id: fileId(key), text: spokenText(text, model !== 'supertonic') });
  // Bumped on halt/stop so a line that was still being generated doesn't start playing afterwards.
  let generation = 0;
  let stateListener: Promise<PluginListenerHandle> | null = null;
  const background: BackgroundSession = {
    async start(title, lines, onState, startIndex = 0) {
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
        ...spec,
        lead: model === 'kokoro' || steps > STEPS.fast ? 4 : 2,
        startIndex,
      });
    },
    pause: () => void NeuralVoice.pauseSession(),
    resume: () => void NeuralVoice.resumeSession(),
    skip: by => void NeuralVoice.skipSession({ by }),
    seek: index => void NeuralVoice.seekSession({ index }),
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
      await NeuralVoice.play({ ...spec, id: fileId(key) });
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

type VoiceSettings = Pick<Settings,
  'voiceChoice' | 'voiceBench' | 'speechSpeed' | 'voiceQuality' | 'voiceSoftness' | 'voiceSpace'>;

/** Changes whenever a setting that alters how a meditation is spoken or timed does. */
export function voiceSettingsKey(settings: VoiceSettings & Pick<Settings, 'pauseScale'>): string {
  return [settings.voiceChoice, settings.speechSpeed, settings.pauseScale, settings.voiceQuality,
    settings.voiceSoftness, settings.voiceSpace].join('|');
}

/**
 * Builds the engine for the chosen voice. "Automatic" uses a one-off speed test to pick the best
 * voice the device keeps up with. A chosen voice whose model isn't
 * installed also falls back to the phone voice.
 */
export async function chooseEngine(settings: VoiceSettings, saveBench: (b: VoiceBench) => void): Promise<VoiceEngine> {
  const speed = settings.speechSpeed;
  const tuning: VoiceTuning = {
    speed,
    quality: settings.voiceQuality,
    softness: settings.voiceSoftness,
    space: settings.voiceSpace,
  };
  const choice = voiceOption(settings.voiceChoice);
  const installed = await installedModels();

  // A saved choice from a build that bundled other voices falls through to Automatic.
  if (choice.model && installed[choice.model]) return neuralEngine(choice, tuning);
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
  return neuralEngine(picked, canDoBest ? tuning : { ...tuning, quality: 'fast' });
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

/** After an update that changed the voice models, drops speech generated by the old ones. */
export function dropOutdatedVoiceCache(): void {
  try {
    if (localStorage.getItem('ac-voice-engine') === ENGINE_VERSION) return;
    clearVoiceCache();
    localStorage.setItem('ac-voice-engine', ENGINE_VERSION);
  } catch {
    // storage unavailable: stale files are harmless, their ids no longer match
  }
}
