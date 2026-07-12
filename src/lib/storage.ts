import crypto from "crypto";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "./db";

/** هل التخزين السحابي (Vercel Blob) مفعّل؟ */
export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** يتحقق أن رابط الملف المرسل من المتصفح هو فعلًا رابط Vercel Blob لفواتير العهدة */
export function isValidBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith("/invoices/");
  } catch {
    return false;
  }
}

/** يحفظ ملف فاتورة مرفوع عبر النموذج (الوضع المحلي) ويرجع مسار التخزين */
export async function saveInvoicePdfLocally(custodyId: number, file: File): Promise<string> {
  const dir = path.join(UPLOADS_DIR, String(custodyId));
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${crypto.randomBytes(8).toString("hex")}.pdf`;
  fs.writeFileSync(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  return `${custodyId}/${stored}`;
}

/** يحذف ملف فاتورة أيًا كان مكان تخزينه */
export async function deleteInvoiceFile(filePath: string): Promise<void> {
  if (!filePath) return;
  if (filePath.startsWith("https://")) {
    const { del } = await import("@vercel/blob");
    await del(filePath).catch(() => {});
  } else {
    fs.rmSync(path.join(UPLOADS_DIR, filePath), { force: true });
  }
}

/** يقرأ محتوى ملف فاتورة للعرض */
export async function readInvoiceFile(filePath: string): Promise<Blob | null> {
  if (!filePath) return null;
  if (filePath.startsWith("https://")) {
    const res = await fetch(filePath);
    if (!res.ok) return null;
    return await res.blob();
  }
  const full = path.resolve(UPLOADS_DIR, filePath);
  if (!full.startsWith(path.resolve(UPLOADS_DIR)) || !fs.existsSync(full)) return null;
  return new Blob([new Uint8Array(fs.readFileSync(full))]);
}
