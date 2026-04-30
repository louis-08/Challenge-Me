import { v4 as uuidv4 } from 'uuid';
import * as webpush from 'web-push';
import db from './db';

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface BrowserPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:challenge-me@example.com';

let pushEnabled = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
}

console.log(`Push notifications ${pushEnabled ? 'enabled' : 'disabled'}`);

export function isPushEnabled(): boolean {
  return pushEnabled;
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

export function upsertPushSubscription(userId: string, subscription: BrowserPushSubscription): void {
  const existing = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?'
    ).run(userId, subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint);
    return;
  }

  db.prepare(
    'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
}

export function removePushSubscription(userId: string, endpoint: string): void {
  db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url: string; tag: string }): Promise<void> {
  if (!isPushEnabled()) return;
    console.log(`Sending push to user ${userId}: ${payload.title}`);
  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as PushSubscriptionRow[];
  if (rows.length === 0) return;

  const message = JSON.stringify(payload);

  await Promise.all(rows.map(async (row) => {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    };

    try {
      await webpush.sendNotification(subscription, message);
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint);
      }
    }
  }));
}
