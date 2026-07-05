import type { CustodyStatus } from "./db";

const moneyFmt = new Intl.NumberFormat("ar-SA-u-nu-latn", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${moneyFmt.format(n)} ر.س`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  // التواريخ الهجرية مخزنة كنص جاهز للعرض (مثل: 15 محرم 1447هـ)
  if (d.includes("هـ")) return d;
  return d.slice(0, 10);
}

export const STATUS_LABEL: Record<CustodyStatus, string> = {
  pending: "طلب جديد",
  open: "مفتوحة",
  pending_close: "بانتظار اعتماد الإقفال",
  closed: "مقفلة",
  rejected: "مرفوضة",
};

/** ألوان الحالات — من لوحة الحالات الثابتة (تُعرض دائمًا مع نص، لا لون فقط) */
export const STATUS_STYLE: Record<CustodyStatus, string> = {
  pending: "badge badge-warning",
  open: "badge badge-info",
  pending_close: "badge badge-serious",
  closed: "badge badge-good",
  rejected: "badge badge-critical",
};
