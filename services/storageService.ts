import { User, Group, Milestone, MediaItem } from '../types';
import { INITIAL_MILESTONES } from '../constants';

const API_BASE = import.meta.env.VITE_API_URL || 'https://crispy-space-trout-wxgxrx7wrx7cgr6g-3001.app.github.dev';

function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf='))
    ?.split('=')[1] ?? '';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method ?? 'GET').toUpperCase()
  );
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly cookie with every request
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? { 'X-CSRF-Token': getCsrfToken() } : {}),
      ...options.headers
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

// --- Auth & User ---

export const registerUser = async (username: string, password: string): Promise<User> => {
  return apiFetch<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
};

export const loginUser = async (username: string, password: string): Promise<User> => {
  return apiFetch<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
};

export const logoutUser = async (): Promise<void> => {
  await apiFetch('/auth/logout', { method: 'POST' });
};

export const getCurrentSessionUser = async (): Promise<User | null> => {
  try {
    return await apiFetch<User>('/auth/me');
  } catch {
    return null;
  }
};

export const getUserById = async (userId: string): Promise<User | undefined> => {
  try {
    return await apiFetch<User>(`/users/${userId}`);
  } catch {
    return undefined;
  }
};

export const updateUserMilestones = async (_userId: string, milestones: Milestone[]): Promise<void> => {
  await apiFetch('/users/me/milestones', {
    method: 'PUT',
    body: JSON.stringify({ milestones })
  });
};

// --- Friends ---

export const addFriend = async (_currentUserId: string, friendUsername: string): Promise<User> => {
  return apiFetch<User>('/users/me/friends', {
    method: 'POST',
    body: JSON.stringify({ username: friendUsername })
  });
};

export const getUserFriends = async (_userId: string): Promise<User[]> => {
  return apiFetch<User[]>('/users/me/friends');
};

// --- Groups ---

export const createGroup = async (_userId: string, groupName: string, initialMemberIds: string[] = []): Promise<Group> => {
  return apiFetch<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name: groupName, memberIds: initialMemberIds })
  });
};

export const joinGroup = async (_userId: string, code: string): Promise<Group> => {
  return apiFetch<Group>('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ code })
  });
};

export const getUserGroups = async (_userId: string): Promise<Group[]> => {
  return apiFetch<Group[]>('/groups/mine');
};

// --- Challenge Logic ---

export const startGroupChallenge = async (groupId: string, title: string, description: string, durationMinutes: number): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge`, {
    method: 'POST',
    body: JSON.stringify({ title, description, durationMinutes })
  });
};

export const submitChallengeProof = async (groupId: string, _userId: string, media: MediaItem[], comment: string): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge/submit`, {
    method: 'POST',
    body: JSON.stringify({ media, comment })
  });
};

export const transitionToVoting = async (groupId: string): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge/vote`, { method: 'POST' });
};

export const rateSubmission = async (groupId: string, _voterId: string, targetUserId: string, score: number): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge/rate`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, score })
  });
};

export const finishChallenge = async (groupId: string): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge/finish`, { method: 'POST' });
};

// Keep for backward compatibility – not used anymore but exported to avoid import errors
export { INITIAL_MILESTONES };
