import Link from "next/link";
import { BulkStudentForm, NewStudentForm } from "@/components/StudentForm";
import { listCourses } from "@/lib/queries";
import { isTrack, TRACKS } from "@/lib/tracks";
import type { TrackKey } from "@/lib/tracks";
import type { Course } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track: raw } = await searchParams;
  const defaultTrack = (isTrack(raw) ? raw : "tarbawi") as TrackKey;
  const courses = await listCourses();
  const byTrack = new Map<TrackKey, Course[]>(
    TRACKS.map((t) => [t.key, courses.filter((c) => c.track === t.key)])
  );
  const empty = TRACKS.filter((t) => (byTrack.get(t.key) ?? []).length === 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="page-title text-xl">إضافة طالب</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            اكتب بيانات طالب واحد، أو ألصق قائمة أسماء دفعةً واحدة.
          </p>
        </div>
        <Link className="btn btn-ghost ms-auto text-sm" href="/students">
          رجوع
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TRACKS.map((t) => {
          const list = byTrack.get(t.key) ?? [];
          return (
            <div key={t.key} className="card p-4" style={{ borderTop: `3px solid ${t.color}` }}>
              <div className="font-bold" style={{ color: t.color }}>
                {t.name}
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {list.length > 0 ? list.map((c) => c.name).join(" · ") : "لا مقررات بعد"}
              </p>
            </div>
          );
        })}
      </div>

      {empty.length > 0 && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {empty.map((t) => t.name).join(" و")} بلا مقررات بعد — أضفها من{" "}
          <Link href="/courses" className="font-semibold underline">
            صفحة المقررات
          </Link>{" "}
          قبل أن تقسّم لطلابها.
        </p>
      )}

      <NewStudentForm defaultTrack={defaultTrack} />

      <BulkStudentForm defaultTrack={defaultTrack} />
    </div>
  );
}
