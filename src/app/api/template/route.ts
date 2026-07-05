import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["التاريخ", "النوع", "الوصف", "التصنيف", "المبلغ"],
    ["2026-07-01", "إيراد", "اشتراكات شهر يوليو", "اشتراكات", 15000],
    ["2026-07-02", "مصروف", "فاتورة كهرباء", "خدمات", 1200],
  ]);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "الحركات");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template.xlsx"',
    },
  });
}
