"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensureSettings } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { fail, str, type ActionResult } from "./shared";

/**
 * Creates an account. Open to anyone — the instance is multi-tenant.
 *
 * A new account starts genuinely empty: every table carries a `user_id` and
 * every query, page and server action is scoped to the signed-in user, so there
 * is no state to inherit and nothing of anyone else's to see. Signing up is the
 * only way rows ever come into existence for an account.
 */
export async function signUp(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
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

  /*
   * `users.email` is unique, so a duplicate raises a constraint error rather
   * than quietly creating a second account. Caught here and reported plainly:
   * at signup there is no way to be vague about it without leaving the person
   * unable to work out why nothing happened.
   */
  let created;
  try {
    [created] = await db
      .insert(users)
      .values({ email, name, passwordHash: await hashPassword(password) })
      .returning();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      return fail("An account with that email already exists. Sign in instead.");
    }
    throw error;
  }

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
