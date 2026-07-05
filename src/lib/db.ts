import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, "app.db"));
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('revenue','expense')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS custodies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_amount REAL,
      amount REAL,
      request_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','open','pending_close','closed','rejected')),
      close_token TEXT NOT NULL UNIQUE,
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      disbursed_at TEXT,
      closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custody_id INTEGER NOT NULL REFERENCES custodies(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return _db;
}

export function getSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

/** رمز رابط طلب العهدة العام — ينشأ مرة واحدة ويبقى ثابتًا */
export function getRequestToken(): string {
  let token = getSetting("request_token");
  if (!token) {
    token = crypto.randomBytes(12).toString("hex");
    setSetting("request_token", token);
  }
  return token;
}

export type Transaction = {
  id: number;
  type: "revenue" | "expense";
  amount: number;
  description: string;
  category: string;
  date: string;
  created_at: string;
};

export type CustodyStatus = "pending" | "open" | "pending_close" | "closed" | "rejected";

export type Custody = {
  id: number;
  name: string;
  phone: string;
  reason: string;
  requested_amount: number | null;
  amount: number | null;
  request_date: string;
  status: CustodyStatus;
  close_token: string;
  admin_notes: string;
  created_at: string;
  disbursed_at: string | null;
  closed_at: string | null;
};

export type Invoice = {
  id: number;
  custody_id: number;
  description: string;
  amount: number;
  file_name: string;
  file_path: string;
  created_at: string;
};

export function newCloseToken(): string {
  return crypto.randomBytes(12).toString("hex");
}
