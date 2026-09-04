import { NextResponse } from "next/server";
import { studentWorkbook } from "@/lib/plan-xlsx";
import { templateWorkbook } from "@/lib/template-xlsx";
import { getStudentByToken, listCourses, listPlanItems, toPicks } from "@/lib/queries";

/** رابط عام: الطالب يحمّل خطته بنفس رمز صفحته */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const student = await getStudentByToken(token);
  if (!student) return new NextResponse("الرابط غير صالح", { status: 404 });

  const [courses, items] = await Promise.all([listCourses(true), listPlanItems(student.id)]);
  const picks = toPicks(items);

  // الافتراضي قالب «الخطة الزمنية» معبّأ؛ و«?format=table» للجداول التفصيلية
  const table = new URL(req.url).searchParams.get("format") === "table";
  const buf = table
    ? studentWorkbook(student, courses, picks)
    : await templateWorkbook(student, courses, picks);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="khitta-${student.id}${table ? "-table" : ""}.xlsx"`,
    },
  });
}
