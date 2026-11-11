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
  voiceChoice: VoiceChoice;
  voiceBench: VoiceBench | null;
}

export type VoiceChoice = 'auto' | 'neural' | 'system';

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
