"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProgress } from "@/app/plan-actions";
import type { Track } from "@/lib/tracks";

export type ProgressRow = {
  id: number;
  name: string;
  /** مقررات خطته: معرّف المقرر وهل أنهاه */
  items: { courseId: number; done: boolean }[];
};

/** سجلّ إنجاز مسار واحد: صف لكل طالب وعمود لكل مقرر */
export default function ProgressBoard({
  track,
  courses,
  rows,
}: {
  track: Track;
  courses: { id: number; name: string }[];
  rows: ProgressRow[];
}) {
  const [error, action, pending] = useActionState(saveProgress, null);
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState<Set<string>>(
    () =>
      new Set(
        rows.flatMap((r) => r.items.filter((i) => i.done).map((i) => `${r.id}:${i.courseId}`))
      )
  );

  /** كل المربّعات المعروضة — ما لم يُؤشَّر منها يُحفظ غير منجَز */
  const scope = rows.flatMap((r) => r.items.map((i) => `${r.id}:${i.courseId}`));
  const inPlan = new Set(scope);
  const has = (sid: number, cid: number) => inPlan.has(`${sid}:${cid}`);
  const isDone = (sid: number, cid: number) => done.has(`${sid}:${cid}`);

  const set = (keys: string[], value: boolean) =>
    setDone((cur) => {
      const next = new Set(cur);
      for (const k of keys) {
        if (value) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const toggle = (key: string) =>
    setDone((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const doneCount = (r: ProgressRow) => r.items.filter((i) => isDone(r.id, i.courseId)).length;
  const columnKeys = (cid: number) =>
    rows.filter((r) => has(r.id, cid)).map((r) => `${r.id}:${cid}`);

  const totalCells = scope.length;
  const totalDone = scope.filter((k) => done.has(k)).length;
  const finished = rows.filter((r) => r.items.length > 0 && doneCount(r) === r.items.length).length;

  if (rows.length === 0) {
    return (
      <p className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا طلاب في {track.name} بعد.
      </p>
    );
  }
  if (courses.length === 0) {
    return (
      <p className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا مقررات في {track.name} بعد — أضفها من{" "}
        <Link href="/courses" className="font-semibold underline">
          صفحة المقررات
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={action} onSubmit={() => setSaved(true)} className="grid gap-3">
      <input type="hidden" name="scope" value={scope.join(",")} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="أنهى مقرراته كلها" value={`${finished} من ${rows.length}`} color={track.color} />
        <Stat label="المقررات المنجزة" value={`${totalDone} من ${totalCells}`} color={track.color} />
        <Stat
          label="نسبة الإنجاز"
          value={totalCells ? `${Math.round((totalDone / totalCells) * 100)}%` : "—"}
          color={track.color}
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="sticky-col text-start">الطالب</th>
                {courses.map((c) => {
                  const keys = columnKeys(c.id);
                  const all = keys.length > 0 && keys.every((k) => done.has(k));
                  return (
                    <th key={c.id} className="text-center">
                      <div className="whitespace-nowrap">{c.name}</div>
                      {keys.length > 0 && (
                        <button
                          type="button"
                          className="mt-1 text-[11px] font-semibold underline"
                          onClick={() => set(keys, !all)}
                        >
                          {all ? "ألغِ الكل" : "أشّر للكل"}
                        </button>
                      )}
                    </th>
                  );
                })}
                <th className="text-center whitespace-nowrap">الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const n = doneCount(r);
                const all = r.items.length > 0 && n === r.items.length;
                return (
                  <tr key={r.id} style={all ? { background: `${track.color}12` } : undefined}>
                    <td
                      className="sticky-col whitespace-nowrap font-semibold"
                      style={all ? { background: `${track.color}1f` } : undefined}
                    >
                      <Link href={`/students/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    {courses.map((c) => {
                      const key = `${r.id}:${c.id}`;
                      if (!has(r.id, c.id)) {
                        return (
                          <td key={c.id} className="text-center" style={{ color: "var(--text-muted)" }}>
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={c.id} className="text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center p-1">
                            <input
                              type="checkbox"
                              name="done"
                              value={key}
                              checked={done.has(key)}
                              onChange={() => toggle(key)}
                              className="h-5 w-5 cursor-pointer"
                              style={{ accentColor: track.color }}
                              aria-label={`${r.name} — ${c.name}`}
                            />
                          </label>
                        </td>
                      );
                    })}
                    <td className="text-center whitespace-nowrap">
                      {r.items.length === 0 ? (
                        <span style={{ color: "var(--brand-amber)" }}>بلا خطة</span>
                      ) : (
                        <span style={{ color: all ? track.color : "var(--text-secondary)", fontWeight: all ? 700 : 400 }}>
                          {n} من {r.items.length}
                          {all && " ✓"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary text-sm" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ الإنجاز"}
        </button>
        {error && (
          <span className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
            {error}
          </span>
        )}
        {saved && !error && !pending && (
          <span className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
            ✓ حُفظ الإنجاز
          </span>
        )}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          أشّر على ما أنهاه الطالب ثم احفظ — والمربّع الفارغ يعني أنه لم ينهه بعد.
        </span>
      </div>
    </form>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card p-3 text-center sm:p-4 sm:text-start">
      <div className="text-[11px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-base font-bold sm:text-lg" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
