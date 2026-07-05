import { HIJRI_MONTHS, todayHijri } from "@/lib/hijri";

/** ثلاث قوائم (يوم / شهر / سنة) للتاريخ الهجري، افتراضيًا تاريخ اليوم */
export default function HijriDateFields() {
  const today = todayHijri();
  const years = Array.from({ length: 5 }, (_, i) => today.year - 2 + i);
  return (
    <div className="flex gap-2">
      <select name="hijri_day" className="input" defaultValue={today.day} required>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select name="hijri_month" className="input" defaultValue={today.month} required>
        {HIJRI_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select name="hijri_year" className="input" defaultValue={today.year} required>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}هـ
          </option>
        ))}
      </select>
    </div>
  );
}
