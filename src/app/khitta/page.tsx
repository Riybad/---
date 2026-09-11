import type { Metadata } from "next";
import PlanWizard from "@/components/PlanWizard";
import { listCourses } from "@/lib/queries";
import { PUBLIC_TRACK, trackInfo } from "@/lib/tracks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "خطتي السنوية — نخب",
  description: "قسّم مقرراتك الخمسة على السنة بين الحفظ والشرح، واحفظ خطتك برابط خاص بك.",
  openGraph: {
    title: "خطتي السنوية — نخب",
    description: "قسّم مقرراتك الخمسة على السنة بين الحفظ والشرح، واحفظ خطتك برابط خاص بك.",
    images: ["/logo-nokhab.png"],
  },
};

export default async function KhittaPage() {
  // الرابط العام يخدم مسارًا واحدًا؛ ومسار النخب العلمية يُدار من اللوحة
  const track = trackInfo(PUBLIC_TRACK);
  const courses = await listCourses(false, PUBLIC_TRACK);

  return (
    <main className="sunny sunny-bg min-h-screen p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="card sunny-card mb-4 p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nokhab.png" alt="شعار نخب" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="page-title text-xl">خطتي السنوية</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {track.name}
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="card sunny-card p-8 text-center">
            <p className="text-3xl">📚</p>
            <p className="mt-3 font-bold">لا توجد مقررات متاحة حاليًا</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              راجع المشرف لإضافة المقررات.
            </p>
          </div>
        ) : (
          <div className="card sunny-card p-5">
            <PlanWizard courses={courses} />
          </div>
        )}
      </div>
    </main>
  );
}
