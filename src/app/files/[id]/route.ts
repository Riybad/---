import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { getInvoice } from "@/lib/queries";
import { readInvoiceFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) {
    return new NextResponse("غير مصرح", { status: 401 });
  }
  const { id } = await params;
  const invoice = await getInvoice(Number(id));
  if (!invoice) return new NextResponse("غير موجود", { status: 404 });

  const data = await readInvoiceFile(invoice.file_path);
  if (!data) return new NextResponse("غير موجود", { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.id}.pdf"`,
    },
  });
}
