"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "./actions";
import styles from "./login.module.css";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  GitHubIcon,
  GitLabIcon,
  GoogleIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  MicrosoftIcon,
  ShieldCheckIcon,
  UserIcon,
} from "../landing-icons";

interface LoginCardProps {
  githubUrl: string;
  googleUrl: string;
  nextPath: string;
  error?: string;
}

const INITIAL_STATE: AuthFormState = { error: null };

export default function LoginCard({ githubUrl, googleUrl, nextPath, error }: LoginCardProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [signInState, signInFormAction, signInPending] = useActionState(
    signInAction,
    INITIAL_STATE
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUpAction,
    INITIAL_STATE
  );

  const isSignIn = mode === "signin";
  const formState = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signInPending : signUpPending;

  return (
    <div className={styles.card}>
      <h1 className={styles.cardTitle}>{isSignIn ? "Welcome back \u{1F44B}" : "Get started"}</h1>
      <p className={styles.cardSubtitle}>
        {isSignIn
          ? "Sign in to your ReadyCheck AI account"
          : "Create your ReadyCheck AI account"}
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={isSignIn}
          className={`${styles.tab} ${isSignIn ? styles.tabActive : ""}`}
          onClick={() => setMode("signin")}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignIn}
          className={`${styles.tab} ${!isSignIn ? styles.tabActive : ""}`}
          onClick={() => setMode("signup")}
        >
          Sign Up
        </button>
      </div>

      {error && (
        <p className={styles.errorNote}>
          Sign-in failed. Please try again, or use a different provider.
        </p>
      )}
      {formState.error && <p className={styles.errorNote}>{formState.error}</p>}

      <form action={isSignIn ? signInFormAction : signUpFormAction}>
        <input type="hidden" name="next" value={nextPath} />

        {!isSignIn && (
          <>
            <label
              className={styles.fieldLabel}
              htmlFor="signup-name"
              style={{ marginBottom: "0.45rem" }}
            >
              Full name
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <UserIcon size={16} />
              </span>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                className={styles.input}
                placeholder="Jane Doe"
                required
              />
            </div>
          </>
        )}

        <label className={styles.fieldLabel} htmlFor="login-email" style={{ marginBottom: "0.45rem" }}>
          Email address
        </label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}>
            <MailIcon size={16} />
          </span>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            className={styles.input}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={styles.fieldLabelRow}>
          <label className={styles.fieldLabel} htmlFor="login-password">
            Password
          </label>
          {isSignIn && (
            <a href="/forgot-password" className={styles.forgot}>
              Forgot password?
            </a>
          )}
        </div>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}>
            <LockIcon size={16} />
          </span>
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            className={styles.input}
            placeholder="••••••••••"
            minLength={isSignIn ? undefined : 8}
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

        {!isSignIn && (
          <>
            <label
              className={styles.fieldLabel}
              htmlFor="signup-confirm-password"
              style={{ marginBottom: "0.45rem" }}
            >
              Confirm password
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>
                <LockIcon size={16} />
              </span>
              <input
                id="signup-confirm-password"
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

            <div className={styles.rememberRow}>
              <input id="signup-terms" type="checkbox" required className={styles.checkbox} />
              <label htmlFor="signup-terms" className={styles.rememberLabel}>
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>
          </>
        )}

        {isSignIn && (
          <div className={styles.rememberRow}>
            <input id="remember-me" type="checkbox" defaultChecked className={styles.checkbox} />
            <label htmlFor="remember-me" className={styles.rememberLabel}>
              Remember me
            </label>
            <span className={styles.rememberHint}>
              Keep me signed in for 30 days
              <InfoIcon size={13} />
            </span>
          </div>
        )}

        <button type="submit" className={styles.submitBtn} disabled={pending}>
          {isSignIn
            ? pending
              ? "Signing in..."
              : "Sign In"
            : pending
              ? "Creating account..."
              : "Create Account"}
          {!pending && <ArrowRightIcon size={16} />}
        </button>
      </form>

      <div className={styles.divider}>or continue with</div>

      <div className={styles.providers}>
        <a href={githubUrl} className={styles.providerBtn}>
          <GitHubIcon size={17} />
          GitHub
        </a>
        <a href={googleUrl} className={styles.providerBtn}>
          <GoogleIcon size={17} />
          Google
        </a>
        <button
          type="button"
          className={`${styles.providerBtn} ${styles.providerDisabled}`}
          title="GitLab sign-in is coming soon"
          aria-disabled="true"
        >
          <GitLabIcon size={17} style={{ color: "#fc6d26" }} />
          GitLab
        </button>
        <button
          type="button"
          className={`${styles.providerBtn} ${styles.providerDisabled}`}
          title="Microsoft sign-in is coming soon"
          aria-disabled="true"
        >
          <MicrosoftIcon size={16} />
          Microsoft
        </button>
      </div>

      <div className={styles.trust}>
        <ShieldCheckIcon size={20} />
        <span>
          <strong>Your code is never stored.</strong>
          We use industry-standard encryption.
        </span>
      </div>
    </div>
  );
}
