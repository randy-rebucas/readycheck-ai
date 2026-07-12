"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resetPasswordAction, type AuthFormState } from "../login/actions";
import styles from "../login/login.module.css";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon } from "../landing-icons";

const INITIAL_STATE: AuthFormState = { error: null };

export default function ResetPasswordCard({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className={styles.card}>
      <h1 className={styles.cardTitle}>Choose a new password</h1>
      <p className={styles.cardSubtitle}>
        You&apos;ll be signed in automatically once it&apos;s saved.
      </p>

      {state.error && <p className={styles.errorNote}>{state.error}</p>}

      <form action={formAction}>
        <input type="hidden" name="token" value={token} />

        <label
          className={styles.fieldLabel}
          htmlFor="reset-password"
          style={{ marginBottom: "0.45rem" }}
        >
          New password
        </label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}>
            <LockIcon size={16} />
          </span>
          <input
            id="reset-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className={styles.input}
            placeholder="••••••••••"
            minLength={8}
            required
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>

        <label
          className={styles.fieldLabel}
          htmlFor="reset-confirm-password"
          style={{ marginBottom: "0.45rem" }}
        >
          Confirm new password
        </label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}>
            <LockIcon size={16} />
          </span>
          <input
            id="reset-confirm-password"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            className={styles.input}
            placeholder="••••••••••"
            minLength={8}
            required
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
          >
            {showConfirm ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={pending}>
          {pending ? "Saving..." : "Save New Password"}
          {!pending && <ArrowRightIcon size={16} />}
        </button>
      </form>

      <p className={styles.footNote}>
        Link expired? <Link href="/forgot-password">Request a new one</Link>
      </p>
    </div>
  );
}
