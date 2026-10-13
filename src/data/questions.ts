import { Question } from '../types';

export const questions: Question[] = [
  {
    id: 'q1',
    text: 'Right now, I feel…',
    subtitle: 'Choose the one that fits best',
    options: [
      {
        id: 'q1-overwhelmed',
        text: 'Overwhelmed or panicky',
        emoji: '😰',
        scores: { breathing: 3, grounding: 3, acceptance: 1 },
      },
      {
        id: 'q1-thoughts',
        text: 'Caught in anxious thoughts',
        emoji: '🌀',
        scores: { defusion: 3, mindfulness: 2, acceptance: 1 },
      },
      {
        id: 'q1-worry',
        text: 'Worried about what might happen',
        emoji: '😟',
        scores: { defusion: 2, acceptance: 2, values: 1 },
      },
      {
        id: 'q1-stuck',
        text: 'Stuck or avoiding something',
        emoji: '🥀',
        scores: { values: 3, action: 3, acceptance: 1 },
      },
      {
        id: 'q1-tense',
        text: 'Tense or uncomfortable in my body',
        emoji: '😬',
        scores: { breathing: 2, grounding: 3, acceptance: 1 },
      },
      {
        id: 'q1-disconnected',
        text: 'Disconnected or numb',
        emoji: '🌫️',
        scores: { grounding: 3, mindfulness: 2, acceptance: 1 },
      },
    ],
  },
  {
    id: 'q2',
    text: "What's showing up most?",
    subtitle: 'Pick the one that resonates',
    options: [
      {
        id: 'q2-racing',
        text: 'Racing or looping thoughts',
        emoji: '💭',
        scores: { defusion: 3, mindfulness: 2 },
      },
      {
        id: 'q2-body',
        text: 'Physical anxiety sensations',
        emoji: '💗',
        scores: { breathing: 2, grounding: 3 },
      },
      {
        id: 'q2-avoidance',
        text: 'Urge to avoid or escape',
        emoji: '🚪',
        scores: { acceptance: 2, values: 2, action: 2 },
      },
      {
        id: 'q2-judgment',
        text: 'Harsh self-judgment or criticism',
        emoji: '🪞',
        scores: { defusion: 2, mindfulness: 2, values: 1 },
      },
      {
        id: 'q2-control',
        text: 'Feeling out of control',
        emoji: '🎢',
        scores: { breathing: 3, grounding: 2, acceptance: 1 },
      },
    ],
  },
  {
    id: 'q3',
    text: 'What I need most right now…',
    subtitle: 'What would help the most?',
    options: [
      {
        id: 'q3-calm',
        text: 'To calm my body down',
        emoji: '🧘',
        scores: { breathing: 3, grounding: 2 },
      },
      {
        id: 'q3-distance',
        text: 'To get distance from my thoughts',
        emoji: '🍃',
        scores: { defusion: 3, mindfulness: 2 },
      },
      {
        id: 'q3-accept',
        text: 'To stop fighting how I feel',
        emoji: '🌊',
        scores: { acceptance: 3, mindfulness: 1 },
      },
      {
        id: 'q3-values',
        text: 'To reconnect with what matters',
        emoji: '🧭',
        scores: { values: 3, action: 2 },
      },
      {
        id: 'q3-step',
        text: 'To take a small step forward',
        emoji: '🌱',
        scores: { action: 3, values: 2 },
      },
    ],
  },
];
