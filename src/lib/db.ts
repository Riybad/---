import fs from "fs";
import crypto from "crypto";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");

type Row = Record<string, unknown>;
interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'صفحة',
    memo_unit TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT '',
    mastery TEXT NOT NULL DEFAULT '',
    memo_total INTEGER NOT NULL DEFAULT 0,
    expl_total INTEGER NOT NULL DEFAULT 0,
    expl_label TEXT NOT NULL DEFAULT 'شرح',
    has_memo BOOLEAN NOT NULL DEFAULT TRUE,
    has_expl BOOLEAN NOT NULL DEFAULT TRUE,
    track TEXT NOT NULL DEFAULT 'tarbawi',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
  );
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS expl_label TEXT NOT NULL DEFAULT 'شرح';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS memo_total INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS expl_total INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS recitation_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS recitation_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS sharh_name TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS sharh_book_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS sharh_video_url TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'tarbawi';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS memo_unit TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS mastery TEXT NOT NULL DEFAULT '';
  CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    cadence TEXT NOT NULL DEFAULT 'weekly',
    track TEXT NOT NULL DEFAULT 'tarbawi',
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
    start_session INTEGER NOT NULL DEFAULT 0,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    done_at TIMESTAMPTZ
  );
  ALTER TABLE students ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'weekly';
  ALTER TABLE students ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'tarbawi';
  CREATE INDEX IF NOT EXISTS courses_track_idx ON courses (track);
  CREATE INDEX IF NOT EXISTS students_track_idx ON students (track);
  ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;
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
  await seedIlmiCourses(client);
  await seedResources(client);
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

/**
 * مقررات «نواة العلم» — الدرجة الأولى (درجة التسهيل) لمسار النخب العلمية.
 * [الاسم، الفرع، النوع، معيار الضبط، صفحات القراءة، أسطر الحفظ]
 * الحفظ بالأسطر والقراءة بالصفحات، ولذلك للمقرر وحدتان.
 */
const ILMI_COURSES: [string, string, string, string, number, number][] = [
  ["فضل العلم", "شرف العلم", "نثر + نظم", "حفظ", 2, 20],
  ["فضل علم السلف لابن رجب", "شرف العلم", "كتاب", "ملخص", 90, 0],
  ["ملخص شرف أهل الحديث للخطيب البغدادي", "شرف العلم", "كتاب", "اختبار", 150, 0],
  ["أدب الطلب", "أدب الطلب", "نثر", "حفظ", 3, 30],
  ["تذكرة العالم والمتعلم لابن جماعة", "أدب الطلب", "كتاب", "ملخص", 115, 0],
  ["ملخص من نيل الأمل في أدب الطلب للشوكاني", "أدب الطلب", "كتاب", "اختبار", 130, 0],
  ["تأصيل الطلاب", "منهج الطالب", "نظم", "حفظ", 1, 20],
  ["تعليم المتعلم للزركشي", "منهج الطالب", "كتاب", "ملخص", 110, 0],
  ["ملخص من المدخل لابن بدران", "منهج الطالب", "كتاب", "اختبار", 110, 0],
  ["وصايا للطالب", "موجب الطلب", "نظم", "حفظ", 2, 40],
  ["لامية ابن الوردي", "موجب الطلب", "كتاب", "ملخص", 5, 80],
  ["ملخص من مفتاح دار السعادة لابن القيم", "موجب الطلب", "كتاب", "اختبار", 100, 0],
];

/**
 * تُزرع مقررات النخب العلمية مرة واحدة: إن كان المسار بلا مقرر أصلًا.
 * فحذف مقرر أو تعديله لا يُعيده، وإنما إفراغ المسار كلّه.
 */
async function seedIlmiCourses(client: QueryClient): Promise<void> {
  const rows = (await client.query("SELECT COUNT(*)::int AS n FROM courses WHERE track = 'ilmi'"))
    .rows;
  if (Number(rows[0]?.n ?? 0) > 0) return;

  const max = (await client.query("SELECT COALESCE(MAX(sort_order), -1)::int AS m FROM courses"))
    .rows;
  let order = Number(max[0]?.m ?? -1) + 1;
  for (const [name, subject, kind, mastery, read, memoLines] of ILMI_COURSES) {
    await client.query(
      `INSERT INTO courses
         (name, subject, unit, memo_unit, memo_total, expl_total, expl_label,
          has_memo, has_expl, kind, mastery, track, sort_order)
       VALUES ($1, $2, 'صفحة', 'سطر', $3, $4, 'قراءة', $5, $6, $7, $8, 'ilmi', $9)`,
      [name, subject, memoLines, read, memoLines > 0, read > 0, kind, mastery, order++]
    );
  }
}

/**
 * الشروح المعتمدة كما في ورقة «المتون»: [الشارح، رابط القرائي، رابط السماعي]
 * تُملأ للمقرر الذي لم يُملأ له شرح بعد — فلا تطمس ما عدّله المشرف.
 * القرآن سؤال وجواب بلا شرح عمدًا، والتاريخ قرائي فقط (الموسوعة الميسرة).
 */
const COURSE_RESOURCES: Record<string, [string, string, string]> = {
  "سلم الوصول": [
    "شرح الشيخ عبدالرزاق البدر",
    "https://www.noor-book.com/%D9%83%D8%AA%D8%A7%D8%A8-%D8%AA%D9%81%D8%B1%D9%8A%D8%BA-%D8%B4%D8%B1%D8%AD-%D9%85%D9%86%D8%B8%D9%88%D9%85%D9%87-%D8%B3%D9%84%D9%85-%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84-%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B1%D8%B2%D8%A7%D9%82-%D8%A7%D9%84%D8%A8%D8%AF%D8%B1-pdf",
    "https://youtube.com/playlist?list=PLXuY2YL-v4n8Qhu4pSgUMdBzrdTKfLhbE&si=AxfgAdbC2LH2fcq1",
  ],
  "أخصر المختصرات": [
    "شرح الشيخ عبدالسلام الشويعر",
    "https://ia600506.us.archive.org/15/items/Sharh_Akhsar_Mokhtasarat_1437H/Sharh_Akhsar_Mokhtasarat.pdf",
    "https://youtube.com/playlist?list=PLl9thoP_s9vWvtIPQ_h0eCGPmOLP3-N_O&si=9wRZ1IRkFqgz2dfk",
  ],
  "نظم الآجرومية": [
    "شرح الشيخ سليمان العيوني",
    "https://archive.org/details/hjiggggg_gmail_20180729_1454",
    "https://youtube.com/playlist?list=PL54tsaxKeZjP3ZXGyP3HpgPY3b4SqNrI_&si=mMszoNZwjnoj57rT",
  ],
  "موسوعة التاريخ الإسلامي": [
    "الموسوعة الميسرة",
    "https://archive.org/details/20220418_20220418_1227",
    "",
  ],
};

async function seedResources(client: QueryClient): Promise<void> {
  const entries = Object.entries(COURSE_RESOURCES);
  const values = entries
    .map((_, i) => `($${i * 4 + 1}::text, $${i * 4 + 2}::text, $${i * 4 + 3}::text, $${i * 4 + 4}::text)`)
    .join(", ");
  await client.query(
    `UPDATE courses AS c
       SET sharh_name = v.sharh_name, sharh_book_url = v.book, sharh_video_url = v.video
       FROM (VALUES ${values}) AS v(name, sharh_name, book, video)
      WHERE c.name = v.name
        AND c.sharh_name = '' AND c.sharh_book_url = '' AND c.sharh_video_url = ''`,
    entries.flatMap(([name, [sName, sBook, sVideo]]) => [name, sName, sBook, sVideo])
  );
}

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

export type Student = {
  id: number;
  name: string;
  phone: string;
  stage: string;
  notes: string;
  /** وحدة التقسيم التي اختارها الطالب: daily | weekly | monthly */
  cadence: string;
  /** مساره: tarbawi | ilmi */
  track: string;
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
  /** هل أنهى الطالب هذا المقرر — يسجّله المشرف */
  done: boolean;
  done_at: Date | null;
};

/** رمز الرابط الخاص بخطة الطالب */
export function newPlanToken(): string {
  return crypto.randomBytes(9).toString("hex");
}
