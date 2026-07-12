// Pure input parsing/validation for the email+password endpoints, kept free
// of Nest/Prisma so it can be unit tested (mirrors scan-source.ts).

export interface RegisterInput {
  name: string | null;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 100;

function field(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

function parsePassword(raw: unknown): ParseResult<string> {
  if (typeof raw !== "string" || raw.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (raw.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  return { ok: true, value: raw };
}

export function parseRegisterInput(body: unknown): ParseResult<RegisterInput> {
  const email = normalizeEmail(field(body, "email"));
  if (!email) return { ok: false, error: "Provide a valid email address." };

  const password = parsePassword(field(body, "password"));
  if (!password.ok) return password;

  const rawName = field(body, "name");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, NAME_MAX_LENGTH) : "";

  return { ok: true, value: { name: name || null, email, password: password.value } };
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export function parseForgotPasswordInput(body: unknown): ParseResult<{ email: string }> {
  const email = normalizeEmail(field(body, "email"));
  if (!email) return { ok: false, error: "Provide a valid email address." };
  return { ok: true, value: { email } };
}

export function parseResetPasswordInput(body: unknown): ParseResult<ResetPasswordInput> {
  const token = field(body, "token");
  // Tokens are 32 random bytes base64url-encoded (43 chars); bound loosely.
  if (typeof token !== "string" || token.length < 20 || token.length > 128) {
    return { ok: false, error: "Invalid or missing reset token." };
  }

  const password = parsePassword(field(body, "password"));
  if (!password.ok) return password;

  return { ok: true, value: { token, password: password.value } };
}

export function parseLoginInput(body: unknown): ParseResult<LoginInput> {
  const email = normalizeEmail(field(body, "email"));
  const password = field(body, "password");

  if (!email || typeof password !== "string" || password.length === 0) {
    // Deliberately vague: don't tell callers which part failed validation.
    return { ok: false, error: "Provide an email address and password." };
  }

  return { ok: true, value: { email, password } };
}
