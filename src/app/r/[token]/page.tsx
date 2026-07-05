import { notFound } from "next/navigation";
import RequestForm from "@/components/RequestForm";
import { getRequestToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  if (token !== getRequestToken()) notFound();

  return (
    <main className="sunny sunny-bg flex min-h-screen items-center justify-center p-4">
      <div className="card sunny-card w-full max-w-lg p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="شعار طُود" className="mx-auto mb-4 h-20 w-auto" />
        {done ? (
          <div className="text-center">
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 text-xl font-bold">تم استلام طلبك</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              سيتم التواصل معك بعد مراجعة الطلب من الإدارة المالية.
            </p>
          </div>
        ) : (
          <>
            <h1 className="page-title mb-1 text-center text-xl">طلب عهدة مالية</h1>
            <p className="mb-6 text-center text-sm" style={{ color: "var(--brand-orange)" }}>
              عبّئ البيانات التالية وسيراجع طلبك المسؤول المالي
            </p>
            <RequestForm token={token} />
          </>
        )}
      </div>
    </main>
  );
}
