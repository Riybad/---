import type { Course } from "@/lib/plan";

/** روابط المقرر: التسجيل الصوتي للحفظ، والشرح كتابًا ومرئيات */
export default function CourseResources({ course }: { course: Course }) {
  const rows: { icon: string; title: string; links: { href: string; label: string }[] }[] = [];
  if (course.recitation_name || course.recitation_url) {
    rows.push({
      icon: "🎧",
      title: course.recitation_name || "التسجيل الصوتي",
      links: course.recitation_url ? [{ href: course.recitation_url, label: "استماع" }] : [],
    });
  }
  if (course.sharh_name || course.sharh_book_url || course.sharh_video_url) {
    rows.push({
      icon: "📖",
      title: course.sharh_name || "الشرح",
      links: [
        ...(course.sharh_book_url ? [{ href: course.sharh_book_url, label: "الكتاب" }] : []),
        ...(course.sharh_video_url ? [{ href: course.sharh_video_url, label: "المرئيات" }] : []),
      ],
    });
  }
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-1.5 text-xs">
      {rows.map((r) => (
        <li key={r.title} className="flex flex-wrap items-center gap-2">
          <span aria-hidden>{r.icon}</span>
          <span style={{ color: "var(--text-secondary)" }}>{r.title}</span>
          {r.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-2 py-0.5 font-bold"
              style={{ borderColor: "var(--brand-olive)", color: "var(--brand-olive)" }}
            >
              {l.label} ↗
            </a>
          ))}
        </li>
      ))}
    </ul>
  );
}
