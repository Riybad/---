import Link from "next/link";
import { notFound } from "next/navigation";
import ClosureLookup from "@/components/ClosureLookup";
import RequestForm from "@/components/RequestForm";
import { getRequestToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; type?: string }>;
}) {
  const { token } = await params;
  const { done, type } = await searchParams;
  if (token !== (await getRequestToken())) notFound();

  return (
    <main className="sunny sunny-bg flex min-h-screen items-center justify-center p-4">
      <div className="card sunny-card w-full max-w-lg p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="شعار طُود" className="mx-auto mb-4 h-20 w-auto" />
        {done ? (
          <div className="text-center">
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 text-xl font-bold">تم رفع العهدة</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              سيتم التحويل قريبًا بإذن الله.
            </p>
          </div>
        ) : type === "new" ? (
          <>
            <h1 className="page-title mb-1 text-center text-xl">طلب عهدة مالية</h1>
            <p className="mb-6 text-center text-sm" style={{ color: "var(--brand-orange)" }}>
              ادخل البيانات التالية
            </p>
            <RequestForm token={token} />
          </>
        ) : type === "close" ? (
          <>
            <h1 className="page-title mb-1 text-center text-xl">إقفال عهدة</h1>
            <p className="mb-6 text-center text-sm" style={{ color: "var(--brand-orange)" }}>
              أدخل رقم جوالك وسنوصلك لعهدتك
            </p>
            <ClosureLookup token={token} />
          </>
        ) : (
          <>
            <h1 className="page-title mb-2 text-center text-xl">العهد المالية</h1>
            <p className="mb-6 text-center text-sm" style={{ color: "var(--brand-orange)" }}>
              وش تبي تسوي؟
            </p>
            <div className="grid gap-3">
              <Link
                href={`/r/${token}?type=new`}
                className="btn btn-primary justify-center py-4 text-base"
              >
                ➕ طلب عهدة جديدة
              </Link>
              <Link
                href={`/r/${token}?type=close`}
                className="btn btn-good justify-center py-4 text-base"
              >
                🧾 إقفال عهدة قائمة
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
