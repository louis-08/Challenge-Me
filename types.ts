export enum MilestoneCategory {
  FUNandCringe = 'Fun & Cringe',
  SPORT = 'Sport',
  SOCIAL = 'Social',
  OUTDOOR = 'Outdoor',
  PARTY = 'Party',
  SKILLSandCREATIVITY = 'Skills & Kreativität',
  SCHOOL = 'Schule',
  INDOOR = 'Indoor',
  DRINKING = 'Trinkspiele'
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

export interface VotingComment {
  userId: string;
  text: string;
  timestamp: string;
}

export interface ChallengeSubmission {
  userId: string;
  media: MediaItem[];
  comment: string;
  timestamp: string;
  ratings: { voterId: string, score: number }[];
  comments?: VotingComment[];
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