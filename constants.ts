import { Milestone, MilestoneCategory, Difficulty } from './types';

export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: '1',
    title: 'Der 24h Digital Detox',
    description: 'Kein Handy, kein PC, kein TV für 24 Stunden. Mach ein Foto von deinem "analogen" Setup.',
    category: MilestoneCategory.WELLNESS,
    difficulty: Difficulty.HARD,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '2',
    title: 'Blind Cooking Battle',
    description: 'Koch ein Gericht nur aus Zutaten, die du blind aus dem Schrank greifst.',
    category: MilestoneCategory.CREATIVITY,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '3',
    title: 'Fremdsprachen-Bestellung',
    description: 'Bestelle in einem Restaurant in einer Sprache, die du kaum kannst. Video Beweis!',
    category: MilestoneCategory.SKILLS,
    difficulty: Difficulty.HARD,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '4',
    title: 'Solo-Kino',
    description: 'Geh alleine ins Kino und mach ein Selfie mit dem Popcorn.',
    category: MilestoneCategory.ADVENTURE,
    difficulty: Difficulty.EASY,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '5',
    title: 'Der 5€ Outfit Contest',
    description: 'Stell das beste Outfit zusammen, das maximal 5€ im Second Hand Laden kostet.',
    category: MilestoneCategory.FUN,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '6',
    title: 'Eisbaden',
    description: 'Geh in ein kaltes Gewässer (oder kalte Dusche) für min. 1 Minute. Wir wollen Gesichter sehen!',
    category: MilestoneCategory.ADVENTURE,
    difficulty: Difficulty.INSANE,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '7',
    title: 'Street Art Hunter',
    description: 'Finde 5 verschiedene Graffiti/Street Art Werke in deiner Stadt.',
    category: MilestoneCategory.ADVENTURE,
    difficulty: Difficulty.EASY,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '8',
    title: 'Old School Brief',
    description: 'Schreib einen echten Brief und schick ein Foto vom Einwurf.',
    category: MilestoneCategory.RELATIONSHIPS,
    difficulty: Difficulty.EASY,
    proofType: 'PHOTO',
    completed: false
  },
  {
    id: '9',
    title: 'Public Dancing',
    description: 'Tanze 30 Sekunden sichtbar an einem öffentlichen Ort.',
    category: MilestoneCategory.FUN,
    difficulty: Difficulty.INSANE,
    proofType: 'VIDEO',
    completed: false
  },
  {
    id: '10',
    title: 'Der 10k Schrittmacher',
    description: 'Lauf 10.000 Schritte vor 12 Uhr mittags. Screenshot der App.',
    category: MilestoneCategory.WELLNESS,
    difficulty: Difficulty.MEDIUM,
    proofType: 'PHOTO',
    completed: false
  }
];

export const CATEGORY_COLORS: Record<string, string> = {
  [MilestoneCategory.TRAVEL]: '#3b82f6', 
  [MilestoneCategory.SKILLS]: '#8b5cf6', 
  [MilestoneCategory.CAREER]: '#64748b', 
  [MilestoneCategory.WELLNESS]: '#10b981', 
  [MilestoneCategory.ADVENTURE]: '#f59e0b', 
  [MilestoneCategory.RELATIONSHIPS]: '#ec4899', 
  [MilestoneCategory.CREATIVITY]: '#a855f7', 
  [MilestoneCategory.FINANCE]: '#22c55e', 
  [MilestoneCategory.FUN]: '#f43f5e', 
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  [Difficulty.EASY]: '#4ade80',    // green
  [Difficulty.MEDIUM]: '#facc15',  // yellow
  [Difficulty.HARD]: '#f87171',    // red
  [Difficulty.INSANE]: '#c026d3',  // purple
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  [MilestoneCategory.TRAVEL]: '✈️',
  [MilestoneCategory.SKILLS]: '🧠',
  [MilestoneCategory.CAREER]: '💼',
  [MilestoneCategory.WELLNESS]: '🌿',
  [MilestoneCategory.ADVENTURE]: '🌋',
  [MilestoneCategory.RELATIONSHIPS]: '❤️',
  [MilestoneCategory.CREATIVITY]: '🎨',
  [MilestoneCategory.FINANCE]: '💰',
  [MilestoneCategory.FUN]: '🤪',
};