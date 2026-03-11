import { Milestone } from '../types';
import { getCsrfTokenValue } from './storageService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const generateCreativeMilestones = async (
  category: string | 'MIX', 
  difficulty: string | 'ALL',
  additionalInfo: string,
  count: number = 3
): Promise<Milestone[]> => {
  try {
    const res = await fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfTokenValue()
      },
      body: JSON.stringify({
        category,
        difficulty,
        additionalInfo,
        count
      })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Fehler beim Generieren');
    }

    return await res.json();
  } catch (error) {
    console.error("Error generating milestones:", error);
    return [];
  }
};

export const verifyMilestoneProof = async (
  title: string,
  description: string,
  base64Image: string
): Promise<{ verified: boolean; feedback: string }> => {
  try {
    const res = await fetch(`${API_BASE}/ai/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfTokenValue()
      },
      body: JSON.stringify({
        title,
        description,
        base64Image
      })
    });

    if (!res.ok) {
      return { verified: false, feedback: "Fehler bei der Überprüfung." };
    }

    return await res.json();
  } catch (error) {
    console.error("Error verifying proof:", error);
    return { verified: false, feedback: "Fehler bei der Überprüfung." };
  }
};