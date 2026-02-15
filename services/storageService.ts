import { User, Group, Milestone, GroupChallenge, ChallengeSubmission, MediaItem } from '../types';
import { INITIAL_MILESTONES } from '../constants';

const USERS_KEY = 'lebensweg_users';
const GROUPS_KEY = 'lebensweg_groups';
const CURRENT_USER_ID_KEY = 'lebensweg_current_user_id';

// Helper to simulate DB delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const generateId = () => Math.random().toString(36).substr(2, 9);
const generateGroupCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();

// --- Auth & User ---

export const registerUser = async (username: string, password: string): Promise<User> => {
  await delay(500);
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];

  if (users.find(u => u.username === username)) {
    throw new Error('Benutzername bereits vergeben.');
  }

  const newUser: User = {
    id: generateId(),
    username,
    password, 
    milestones: [...INITIAL_MILESTONES], 
    groupIds: [],
    friendIds: [],
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
  
  return newUser;
};

export const loginUser = async (username: string, password: string): Promise<User> => {
  await delay(500);
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];

  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    throw new Error('Ungültige Anmeldedaten.');
  }

  localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_ID_KEY);
};

export const getCurrentSessionUser = (): User | null => {
  const userId = localStorage.getItem(CURRENT_USER_ID_KEY);
  if (!userId) return null;

  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  return users.find(u => u.id === userId) || null;
};

export const getUserById = (userId: string): User | undefined => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  return users.find(u => u.id === userId);
};

export const updateUserMilestones = (userId: string, milestones: Milestone[]) => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  const updatedUsers = users.map(u => {
    if (u.id === userId) {
      return { ...u, milestones };
    }
    return u;
  });

  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
};

// --- Friends Logic ---

export const addFriend = async (currentUserId: string, friendUsername: string): Promise<User> => {
  await delay(300);
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  const currentUserIndex = users.findIndex(u => u.id === currentUserId);
  const friendUser = users.find(u => u.username === friendUsername);

  if (currentUserIndex === -1) throw new Error("Session Error");
  if (!friendUser) throw new Error("Benutzer nicht gefunden.");
  if (friendUser.id === currentUserId) throw new Error("Du kannst dich nicht selbst hinzufügen.");
  if (users[currentUserIndex].friendIds.includes(friendUser.id)) throw new Error("Bereits befreundet.");

  users[currentUserIndex].friendIds.push(friendUser.id);
  
  // Optional: Two-way friendship for simplicity in this demo
  const friendIndex = users.findIndex(u => u.id === friendUser.id);
  if (friendIndex !== -1 && !users[friendIndex].friendIds.includes(currentUserId)) {
      users[friendIndex].friendIds.push(currentUserId);
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users[currentUserIndex];
};

export const getUserFriends = (userId: string): User[] => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  const currentUser = users.find(u => u.id === userId);
  
  if (!currentUser) return [];
  return users.filter(u => currentUser.friendIds.includes(u.id));
};

// --- Groups ---

export const createGroup = async (userId: string, groupName: string, initialMemberIds: string[] = []): Promise<Group> => {
  await delay(400);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];

  const allMembers = [userId, ...initialMemberIds];

  const newGroup: Group = {
    id: generateId(),
    name: groupName,
    code: generateGroupCode(),
    memberIds: [...new Set(allMembers)], // unique
    description: 'Eine Gruppe für gemeinsame Abenteuer.',
    pastChallenges: []
  };

  groups.push(newGroup);
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

  // Update users' group lists
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  const updatedUsers = users.map(u => {
    if (allMembers.includes(u.id)) {
      return { ...u, groupIds: [...u.groupIds, newGroup.id] };
    }
    return u;
  });
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));

  return newGroup;
};

export const joinGroup = async (userId: string, code: string): Promise<Group> => {
  await delay(400);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];

  const groupIndex = groups.findIndex(g => g.code === code);
  if (groupIndex === -1) throw new Error('Gruppe nicht gefunden.');

  const group = groups[groupIndex];
  if (group.memberIds.includes(userId)) throw new Error('Du bist bereits in dieser Gruppe.');

  group.memberIds.push(userId);
  groups[groupIndex] = group;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

  // Update user
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  const updatedUsers = users.map(u => {
    if (u.id === userId) {
      return { ...u, groupIds: [...u.groupIds, group.id] };
    }
    return u;
  });
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));

  return group;
};

export const getUserGroups = (userId: string): Group[] => {
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  return groups.filter(g => g.memberIds.includes(userId));
};

// --- Challenge Logic ---

export const startGroupChallenge = async (groupId: string, title: string, description: string, durationMinutes: number): Promise<Group> => {
  await delay(300);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  
  const groupIndex = groups.findIndex(g => g.id === groupId);
  if (groupIndex === -1) throw new Error("Group not found");

  const deadline = new Date();
  deadline.setMinutes(deadline.getMinutes() + durationMinutes);

  const newChallenge: GroupChallenge = {
    id: generateId(),
    title,
    description,
    deadline: deadline.toISOString(),
    status: 'ACTIVE',
    submissions: []
  };

  groups[groupIndex].activeChallenge = newChallenge;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups[groupIndex];
};

export const submitChallengeProof = async (groupId: string, userId: string, media: MediaItem[], comment: string): Promise<Group> => {
  await delay(300);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  
  const groupIndex = groups.findIndex(g => g.id === groupId);
  if (groupIndex === -1) throw new Error("Group not found");
  
  const challenge = groups[groupIndex].activeChallenge;
  if (!challenge || challenge.status !== 'ACTIVE') throw new Error("No active challenge");

  // Check if already submitted
  const existingSubIndex = challenge.submissions.findIndex(s => s.userId === userId);
  const submission: ChallengeSubmission = {
    userId,
    media,
    comment,
    timestamp: new Date().toISOString(),
    ratings: []
  };

  if (existingSubIndex >= 0) {
    challenge.submissions[existingSubIndex] = submission;
  } else {
    challenge.submissions.push(submission);
  }

  // AUTO-TRANSITION: If everyone has submitted, start voting immediately
  const group = groups[groupIndex];
  if (challenge.submissions.length >= group.memberIds.length) {
    challenge.status = 'VOTING';
  }

  groups[groupIndex].activeChallenge = challenge;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups[groupIndex];
};

export const transitionToVoting = async (groupId: string): Promise<Group> => {
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  const groupIndex = groups.findIndex(g => g.id === groupId);
  
  if (groupIndex === -1 || !groups[groupIndex].activeChallenge) throw new Error("Action failed");
  
  groups[groupIndex].activeChallenge!.status = 'VOTING';
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups[groupIndex];
};

export const rateSubmission = async (groupId: string, voterId: string, targetUserId: string, score: number): Promise<Group> => {
  await delay(100);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  const groupIndex = groups.findIndex(g => g.id === groupId);
  
  const challenge = groups[groupIndex].activeChallenge;
  if (!challenge || challenge.status !== 'VOTING') throw new Error("Voting not active");

  const subIndex = challenge.submissions.findIndex(s => s.userId === targetUserId);
  if (subIndex === -1) throw new Error("Submission not found");

  // Update or add vote
  const existingVoteIndex = challenge.submissions[subIndex].ratings.findIndex(r => r.voterId === voterId);
  if (existingVoteIndex >= 0) {
    challenge.submissions[subIndex].ratings[existingVoteIndex].score = score;
  } else {
    challenge.submissions[subIndex].ratings.push({ voterId, score });
  }

  groups[groupIndex].activeChallenge = challenge;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups[groupIndex];
};

export const finishChallenge = async (groupId: string): Promise<Group> => {
  await delay(500);
  const groupsStr = localStorage.getItem(GROUPS_KEY);
  const groups: Group[] = groupsStr ? JSON.parse(groupsStr) : [];
  const groupIndex = groups.findIndex(g => g.id === groupId);
  
  const challenge = groups[groupIndex].activeChallenge;
  if (!challenge) throw new Error("No challenge");

  // Calculate winner
  let winnerId = undefined;
  let maxScore = -1;

  challenge.submissions.forEach(sub => {
    const total = sub.ratings.reduce((sum, r) => sum + r.score, 0);
    const avg = sub.ratings.length ? total / sub.ratings.length : 0;
    if (avg > maxScore) {
      maxScore = avg;
      winnerId = sub.userId;
    }
  });

  challenge.status = 'COMPLETED';
  challenge.winnerId = winnerId;

  // Move to history
  if (!groups[groupIndex].pastChallenges) groups[groupIndex].pastChallenges = [];
  groups[groupIndex].pastChallenges.unshift(challenge);
  groups[groupIndex].activeChallenge = undefined;

  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  return groups[groupIndex];
};