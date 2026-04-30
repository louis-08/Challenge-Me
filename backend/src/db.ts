import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'challenge-me.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    avatar      TEXT NOT NULL,
    milestones  TEXT NOT NULL DEFAULT '[]',
    group_ids   TEXT NOT NULL DEFAULT '[]',
    friend_ids  TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    code             TEXT UNIQUE NOT NULL,
    member_ids       TEXT NOT NULL DEFAULT '[]',
    description      TEXT NOT NULL DEFAULT '',
    avatar           TEXT NOT NULL DEFAULT '',
    active_challenge TEXT,
    past_challenges  TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id            TEXT PRIMARY KEY,
    from_user_id  TEXT NOT NULL,
    to_user_id    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'PENDING',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    payload     TEXT NOT NULL DEFAULT '{}',
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

// Backward-compatible migrations for already initialized databases.
if (!hasColumn('groups', 'avatar')) {
  db.exec("ALTER TABLE groups ADD COLUMN avatar TEXT NOT NULL DEFAULT ''");
}

if (!hasColumn('users', 'friend_ids')) {
  db.exec(`ALTER TABLE users ADD COLUMN friend_ids TEXT NOT NULL DEFAULT '[]'`);
}

if (!hasColumn('friend_requests', 'status')) {
  db.exec(`ALTER TABLE friend_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'`);
}

if (!hasColumn('friend_requests', 'updated_at')) {
  db.exec(`ALTER TABLE friend_requests ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`);
}

db.exec('CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status)');
db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)');


export default db;
