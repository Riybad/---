import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { UPLOADS_DIR } from "@/lib/db";
import { getInvoice } from "@/lib/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) {
    return new NextResponse("غير مصرح", { status: 401 });
  }
  const { id } = await params;
  const invoice = getInvoice(Number(id));
  if (!invoice) return new NextResponse("غير موجود", { status: 404 });

  const filePath = path.resolve(UPLOADS_DIR, invoice.file_path);
  if (!filePath.startsWith(path.resolve(UPLOADS_DIR)) || !fs.existsSync(filePath)) {
    return new NextResponse("غير موجود", { status: 404 });
  }
  const data = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.id}.pdf"`,
    },
  });
}
