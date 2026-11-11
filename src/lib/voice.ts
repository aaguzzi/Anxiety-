import { Capacitor, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { VoiceBench, VoiceChoice } from '../types';

interface NeuralVoicePlugin {
  info(): Promise<{ available: boolean; cores: number; ramMb: number }>;
  benchmark(): Promise<VoiceBench>;
  prepare(options: { id: string; text: string; speed: number }): Promise<{ durationMs: number; genMs: number }>;
  play(options: { id: string }): Promise<{ stopped: boolean }>;
  stop(options?: { cancelQueued: boolean }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
}

const NeuralVoice = registerPlugin<NeuralVoicePlugin>('NeuralVoice');

export type VoiceKind = 'neural' | 'system';

export const VOICE_LABEL: Record<VoiceKind, string> = {
  neural: 'Natural voice',
  system: 'Phone voice',
};

const SPEED = 0.85;
// Generating faster than this many seconds of work per second of speech keeps ahead of playback,
// because roughly half of a meditation is silence.
const MAX_RTF = 2;
const MIN_RAM_MB = 2500;

export interface VoiceEngine {
  kind: VoiceKind;
  /** Queue every line for generation up front (neural only; resolves immediately otherwise). */
  preload(lines: { id: string; text: string }[]): void;
  /** Speak one line; resolves when it has finished or was stopped. */
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

function systemEngine(): VoiceEngine {
  let cancel: (() => void) | null = null;
  return {
    kind: 'system',
    preload() {},
    speak(_id, text) {
      // Some phones never report that speech finished; don't let one line stall the whole session.
      const limitMs = (text.split(/\s+/).length / 1.5 + 6) * 1000;
      return new Promise<void>(resolve => {
        const timer = setTimeout(done, limitMs);
        function done() {
          clearTimeout(timer);
          cancel = null;
          resolve();
        }
        cancel = done;
        TextToSpeech.speak({ text, lang: 'en-US', rate: SPEED, pitch: 0.95, category: 'playback' })
          .catch(() => {})
          .then(done);
      });
    },
    async halt() {
      cancel?.();
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

export function benchIsFastEnough(bench: VoiceBench | null): boolean {
  return !!bench && bench.rtf <= MAX_RTF && bench.ramMb >= MIN_RAM_MB;
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
  return benchIsFastEnough(bench) ? neuralEngine() : systemEngine();
}

export function fallbackEngine(): VoiceEngine {
  return systemEngine();
}

export function keepScreenAwake(on: boolean): void {
  if (Capacitor.isNativePlatform()) NeuralVoice.keepAwake({ on }).catch(() => {});
}
