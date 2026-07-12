"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  safeInternalPath,
  sessionCookieOptions,
  signSessionToken,
  verifyTransferToken,
} from "../../lib/session";

// Server-side URL (docker hostname works here), same resolution as lib/api.ts.
const API_URL =
  process.env.READYCHECK_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthFormState {
  error: string | null;
  success?: boolean;
}

async function completeCredentialAuth(
  endpoint: "login" | "register" | "reset-password",
  payload: Record<string, string | null>,
  next: string
): Promise<AuthFormState> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { error: "Could not reach the authentication service. Please try again." };
  }

  if (!res.ok) {
    const fallback =
      endpoint === "login"
        ? "Sign-in failed."
        : endpoint === "register"
          ? "Sign-up failed."
          : "Password reset failed.";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      const message = Array.isArray(body.message) ? body.message[0] : body.message;
      return { error: message || fallback };
    } catch {
      return { error: fallback };
    }
  }

  // Same exchange as the OAuth callback: the API returns a 60s transfer
  // token, and the session cookie is minted here so it never crosses a URL.
  const { token } = (await res.json()) as { token?: string };
  const user = token ? await verifyTransferToken(token) : null;
  if (!user) {
    return { error: "Authentication succeeded but the session was invalid. Please try again." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSessionToken(user), sessionCookieOptions());
  redirect(next);
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Provide an email address and password." };
  }

  return completeCredentialAuth("login", { email, password }, next);
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Provide an email address." };

  try {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
      const message = Array.isArray(body.message) ? body.message[0] : body.message;
      return { error: message || "Could not request a reset. Please try again." };
    }
  } catch {
    return { error: "Could not reach the authentication service. Please try again." };
  }

  return { error: null, success: true };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return { error: "Passwords don't match. Please re-enter them." };
  }

  return completeCredentialAuth("reset-password", { token, password }, "/dashboard");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? ""));

  if (password !== confirmPassword) {
    return { error: "Passwords don't match. Please re-enter them." };
  }

  return completeCredentialAuth("register", { name: name || null, email, password }, next);
}
