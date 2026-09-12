import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { allStudentsWorkbook, trackChecklistWorkbook } from "@/lib/plan-xlsx";
import { hasTimeline, isTrack, PUBLIC_TRACK, trackInfo, type TrackKey } from "@/lib/tracks";
import { listCourses, listPlanItems, listStudents, toPicks } from "@/lib/queries";

/**
 * تصدير طلاب مسار واحد — للوحة فقط.
 * المساران لا يجتمعان في ملف: لكلٍّ مقرراته وطريقته.
 */
export async function GET(req: Request) {
  if (!(await isLoggedIn())) return new NextResponse("غير مصرح", { status: 401 });

  const raw = new URL(req.url).searchParams.get("track");
  const track = (isTrack(raw) ? raw : PUBLIC_TRACK) as TrackKey;
  const students = await listStudents(undefined, track);

  let buf: Buffer;
  if (hasTimeline(track)) {
    const courses = await listCourses(true);
    const entries = [];
    for (const student of students) {
      entries.push({ student, picks: toPicks(await listPlanItems(student.id)) });
    }
    buf = allStudentsWorkbook(entries, courses);
  } else {
    const courses = await listCourses(false, track);
    const entries = [];
    for (const student of students) {
      const items = await listPlanItems(student.id);
      entries.push({
        student,
        done: new Set(items.filter((i) => i.done).map((i) => i.course_id)),
      });
    }
    buf = trackChecklistWorkbook(entries, courses);
  }

  const today = new Date().toISOString().slice(0, 10);
  const name = trackInfo(track).name.replace(/\s+/g, "-");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}-${today}.xlsx"`,
    },
  });
}
