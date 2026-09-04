/** ترويسة الهوية: شعار نبغ واسم البرنامج */
export default function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-20" : size === "sm" ? "h-9" : "h-14";
  const title = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-nabgh.png" alt="شعار نبغ" className={`${box} w-auto shrink-0`} />
      <span className="grid text-right leading-tight">
        <span className={`${title} font-extrabold`} style={{ color: "var(--brand-olive)" }}>
          النخب الناشئة
        </span>
        <span className="text-xs font-bold tracking-wide" style={{ color: "var(--brand-logo)" }}>
          تمكين · دفعة 42
        </span>
      </span>
    </span>
  );
}
