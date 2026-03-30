import { User, Group, Milestone, MediaItem } from '../types';
import { INITIAL_MILESTONES } from '../constants';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let currentCsrfToken: string = '';

export async function fetchCsrfToken() {
  if (currentCsrfToken) return currentCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/csrf`, { credentials: 'include' });
    const data = await res.json();
    if (data.csrfToken) {
      currentCsrfToken = data.csrfToken;
    }
  } catch (e) {
    console.error('Failed to fetch initial CSRF token', e);
  }
  return currentCsrfToken;
}

export function getCsrfToken(): string {
  return currentCsrfToken;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method ?? 'GET').toUpperCase()
  );
  
  if (isMutating && !getCsrfToken()) {
    await fetchCsrfToken(); // Block until token is fetched
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly cookie with every request
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? { 'x-csrf-token': getCsrfToken() } : {}),
      ...options.headers
    }
  });

  // Intercept the token from the response header if provided
  const headerToken = res.headers.get('x-csrf-token');
  if (headerToken) {
    currentCsrfToken = headerToken;
  }

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

export const uploadAvatar = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await fetch(`${API_BASE}/users/me/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': getCsrfToken() },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return (data as { avatar: string }).avatar;
};

export const updateProfile = async (data: { username?: string; password?: string; avatar?: string }): Promise<User> => {
  return apiFetch<User>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
};

export const deleteAccount = async (): Promise<void> => {
  await apiFetch('/users/me', { method: 'DELETE' });
};

// --- Friends ---

export interface FriendRequest {
  id: string;
  from_user_id: string;
  created_at: string;
  username: string;
  avatar: string;
}

export const sendFriendRequest = async (friendUsername: string): Promise<void> => {
  await apiFetch('/users/me/friend-requests', {
    method: 'POST',
    body: JSON.stringify({ username: friendUsername })
  });
};

export const getFriendRequests = async (): Promise<FriendRequest[]> => {
  return apiFetch<FriendRequest[]>('/users/me/friend-requests');
};

export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  await apiFetch(`/users/me/friend-requests/${requestId}/accept`, { method: 'POST' });
};

export const declineFriendRequest = async (requestId: string): Promise<void> => {
  await apiFetch(`/users/me/friend-requests/${requestId}/decline`, { method: 'POST' });
};

// Keep for backward compatibility
export const addFriend = async (_currentUserId: string, friendUsername: string): Promise<void> => {
  await sendFriendRequest(friendUsername);
};

export const getUserFriends = async (_userId: string): Promise<User[]> => {
  return apiFetch<User[]>('/users/me/friends');
};

export const removeFriend = async (friendId: string): Promise<void> => {
  await apiFetch(`/users/me/friends/${friendId}`, { method: 'DELETE' });
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

export const deleteGroup = async (groupId: string): Promise<void> => {
  await apiFetch(`/groups/${groupId}`, { method: 'DELETE' });
};

export const getGroup = async (groupId: string): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}`);
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

export const addSubmissionComment = async (groupId: string, targetUserId: string, text: string): Promise<Group> => {
  return apiFetch<Group>(`/groups/${groupId}/challenge/comment`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, text })
  });
};

// Keep for backward compatibility – not used anymore but exported to avoid import errors
export { INITIAL_MILESTONES };
