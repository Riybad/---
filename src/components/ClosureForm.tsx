"use client";

import { useActionState, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { submitClosure, submitStandaloneClosure } from "@/app/actions";
import { PAYMENT_METHODS } from "@/lib/hijri";

export default function ClosureForm({
  token,
  uploadMode,
  standalone = false,
}: {
  token: string;
  uploadMode: "blob" | "local";
  standalone?: boolean;
}) {
  const [error, action, pending] = useActionState(
    standalone ? submitStandaloneClosure : submitClosure,
    null
  );
  const [rows, setRows] = useState([0]);
  const [nextKey, setNextKey] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const busy = pending || uploading;

  // في الوضع السحابي نرفع ملفات الـ PDF مباشرة من المتصفح إلى التخزين
  // (حدود الاستضافة لا تسمح بتمرير الملفات عبر النموذج) ثم نرسل روابطها
  async function handleBlobSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData(form);
      const files = fd.getAll("inv_file") as File[];
      fd.delete("inv_file");
      for (const f of files) {
        // الملف اختياري — الصفوف بدون ملف ترسل رابطًا فارغًا للحفاظ على الترتيب
        if (!f || f.size === 0) {
          fd.append("inv_url", "");
          fd.append("inv_name", "");
          continue;
        }
        if (f.size > 10 * 1024 * 1024) throw new Error(`الملف ${f.name} أكبر من 10MB`);
        const result = await upload(`invoices/${f.name || "invoice.pdf"}`, f, {
          access: "public",
          handleUploadUrl: "/api/invoice-upload",
          clientPayload: token,
        });
        fd.append("inv_url", result.url);
        fd.append("inv_name", f.name);
      }
      startTransition(() => action(fd));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "تعذر رفع الملفات — حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      action={uploadMode === "local" ? action : undefined}
      onSubmit={uploadMode === "blob" ? handleBlobSubmit : undefined}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />

      {standalone && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">الاسم الكامل</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input name="phone" className="input" dir="ltr" placeholder="05xxxxxxxx" required />
          </div>
          <div>
            <label className="label">مبلغ العهدة</label>
            <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
          </div>
          <div className="col-span-2">
            <label className="label">الغرض من العهدة</label>
            <input name="reason" className="input" required />
          </div>
        </div>
      )}

      <div>
        <label className="label">طريقة الدفع</label>
        <select name="payment_method" className="input" required defaultValue="">
          <option value="" disabled>
            اختر طريقة الدفع
          </option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {rows.map((key, i) => (
        <fieldset
          key={key}
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <legend className="px-1 text-sm font-bold">فاتورة {i + 1}</legend>
            {rows.length > 1 && (
              <button
                type="button"
                className="text-xs font-semibold hover:underline"
                style={{ color: "var(--critical)" }}
                onClick={() => setRows(rows.filter((r) => r !== key))}
              >
                إزالة
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">وصف الفاتورة</label>
              <input name="inv_description" className="input" required />
            </div>
            <div>
              <label className="label">المبلغ (ر.س)</label>
              <input name="inv_amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ملف الفاتورة (PDF — اختياري، بحد أقصى 10MB)</label>
              <input name="inv_file" type="file" accept="application/pdf,.pdf" className="input" />
            </div>
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        className="btn btn-ghost text-sm"
        onClick={() => {
          setRows([...rows, nextKey]);
          setNextKey(nextKey + 1);
        }}
      >
        + إضافة فاتورة أخرى
      </button>

      {(error || uploadError) && (
        <p className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {uploadError ?? error}
        </p>
      )}

      <button className="btn btn-primary w-full justify-center" disabled={busy}>
        {uploading ? "جارٍ رفع الملفات…" : pending ? "جارٍ الإرسال…" : "إرسال طلب الإقفال"}
      </button>
    </form>
  );
}
