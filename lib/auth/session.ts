import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "oc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

let cachedKey: Uint8Array | null = null;

/**
 * AUTH_SECRET in production. Locally, a random secret is generated once and
 * kept in .auth-secret (gitignored) so sessions survive restarts without
 * shipping a hardcoded key.
 */
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) {
    cachedKey = new TextEncoder().encode(fromEnv);
    return cachedKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production. Set it to a random 32+ character string.",
    );
  }

  const file = path.join(process.cwd(), ".auth-secret");
  let secret: string;
  try {
    secret = fs.readFileSync(file, "utf8").trim();
    if (secret.length < 16) throw new Error("too short");
  } catch {
    secret = randomBytes(32).toString("hex");
    fs.writeFileSync(file, secret, { mode: 0o600 });
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export type SessionPayload = { userId: string; email: string };

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { userId: payload.sub, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
