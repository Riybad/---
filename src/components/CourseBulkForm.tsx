"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createCourses } from "@/app/plan-actions";
import { UNITS } from "@/lib/plan";
import { TRACKS, type TrackKey } from "@/lib/tracks";

/** لصق جدول مقررات كامل: سطر لكل مقرر، وعنوان الفرع سطرٌ وحده */
export default function CourseBulkForm({ defaultTrack }: { defaultTrack: TrackKey }) {
  const [result, action, pending] = useActionState(createCourses, null);
  const [track, setTrack] = useState<TrackKey>(defaultTrack);
  const [rows, setRows] = useState("");

  const info = TRACKS.find((t) => t.key === track) ?? TRACKS[0];
  // الأسطر التي فيها فاصل هي المقررات، وما عداها عناوين فروع
  const count = rows
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /\t|\||[,،]/.test(l) && !/إجمال/.test(l)).length;

  return (
    <form action={action} className="card grid gap-4 p-5">
      <input type="hidden" name="track" value={track} />

      <div>
        <h2 className="font-bold">ألصق جدول مقررات</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          سطر لكل مقرر: <strong>الاسم | النوع | معيار الضبط | صفحات القراءة | أسطر الحفظ</strong>
          {" "}— والفاصل جدولة أو <code>|</code> أو فاصلة. السطر الذي بلا فواصل عنوانُ فرعٍ يسري
          على ما بعده، وأسطر «إجماليات الفرع» تُتجاهل.
        </p>
      </div>

      <div>
        <div className="label mb-2">المسار</div>
        <div className="flex flex-wrap gap-2">
          {TRACKS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTrack(t.key)}
              className="rounded-xl border px-4 py-2 text-sm font-bold transition"
              style={{
                borderColor: track === t.key ? t.color : "var(--hairline)",
                background: track === t.key ? `${t.color}1a` : "transparent",
                color: track === t.key ? t.color : "var(--text-secondary)",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">وحدة الحفظ</label>
          <select name="memo_unit" className="input" defaultValue="سطر">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">وحدة المسار الثاني</label>
          <select name="read_unit" className="input" defaultValue="صفحة">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">مسمّى المسار الثاني</label>
          <select name="expl_label" className="input" defaultValue="قراءة">
            <option value="قراءة">قراءة</option>
            <option value="شرح">شرح</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">
          الصفوف
          {count > 0 && (
            <span className="ms-2 font-normal" style={{ color: "var(--brand-olive)" }}>
              — {count} {count === 1 ? "مقرر" : count === 2 ? "مقرران" : count <= 10 ? "مقررات" : "مقررًا"}
            </span>
          )}
        </label>
        <textarea
          name="rows"
          className="input"
          rows={12}
          dir="rtl"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          placeholder={"شرف العلم\nفضل العلم | نثر + نظم | حفظ | 2 | 20\nفضل علم السلف لابن رجب | كتاب | ملخص | 90 | 0"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={pending || count === 0}>
          {pending ? "جارٍ الإضافة…" : `أضف ${count > 0 ? `${count} ` : ""}إلى ${info.name}`}
        </button>
        {result?.error && (
          <span className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
            {result.error}
          </span>
        )}
        {!result?.error && result?.added ? (
          <span className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
            ✓ أُضيف {result.added} مقررًا
          </span>
        ) : null}
      </div>

      {result?.skipped && result.skipped.length > 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          مسجّلة من قبل فتُخطّيت: {result.skipped.join("، ")}
        </p>
      )}

      {!result?.error && result?.added ? (
        <Link href="/students/new" className="btn btn-ghost w-fit text-sm">
          الآن قسّم خطط طلابه ←
        </Link>
      ) : null}
    </form>
  );
}
