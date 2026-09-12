import { NextResponse } from "next/server";
import { checklistWorkbook, studentWorkbook } from "@/lib/plan-xlsx";
import { templateWorkbook } from "@/lib/template-xlsx";
import { hasTimeline, parseTrack } from "@/lib/tracks";
import { getStudentByToken, listCourses, listPlanItems, toPicks } from "@/lib/queries";

/** رابط عام: الطالب يحمّل خطته بنفس رمز صفحته */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const student = await getStudentByToken(token);
  if (!student) return new NextResponse("الرابط غير صالح", { status: 404 });

  const track = parseTrack(student.track);
  const [courses, items] = await Promise.all([listCourses(true), listPlanItems(student.id)]);

  let buf: Buffer;
  let suffix = "";
  if (!hasTimeline(track)) {
    // بلا جدول زمني: قائمة مقررات المسار وما أنجزه منها — لا تواريخ
    const trackCourses = await listCourses(false, track);
    const done = new Set(items.filter((i) => i.done).map((i) => i.course_id));
    buf = checklistWorkbook(student, trackCourses, done);
    suffix = "-injaz";
  } else {
    const picks = toPicks(items);
    // الافتراضي قالب «الخطة الزمنية» معبّأ؛ و«?format=table» للجداول التفصيلية
    const table = new URL(req.url).searchParams.get("format") === "table";
    buf = table
      ? studentWorkbook(student, courses, picks)
      : await templateWorkbook(student, courses, picks);
    suffix = table ? "-table" : "";
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="khitta-${student.id}${suffix}.xlsx"`,
    },
  });
}
