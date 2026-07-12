"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import {
  adminPassword,
  createSession,
  destroySession,
  requireAdmin,
} from "@/lib/auth";
import { q, getRequestToken, newCloseToken, type Custody } from "@/lib/db";
import { composeHijri, PAYMENT_METHODS, STAGES, todayHijri } from "@/lib/hijri";
import {
  deleteInvoiceFile,
  isValidBlobUrl,
  saveInvoicePdfLocally,
} from "@/lib/storage";

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
  await q(
    "INSERT INTO transactions (type, amount, description, category, date) VALUES ($1, $2, $3, $4, $5)",
    [type, amount, description, category, date]
  );
  revalidatePath("/", "layout");
}

export async function deleteTransaction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await q("DELETE FROM transactions WHERE id = $1", [id]);
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
      if (keys.includes(k.trim())) return String(row[k] ?? "").trim();
    }
    return "";
  };

  let ok = 0;
  let skipped = 0;
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
    await q(
      "INSERT INTO transactions (type, amount, description, category, date) VALUES ($1, $2, $3, $4, $5)",
      [type, amount, description, category, date]
    );
    ok++;
  }
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
  const rows = await q(
    "INSERT INTO custodies (name, phone, reason, requested_amount, request_date, stage, close_token) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [name, phone, reason, requested > 0 ? requested : null, date, stage, newCloseToken()]
  );
  revalidatePath("/", "layout");
  redirect(`/custodies/${rows[0].id}`);
}

export async function disburseCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const amount = Number(formData.get("amount"));
  const notes = String(formData.get("admin_notes") ?? "").trim();
  if (!(amount > 0)) return;
  await q(
    "UPDATE custodies SET status = 'open', amount = $1, admin_notes = $2, disbursed_at = now() WHERE id = $3 AND status = 'pending'",
    [amount, notes, id]
  );
  revalidatePath("/", "layout");
}

export async function rejectCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await q("UPDATE custodies SET status = 'rejected' WHERE id = $1 AND status = 'pending'", [id]);
  revalidatePath("/", "layout");
}

export async function approveClose(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await q(
    "UPDATE custodies SET status = 'closed', closed_at = now() WHERE id = $1 AND status = 'pending_close'",
    [id]
  );
  revalidatePath("/", "layout");
}

/** إعادة العهدة للحالة المفتوحة (مثلاً إذا كانت الفواتير ناقصة) مع حذف الفواتير المرفوعة */
export async function reopenCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const invoices = (await q("SELECT file_path FROM invoices WHERE custody_id = $1", [id])) as {
    file_path: string;
  }[];
  await q("DELETE FROM invoices WHERE custody_id = $1", [id]);
  await q("UPDATE custodies SET status = 'open' WHERE id = $1 AND status = 'pending_close'", [id]);
  for (const inv of invoices) {
    await deleteInvoiceFile(inv.file_path);
  }
  revalidatePath("/", "layout");
}

export async function deleteCustody(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const invoices = (await q("SELECT file_path FROM invoices WHERE custody_id = $1", [id])) as {
    file_path: string;
  }[];
  await q("DELETE FROM invoices WHERE custody_id = $1", [id]);
  await q("DELETE FROM custodies WHERE id = $1", [id]);
  for (const inv of invoices) {
    await deleteInvoiceFile(inv.file_path);
  }
  revalidatePath("/", "layout");
  redirect("/custodies");
}

// ---------- النماذج العامة (الموظفين) ----------

export async function submitRequest(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  if (token !== (await getRequestToken())) return "الرابط غير صالح";
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
  await q(
    "INSERT INTO custodies (name, phone, reason, requested_amount, request_date, stage, close_token) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [name, phone, reason, requested, date, stage, newCloseToken()]
  );
  redirect(`/r/${token}?done=1`);
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type InvoiceItem = { description: string; amount: number; url?: string; file?: File; name: string };

/** يقرأ ويتحقق من فواتير النموذج (روابط مرفوعة سحابيًا أو ملفات مباشرة) */
function collectInvoices(formData: FormData): string | InvoiceItem[] {
  const descriptions = formData.getAll("inv_description").map((v) => String(v).trim());
  const amounts = formData.getAll("inv_amount").map((v) => Number(v));
  const urls = formData.getAll("inv_url").map((v) => String(v));
  const names = formData.getAll("inv_name").map((v) => String(v));
  const files = formData.getAll("inv_file") as File[];
  const usingUrls = urls.length > 0;

  if (descriptions.length === 0) return "أضف فاتورة واحدة على الأقل";
  const items: InvoiceItem[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i] || !(amounts[i] > 0)) return `أكمل بيانات الفاتورة رقم ${i + 1}`;
    // ملف الفاتورة اختياري — يُقبل الصف ببياناته فقط
    if (usingUrls) {
      if (urls[i] && !isValidBlobUrl(urls[i])) return `ملف الفاتورة رقم ${i + 1} لم يُرفع بشكل صحيح`;
      items.push({
        description: descriptions[i],
        amount: amounts[i],
        url: urls[i] || undefined,
        name: urls[i] ? names[i] || `invoice-${i + 1}.pdf` : "",
      });
    } else {
      const f = files[i];
      if (f && f.size > 0) {
        if (f.size > MAX_PDF_BYTES) return `ملف الفاتورة رقم ${i + 1} أكبر من 10MB`;
        const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return `ملف الفاتورة رقم ${i + 1} يجب أن يكون PDF`;
        items.push({ description: descriptions[i], amount: amounts[i], file: f, name: f.name });
      } else {
        items.push({ description: descriptions[i], amount: amounts[i], name: "" });
      }
    }
  }
  return items;
}

async function storeInvoices(custodyId: number, items: InvoiceItem[]) {
  for (const item of items) {
    const filePath =
      item.url ?? (item.file ? await saveInvoicePdfLocally(custodyId, item.file) : "");
    await q(
      "INSERT INTO invoices (custody_id, description, amount, file_name, file_path) VALUES ($1, $2, $3, $4, $5)",
      [custodyId, item.description, item.amount, item.name, filePath]
    );
  }
}

/** إقفال مباشر من الرابط العام — للعهد المصروفة سابقًا خارج النظام */
export async function submitStandaloneClosure(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  if (token !== (await getRequestToken())) return "الرابط غير صالح";
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const paymentMethod = String(formData.get("payment_method") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "عهدة سابقة";
  if (!name || !phone) return "فضلًا أدخل الاسم ورقم الجوال";
  if (!(amount > 0)) return "فضلًا أدخل مبلغ العهدة";
  if (!PAYMENT_METHODS.includes(paymentMethod)) return "فضلًا اختر طريقة الدفع";

  const invoices = collectInvoices(formData);
  if (typeof invoices === "string") return invoices;

  const t = todayHijri();
  const date = composeHijri(t.day, t.month, t.year) ?? "";
  const rows = await q(
    `INSERT INTO custodies (name, phone, reason, requested_amount, amount, request_date, payment_method, status, close_token, disbursed_at)
     VALUES ($1, $2, $3, $4, $4, $5, $6, 'pending_close', $7, now()) RETURNING id`,
    [name, phone, reason, amount, date, paymentMethod, newCloseToken()]
  );
  await storeInvoices(rows[0].id as number, invoices);
  revalidatePath("/", "layout");
  redirect(`/r/${token}?done=close`);
}

export async function submitClosure(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const token = String(formData.get("token") ?? "");
  const rows = await q("SELECT * FROM custodies WHERE close_token = $1 AND status = 'open'", [
    token,
  ]);
  const custody = rows[0] as Custody | undefined;
  if (!custody) return "الرابط غير صالح أو العهدة ليست بحالة تسمح بالإقفال";

  const paymentMethod = String(formData.get("payment_method") ?? "");
  if (!PAYMENT_METHODS.includes(paymentMethod)) return "فضلًا اختر طريقة الدفع";

  const invoices = collectInvoices(formData);
  if (typeof invoices === "string") return invoices;

  await storeInvoices(custody.id, invoices);
  await q("UPDATE custodies SET status = 'pending_close', payment_method = $1 WHERE id = $2", [
    paymentMethod,
    custody.id,
  ]);
  revalidatePath("/", "layout");
  redirect(`/c/${token}?done=1`);
}
