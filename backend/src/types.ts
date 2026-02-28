// Shared types mirrored from the frontend types.ts
export interface Milestone {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  proofType: 'PHOTO' | 'VIDEO' | 'TEXT';
  completed: boolean;
  completedDate?: string;
  isAiGenerated?: boolean;
  proofImage?: string;
  verificationFeedback?: string;
}

export type ChallengeStatus = 'ACTIVE' | 'VOTING' | 'COMPLETED';

export interface MediaItem {
  type: 'IMAGE' | 'VIDEO';
  url: string;
}

export interface ChallengeSubmission {
  userId: string;
  media: MediaItem[];
  comment: string;
  timestamp: string;
  ratings: { voterId: string; score: number }[];
}

export interface GroupChallenge {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: ChallengeStatus;
  submissions: ChallengeSubmission[];
  winnerId?: string;
  difficulty?: string;
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
