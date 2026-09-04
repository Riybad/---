import type { Course } from "@/lib/plan";

/** الشرح المعتمد للمقرر: الشارح، ورابط القرائي، ورابط السماعي */
export function hasSharh(course: Course): boolean {
  return Boolean(course.sharh_name || course.sharh_book_url || course.sharh_video_url);
}

export default function CourseResources({ course }: { course: Course }) {
  if (!hasSharh(course)) return null;
  const links = [
    ...(course.sharh_book_url ? [{ href: course.sharh_book_url, label: "قرائي" }] : []),
    ...(course.sharh_video_url ? [{ href: course.sharh_video_url, label: "سماعي" }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span aria-hidden>📖</span>
      <span style={{ color: "var(--text-secondary)" }}>{course.sharh_name || "الشرح"}</span>
      {links.map((l) => (
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
    </div>
  );
}
