export enum MilestoneCategory {
  TRAVEL = 'Reisen',
  SKILLS = 'Skills',
  CAREER = 'Karriere',
  WELLNESS = 'Gesundheit',
  ADVENTURE = 'Abenteuer',
  RELATIONSHIPS = 'Social',
  CREATIVITY = 'Kreativität',
  FINANCE = 'Geld',
  FUN = 'Fun & Cringe'
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
  INSANE = 'Insane'
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory | string;
  difficulty: Difficulty;
  proofType: 'PHOTO' | 'VIDEO' | 'TEXT';
  completed: boolean; 
  completedDate?: string;
  isAiGenerated?: boolean;
  proofImage?: string;
  verificationFeedback?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; 
  milestones: Milestone[];
  groupIds: string[];
  friendIds: string[]; // New: List of friend IDs
  avatar?: string;
}

export type ChallengeStatus = 'ACTIVE' | 'VOTING' | 'COMPLETED';

export interface MediaItem {
  type: 'IMAGE' | 'VIDEO';
  url: string;
}

export interface ChallengeSubmission {
  userId: string;
  media: MediaItem[]; // New: Supports multiple images/videos
  comment: string;
  timestamp: string;
  ratings: { voterId: string, score: number }[]; 
}

export interface GroupChallenge {
  id: string;
  title: string;
  description: string;
  deadline: string; 
  status: ChallengeStatus;
  submissions: ChallengeSubmission[];
  winnerId?: string;
  difficulty?: Difficulty;
}

export interface Group {
  id: string;
  name: string;
  code: string; 
  memberIds: string[];
  description: string;
  activeChallenge?: GroupChallenge;
  pastChallenges: GroupChallenge[];
}

export interface ChartData {
  name: string;
  value: number;
  fill: string;
}