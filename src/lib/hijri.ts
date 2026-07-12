export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

export const STAGES = ["الإدارة", "متوسط", "ابتدائي عليا", "ابتدائي دنيا"];

export const PAYMENT_METHODS = ["بطاقة الجمعية", "تحويل"];

/** تاريخ اليوم بالتقويم الهجري (أم القرى) */
export function todayHijri(): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** يركّب التاريخ الهجري كنص مقروء مثل: 15 محرم 1447هـ — أو null إذا كانت القيم غير صالحة */
export function composeHijri(day: number, month: number, year: number): string | null {
  if (
    !Number.isInteger(day) || day < 1 || day > 30 ||
    !Number.isInteger(month) || month < 1 || month > 12 ||
    !Number.isInteger(year) || year < 1400 || year > 1500
  ) {
    return null;
  }
  return `${day} ${HIJRI_MONTHS[month - 1]} ${year}هـ`;
}
