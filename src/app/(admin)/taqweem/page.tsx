import { DARK_EVENTS, EVENT_COLOR, EVENT_LABEL, gregShort, monthsOfYear, SESSIONS, WEEKDAYS } from "@/lib/calendar";
import type { EventKey } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const LEGEND: EventKey[] = [
  "session",
  "tamkeen",
  "recital",
  "quran",
  "himma",
  "intensive",
  "sleepover",
  "forum",
  "summer",
  "ramadan10",
  "break",
  "weekend",
];

export default function TaqweemPage() {
  const months = monthsOfYear();
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="page-title text-xl">الخطة الزمنية للسنة</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          منقولة كما هي من ملف تمكين 48 — أيام «لقاء الدفعة» ({SESSIONS.length} لقاءً) هي التي
          تُبنى عليها خطط الطلاب.
        </p>
      </div>

      <div className="card flex flex-wrap gap-2 p-4">
        {LEGEND.map((k) => (
          <span
            key={k}
            className="rounded-md px-2.5 py-1 text-xs font-bold"
            style={{
              background: EVENT_COLOR[k],
              color: DARK_EVENTS.includes(k) ? "#fff" : "#22280f",
            }}
          >
            {EVENT_LABEL[k]}
          </span>
        ))}
      </div>

      <div className="grid gap-4">
        {months.map((m) => (
          <div key={m.key} className="card p-4">
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="font-bold">
                {m.name} {m.year}هـ
              </h2>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {m.term} · {gregShort(m.days[0].gregorian)} – {gregShort(m.days[m.days.length - 1].gregorian)}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-[11px] font-bold" style={{ color: "var(--brand-amber)" }}>
                  {w}
                </div>
              ))}
              {Array.from({ length: m.days[0].weekdayIndex }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {m.days.map((d) => (
                <div
                  key={d.index}
                  title={`${d.hijri} — ${EVENT_LABEL[d.event] || "لا يوجد نشاط"}`}
                  className="rounded-md border py-1.5 text-xs font-semibold num"
                  style={{
                    background: d.event === "none" ? "var(--surface-1)" : EVENT_COLOR[d.event],
                    borderColor: "var(--hairline)",
                    color: DARK_EVENTS.includes(d.event) ? "#fff" : "#22280f",
                  }}
                >
                  {d.hd}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
