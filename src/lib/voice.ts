import { Capacitor, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { VoiceBench, VoiceChoice } from '../types';

interface NeuralVoicePlugin {
  info(): Promise<{ available: boolean; cores: number; ramMb: number }>;
  benchmark(): Promise<VoiceBench>;
  prepare(options: { id: string; text: string; speed: number }): Promise<{ cached: boolean }>;
  play(options: { id: string }): Promise<{ stopped: boolean }>;
  stop(options?: { cancelQueued: boolean }): Promise<void>;
  clearCache(options?: { prefix: string }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
}

const NeuralVoice = registerPlugin<NeuralVoicePlugin>('NeuralVoice');

export type VoiceKind = 'neural' | 'system';

export const VOICE_LABEL: Record<VoiceKind, string> = {
  neural: 'Natural voice',
  system: 'Phone voice',
};

const SPEED = 0.85;
// Seconds of work per second of speech. About half of a meditation is silence, so a device a little
// slower than real time still keeps ahead once the first lines are ready.
const MAX_RTF = 1.2;
const MIN_RAM_MB = 2500;

export interface VoiceEngine {
  kind: VoiceKind;
  /** Queue every line for generation up front (neural only). */
  preload(lines: { id: string; text: string }[]): void;
  /** Resolves once these lines can be spoken without a wait. */
  whenReady(ids: string[]): Promise<void>;
  /** Speak one line; resolves when it has finished or was halted, rejects if the voice can't speak. */
  speak(id: string, text: string): Promise<void>;
  /** Silence the current line but keep generated speech, so playback can resume. */
  halt(): Promise<void>;
  /** End the session and discard queued work. */
  stop(): Promise<void>;
}

function neuralEngine(): VoiceEngine {
  const ready = new Map<string, Promise<unknown>>();
  // Bumped on halt/stop so a line that was still being generated doesn't start playing afterwards.
  let generation = 0;
  return {
    kind: 'neural',
    preload(lines) {
      for (const { id, text } of lines) {
        const p = NeuralVoice.prepare({ id, text, speed: SPEED });
        p.catch(() => {});
        ready.set(id, p);
      }
    },
    async whenReady(ids) {
      await Promise.all(ids.map(id => ready.get(id)?.catch(() => {})));
    },
    async speak(id, text) {
      const started = generation;
      await (ready.get(id) ?? NeuralVoice.prepare({ id, text, speed: SPEED }));
      if (started !== generation) return;
      await NeuralVoice.play({ id });
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

function systemEngine(): VoiceEngine {
  let finish: (() => void) | null = null;
  return {
    kind: 'system',
    preload() {},
    async whenReady() {},
    async speak(_id, text) {
      const lang = await resolveSystemLang();
      // Some phones never report that speech finished; don't let one line stall the whole session.
      const limitMs = (text.split(/\s+/).length / 1.5 + 6) * 1000;
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
        TextToSpeech.speak({ text, lang, rate: SPEED, pitch: 0.95, category: 'playback' })
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

export async function neuralAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await NeuralVoice.info()).available;
  } catch {
    return false;
  }
}

export async function runBenchmark(): Promise<VoiceBench | null> {
  if (!(await neuralAvailable())) return null;
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

/**
 * Picks the voice for this device. On "auto" the natural voice is used when a one-off speed test
 * shows the device can keep up; otherwise the phone's built-in voice.
 */
export async function chooseEngine(
  choice: VoiceChoice,
  cached: VoiceBench | null,
  saveBench: (b: VoiceBench) => void,
): Promise<VoiceEngine> {
  if (choice === 'system' || !(await neuralAvailable())) return systemEngine();
  if (choice === 'neural') return neuralEngine();

  let bench = cached;
  if (!bench) {
    bench = await runBenchmark();
    if (bench) saveBench(bench);
  }
  return benchVerdict(bench) === 'ok' ? neuralEngine() : systemEngine();
}

export function fallbackEngine(): VoiceEngine {
  return systemEngine();
}

export function keepScreenAwake(on: boolean): void {
  if (Capacitor.isNativePlatform()) NeuralVoice.keepAwake({ on }).catch(() => {});
}

/** Removes generated speech files: for one meditation (by id prefix) or all of them. */
export function clearVoiceCache(prefix = ''): void {
  if (Capacitor.isNativePlatform()) NeuralVoice.clearCache({ prefix }).catch(() => {});
}
