import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Brand from "@/components/Brand";
import CopyButton from "@/components/CopyButton";
import PlanTable, { CourseSummary } from "@/components/PlanTable";
import type { Cadence } from "@/lib/calendar";
import { getStudentByToken, listCourses, listPlanItems, toPicks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StudentPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const student = await getStudentByToken(token);
  if (!student) notFound();

  const [courses, items] = await Promise.all([listCourses(true), listPlanItems(student.id)]);
  const picks = toPicks(items);
  const cadence = (student.cadence || "weekly") as Cadence;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const planUrl = `${proto}://${host}/khitta/${token}`;

  return (
    <main className="sunny sunny-bg min-h-screen p-4">
      <div className="mx-auto grid w-full max-w-4xl gap-4">
        <div className="card sunny-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Brand />
            <div className="ms-auto flex flex-wrap gap-2">
              <a className="btn btn-primary text-sm" href={`/api/export/khitta/${token}`}>
                تحميل الخطة إكسل
              </a>
              <a
                className="btn btn-ghost text-sm"
                href={`/api/export/khitta/${token}?format=table`}
              >
                جدول تفصيلي
              </a>
              <CopyButton text={planUrl} label="نسخ رابط خطتي" />
            </div>
          </div>
          <div className="tamkeen-band mt-5 text-center">
            ✅ خطة {student.name} محفوظة
          </div>
          <p className="mt-3 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            احتفظ برابط هذه الصفحة — ترجع له وقت ما تبي، والمشرف يشوف خطتك في اللوحة.
          </p>
          <p
            className="mt-2 break-all text-center text-xs num"
            style={{ color: "var(--text-muted)" }}
          >
            {planUrl}
          </p>
        </div>

        <div className="card sunny-card p-5">
          <h2 className="mb-3 font-bold">مقررات الخطة</h2>
          <CourseSummary courses={courses} picks={picks} cadence={cadence} />
        </div>

        <div className="card sunny-card">
          <h2 className="p-4 pb-0 font-bold">جدول الخطة</h2>
          <PlanTable courses={courses} picks={picks} cadence={cadence} />
        </div>

        <p className="text-center text-sm">
          <Link href="/khitta" className="underline" style={{ color: "var(--brand-olive)" }}>
            تسجيل خطة طالب آخر
          </Link>
        </p>
      </div>
    </main>
  );
}
