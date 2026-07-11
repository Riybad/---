import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "session";

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

/** مفتاح توقيع الجلسات: من AUTH_SECRET إن وُجد، وإلا يُشتق من كلمة المرور */
function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return crypto.createHash("sha256").update(`tood-session-key:${adminPassword()}`).digest("hex");
}

export function sessionToken(): string {
  return crypto.createHmac("sha256", secret()).update("admin-session").digest("hex");
}

export async function isLoggedIn(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken()));
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isLoggedIn())) redirect("/login");
}

export async function createSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
