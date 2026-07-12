import fs from "fs";
import crypto from "crypto";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

type Row = Record<string, unknown>;
interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('revenue','expense')),
    amount DOUBLE PRECISION NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS custodies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT NOT NULL,
    requested_amount DOUBLE PRECISION,
    amount DOUBLE PRECISION,
    request_date TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','open','pending_close','closed','rejected')),
    close_token TEXT NOT NULL UNIQUE,
    admin_notes TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disbursed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
  );
  ALTER TABLE custodies ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';
  CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    custody_id INTEGER NOT NULL REFERENCES custodies(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: Promise<QueryClient> | undefined;
}

async function connect(): Promise<QueryClient> {
  let client: QueryClient;
  if (process.env.DATABASE_URL) {
    // قاعدة بيانات سحابية (Neon/Supabase/أي Postgres)
    const { Pool } = await import("pg");
    client = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  } else {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL غير مضبوط — أضف قاعدة بيانات Neon من تبويب Storage في Vercel ثم أعد النشر"
      );
    }
    // تشغيل محلي بدون إعدادات — قاعدة Postgres مدمجة تُحفظ في data/pg
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    client = new PGlite(path.join(DATA_DIR, "pg")) as unknown as QueryClient;
  }
  for (const stmt of SCHEMA.split(";")) {
    if (stmt.trim()) await client.query(stmt);
  }
  return client;
}

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  // نخزن الاتصال على globalThis حتى تتشاركه كل حزم المسارات في نفس العملية
  if (!globalThis.__dbClient) globalThis.__dbClient = connect();
  const client = await globalThis.__dbClient;
  const res = await client.query(text, params);
  return res.rows;
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await q("SELECT value FROM settings WHERE key = $1", [key]);
  return (rows[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await q(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value]
  );
}

/** رمز رابط طلب العهدة العام — ينشأ مرة واحدة ويبقى ثابتًا */
export async function getRequestToken(): Promise<string> {
  let token = await getSetting("request_token");
  if (!token) {
    token = crypto.randomBytes(12).toString("hex");
    await setSetting("request_token", token);
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
  created_at: Date;
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
  stage: string;
  payment_method: string;
  status: CustodyStatus;
  close_token: string;
  admin_notes: string;
  created_at: Date;
  disbursed_at: Date | null;
  closed_at: Date | null;
};

export type Invoice = {
  id: number;
  custody_id: number;
  description: string;
  amount: number;
  file_name: string;
  file_path: string;
  created_at: Date;
};

export function newCloseToken(): string {
  return crypto.randomBytes(12).toString("hex");
}
