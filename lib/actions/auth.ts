"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { countUsers, ensureSettings } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { fail, str, type ActionResult } from "./shared";

/**
 * First-run setup. Only ever creates the very first account — once an owner
 * exists this route refuses, so an exposed instance cannot be claimed twice.
 */
export async function setupAccount(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  if ((await countUsers()) > 0) return fail("This instance already has an owner. Sign in instead.");

  const email = str(form, "email")?.toLowerCase();
  const password = str(form, "password");
  const confirm = str(form, "confirm");
  const name = str(form, "name");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email.");
  if (!password) return fail("Choose a password.");

  const problem = passwordProblem(password);
  if (problem) return fail(problem);
  if (password !== confirm) return fail("Passwords do not match.");

  const db = await getDb();
  const [created] = await db
    .insert(users)
    .values({ email, name, passwordHash: await hashPassword(password) })
    .returning();

  await ensureSettings(created.id);
  await createSession({ userId: created.id, email: created.email });
  redirect("/");
}

export async function signIn(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const email = str(form, "email")?.toLowerCase();
  const password = str(form, "password");
  if (!email || !password) return fail("Enter your email and password.");

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Same message either way — a wrong email must not read differently to a
  // wrong password.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("Incorrect email or password.");
  }

  await createSession({ userId: user.id, email: user.email });
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
