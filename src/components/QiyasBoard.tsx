"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveQiyas } from "@/app/plan-actions";
import { ratio, type Part } from "@/lib/performance";
import type { Track } from "@/lib/tracks";

export type QiyasMetric = {
  part: Part;
  courseId: number | null;
  label: string;
  unit: string;
  /** المفترض من الخطة — غير محدّد يعني أنه يُدخَل يدويًا */
  planned?: number;
  savedPlanned: number;
  actual: number;
};

export type QiyasStudent = {
  id: number;
  name: string;
  metrics: QiyasMetric[];
  /** مقررات يمكن إضافتها لهذا الشهر: [المعرّف، الاسم، الوحدة] لكل مسار */
  addable: { key: string; label: string; unit: string }[];
};

type Row = QiyasMetric & { key: string };

/** قياس أداء شهر: المفترض والفعلي لكل طالب، في القرآن والمتون */
export default function QiyasBoard({
  track,
  month,
  monthName,
  students,
}: {
  track: Track;
  month: number;
  monthName: string;
  students: QiyasStudent[];
}) {
  const [error, action, pending] = useActionState(saveQiyas, null);
  const [saved, setSaved] = useState(false);
  const [added, setAdded] = useState<Record<number, Row[]>>({});

  const rowsOf = (s: QiyasStudent): Row[] => [
    ...s.metrics.map((m) => ({ ...m, key: `${s.id}:${m.part}:${m.courseId ?? 0}` })),
    ...(added[s.id] ?? []),
  ];

  const scope = useMemo(
    () => students.flatMap((s) => rowsOf(s).map((r) => r.key)).join(","),
    [students, added]
  );

  function addRow(s: QiyasStudent, value: string) {
    const [part, cid] = value.split(":");
    const found = s.addable.find((a) => a.key === value);
    if (!found) return;
    const key = `${s.id}:${part}:${cid}`;
    setAdded((cur) => {
      const list = cur[s.id] ?? [];
      if (list.some((r) => r.key === key) || rowsOf(s).some((r) => r.key === key)) return cur;
      return {
        ...cur,
        [s.id]: [
          ...list,
          {
            key,
            part: part as Part,
            courseId: Number(cid),
            label: found.label,
            unit: found.unit,
            savedPlanned: 0,
            actual: 0,
          },
        ],
      };
    });
  }

  if (students.length === 0) {
    return (
      <p className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        لا طلاب في {track.name} بعد.
      </p>
    );
  }

  return (
    <form action={action} onSubmit={() => setSaved(true)} className="grid gap-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="scope" value={scope} />

      <div className="grid gap-4">
        {students.map((s) => {
          const rows = rowsOf(s);
          const totalPlanned = rows.reduce((a, r) => a + (r.planned ?? r.savedPlanned), 0);
          const totalActual = rows.reduce((a, r) => a + r.actual, 0);
          const pct = ratio(totalPlanned, totalActual);
          return (
            <div key={s.id} className="card p-4" style={{ borderTop: `3px solid ${track.color}` }}>
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <Link href={`/students/${s.id}`} className="font-bold hover:underline">
                  {s.name}
                </Link>
                {pct !== null && (
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: pct >= 100 ? "var(--good-bg)" : `${track.color}1a`,
                      color: pct >= 100 ? "var(--good-text)" : track.color,
                    }}
                  >
                    {pct}%
                  </span>
                )}
                {s.addable.length > 0 && (
                  <select
                    className="input ms-auto w-auto text-xs"
                    value=""
                    onChange={(e) => addRow(s, e.target.value)}
                    aria-label={`أضف بندًا لـ${s.name}`}
                  >
                    <option value="">+ أضف بندًا…</option>
                    {s.addable.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="text-start">البند</th>
                      <th>الوحدة</th>
                      <th className="text-center">المفترض</th>
                      <th className="text-center">الفعلي</th>
                      <th className="text-center">النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <QiyasRow key={r.key} row={r} color={track.color} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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
          المفترض الرمادي مأخوذ من خطة الطالب ولا يُعدَّل، وما سواه تكتبه أنت.
        </span>
      </div>
    </form>
  );
}

function QiyasRow({ row, color }: { row: Row; color: string }) {
  const fromPlan = row.planned !== undefined;
  const [actual, setActual] = useState(row.actual || 0);
  const [planned, setPlanned] = useState(row.savedPlanned || 0);
  const effective = fromPlan ? row.planned! : planned;
  const pct = ratio(effective, actual);

  return (
    <tr>
      <td className="font-semibold">{row.label}</td>
      <td style={{ color: "var(--text-muted)" }}>{row.unit}</td>
      <td className="text-center">
        {fromPlan ? (
          <>
            <input type="hidden" name={`p:${row.key}`} value={row.planned} />
            <span className="num font-bold" style={{ color: "var(--text-muted)" }}>
              {row.planned}
            </span>
          </>
        ) : (
          <input
            name={`p:${row.key}`}
            type="number"
            min={0}
            className="input num mx-auto w-20 text-center"
            value={planned || ""}
            onChange={(e) => setPlanned(Number(e.target.value) || 0)}
            placeholder="0"
          />
        )}
      </td>
      <td className="text-center">
        <input
          name={`a:${row.key}`}
          type="number"
          min={0}
          className="input num mx-auto w-20 text-center"
          value={actual || ""}
          onChange={(e) => setActual(Number(e.target.value) || 0)}
          placeholder="0"
        />
      </td>
      <td className="text-center num">
        {pct === null ? (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        ) : (
          <span
            style={{ color: pct >= 100 ? "var(--good-text)" : color, fontWeight: 700 }}
          >
            {pct}%
          </span>
        )}
      </td>
    </tr>
  );
}
