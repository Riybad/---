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
  /** بنود يمكن إضافتها لهذا الشهر */
  addable: { key: string; label: string; unit: string }[];
};

type Row = QiyasMetric & { key: string };

/** قياس أداء شهر: الطلاب كلهم في جدول واحد، صفٌّ لكل بند */
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

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table qiyas">
            <thead>
              <tr>
                <th className="sticky-col text-start">الطالب</th>
                <th className="text-start">البند</th>
                <th>الوحدة</th>
                <th className="text-center">المفترض</th>
                <th className="text-center">الفعلي</th>
                <th className="text-center">النسبة</th>
              </tr>
            </thead>
            {students.map((s, i) => {
              const rows = rowsOf(s);
              const totalPlanned = rows.reduce((a, r) => a + (r.planned ?? r.savedPlanned), 0);
              const totalActual = rows.reduce((a, r) => a + r.actual, 0);
              const pct = ratio(totalPlanned, totalActual);
              // تظليل متناوب لكل طالب ليُفصَل عمّن قبله مهما طالت بنوده
              const band = i % 2 === 1 ? "var(--surface-stripe)" : undefined;
              return (
                <tbody key={s.id} style={{ borderTop: `2px solid ${track.color}33` }}>
                  {rows.map((r, j) => (
                    <QiyasRow
                      key={r.key}
                      row={r}
                      color={track.color}
                      band={band}
                      lead={
                        j > 0 ? null : (
                          <td
                            rowSpan={rows.length}
                            className="sticky-col align-top"
                            style={band ? { background: band } : undefined}
                          >
                            <Link
                              href={`/students/${s.id}`}
                              className="whitespace-nowrap font-bold hover:underline"
                            >
                              {s.name}
                            </Link>
                            {pct !== null && (
                              <div
                                className="mt-1 text-xs font-bold num"
                                style={{ color: pct >= 100 ? "var(--good-text)" : track.color }}
                              >
                                {pct}%
                              </div>
                            )}
                            {s.addable.length > 0 && (
                              <select
                                className="input qiyas-add mt-2 px-1 py-1 text-[11px]"
                                value=""
                                onChange={(e) => addRow(s, e.target.value)}
                                aria-label={`أضف بندًا لـ${s.name}`}
                              >
                                <option value="">+ بند…</option>
                                {s.addable.map((a) => (
                                  <option key={a.key} value={a.key}>
                                    {a.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        )
                      }
                    />
                  ))}
                </tbody>
              );
            })}
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
          المفترض الرمادي مأخوذ من خطة الطالب ولا يُعدَّل، وما سواه تكتبه أنت.
        </span>
      </div>
    </form>
  );
}

function QiyasRow({
  row,
  color,
  band,
  lead,
}: {
  row: Row;
  color: string;
  band?: string;
  lead: React.ReactNode;
}) {
  const fromPlan = row.planned !== undefined;
  const [actual, setActual] = useState(row.actual || 0);
  const [planned, setPlanned] = useState(row.savedPlanned || 0);
  const effective = fromPlan ? row.planned! : planned;
  const pct = ratio(effective, actual);
  const cell = band ? { background: band } : undefined;

  return (
    <tr>
      {lead}
      <td className="qiyas-item font-semibold" style={cell}>
        {row.label}
      </td>
      <td style={{ ...cell, color: "var(--text-muted)" }}>{row.unit}</td>
      <td className="text-center" style={cell}>
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
            className="input num qiyas-num text-center"
            value={planned || ""}
            onChange={(e) => setPlanned(Number(e.target.value) || 0)}
            placeholder="0"
          />
        )}
      </td>
      <td className="text-center" style={cell}>
        <input
          name={`a:${row.key}`}
          type="number"
          min={0}
          className="input num qiyas-num text-center"
          value={actual || ""}
          onChange={(e) => setActual(Number(e.target.value) || 0)}
          placeholder="0"
        />
      </td>
      <td className="text-center num" style={cell}>
        {pct === null ? (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        ) : (
          <span style={{ color: pct >= 100 ? "var(--good-text)" : color, fontWeight: 700 }}>
            {pct}%
          </span>
        )}
      </td>
    </tr>
  );
}
