"use client";

import { useActionState, useMemo, useState } from "react";
import { savePlan } from "@/app/plan-actions";
import { CADENCES, cadenceInfo, gregShort, periodsOf, YEAR_END, YEAR_START } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
  periodCount,
  periodsLabel,
  portionText,
  sessionsNeeded,
  spanOf,
  suggestRate,
  unitLabel,
  type Course,
  type Pick,
} from "@/lib/plan";

/** لون ثابت لكل مقرر حسب ترتيبه — يستعمل في الشريط والجدول */
export const COURSE_COLORS = [
  "#4f6228", // زيتوني — عناوين الملف
  "#a8791f", // ذهب الشعار (أغمق ليقرأ على الأبيض)
  "#31869b", // تركوازي — مبيت
  "#953734", // أحمر — ملتقى
  "#6b4f96", // بنفسجي — النادي الصيفي
  "#974806", // بنّي كهرماني — أيام الأسبوع
  "#39707a", // أزرق مخضرّ
  "#5c6b2b", // زيتوني فاتح
];

/** مقرر في خطة الطالب — بلا بداية، لأنها تُحسب من الترتيب */
type Entry = { courseId: number; memoPer: number; explPer: number };

export default function PlanWizard({ courses }: { courses: Course[] }) {
  const [error, action, pending] = useActionState(savePlan, null);
  const [step, setStep] = useState<"who" | "choose" | "split" | "review">("who");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [plan, setPlan] = useState<Entry[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const colorOf = (id: number) => COURSE_COLORS[courses.findIndex((c) => c.id === id) % COURSE_COLORS.length];
  const info = cadenceInfo(cadence);
  const periods = useMemo(() => periodsOf(cadence), [cadence]);
  const total = periods.length;

  /**
   * الطالب لا يدرس مقررين في وقت واحد، فبداية كل مقرر تُشتقّ من ترتيبه:
   * يبدأ حيث انتهى الذي قبله. لا يُخزَّن «start» مستقلًا حتى لا يتضارب.
   */
  const picks: Pick[] = useMemo(() => {
    let start = 0;
    return plan.map((e) => {
      const course = courses.find((c) => c.id === e.courseId);
      const pick = { courseId: e.courseId, memoPer: e.memoPer, explPer: e.explPer, start };
      if (course) start += sessionsNeeded(course, e.memoPer, e.explPer);
      return pick;
    });
  }, [plan, courses]);

  const done = plan.length;
  /** المقررات التي لم يقسّمها بعد — الخطة لا تُحفظ قبل أن تكتمل */
  const remainingCourses = courses.filter((c) => !plan.some((e) => e.courseId === c.id));
  const current = courses.find((c) => c.id === currentId) ?? null;
  const currentIndex = plan.findIndex((e) => e.courseId === currentId);

  /** نهاية آخر مقرر في الخطة — بداية أي مقرر جديد */
  const planEnd = useMemo(() => {
    let end = 0;
    for (const e of plan) {
      const c = courses.find((x) => x.id === e.courseId);
      if (c) end += sessionsNeeded(c, e.memoPer, e.explPer);
    }
    return end;
  }, [plan, courses]);

  /** بداية المقرر المفتوح حاليًا */
  const currentStart = currentIndex >= 0 ? picks[currentIndex].start : planEnd;

  function openCourse(course: Course) {
    setCurrentId(course.id);
    if (!plan.some((e) => e.courseId === course.id)) {
      // النصيب الافتراضي يتناسب مع حجم المقرر لا بالتساوي، وإلا خنق الكبيرُ
      // ما بعده (التاريخ 750 صفحة لا يساوي متنًا من 154 بيتًا)
      const rest = courses.filter((c) => !plan.some((e) => e.courseId === c.id));
      const weight = (c: Course) => Math.max(memoTotal(c), explTotal(c), 1);
      const sum = rest.reduce((a, c) => a + weight(c), 0) || 1;
      const left = Math.max(1, total - planEnd);
      const share = Math.max(1, Math.round((left * weight(course)) / sum));
      setPlan((cur) => [
        ...cur,
        {
          courseId: course.id,
          memoPer: course.has_memo ? suggestRate(memoTotal(course), share) : 0,
          explPer: course.has_expl ? suggestRate(explTotal(course), share) : 0,
        },
      ]);
    }
    setStep("split");
  }

  function removeCourse(id: number) {
    setPlan((cur) => cur.filter((e) => e.courseId !== id));
  }

  const schedule = useMemo(
    () => buildSchedule(courses, picks, cadence),
    [courses, picks, cadence]
  );
  const used = schedule.filter((r) => r.portions.length > 0).length;

  return (
    <div className="grid gap-5">
      <Stepper step={step} done={done} />

      {step === "who" && (
        <div className="card p-5 grid gap-4">
          <div>
            <h2 className="text-lg font-bold">أهلًا بك</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              بعدها نختار المقرر الذي تبدأ به، ونقسّمه معك على السنة — دراسة ذاتية بمعدّل تختاره
              أنت.
            </p>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="label">الاسم الكامل</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">رقم الجوال (اختياري)</label>
              <input
                className="input"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
              />
            </div>
          </div>
          <div>
            <label className="label">كيف تحب تقسّم مقرراتك؟</label>
            <div className="grid grid-cols-3 gap-2">
              {CADENCES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setCadence(c.key);
                    setPlan([]);
                  }}
                  className="rounded-xl border py-3 text-sm font-bold transition"
                  style={{
                    borderColor: cadence === c.key ? "var(--brand-olive)" : "var(--hairline)",
                    background:
                      cadence === c.key ? "var(--brand-sage-soft)" : "var(--surface-1)",
                    color: cadence === c.key ? "var(--brand-olive-strong)" : "var(--text-secondary)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              تحدّد مقدارك {info.per} — والخطة تُبنى على {periodsLabel(total, cadence)} في السنة.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary justify-center"
            disabled={name.trim().length < 3}
            onClick={() => setStep("choose")}
          >
            التالي
          </button>
        </div>
      )}

      {step === "choose" && (
        <div className="card p-5 grid gap-4">
          <div>
            <h2 className="text-lg font-bold">
              {done === 0 ? "بأي مقرر تحب تبدأ؟" : "اختر المقرر التالي"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              اضغط على المقرر لتقسيمه — واحدًا تلو الآخر حتى تقسّم المقررات كلها.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => {
              const idx = plan.findIndex((e) => e.courseId === c.id);
              const d = idx >= 0 ? plan[idx] : null;
              const span = d ? spanOf(c, picks[idx], cadence) : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCourse(c)}
                  className="rounded-xl border p-4 text-right transition hover:opacity-85"
                  style={{
                    borderColor: d ? colorOf(c.id) : "var(--hairline)",
                    background: d ? `${colorOf(c.id)}14` : "var(--surface-1)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: colorOf(c.id) }}
                    />
                    <span className="font-bold">{c.name}</span>
                    {d && <span className="ms-auto text-xs font-bold">✓ مقسّم</span>}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.subject && <span>{c.subject} · </span>}
                    {trackSummary(c)}
                  </div>
                  {span?.endPeriod && (
                    <div className="mt-2 text-xs font-semibold" style={{ color: colorOf(c.id) }}>
                      {periodsLabel(span.count, cadence)} · ينتهي {span.endPeriod?.hijri}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <YearStrip picks={picks} courses={courses} colorOf={colorOf} cadence={cadence} />
          {remainingCourses.length > 0 && (
            <p className="text-sm font-semibold" style={{ color: "var(--brand-amber)" }}>
              بقي لك {remainingCourses.length === 1 ? "مقرر واحد" : `${remainingCourses.length} مقررات`}:{" "}
              {remainingCourses.map((c) => c.name).join("، ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-good"
              disabled={remainingCourses.length > 0}
              onClick={() => setStep("review")}
            >
              أنهيت التقسيم — راجع الخطة
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("who")}>
              رجوع
            </button>
          </div>
        </div>
      )}

      {step === "split" && current && (
        <SplitCourse
          course={current}
          value={plan[currentIndex]}
          start={currentStart}
          color={colorOf(current.id)}
          cadence={cadence}
          remaining={total - currentStart}
          onChange={(v) =>
            setPlan((cur) => cur.map((e, i) => (i === currentIndex ? { ...e, ...v } : e)))
          }
          onRemove={() => {
            removeCourse(current.id);
            setStep("choose");
          }}
          onDone={() => setStep("choose")}
        />
      )}

      {step === "review" && (
        <form action={action} className="grid gap-4">
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="notes" value={notes} />
          <input type="hidden" name="cadence" value={cadence} />
          <input type="hidden" name="picks" value={JSON.stringify(picks)} />

          <div className="card p-5 grid gap-4">
            <h2 className="text-lg font-bold">راجع خطتك قبل الحفظ</h2>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <Fact label="الطالب" value={name} />
              <Fact label="عدد المقررات" value={`${done}`} />
              <Fact label={`${info.plural} المشغولة`} value={`${used} من ${total}`} />
            </div>
            <YearStrip picks={picks} courses={courses} colorOf={colorOf} cadence={cadence} />
            {total - planEnd > 0 && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
              >
                تنتهي خطتك قبل نهاية السنة بـ{periodsLabel(total - planEnd, cadence)} — إن أردت
                ملء السنة كلها فارجع وخفّف معدّل آخر مقرر.
              </p>
            )}
            <div>
              <label className="label">ملاحظة تحب تضيفها للمشرف (اختياري)</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm font-semibold" style={{ color: "var(--critical)" }}>
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={pending}>
                {pending ? "جارٍ الحفظ…" : "احفظ الخطة"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setStep("choose")}>
                تعديل التقسيم
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">{info.each}</th>
                  <th>التاريخ الهجري</th>
                  <th>الميلادي</th>
                  <th>المقرر</th>
                  <th>الحفظ</th>
                  <th>الشرح / القراءة</th>
                </tr>
              </thead>
              <tbody>
                {schedule
                  .filter((r) => r.portions.length > 0)
                  .map((r) => (
                    <tr key={r.no}>
                      <td className="num">{r.no}</td>
                      <td>{r.period.hijri}</td>
                      <td className="num" dir="ltr">
                        {r.period.gregorian.includes("→")
                          ? r.period.gregorian
                              .split(" → ")
                              .map(gregShort)
                              .join(" → ")
                          : gregShort(r.period.gregorian)}
                      </td>
                      <td>
                        <div className="grid gap-1">
                          {r.portions.map((p) => (
                            <span key={p.course.id} style={{ color: colorOf(p.course.id) }}>
                              {p.course.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="num">
                        <div className="grid gap-1">
                          {r.portions.map((p) => (
                            <span key={p.course.id}>{portionText(p.memoFrom, p.memoTo)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="num">
                        <div className="grid gap-1">
                          {r.portions.map((p) => (
                            <span key={p.course.id}>{portionText(p.explFrom, p.explTo)}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </div>
  );
}

/** وصف مختصر لمساري المقرر وحجميهما */
function trackSummary(c: Course): string {
  const parts: string[] = [];
  if (c.has_memo) parts.push(`حفظ ${unitLabel(memoTotal(c), c.unit)}`);
  if (c.has_expl) parts.push(`${c.expl_label} ${unitLabel(explTotal(c), c.unit)}`);
  return parts.join(" · ");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function Stepper({ step, done }: { step: string; done: number }) {
  const items = [
    { key: "who", label: "التعريف" },
    { key: "choose", label: "المقررات" },
    { key: "split", label: "التقسيم" },
    { key: "review", label: "المراجعة" },
  ];
  const at = items.findIndex((i) => i.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      {items.map((it, i) => (
        <li
          key={it.key}
          className="rounded-full border px-3 py-1"
          style={{
            borderColor: i <= at ? "var(--brand-orange)" : "var(--hairline)",
            color: i <= at ? "var(--brand-orange)" : "var(--text-muted)",
            background: i === at ? "var(--surface-1)" : "transparent",
          }}
        >
          {i + 1}. {it.label}
          {it.key === "choose" && done > 0 ? ` (${done})` : ""}
        </li>
      ))}
    </ol>
  );
}

/** شريط السنة: 33 خانة تمثل لقاءات الدفعة، ملوّنة بحسب المقرر */
/** شريط السنة: خانة لكل أسبوع مهما كانت وحدة التقسيم، ملوّنة بمقررات تلك المدة */
const STRIP_CELLS = 52;

function YearStrip({
  picks,
  courses,
  colorOf,
  cadence,
}: {
  picks: Pick[];
  courses: Course[];
  colorOf: (id: number) => string;
  cadence: Cadence;
}) {
  const periods = periodsOf(cadence);
  const cells: string[][] = Array.from({ length: STRIP_CELLS }, () => []);
  const lastDay = periods[periods.length - 1]?.last.index ?? 1;

  for (const p of picks) {
    const c = courses.find((x) => x.id === p.courseId);
    if (!c) continue;
    const n = sessionsNeeded(c, p.memoPer, p.explPer);
    if (n === 0) continue;
    const from = periods[Math.min(p.start, periods.length - 1)]?.first.index ?? 0;
    const to = periods[Math.min(p.start + n - 1, periods.length - 1)]?.last.index ?? lastDay;
    const a = Math.floor((from / (lastDay + 1)) * STRIP_CELLS);
    const b = Math.min(STRIP_CELLS - 1, Math.floor((to / (lastDay + 1)) * STRIP_CELLS));
    for (let i = a; i <= b; i++) if (!cells[i].includes(colorOf(c.id))) cells[i].push(colorOf(c.id));
  }

  return (
    <div>
      <div
        className="mb-1 flex items-center justify-between text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <span>{YEAR_START.hijri}</span>
        <span>{YEAR_END.hijri}</span>
      </div>
      <div className="flex gap-[2px]">
        {cells.map((colors, i) => (
          <div
            key={i}
            className="h-6 flex-1 overflow-hidden rounded-[3px] border"
            style={{ borderColor: "var(--hairline)", background: "var(--surface-stripe)" }}
          >
            {colors.map((col, j) => (
              <div key={j} style={{ background: col, height: `${100 / colors.length}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitCourse({
  course,
  value,
  start,
  color,
  cadence,
  remaining,
  onChange,
  onRemove,
  onDone,
}: {
  course: Course;
  value: { memoPer: number; explPer: number };
  /** الفترة التي يبدأ منها — محسوبة من ترتيب المقرر، لا يختارها الطالب */
  start: number;
  color: string;
  cadence: Cadence;
  /** ما تبقّى من فترات السنة بعد المقررات السابقة */
  remaining: number;
  onChange: (v: { memoPer: number; explPer: number }) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const info = cadenceInfo(cadence);
  const span = spanOf(course, { courseId: course.id, ...value, start }, cadence);
  const set = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });

  const presets = [
    { label: "على مهل", count: remaining },
    { label: "متوازن", count: Math.max(1, Math.ceil(remaining / 2)) },
    { label: "مكثّف", count: Math.max(1, Math.ceil(remaining / 4)) },
  ];

  function applyPreset(count: number) {
    set({
      memoPer: course.has_memo ? suggestRate(memoTotal(course), count) : 0,
      explPer: course.has_expl ? suggestRate(explTotal(course), count) : 0,
    });
  }

  return (
    <div className="card p-5 grid gap-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: color }} />
        <div>
          <h2 className="text-lg font-bold">{course.name}</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {course.subject && <span>{course.subject} · </span>}
            {trackSummary(course)} — كم تأخذ {info.per}؟
          </p>
        </div>
      </div>

      <p
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
      >
        {start === 0
          ? "هذا أول مقرر في خطتك — يبدأ من أول السنة."
          : "يبدأ بعد أن تُنهي المقرر السابق — لا تدرس مقررين في وقت واحد."}
        {" "}المتبقّي من السنة: <strong>{periodsLabel(remaining, cadence)}</strong>.
      </p>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => applyPreset(p.count)}
          >
            {p.label} · {periodsLabel(p.count, cadence)}
          </button>
        ))}
      </div>

      {course.has_memo && (
        <Stepper2
          label={`الحفظ ${info.per} — من ${unitLabel(memoTotal(course), course.unit)}`}
          unit={course.unit}
          each={info.each}
          max={memoTotal(course)}
          value={value.memoPer}
          color={color}
          onChange={(memoPer) => set({ memoPer })}
        />
      )}
      {course.has_expl && (
        <Stepper2
          label={`ال${course.expl_label} ${info.per} — من ${unitLabel(explTotal(course), course.unit)}`}
          unit={course.unit}
          each={info.each}
          max={explTotal(course)}
          value={value.explPer}
          color={color}
          onChange={(explPer) => set({ explPer })}
        />
      )}

      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: `${color}14`, border: `1px solid ${color}44` }}
      >
        {span.count === 0 ? (
          <span style={{ color: "var(--critical)" }}>
            حدّد مقدارًا للحفظ أو لل{course.expl_label}.
          </span>
        ) : span.overflow ? (
          <span style={{ color: "var(--critical)" }}>
            بهذا المعدل يحتاج المقرر {periodsLabel(span.count, cadence)}، والمتبقّي من السنة
            {" "}{periodsLabel(remaining, cadence)} فقط — زد المقدار.
          </span>
        ) : (
          <>
            <div className="font-bold" style={{ color }}>
              ينتهي المقرر في {periodsLabel(span.count, cadence)}
            </div>
            <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
              من {span.startPeriod?.first.hijri} إلى {span.endPeriod?.last.hijri}
              <span dir="ltr" className="num mx-1">
                ({gregShort(span.startPeriod?.first.gregorian ?? "")} →{" "}
                {gregShort(span.endPeriod?.last.gregorian ?? "")})
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={span.count === 0 || span.overflow}
          onClick={onDone}
        >
          حفظ التقسيم
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRemove}>
          احذف المقرر من خطتي
        </button>
      </div>
    </div>
  );
}

function Stepper2({
  label,
  unit,
  each,
  max,
  value,
  color,
  onChange,
}: {
  label: string;
  unit: string;
  /** «اليوم» أو «الأسبوع» أو «الشهر» — يظهر تحت الرقم */
  each: string;
  max: number;
  value: number;
  color: string;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(0, n));
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost h-11 w-11 justify-center text-xl"
          onClick={() => onChange(clamp(value - 1))}
          aria-label="أنقص"
        >
          −
        </button>
        <div className="min-w-24 text-center">
          <div className="text-2xl font-extrabold num" style={{ color }}>
            {value}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {unit} / {each.replace("ال", "")}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost h-11 w-11 justify-center text-xl"
          onClick={() => onChange(clamp(value + 1))}
          aria-label="زد"
        >
          +
        </button>
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="flex-1 accent-current"
          style={{ accentColor: color }}
        />
      </div>
    </div>
  );
}
