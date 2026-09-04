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
  CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'صفحة',
    memo_total INTEGER NOT NULL DEFAULT 0,
    expl_total INTEGER NOT NULL DEFAULT 0,
    expl_label TEXT NOT NULL DEFAULT 'شرح',
    has_memo BOOLEAN NOT NULL DEFAULT TRUE,
    has_expl BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
  );
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS expl_label TEXT NOT NULL DEFAULT 'شرح';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS memo_total INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS expl_total INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS plan_items (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    ord INTEGER NOT NULL DEFAULT 0,
    memo_per INTEGER NOT NULL DEFAULT 0,
    expl_per INTEGER NOT NULL DEFAULT 0,
    start_session INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS plan_items_student_idx ON plan_items (student_id);
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
  await seedCourses(client);
  return client;
}

/**
 * المقررات الخمسة كما في ملف «تفصيل مقررات الخطة الأساسية».
 * [الاسم، الفن، الوحدة، حجم الحفظ، حجم المسار الثاني، مسمّى المسار الثاني]
 * حجم الحفظ صفر يعني أن المقرر بلا حفظ، والعكس بالعكس.
 */
const DEFAULT_COURSES: [string, string, string, number, number, string][] = [
  ["سلم الوصول", "العقيدة", "بيت", 290, 290, "شرح"],
  ["أخصر المختصرات", "الفقه", "صفحة", 299, 299, "شرح"],
  ["نظم الآجرومية", "اللغة", "بيت", 154, 154, "شرح"],
  ["القرآن سؤال وجواب", "علوم القرآن", "صفحة", 200, 200, "قراءة"],
  ["موسوعة التاريخ الإسلامي", "التاريخ", "صفحة", 30, 750, "قراءة"],
];

async function seedCourses(client: QueryClient): Promise<void> {
  const rows = (await client.query("SELECT COUNT(*)::int AS n FROM courses")).rows;
  if (Number(rows[0]?.n ?? 0) > 0) return;
  for (let i = 0; i < DEFAULT_COURSES.length; i++) {
    const [name, subject, unit, memoTotal, explTotal, explLabel] = DEFAULT_COURSES[i];
    await client.query(
      `INSERT INTO courses
         (name, subject, unit, memo_total, expl_total, expl_label, has_memo, has_expl, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [name, subject, unit, memoTotal, explTotal, explLabel, memoTotal > 0, explTotal > 0, i]
    );
  }
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

export type Student = {
  id: number;
  name: string;
  phone: string;
  stage: string;
  notes: string;
  token: string;
  created_at: Date;
  updated_at: Date;
};

export type PlanItem = {
  id: number;
  student_id: number;
  course_id: number;
  ord: number;
  memo_per: number;
  expl_per: number;
  start_session: number;
};

/** رمز الرابط الخاص بخطة الطالب */
export function newPlanToken(): string {
  return crypto.randomBytes(9).toString("hex");
}
