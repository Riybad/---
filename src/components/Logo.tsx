/**
 * شعار «صناعة الموهبة».
 * نسختان: سوداء للخلفية الفاتحة وبيضاء للداكنة، تتبادلان بالـCSS لا
 * بجافاسكربت — فلا ومضة عند أول رسم.
 */
export default function Logo({
  className = "",
  mark = true,
  alt = "شعار صناعة الموهبة",
}: {
  className?: string;
  /** العلامة وحدها (الدماغ والتروس) أم الشعار كاملًا بنصّه */
  mark?: boolean;
  alt?: string;
}) {
  const base = mark ? "mark-talent" : "logo-talent";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/${base}.png`} alt={alt} className={`logo-light ${className}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/${base}-white.png`} alt="" aria-hidden className={`logo-dark ${className}`} />
    </>
  );
}
