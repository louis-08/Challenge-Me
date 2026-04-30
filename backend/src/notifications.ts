import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { notifyUser } from './sseClients';
import { sendPushToUser } from './push';

interface NotificationPayload {
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  payload: string;
  is_read: number;
  created_at: string;
}

function toAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: JSON.parse(row.payload),
    isRead: row.is_read === 1,
    createdAt: row.created_at
  };
}

function resolveDeepLink(type: string, payload: NotificationPayload): string {
  if (type === 'CHALLENGE_INVITED' || type === 'CHALLENGE_VOTING_STARTED') {
    const groupId = typeof payload.groupId === 'string' ? payload.groupId : '';
    if (groupId) {
      return `/?tab=groups&screen=group&groupId=${encodeURIComponent(groupId)}`;
    }
  }

  if (
    type === 'FRIEND_REQUEST_RECEIVED'
    || type === 'FRIEND_REQUEST_ACCEPTED'
    || type === 'FRIEND_REQUEST_DECLINED'
  ) {
    return '/?tab=groups&screen=friends';
  }

  return '/';
}

export function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: NotificationPayload;
}): AppNotification {
  const id = uuidv4();
  const payload = input.payload ?? {};

  db.prepare(
    'INSERT INTO notifications (id, user_id, type, title, body, payload) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.userId, input.type, input.title, input.body, JSON.stringify(payload));

  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRow;
  const notification = toAppNotification(row);

  notifyUser(input.userId, {
    type: 'NOTIFICATION_CREATED',
    payload: notification,
    createdAt: new Date().toISOString()
  });

  void sendPushToUser(input.userId, {
    title: notification.title,
    body: notification.body,
    url: resolveDeepLink(notification.type, notification.payload),
    tag: notification.id
  });

  return notification;
}

export function listNotifications(userId: string, limit = 50): AppNotification[] {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as NotificationRow[];

  return rows.map(toAppNotification);
}

export function markNotificationRead(userId: string, notificationId: string): boolean {
  const result = db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(notificationId, userId);

  return result.changes > 0;
}

export function markAllNotificationsRead(userId: string): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
}
