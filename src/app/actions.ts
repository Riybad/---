"use server";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import {
  adminPassword,
  createSession,
  destroySession,
  requireAdmin,
} from "@/lib/auth";
import { db, getRequestToken, newCloseToken, UPLOADS_DIR, type Custody } from "@/lib/db";
import { composeHijri, STAGES } from "@/lib/hijri";

// ---------- الدخول والخروج ----------

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const expected = adminPassword();
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return "كلمة المرور غير صحيحة";
  }
  await createSession();
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- الحركات المالية ----------

export async function addTransaction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type"));
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const date = String(formData.get("date") ?? "").slice(0, 10);
  if (!["revenue", "expense"].includes(type) || !(amount > 0) || !description || !date) return;
  db()
    .prepare(
      "INSERT INTO transactions (type, amount, description, category, date) VALUES (?, ?, ?, ?, ?)"
    )
    .run(type, amount, description, category, date);
  revalidatePath("/", "layout");
}

export async function deleteTransaction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  db().prepare("DELETE FROM transactions WHERE id = ?").run(id);
  revalidatePath("/", "layout");
}

/** استيراد من إكسل — الأعمدة: التاريخ، النوع (إيراد/مصروف)، الوصف، التصنيف، المبلغ */
export async function importExcel(
  _prev: { ok: number; skipped: number } | null,
  formData: FormData
): Promise<{ ok: number; skipped: number }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: 0, skipped: 0 };
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false });

  const pick = (row: Record<string, unknown>, keys: string[]): string => {
    for (const k of Object.keys(row)) {
      const norm = k.trim();
      if (keys.includes(norm)) return String(row[k] ?? "").trim();
    }
    return "";
  };

  const insert = db().prepare(
    "INSERT INTO transactions (type, amount, description, category, date) VALUES (?, ?, ?, ?, ?)"
  );
  let ok = 0;
  let skipped = 0;
  const tx = db().transaction(() => {
    for (const row of rows) {
      const typeRaw = pick(row, ["النوع", "type", "Type"]);
      const type = /إيراد|ايراد|revenue|income/i.test(typeRaw)
        ? "revenue"
        : /مصروف|expense/i.test(typeRaw)
          ? "expense"
          : null;
      const amount = Number(pick(row, ["المبلغ", "amount", "Amount"]).replace(/[,،]/g, ""));
      const description = pick(row, ["الوصف", "البيان", "description", "Description"]);
      const category = pick(row, ["التصنيف", "category", "Category"]);
      let date = pick(row, ["التاريخ", "date", "Date"]);
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().slice(0, 10);
      }
      if (!type || !(amount > 0) || !description || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        skipped++;
        continue;
      }
      insert.run(type, amount, description, category, date);
      ok++;
    }
  });
  tx();
  revalidatePath("/", "layout");
  return { ok, skipped };
}

// ---------- العهد (إدارة) ----------

export async function createCustodyManual(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const requested = Number(formData.get("requested_amount"));
  const stage = String(formData.get("stage") ?? "");
  const date = composeHijri(
    Number(formData.get("hijri_day")),
    Number(formData.get("hijri_month")),
    Number(formData.get("hijri_year"))
  );
  if (!name || !reason || !date || !STAGES.includes(stage)) return;
  const info = db()
    .prepare(
      "INSERT INTO custodies (name, phone, reason, requested_amount, request_date, stage, close_token) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(name, phone, reason, requested > 0 ? requested : null, date, stage, newCloseToken());
  revalidatePath("/", "layout");
  redirect(`/custodies/${info.lastInsertRowid}`);
}

export async function disburseCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const amount = Number(formData.get("amount"));
  const notes = String(formData.get("admin_notes") ?? "").trim();
  if (!(amount > 0)) return;
  db()
    .prepare(
      "UPDATE custodies SET status = 'open', amount = ?, admin_notes = ?, disbursed_at = datetime('now') WHERE id = ? AND status = 'pending'"
    )
    .run(amount, notes, id);
  revalidatePath("/", "layout");
}

export async function rejectCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  db()
    .prepare("UPDATE custodies SET status = 'rejected' WHERE id = ? AND status = 'pending'")
    .run(id);
  revalidatePath("/", "layout");
}

export async function approveClose(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  db()
    .prepare(
      "UPDATE custodies SET status = 'closed', closed_at = datetime('now') WHERE id = ? AND status = 'pending_close'"
    )
    .run(id);
  revalidatePath("/", "layout");
}

/** إعادة العهدة للحالة المفتوحة (مثلاً إذا كانت الفواتير ناقصة) مع حذف الفواتير المرفوعة */
export async function reopenCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const invoices = db()
    .prepare("SELECT file_path FROM invoices WHERE custody_id = ?")
    .all(id) as { file_path: string }[];
  db().prepare("DELETE FROM invoices WHERE custody_id = ?").run(id);
  db()
    .prepare("UPDATE custodies SET status = 'open' WHERE id = ? AND status = 'pending_close'")
    .run(id);
  for (const inv of invoices) {
    fs.rmSync(path.join(UPLOADS_DIR, inv.file_path), { force: true });
  }
  revalidatePath("/", "layout");
}

export async function deleteCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  db().prepare("DELETE FROM invoices WHERE custody_id = ?").run(id);
  db().prepare("DELETE FROM custodies WHERE id = ?").run(id);
  fs.rmSync(path.join(UPLOADS_DIR, String(id)), { recursive: true, force: true });
  revalidatePath("/", "layout");
  redirect("/custodies");
}

// ---------- النماذج العامة (الموظفين) ----------

export async function submitRequest(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  if (token !== getRequestToken()) return "الرابط غير صالح";
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const requested = Number(formData.get("requested_amount"));
  const stage = String(formData.get("stage") ?? "");
  const date = composeHijri(
    Number(formData.get("hijri_day")),
    Number(formData.get("hijri_month")),
    Number(formData.get("hijri_year"))
  );
  if (!name || !phone || !reason || !date) return "فضلًا عبّئ جميع الحقول المطلوبة";
  if (!STAGES.includes(stage)) return "فضلًا اختر المرحلة";
  if (!(requested > 0)) return "فضلًا أدخل المبلغ المطلوب";
  db()
    .prepare(
      "INSERT INTO custodies (name, phone, reason, requested_amount, request_date, stage, close_token) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(name, phone, reason, requested, date, stage, newCloseToken());
  redirect(`/r/${token}?done=1`);
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function submitClosure(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  const custody = db()
    .prepare("SELECT * FROM custodies WHERE close_token = ? AND status = 'open'")
    .get(token) as Custody | undefined;
  if (!custody) return "الرابط غير صالح أو العهدة ليست بحالة تسمح بالإقفال";

  const descriptions = formData.getAll("inv_description").map((v) => String(v).trim());
  const amounts = formData.getAll("inv_amount").map((v) => Number(v));
  const files = formData.getAll("inv_file") as File[];

  if (descriptions.length === 0) return "أضف فاتورة واحدة على الأقل";
  for (let i = 0; i < descriptions.length; i++) {
    const f = files[i];
    if (!descriptions[i] || !(amounts[i] > 0)) return `أكمل بيانات الفاتورة رقم ${i + 1}`;
    if (!f || f.size === 0) return `أرفق ملف PDF للفاتورة رقم ${i + 1}`;
    if (f.size > MAX_PDF_BYTES) return `ملف الفاتورة رقم ${i + 1} أكبر من 10MB`;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return `ملف الفاتورة رقم ${i + 1} يجب أن يكون PDF`;
  }

  const dir = path.join(UPLOADS_DIR, String(custody.id));
  fs.mkdirSync(dir, { recursive: true });
  const insert = db().prepare(
    "INSERT INTO invoices (custody_id, description, amount, file_name, file_path) VALUES (?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < descriptions.length; i++) {
    const f = files[i];
    const stored = `${crypto.randomBytes(8).toString("hex")}.pdf`;
    fs.writeFileSync(path.join(dir, stored), Buffer.from(await f.arrayBuffer()));
    insert.run(custody.id, descriptions[i], amounts[i], f.name, `${custody.id}/${stored}`);
  }
  db()
    .prepare("UPDATE custodies SET status = 'pending_close' WHERE id = ?")
    .run(custody.id);
  revalidatePath("/", "layout");
  redirect(`/c/${token}?done=1`);
}
