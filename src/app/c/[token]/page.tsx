import { notFound } from "next/navigation";
import ClosureForm from "@/components/ClosureForm";
import { money, fmtDate, STATUS_LABEL } from "@/lib/format";
import { getCustodyByCloseToken } from "@/lib/queries";
import { blobEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ClosurePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const custody = await getCustodyByCloseToken(token);
  if (!custody) notFound();

  return (
    <main className="sunny sunny-bg flex min-h-screen items-center justify-center p-4">
      <div className="card sunny-card w-full max-w-lg p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-nabgh.png" alt="شعار نبغ" className="mx-auto mb-4 h-20 w-auto" />
        {done || custody.status === "pending_close" || custody.status === "closed" ? (
          <div className="text-center">
            <p className="text-4xl">✅</p>
            <h1 className="mt-3 text-xl font-bold">
              {custody.status === "closed" ? "العهدة مقفلة" : "تم استلام طلب الإقفال"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              {custody.status === "closed"
                ? "تم اعتماد إقفال هذه العهدة. شكرًا لك."
                : "فواتيرك وصلت وستُراجع من الإدارة المالية لاعتماد الإقفال."}
            </p>
          </div>
        ) : custody.status !== "open" ? (
          <div className="text-center">
            <h1 className="text-xl font-bold">هذه العهدة ليست جاهزة للإقفال</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              حالة العهدة الحالية: {STATUS_LABEL[custody.status]}
            </p>
          </div>
        ) : (
          <>
            <h1 className="page-title mb-1 text-center text-xl">إقفال عهدة — {custody.name}</h1>
            <p className="mb-6 text-center text-sm" style={{ color: "var(--brand-orange)" }}>
              المبلغ المصروف: {money(custody.amount)} · بتاريخ {fmtDate(custody.disbursed_at)}
              <br />
              أدخل تفاصيل كل فاتورة وأرفقها بصيغة PDF
            </p>
            <ClosureForm token={token} uploadMode={blobEnabled() ? "blob" : "local"} />
          </>
        )}
      </div>
    </main>
  );
}
