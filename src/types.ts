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
