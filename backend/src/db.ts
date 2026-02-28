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
    active_challenge TEXT,
    past_challenges  TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
