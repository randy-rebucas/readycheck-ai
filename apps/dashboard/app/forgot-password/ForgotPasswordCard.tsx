"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type AuthFormState } from "../login/actions";
import styles from "../login/login.module.css";
import { ArrowRightIcon, CheckCircleIcon, MailIcon } from "../landing-icons";

const INITIAL_STATE: AuthFormState = { error: null };

export default function ForgotPasswordCard() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL_STATE);

  return (
    <div className={styles.card}>
      <h1 className={styles.cardTitle}>Forgot your password?</h1>
      <p className={styles.cardSubtitle}>
        Enter your account email and we&apos;ll send you a reset link.
      </p>

      {state.error && <p className={styles.errorNote}>{state.error}</p>}

      {state.success ? (
        <div className={styles.notice} style={{ display: "flex", gap: "0.6rem" }}>
          <CheckCircleIcon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            If an account exists for that email, a reset link is on its way. The link
            expires in 1 hour.
          </span>
        </div>
      ) : (
        <form action={formAction}>
          <label
            className={styles.fieldLabel}
            htmlFor="forgot-email"
            style={{ marginBottom: "0.45rem" }}
          >
            Email address
          </label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>
              <MailIcon size={16} />
            </span>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              placeholder="you@example.com"
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={pending}>
            {pending ? "Sending..." : "Send Reset Link"}
            {!pending && <ArrowRightIcon size={16} />}
          </button>
        </form>
      )}

      <p className={styles.footNote}>
        Remembered it after all? <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
