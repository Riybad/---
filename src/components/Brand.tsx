import Logo from "@/components/Logo";

/** ترويسة الهوية: علامة صناعة الموهبة واسم المشروع */
export default function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-16" : size === "sm" ? "h-8" : "h-12";
  const title = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-3">
      <Logo className={`${box} w-auto shrink-0`} />
      <span className="grid text-right leading-tight">
        <span className={`${title} font-extrabold`} style={{ color: "var(--brand-olive)" }}>
          صناعة الموهبة
        </span>
        <span className="text-xs font-bold tracking-wide" style={{ color: "var(--brand-logo)" }}>
          الريادة في صناعة الموهبة وتنميتها
        </span>
      </span>
    </span>
  );
}
