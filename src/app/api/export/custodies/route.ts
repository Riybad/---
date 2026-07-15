import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isLoggedIn } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDate, STATUS_LABEL } from "@/lib/format";
import { listCustodies } from "@/lib/queries";
import type { CustodyStatus } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await isLoggedIn())) {
    return new NextResponse("غير مصرح", { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const custodies = await listCustodies(status);

  const totals = (await q(
    "SELECT custody_id, COALESCE(SUM(amount), 0)::float8 AS total, COUNT(*)::int AS count FROM invoices GROUP BY custody_id"
  )) as { custody_id: number; total: number; count: number }[];
  const invoiceTotal = (id: number) => totals.find((t) => t.custody_id === id);

  const header = [
    "م",
    "الاسم",
    "رقم الجوال",
    "المرحلة",
    "الغرض",
    "المبلغ المطلوب",
    "المبلغ المصروف",
    "طريقة الدفع",
    "عدد الفواتير",
    "مجموع الفواتير",
    "الحالة",
    "تاريخ الطلب",
    "تاريخ الصرف",
    "تاريخ الإقفال",
  ];
  const rows = custodies.map((c, i) => [
    i + 1,
    c.name,
    c.phone,
    c.stage || "",
    c.reason,
    c.requested_amount ?? "",
    c.amount ?? "",
    c.payment_method || "",
    invoiceTotal(c.id)?.count ?? 0,
    invoiceTotal(c.id)?.total ?? 0,
    STATUS_LABEL[c.status as CustodyStatus],
    fmtDate(c.request_date),
    fmtDate(c.disbursed_at),
    fmtDate(c.closed_at),
  ]);

  const sumDisbursed = custodies.reduce((s, c) => s + (c.amount ?? 0), 0);
  rows.push([]);
  rows.push(["", "الإجمالي المصروف", "", "", "", "", sumDisbursed, "", "", "", "", "", "", ""]);

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "العهد");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="custodies-${today}.xlsx"`,
    },
  });
}
