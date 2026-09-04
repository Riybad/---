import { NextResponse } from "next/server";
import { studentWorkbook } from "@/lib/plan-xlsx";
import { getStudentByToken, listCourses, listPlanItems, toPicks } from "@/lib/queries";

/** رابط عام: الطالب يحمّل خطته بنفس رمز صفحته */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const student = await getStudentByToken(token);
  if (!student) return new NextResponse("الرابط غير صالح", { status: 404 });

  const [courses, items] = await Promise.all([listCourses(true), listPlanItems(student.id)]);
  const buf = studentWorkbook(student, courses, toPicks(items));

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="khitta-${student.id}.xlsx"`,
    },
  });
}
