import crypto from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DIR } from "./db";

const SESSION_COOKIE = "session";

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const keyFile = path.join(DATA_DIR, "secret.key");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(keyFile, "utf8").trim();
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

export function sessionToken(): string {
  return sign("admin-session");
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
