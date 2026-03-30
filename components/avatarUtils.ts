import { API_BASE } from '../services/storageService';

export const resolveAvatarUrl = (url?: string) => {
  if (!url) return '';
  return url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;
};
