import { Capacitor, registerPlugin } from '@capacitor/core';
import { SoundLayer } from '../types';

interface SoundsPlugin {
  setSounds(options: { levels: Record<string, number> }): Promise<void>;
  previewSounds(options: { on: boolean }): Promise<void>;
}

// The sound mixer lives in the same native plugin as the voices.
const Native = registerPlugin<SoundsPlugin>('NeuralVoice');

export const DEFAULT_SOUND_VOLUME = 0.5;

/** The loops made by scripts/make-ambience.py. */
export const SOUND_LAYERS = [
  { id: 'rain', label: 'Rain', detail: 'Steady rainfall' },
  { id: 'ocean', label: 'Ocean', detail: 'Waves coming in and going out' },
  { id: 'stream', label: 'Stream', detail: 'Running water' },
  { id: 'wind', label: 'Wind', detail: 'Slow gusts' },
  { id: 'bowls', label: 'Singing bowls', detail: 'A bowl struck now and then' },
  { id: 'drone', label: 'Drone', detail: 'A low, steady hum' },
  { id: 'brown', label: 'Brown noise', detail: 'Deep rumble' },
  { id: 'pink', label: 'Pink noise', detail: 'Even hush' },
  { id: 'white', label: 'White noise', detail: 'Bright hiss' },
] as const;

export function soundsSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function activeSounds(sounds: Record<string, SoundLayer>): string[] {
  return SOUND_LAYERS.filter(l => sounds[l.id]?.on).map(l => l.label);
}

/** Tells the phone which layers to play and how loud. They are heard only while something plays them. */
export function applySounds(sounds: Record<string, SoundLayer>): void {
  if (!soundsSupported()) return;
  const levels: Record<string, number> = {};
  for (const layer of SOUND_LAYERS) {
    const state = sounds[layer.id];
    if (state?.on) levels[layer.id] = state.volume;
  }
  Native.setSounds({ levels }).catch(() => {});
}

/**
 * Plays the chosen sounds without a meditation session: while they are being set up, and when the
 * app itself is timing the spoken lines.
 */
export function playSounds(on: boolean): void {
  if (soundsSupported()) Native.previewSounds({ on }).catch(() => {});
}
