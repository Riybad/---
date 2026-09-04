import type { Metadata } from "next";
import PlanWizard from "@/components/PlanWizard";
import { listCourses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "خطتي السنوية — نبغ",
  description: "قسّم مقرراتك الخمسة على السنة بين الحفظ والشرح، واحفظ خطتك برابط خاص بك.",
  openGraph: {
    title: "خطتي السنوية — نبغ",
    description: "قسّم مقرراتك الخمسة على السنة بين الحفظ والشرح، واحفظ خطتك برابط خاص بك.",
    images: ["/logo-nabgh.png"],
  },
};

export default async function KhittaPage() {
  const courses = await listCourses();

  return (
    <main className="sunny sunny-bg min-h-screen p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="card sunny-card mb-4 p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nabgh.png" alt="شعار نبغ" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="page-title text-xl">خطتي السنوية</h1>
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
