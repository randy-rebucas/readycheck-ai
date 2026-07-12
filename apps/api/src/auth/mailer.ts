import nodemailer, { type Transporter } from "nodemailer";

// SMTP is optional, following the repo's graceful-degradation pattern
// (no ANTHROPIC_API_KEY = no narratives, no READYCHECK_API_KEY = no auth).
// Without SMTP_HOST the reset link is logged to the API console instead --
// fine for local dev, useless-by-design for real deployments.

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    console.log(`[auth] SMTP not configured; password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "ReadyCheck AI <no-reply@readycheck.local>",
    to,
    subject: "Reset your ReadyCheck AI password",
    text: [
      "Someone requested a password reset for your ReadyCheck AI account.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 1 hour and can be used once.",
      "If you didn't request this, you can safely ignore this email.",
    ].join("\n"),
    html: [
      "<p>Someone requested a password reset for your ReadyCheck AI account.</p>",
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      "<p>This link expires in 1 hour and can be used once.<br/>",
      "If you didn't request this, you can safely ignore this email.</p>",
    ].join(""),
  });
}
