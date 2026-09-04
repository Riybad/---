import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/actions";

const NAV = [
  ["/", "الرئيسية"],
  ["/students", "الطلاب"],
  ["/courses", "المقررات"],
  ["/taqweem", "الخطة الزمنية"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header
        className="mb-6 flex flex-wrap items-center gap-4 border-b py-4"
        style={{ borderColor: "var(--hairline)" }}
      >
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nabgh.png" alt="شعار نبغ" className="h-11 w-auto" />
          <span className="text-lg font-bold">نبغ — لوحة الطلاب</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm font-semibold">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-1.5 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="ms-auto">
          <button className="btn btn-ghost text-sm">تسجيل خروج</button>
        </form>
      </header>
      {children}
    </div>
  );
}
