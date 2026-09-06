"use client";

import { useActionState, useMemo, useState } from "react";
import { savePlan } from "@/app/plan-actions";
import { CADENCES, cadenceInfo, gregShort, periodsOf, YEAR_END, YEAR_START } from "@/lib/calendar";
import type { Cadence } from "@/lib/calendar";
import {
  buildSchedule,
  explTotal,
  memoTotal,
  monthsForPeriods,
  monthsLabel,
  periodsForMonths,
  portionText,
  rateFor,
  sessionsNeeded,
  spanOf,
  unitLabel,
  YEAR_MONTHS,
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

/** مقرر في خطة الطالب: مدته بالأشهر فقط — البداية والمقادير تُشتقّ */
type Entry = { courseId: number; months: number };

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
      if (!course) return { courseId: e.courseId, memoPer: 0, explPer: 0, start };
      const pick = {
        courseId: e.courseId,
        memoPer: rateFor(memoTotal(course), e.months, cadence),
        explPer: rateFor(explTotal(course), e.months, cadence),
        start,
      };
      start += sessionsNeeded(course, pick.memoPer, pick.explPer);
      return pick;
    });
  }, [plan, courses, cadence]);

  const done = plan.length;
  /** المقررات التي لم يقسّمها بعد — الخطة لا تُحفظ قبل أن تكتمل */
  const remainingCourses = courses.filter((c) => !plan.some((e) => e.courseId === c.id));
  const current = courses.find((c) => c.id === currentId) ?? null;
  const currentIndex = plan.findIndex((e) => e.courseId === currentId);

  /** نهاية آخر مقرر في الخطة — بداية أي مقرر جديد */
  const planEnd = useMemo(() => {
    const last = picks[picks.length - 1];
    if (!last) return 0;
    const c = courses.find((x) => x.id === last.courseId);
    return last.start + (c ? sessionsNeeded(c, last.memoPer, last.explPer) : 0);
  }, [picks, courses]);

  /** ميزانية الطالب بالأشهر: ما استهلكه وما بقي */
  const usedMonths = Math.min(YEAR_MONTHS, monthsForPeriods(planEnd, cadence) - (planEnd ? 0 : 1));
  const freeMonths = Math.max(0, YEAR_MONTHS - (planEnd ? usedMonths : 0));

  /** بداية المقرر المفتوح حاليًا */
  const currentStart = currentIndex >= 0 ? picks[currentIndex].start : planEnd;

  function openCourse(course: Course) {
    setCurrentId(course.id);
    if (!plan.some((e) => e.courseId === course.id)) {
      // المدة الافتراضية تتناسب مع حجم المقرر لا بالتساوي، وإلا خنق الكبيرُ
      // ما بعده (التاريخ 750 صفحة لا يساوي متنًا من 154 بيتًا)
      const rest = courses.filter((c) => !plan.some((e) => e.courseId === c.id));
      const weight = (c: Course) => Math.max(memoTotal(c), explTotal(c), 1);
      const sum = rest.reduce((a, c) => a + weight(c), 0) || 1;
      const share = Math.max(1, Math.round((Math.max(1, freeMonths) * weight(course)) / sum));
      setPlan((cur) => [...cur, { courseId: course.id, months: Math.min(share, Math.max(1, freeMonths)) }]);
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
            <label className="label">كيف تحب تستلم خطتك؟</label>
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
              الخطة تُكتب لك «كم تحفظ {info.per}».
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
              اضغط على المقرر وحدّد في كم شهرًا تنهيه — واحدًا تلو الآخر حتى تكمل الخمسة.
            </p>
            <p className="mt-2 text-sm font-bold" style={{ color: "var(--brand-olive)" }}>
              {freeMonths >= YEAR_MONTHS
                ? `أمامك ${monthsLabel(YEAR_MONTHS)} توزّعها على المقررات`
                : freeMonths > 0
                  ? `استهلكت ${monthsLabel(YEAR_MONTHS - freeMonths)} · بقي لك ${monthsLabel(freeMonths)}`
                  : "اكتملت السنة — لم يبقَ وقت لمقرر آخر"}
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
                      {monthsLabel(monthsForPeriods(span.count, cadence))} · ينتهي{" "}
                      {span.endPeriod?.last.hijri}
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
          months={plan[currentIndex]?.months ?? 1}
          start={currentStart}
          color={colorOf(current.id)}
          cadence={cadence}
          maxMonths={Math.max(1, YEAR_MONTHS - monthsForPeriods(currentStart, cadence) + (currentStart ? 0 : 1))}
          onChange={(months) =>
            setPlan((cur) => cur.map((e, i) => (i === currentIndex ? { ...e, months } : e)))
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
              <Fact label="مدة الخطة" value={monthsLabel(Math.max(0, YEAR_MONTHS - freeMonths))} />
            </div>
            <YearStrip picks={picks} courses={courses} colorOf={colorOf} cadence={cadence} />
            {total - planEnd > 0 && (
              <p
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--surface-stripe)", color: "var(--text-secondary)" }}
              >
                تنتهي خطتك قبل نهاية السنة بـ{monthsLabel(freeMonths)} — إن أردت ملء السنة
                كلها فارجع وزد مدة أحد المقررات.
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

          <div className="card">
            {/* حاوية سحب مستقلة: overflow:hidden في البطاقة يطغى على السحب لو وُضع عليها */}
            <div className="overflow-x-auto">
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
  months,
  start,
  color,
  cadence,
  maxMonths,
  onChange,
  onRemove,
  onDone,
}: {
  course: Course;
  /** مدة المقرر بالأشهر — هذا كل ما يختاره الطالب */
  months: number;
  /** الفترة التي يبدأ منها — محسوبة من ترتيب المقرر */
  start: number;
  color: string;
  cadence: Cadence;
  /** أقصى مدة تسعها بقية السنة */
  maxMonths: number;
  onChange: (months: number) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const info = cadenceInfo(cadence);
  const value = Math.min(Math.max(1, months), maxMonths);
  const memoPer = rateFor(memoTotal(course), value, cadence);
  const explPer = rateFor(explTotal(course), value, cadence);
  const span = spanOf(course, { courseId: course.id, memoPer, explPer, start }, cadence);
  const quick = [1, 2, 3, 4, 6, 8, 12].filter((m) => m <= maxMonths);

  return (
    <div className="card p-5 grid gap-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{course.name}</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {course.subject && <span>{course.subject} · </span>}
            {trackSummary(course)}
          </p>
        </div>
      </div>

      {/* السؤال الوحيد: في كم تنهيه؟ */}
      <div>
        <label className="label text-base">في كم مدة تنهي هذا المقرر؟</label>
        <div className="mt-2 flex items-center justify-center gap-4">
          <button
            type="button"
            className="btn btn-ghost h-12 w-12 shrink-0 justify-center text-2xl"
            disabled={value <= 1}
            onClick={() => onChange(value - 1)}
            aria-label="أنقص شهرًا"
          >
            −
          </button>
          <div className="min-w-32 text-center">
            <div className="text-3xl font-extrabold" style={{ color }}>
              {monthsLabel(value)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost h-12 w-12 shrink-0 justify-center text-2xl"
            disabled={value >= maxMonths}
            onClick={() => onChange(value + 1)}
            aria-label="زد شهرًا"
          >
            +
          </button>
        </div>
        {quick.length > 1 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {quick.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange(m)}
                className="rounded-full border px-3 py-1 text-sm font-bold transition"
                style={{
                  borderColor: m === value ? color : "var(--hairline)",
                  background: m === value ? `${color}18` : "transparent",
                  color: m === value ? color : "var(--text-secondary)",
                }}
              >
                {monthsLabel(m)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ماذا يعني هذا الاختيار بالضبط */}
      <div
        className="rounded-xl p-4"
        style={{ background: `${color}12`, border: `1px solid ${color}44` }}
      >
        <div className="text-sm font-bold" style={{ color }}>
          يعني عليك {info.per}:
        </div>
        <ul className="mt-2 grid gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {course.has_memo && (
            <li>
              🧠 حفظ <strong>{unitLabel(memoPer, course.unit)}</strong>
            </li>
          )}
          {course.has_expl && (
            <li>
              📖 {course.expl_label} <strong>{unitLabel(explPer, course.unit)}</strong>
            </li>
          )}
        </ul>
        <div className="mt-3 border-t pt-2 text-xs" style={{ borderColor: `${color}33`, color: "var(--text-muted)" }}>
          يبدأ {span.startPeriod?.first.hijri} وينتهي {span.endPeriod?.last.hijri}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {start === 0
          ? "هذا أول مقرر في خطتك — يبدأ من أول السنة."
          : "يبدأ بعد أن تُنهي المقرر السابق — لا تدرس مقررين في وقت واحد."}
        {" "}المتاح لهذا المقرر وما بعده: <strong>{monthsLabel(maxMonths)}</strong>.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          حفظ التقسيم
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRemove}>
          احذف المقرر من خطتي
        </button>
      </div>
    </div>
  );
}

