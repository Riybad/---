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
    <main className="mx-auto flex min-h-screen max-w-lg items-center p-4">
      <div className="card w-full p-8">
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
            <h1 className="mb-1 text-xl font-bold">طلب عهدة مالية</h1>
            <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
              عبّئ البيانات التالية وسيراجع طلبك المسؤول المالي
            </p>
            <RequestForm token={token} />
          </>
        )}
      </div>
    </main>
  );
}
