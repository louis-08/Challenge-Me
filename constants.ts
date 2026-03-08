import { Milestone, MilestoneCategory, Difficulty } from './types';

export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: '1',
    title: 'Blind Taste Test',
    description: 'Wer erkennt die meisten Getränke mit verbundenen Augen? Loser trinkt den Rest.',
    category: MilestoneCategory.FUNandCringe,
    difficulty: Difficulty.EASY,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '2',
    title: 'Fremdsprachen-Bestellung',
    description: 'Bestelle in einem Restaurant in einer Sprache, die du kaum kannst. Video Beweis!',
    category: MilestoneCategory.SOCIAL,
    difficulty: Difficulty.HARD,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '3',
    title: 'Der 5€ Outfit Contest',
    description: 'Stell das beste Outfit zusammen, das maximal 5€ im Second Hand Laden kostet.',
    category: MilestoneCategory.FUNandCringe,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '4',
    title: 'Eisbaden',
    description: 'Geh in ein kaltes Gewässer (oder kalte Dusche) für min. 1 Minute. Wir wollen Gesichter sehen!',
    category: MilestoneCategory.OUTDOOR,
    difficulty: Difficulty.INSANE,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '5',
    title: 'Public Dancing',
    description: 'Tanze 30 Sekunden sichtbar an einem öffentlichen Ort.',
    category: MilestoneCategory.SOCIAL,
    difficulty: Difficulty.INSANE,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '6',
    title: 'Kartenhaus Battle',
    description: 'Wer baut das höchste Kartenhaus in 5 Minuten? Foto vom Endergebnis.',
    category: MilestoneCategory.SKILLSandCREATIVITY,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '7',
    title: 'Lehrer-Imitation',
    description: 'Imitiere einen Lehrer/Prof vor der Gruppe – die anderen raten wen.',
    category: MilestoneCategory.SCHOOL,
    difficulty: Difficulty.EASY,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '8',
    title: 'Uno mit Hausdurchsuchung',
    description: 'Verlierst du eine Runde, muss du ein peinliches Foto aus deiner Galerie zeigen.',
    category: MilestoneCategory.PARTY,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '9',
    title: 'Socken-Jonglage',
    description: 'Wer jongliert am längsten mit 3 zusammengerollten Socken?',
    category: MilestoneCategory.INDOOR,
    difficulty: Difficulty.EASY,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '10',
    title: 'Wahrheit oder Trink',
    description: 'Klassiker: Wahrheit beantworten oder trinken. Wer lügt, trinkt doppelt.',
    category: MilestoneCategory.DRINKING,
    difficulty: Difficulty.MEDIUM,
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
  ["EASY"]: '#4ade80',    // green
  ["MEDIUM"]: '#facc15',  // yellow
  ["HARD"]: '#f87171',    // red
  ["INSANE"]: '#c026d3',  // purple
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