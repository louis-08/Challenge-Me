import { Response } from 'express';

interface SseClient {
  userId: string;
  groupIds: Set<string>;
  res: Response;
}

const clients: SseClient[] = [];

export function addClient(userId: string, groupIds: string[], res: Response): void {
  clients.push({ userId, groupIds: new Set(groupIds), res });
}

export function removeClient(res: Response): void {
  const idx = clients.findIndex(c => c.res === res);
  if (idx !== -1) clients.splice(idx, 1);
}

export function notifyGroup(groupId: string, data: unknown): void {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client.groupIds.has(groupId)) {
      try { client.res.write(msg); } catch { /* ignore broken pipe */ }
    }
  }
}
