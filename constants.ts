import { Milestone, Difficulty } from './types';

export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: 'default-1',
    title: 'Der Fremde Bestie',
    description: 'Geht in ein belebtes Cafe oder eine Bar. Sucht euch eine komplett fremde Person aus und uberzeugt sie, dass ihr schon seit Jahren beste Freunde seid, die sich zufallig wiedergetroffen haben. Umarmung, Insider-Witze erfinden, alles muss stimmen. Haltet es mindestens 3 Minuten durch.',
    category: 'SOCIAL',
    difficulty: Difficulty.INSANE,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: 'default-2',
    title: 'Trinken',
    description: 'Wer erkennt die meisten Getranke mit verbundenen Augen?',
    category: 'DRINKING',
    difficulty: Difficulty.MEDIUM,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: 'default-3',
    title: 'Der unerwartete Lebensratgeber',
    description: 'Gehe in ein Geschaft wie Supermarkt oder Baumarkt, sprich eine fremde Person an und gib ihr ungefragt einen total abstrusen, aber ernst gemeinten Lebensrat zu einem beliebigen Produkt, das die Person gerade ansieht. Beobachte die Reaktion.',
    category: 'SOCIAL',
    difficulty: Difficulty.HARD,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: 'default-4',
    title: 'Baumfluesterer',
    description: 'Umarme einen Baum eine Minute lang. Erzaehle ihm von deinem Tag oder deinem letzten Erlebnis.',
    category: 'OUTDOOR',
    difficulty: Difficulty.EASY,
    proofType: 'VIDEO',
    completed: false
  }
];

export const CATEGORY_COLORS: Record<string, string> = {
  ["FUNandCringe"]: '#f43f5e',
  ["SPORT"]: '#f59e0b',
  ["SOCIAL"]: '#ec4899',
  ["OUTDOOR"]: '#10b981',
  ["PARTY"]: '#8b5cf6',
  ["SKILLSandCREATIVITY"]: '#a855f7',
  ["SCHOOL"]: '#3b82f6',
  ["INDOOR"]: '#64748b',
  ["DRINKING"]: '#22c55e',
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  ["EASY"]: '#4ade80',
  ["MEDIUM"]: '#facc15',
  ["HARD"]: '#f87171',
  ["INSANE"]: '#c026d3',
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  ["FUNandCringe"]: '🤪',
  ["SPORT"]: '💪',
  ["SOCIAL"]: '😳',
  ["OUTDOOR"]: '🌳',
  ["PARTY"]: '🎉',
  ["SKILLSandCREATIVITY"]: '🎨',
  ["SCHOOL"]: '📚',
  ["INDOOR"]: '🏠',
  ["DRINKING"]: '🍺',
};
