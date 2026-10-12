export type Category =
  | 'breathing'
  | 'grounding'
  | 'defusion'
  | 'acceptance'
  | 'values'
  | 'mindfulness'
  | 'action';

export type Tab = 'home' | 'checkin' | 'toolbox';

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
}

export type PracticeHistory = Record<string, string[]>;

export interface AppState {
  completedToday: string[];
  streak: number;
  lastActiveDate: string;
}
