/**
 * المساران اللذان يدرس فيهما الطلاب. لا يجتمعان في شيء: لكل مسار
 * مقرراته، وطريقته في رسم الخطة، وطلابه.
 *
 * «النخب التربوية» خطة زمنية: يقسّم الطالب مقرراته على سنة هجرية
 * كاملة بمدد يختارها، وله رابط تسجيل عام.
 *
 * «النخب العلمية» بلا جدول زمني أصلًا: المقررات قائمة يُنجزها الطالب
 * متى شاء، والمشرف يسجّل إنجازه فقط — بلا تواريخ ولا مدد ولا سنة.
 */
export type TrackKey = "tarbawi" | "ilmi";

export type Track = {
  key: TrackKey;
  name: string;
  /** هل له رابط تسجيل عام يفتحه الطالب ويقسّم منه */
  publicSignup: boolean;
  /**
   * هل لخططه جدول زمني: سنة ومدد وتواريخ بداية ونهاية.
   * المسار الذي لا جدول له تُعدّ مقرراته قائمةً تُنجَز بلا زمن.
   */
  timeline: boolean;
  color: string;
  note: string;
};

export const TRACKS: Track[] = [
  {
    key: "tarbawi",
    name: "النخب التربوية",
    publicSignup: true,
    timeline: true,
    color: "#4f7942",
    note: "خطة زمنية على سنة كاملة، وللطلاب رابط تسجيل يقسّمون منه بأنفسهم",
  },
  {
    key: "ilmi",
    name: "النخب العلمية",
    publicSignup: false,
    timeline: false,
    color: "#b4762c",
    note: "بلا جدول زمني — المقررات قائمة تُنجَز، والمشرف يسجّل الإنجاز",
  },
];

export const DEFAULT_TRACK: TrackKey = "tarbawi";

export function isTrack(key: unknown): key is TrackKey {
  return TRACKS.some((t) => t.key === key);
}

export function parseTrack(raw: unknown): TrackKey {
  return isTrack(raw) ? raw : DEFAULT_TRACK;
}

export function trackInfo(key: unknown): Track {
  return TRACKS.find((t) => t.key === key) ?? TRACKS[0];
}

/** المسار الذي يخدمه رابط التسجيل العام */
export const PUBLIC_TRACK: TrackKey = TRACKS.find((t) => t.publicSignup)?.key ?? DEFAULT_TRACK;

/** هل لهذا المسار جدول زمني (سنة ومدد وتواريخ)؟ */
export function hasTimeline(key: unknown): boolean {
  return trackInfo(key).timeline;
}
