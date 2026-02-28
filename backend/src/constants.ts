import { Milestone } from './types';

// Seed challenges shown to new users
export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: '1', title: 'Der 24h Digital Detox',
    description: 'Kein Handy, kein PC, kein TV für 24 Stunden. Mach ein Foto von deinem "analogen" Setup.',
    category: 'Gesundheit', difficulty: 'Hard', proofType: 'PHOTO', completed: false
  },
  {
    id: '2', title: 'Blind Cooking Battle',
    description: 'Koch ein Gericht nur aus Zutaten, die du blind aus dem Schrank greifst.',
    category: 'Kreativität', difficulty: 'Medium', proofType: 'PHOTO', completed: false
  },
  {
    id: '3', title: 'Fremdsprachen-Bestellung',
    description: 'Bestelle in einem Restaurant in einer Sprache, die du kaum kannst. Video Beweis!',
    category: 'Skills', difficulty: 'Hard', proofType: 'VIDEO', completed: false
  },
  {
    id: '4', title: 'Solo-Kino',
    description: 'Geh alleine ins Kino und mach ein Selfie mit dem Popcorn.',
    category: 'Abenteuer', difficulty: 'Easy', proofType: 'PHOTO', completed: false
  },
  {
    id: '5', title: 'Der 5€ Outfit Contest',
    description: 'Stell das beste Outfit zusammen, das maximal 5€ im Second Hand Laden kostet.',
    category: 'Fun & Cringe', difficulty: 'Medium', proofType: 'PHOTO', completed: false
  }
];
