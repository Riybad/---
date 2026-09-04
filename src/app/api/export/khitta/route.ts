import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { allStudentsWorkbook } from "@/lib/plan-xlsx";
import { listCourses, listPlanItems, listStudents, toPicks } from "@/lib/queries";

/** تصدير خطط جميع الطلاب — للوحة فقط */
export async function GET() {
  if (!(await isLoggedIn())) return new NextResponse("غير مصرح", { status: 401 });

  const [courses, students] = await Promise.all([listCourses(true), listStudents()]);
  const entries = [];
  for (const student of students) {
    entries.push({ student, picks: toPicks(await listPlanItems(student.id)) });
  }
  const buf = allStudentsWorkbook(entries, courses);

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="khitat-${today}.xlsx"`,
    },
  });
}
