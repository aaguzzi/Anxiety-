export type Category =
  | 'breathing'
  | 'grounding'
  | 'defusion'
  | 'acceptance'
  | 'values'
  | 'mindfulness'
  | 'action';

export type Tab = 'home' | 'checkin' | 'meditate' | 'toolbox';

export interface Exercise {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  duration: string;
  category: Category;
  tags: string[];
  actPrinciple: string;
  component: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  emoji: string;
  scores: Partial<Record<Category, number>>;
}

export interface Question {
  id: string;
  text: string;
  subtitle: string;
  options: QuestionOption[];
}

export interface ExerciseProps {
  onComplete: () => void;
}

export interface CheckinEntry {
  id: string;
  at: string;
  level: number;
  feeling?: string;
  focus: Category[];
  note?: string;
}

export interface Settings {
  reminderEnabled: boolean;
  reminderTime: string;
  contactName: string;
  contactPhone: string;
  onboarded: boolean;
  anthropicKey: string;
  /** A voice id from VOICES in lib/voice.ts. */
  voiceChoice: string;
  voiceBench: VoiceBench | null;
  /** 1 is the voice's natural pace; lower is slower. */
  speechSpeed: number;
  /** Multiplier applied to every silence in a meditation. */
  pauseScale: number;
  /** 'best' spends about three times longer generating each line of a studio voice. */
  voiceQuality: 'best' | 'fast';
  /** 0..1: how much the voice's tone is darkened and warmed. */
  voiceSoftness: number;
  /** 0..1: how much room sound is added around the voice. */
  voiceSpace: number;
  /** Background sound layers by id (see lib/sounds.ts). */
  sounds: Record<string, SoundLayer>;
  /** The choices last used under "Make your own". */
  meditationSetup: MeditationSetup;
}

export interface SoundLayer {
  on: boolean;
  /** 0..1 */
  volume: number;
}

/** What a custom meditation is asked to be like. */
export interface MeditationSetup {
  minutes: number;
  /** An id from PRACTICES in lib/meditationScript.ts. */
  practice: string;
  balance: 'guided' | 'balanced' | 'quiet';
  position: 'any' | 'sitting' | 'lying';
  ending: 'day' | 'sleep' | 'action';
  /** Anything to include or leave out, in the listener's words. */
  notes: string;
}

export interface VoiceBench {
  rtf: number;
  cores: number;
  ramMb: number;
}

export interface MeditationSegment {
  text: string;
  pause: number;
}

export interface Meditation {
  id: string;
  title: string;
  prompt: string;
  minutes: number;
  createdAt: string;
  segments: MeditationSegment[];
}

export type PracticeHistory = Record<string, string[]>;
