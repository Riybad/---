"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveQiyas } from "@/app/plan-actions";
import {
  averageRatio,
  gradeOf,
  ratio,
  type Part,
  type Thresholds,
} from "@/lib/performance";
import type { Track } from "@/lib/tracks";

/** عمود في المصفوفة: بند واحد تحت محوره */
export type QiyasColumn = {
  key: string;
  group: string;
  label: string;
  unit: string;
  part: Part;
  courseId: number | null;
};

export type QiyasCell = {
  /** المفترض المشتقّ من الخطة — غير محدّد يعني أنه يُدخَل يدويًا */
  planned?: number;
  savedPlanned: number;
  actual: number;
};

export type QiyasStudent = {
  id: number;
  name: string;
  /** مفتاح العمود ← خليّته، وما ليس في خطته لا خليّة له */
  cells: Record<string, QiyasCell>;
};

/** خليّة عمود أضافه المشرف ولم يُسجَّل له شيء بعد */
const EMPTY: QiyasCell = { savedPlanned: 0, actual: 0 };

/** صنف لون النسبة — معرّف في globals.css ليعمل في الوضعين الفاتح والداكن */
const GRADE_CLASS: Record<string, string> = {
  good: "g-good",
  warn: "g-warn",
  bad: "g-bad",
  none: "g-none",
};

/** قياس أداء شهر: صفٌّ لكل طالب، وأعمدة مجمّعة في محاور */
export default function QiyasBoard({
  track,
  month,
  monthName,
  columns,
  students,
  addable,
  thresholds,
}: {
  track: Track;
  month: number;
  monthName: string;
  columns: QiyasColumn[];
  students: QiyasStudent[];
  /** أعمدة يضيفها المشرف لكل الطلاب — لمسار بلا جدول، أو لبند خارج الخطة */
  addable: QiyasColumn[];
  thresholds: Thresholds;
}) {
  const [error, action, pending] = useActionState(saveQiyas, null);
  const [saved, setSaved] = useState(false);
  /** ما يكتبه المشرف الآن — ليحسب النسب قبل الحفظ */
  const [draft, setDraft] = useState<Record<string, { p?: number; a?: number }>>({});
  /** أعمدة أضافها المشرف في هذه الجلسة، تُحفظ مع الشاشة */
  const [extra, setExtra] = useState<QiyasColumn[]>([]);

  const cols = useMemo(() => [...columns, ...extra], [columns, extra]);
  /** الأعمدة المضافة مفتوحة لكل طالب، فلكلٍّ خليّة فارغة فيها */
  const rowsOf = (s: QiyasStudent) =>
    cols.filter((c) => s.cells[c.key] || extra.some((e) => e.key === c.key));

  const scope = useMemo(
    () =>
      students
        .flatMap((s) => rowsOf(s).map((c) => `${s.id}:${c.part}:${c.courseId ?? 0}`))
        .join(","),
    [students, cols, extra]
  );

  /** المحاور وعدد أعمدة كلٍّ منها، لترويسة مدمجة */
  const groups = useMemo(() => {
    const out: { name: string; span: number; keys: string[] }[] = [];
    for (const c of cols) {
      const last = out[out.length - 1];
      if (last && last.name === c.group) {
        last.span++;
        last.keys.push(c.key);
      } else out.push({ name: c.group, span: 1, keys: [c.key] });
    }
    return out;
  }, [cols]);

  const fieldKey = (s: QiyasStudent, c: QiyasColumn) => `${s.id}:${c.part}:${c.courseId ?? 0}`;

  function valueOf(s: QiyasStudent, c: QiyasColumn) {
    const cell = s.cells[c.key] ?? (extra.some((e) => e.key === c.key) ? EMPTY : undefined);
    if (!cell) return null;
    const d = draft[fieldKey(s, c)] ?? {};
    const planned = cell.planned !== undefined ? cell.planned : (d.p ?? cell.savedPlanned);
    const actual = d.a ?? cell.actual;
    return { cell, planned, actual, pct: ratio(planned, actual) };
  }

  function groupPct(s: QiyasStudent, keys: string[]): number | null {
    return averageRatio(
      keys.map((k) => {
        const c = cols.find((x) => x.key === k)!;
        return valueOf(s, c)?.pct ?? null;
      })
    );
  }

  const studentPct = (s: QiyasStudent) => averageRatio(groups.map((g) => groupPct(s, g.keys)));

  /** إجماليات العمود: تُجمع لأن وحدة العمود واحدة */
  function columnTotal(c: QiyasColumn) {
    let planned = 0;
    let actual = 0;
    let any = false;
    for (const s of students) {
      const v = valueOf(s, c);
      if (!v) continue;
      any = true;
      planned += v.planned;
      actual += v.actual;
    }
    return any ? { planned, actual, pct: ratio(planned, actual) } : null;
  }

  if (students.length === 0) {
    return (
      <p className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا طلاب في {track.name} بعد.
      </p>
    );
  }
  if (cols.length === 0) {
    return (
      <p className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا بنود في هذا الشهر — لا خطط لطلاب {track.name} فيه.
      </p>
    );
  }

  return (
    <form action={action} onSubmit={() => setSaved(true)} className="grid gap-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="scope" value={scope} />

      {addable.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            أضف عمودًا لكل الطلاب:
          </span>
          <select
            className="input w-auto max-w-64 text-xs"
            value=""
            onChange={(e) => {
              const found = addable.find((a) => a.key === e.target.value);
              if (found && !extra.some((x) => x.key === found.key)) {
                setExtra((cur) => [...cur, found]);
              }
            }}
            aria-label="أضف عمودًا"
          >
            <option value="">+ بند…</option>
            {addable
              .filter((a) => !extra.some((x) => x.key === a.key))
              .map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table qiyas">
            <thead>
              {/* المحاور */}
              <tr>
                <th rowSpan={3} className="sticky-col text-start">
                  الطالب
                </th>
                {groups.map((g) => (
                  <th key={g.name} colSpan={g.span * 3 + 1} className="text-center">
                    {g.name}
                  </th>
                ))}
                <th rowSpan={3} className="qiyas-total text-center">
                  نسبة
                  <br />
                  الطالب
                </th>
              </tr>
              {/* البنود */}
              <tr>
                {groups.map((g) => (
                  <Fragmented key={g.name}>
                    {g.keys.map((k) => {
                      const c = cols.find((x) => x.key === k)!;
                      return (
                        <th key={k} colSpan={3} className="text-center">
                          <div className="qiyas-item">{c.label}</div>
                          <div className="text-[10px] font-normal opacity-75">{c.unit}</div>
                        </th>
                      );
                    })}
                    <th className="qiyas-group text-center" rowSpan={2}>
                      نسبة
                      <br />
                      المحور
                    </th>
                  </Fragmented>
                ))}
              </tr>
              {/* الثلاثي */}
              <tr>
                {groups.map((g) => (
                  <Fragmented key={g.name}>
                    {g.keys.map((k) => (
                      <Fragmented key={k}>
                        <th className="qiyas-sub text-center">المفترض</th>
                        <th className="qiyas-sub text-center">الفعلي</th>
                        <th className="qiyas-sub text-center">النسبة</th>
                      </Fragmented>
                    ))}
                  </Fragmented>
                ))}
              </tr>
            </thead>

            <tbody>
              {students.map((s) => {
                const total = studentPct(s);
                const g = GRADE_CLASS[gradeOf(total, thresholds)];
                return (
                  <tr key={s.id}>
                    <td className="sticky-col">
                      <Link
                        href={`/students/${s.id}`}
                        className="whitespace-nowrap font-bold hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    {groups.map((grp) => {
                      const gp = groupPct(s, grp.keys);
                      const gs = GRADE_CLASS[gradeOf(gp, thresholds)];
                      return (
                        <Fragmented key={grp.name}>
                          {grp.keys.map((k) => {
                            const c = cols.find((x) => x.key === k)!;
                            return (
                              <Cells
                                key={k}
                                student={s}
                                column={c}
                                value={valueOf(s, c)}
                                thresholds={thresholds}
                                onChange={(patch) =>
                                  setDraft((cur) => ({
                                    ...cur,
                                    [fieldKey(s, c)]: { ...cur[fieldKey(s, c)], ...patch },
                                  }))
                                }
                              />
                            );
                          })}
                          <td className={`qiyas-group num text-center font-bold ${gs}`}>
                            {gp === null ? "—" : `${gp}%`}
                          </td>
                        </Fragmented>
                      );
                    })}
                    <td className="qiyas-total num text-center font-extrabold">
                      <span className={`qiyas-pill ${g}`}>
                        {total === null ? "—" : `${total}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* الإجماليات */}
            <tfoot>
              <tr className="qiyas-foot">
                <td className="sticky-col font-bold">الإجمالي</td>
                {groups.map((grp) => (
                  <Fragmented key={grp.name}>
                    {grp.keys.map((k) => {
                      const c = cols.find((x) => x.key === k)!;
                      const t = columnTotal(c);
                      const gs = GRADE_CLASS[gradeOf(t?.pct ?? null, thresholds)];
                      return (
                        <Fragmented key={k}>
                          <td className="num text-center">{t ? t.planned : "—"}</td>
                          <td className="num text-center">{t ? t.actual : "—"}</td>
                          <td className={`num text-center font-bold ${gs}`}>
                            {t?.pct === null || !t ? "—" : `${t.pct}%`}
                          </td>
                        </Fragmented>
                      );
                    })}
                    <td className="qiyas-group num text-center font-bold">
                      {(() => {
                        const all = averageRatio(students.map((s) => groupPct(s, grp.keys)));
                        return all === null ? "—" : `${all}%`;
                      })()}
                    </td>
                  </Fragmented>
                ))}
                <td className="qiyas-total num text-center font-extrabold">
                  <span className="qiyas-pill">
                    {(() => {
                      const all = averageRatio(students.map((s) => studentPct(s)));
                      return all === null ? "—" : `${all}%`;
                    })()}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <button className="btn btn-primary text-sm" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : `حفظ قياس ${monthName}`}
        </button>
        {error && (
          <span className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
            {error}
          </span>
        )}
        {saved && !error && !pending && (
          <span className="text-sm font-semibold" style={{ color: "var(--good-text)" }}>
            ✓ حُفظ القياس
          </span>
        )}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          المفترض الرمادي من خطة الطالب ولا يُعدَّل · نسبة المحور متوسط نسب بنوده · إجمالي
          العمود مجموعه لأن وحدته واحدة.
        </span>
      </div>
    </form>
  );
}

/** تجميع خلايا بلا عنصر في الـDOM */
function Fragmented({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Cells({
  student,
  column,
  value,
  thresholds,
  onChange,
}: {
  student: QiyasStudent;
  column: QiyasColumn;
  value: ReturnType<() => { cell: QiyasCell; planned: number; actual: number; pct: number | null }> | null;
  thresholds: Thresholds;
  onChange: (patch: { p?: number; a?: number }) => void;
}) {
  const key = `${student.id}:${column.part}:${column.courseId ?? 0}`;
  if (!value) {
    return (
      <>
        <td className="qiyas-off text-center">—</td>
        <td className="qiyas-off text-center">—</td>
        <td className="qiyas-off text-center">—</td>
      </>
    );
  }
  const fromPlan = value.cell.planned !== undefined;
  const g = GRADE_CLASS[gradeOf(value.pct, thresholds)];
  return (
    <>
      <td className="text-center">
        {fromPlan ? (
          <>
            <input type="hidden" name={`p:${key}`} value={value.planned} />
            <span className="num font-bold" style={{ color: "var(--text-muted)" }}>
              {value.planned}
            </span>
          </>
        ) : (
          <input
            name={`p:${key}`}
            type="number"
            min={0}
            defaultValue={value.cell.savedPlanned || ""}
            onChange={(e) => onChange({ p: Number(e.target.value) || 0 })}
            className="input num qiyas-num text-center"
            placeholder="0"
          />
        )}
      </td>
      <td className="text-center">
        <input
          name={`a:${key}`}
          type="number"
          min={0}
          defaultValue={value.cell.actual || ""}
          onChange={(e) => onChange({ a: Number(e.target.value) || 0 })}
          className="input num qiyas-num text-center"
          placeholder="0"
        />
      </td>
      <td className={`num text-center font-bold ${g}`}>
        {value.pct === null ? "—" : `${value.pct}%`}
      </td>
    </>
  );
}
