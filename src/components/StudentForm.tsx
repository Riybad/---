"use client";

import { useActionState, useState } from "react";
import { createStudent, updateStudent } from "@/app/plan-actions";
import { CADENCES } from "@/lib/calendar";
import { TRACKS, type TrackKey } from "@/lib/tracks";
import type { Student } from "@/lib/db";

/** إضافة طالب من اللوحة: ببيانات فقط، أو بخطة مبدئية تُعدَّل بعدها */
export function NewStudentForm({ defaultTrack = "tarbawi" }: { defaultTrack?: TrackKey }) {
  const [error, action, pending] = useActionState(createStudent, null);
  const [track, setTrack] = useState<TrackKey>(defaultTrack);
  const [mode, setMode] = useState<"plan" | "empty">("plan");
  const info = TRACKS.find((t) => t.key === track) ?? TRACKS[0];

  return (
    <form action={action} className="card grid gap-4 p-5">
      <input type="hidden" name="track" value={track} />
      <input type="hidden" name="mode" value={mode} />

      <Fieldset legend="المسار">
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
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {info.note}
        </p>
      </Fieldset>

      <Fields />

      <Fieldset legend="الخطة">
        <div className="grid gap-2">
          <Choice
            checked={mode === "plan"}
            onSelect={() => setMode("plan")}
            title="قسّم له الآن"
            note="تُبنى له خطة مبدئية على مقررات مساره، وتفتح لك شاشة التعديل لتضبط المدد والترتيب."
          />
          <Choice
            checked={mode === "empty"}
            onSelect={() => setMode("empty")}
            title="أنشئه بلا خطة"
            note="يُسجَّل الطالب فقط، وتقسّم له لاحقًا أو ترسل له رابط خطته ليقسّم بنفسه."
          />
        </div>
      </Fieldset>

      <Footer error={error} pending={pending} label="أضف الطالب" />
    </form>
  );
}

/** تعديل بيانات طالب قائم */
export function EditStudentForm({ student }: { student: Student }) {
  const [error, action, pending] = useActionState(updateStudent, null);
  const [saved, setSaved] = useState(false);
  const [track, setTrack] = useState<TrackKey>(
    (TRACKS.find((t) => t.key === student.track)?.key ?? "tarbawi") as TrackKey
  );
  const changedTrack = track !== student.track;

  return (
    <form action={action} onSubmit={() => setSaved(true)} className="card grid gap-4 p-5">
      <input type="hidden" name="id" value={student.id} />
      <input type="hidden" name="track" value={track} />
      <h2 className="font-bold">بيانات الطالب</h2>

      <Fieldset legend="المسار">
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
        {changedTrack && (
          <p className="mt-2 text-xs font-semibold" style={{ color: "var(--brand-amber)" }}>
            ⚠︎ لكل مسار مقرراته: نقل الطالب يمسح خطته الحالية لتُبنى من مقررات المسار الجديد.
          </p>
        )}
      </Fieldset>

      <Fields student={student} />
      <Footer
        error={error}
        pending={pending}
        label="حفظ البيانات"
        done={saved && !error && !pending ? "✓ حُفظت البيانات" : ""}
      />
    </form>
  );
}

function Fields({ student }: { student?: Student }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">اسم الطالب</label>
          <input name="name" className="input" defaultValue={student?.name ?? ""} required />
        </div>
        <div>
          <label className="label">رقم الجوال (اختياري)</label>
          <input
            name="phone"
            className="input num"
            dir="ltr"
            inputMode="tel"
            defaultValue={student?.phone ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">وحدة عرض الخطة</label>
          <select name="cadence" className="input" defaultValue={student?.cadence ?? "weekly"}>
            {CADENCES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            تحدّد كيف يُعرض الورد: كل يوم أو كل أسبوع أو كل شهر.
          </p>
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <input name="notes" className="input" defaultValue={student?.notes ?? ""} />
        </div>
      </div>
    </>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-2">{legend}</div>
      {children}
    </div>
  );
}

function Choice({
  checked,
  onSelect,
  title,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-xl border p-3 text-start transition"
      style={{
        borderColor: checked ? "var(--brand-olive)" : "var(--hairline)",
        background: checked ? "var(--surface-stripe)" : "transparent",
      }}
    >
      <span className="font-bold">
        {checked ? "◉" : "○"} {title}
      </span>
      <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
        {note}
      </span>
    </button>
  );
}

function Footer({
  error,
  pending,
  label,
  done,
}: {
  error: string | null;
  pending: boolean;
  label: string;
  done?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn btn-primary text-sm" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : label}
      </button>
      {error && (
        <span className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
          {error}
        </span>
      )}
      {!error && done && (
        <span className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
          {done}
        </span>
      )}
    </div>
  );
}
