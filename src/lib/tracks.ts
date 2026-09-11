/**
 * المساران اللذان يدرس فيهما الطلاب. لكل مسار مقرراته الخاصة، وخطة
 * الطالب لا تُبنى إلا من مقررات مساره.
 *
 * «النخب التربوية» لها رابط تسجيل عام يقسّم الطالب خطته منه بنفسه،
 * و«النخب العلمية» تُدار من اللوحة: المشرف يضيف الطالب ويقسّم له.
 */
export type TrackKey = "tarbawi" | "ilmi";

export type Track = {
  key: TrackKey;
  name: string;
  /** هل له رابط تسجيل عام يفتحه الطالب ويقسّم منه */
  publicSignup: boolean;
  color: string;
  note: string;
};

export const TRACKS: Track[] = [
  {
    key: "tarbawi",
    name: "النخب التربوية",
    publicSignup: true,
    color: "#4f7942",
    note: "للطلاب رابط تسجيل يقسّمون منه خططهم بأنفسهم",
  },
  {
    key: "ilmi",
    name: "النخب العلمية",
    publicSignup: false,
    color: "#b4762c",
    note: "بلا رابط — المشرف يضيف الطالب ويقسّم له خطته من اللوحة",
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
