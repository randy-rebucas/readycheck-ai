import Link from "next/link";
import styles from "../login/login.module.css";
import { BrandMark } from "../landing-icons";
import ResetPasswordCard from "./ResetPasswordCard";

export const metadata = { title: "Reset Password — ReadyCheck AI" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className={styles.page}>
      <div className={styles.centered}>
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandIcon}>
                <BrandMark size={38} />
              </span>
              <span>
                ReadyCheck <span className={styles.brandAI}>AI</span>
              </span>
            </Link>
          </div>
          {token ? (
            <ResetPasswordCard token={token} />
          ) : (
            <div className={styles.card}>
              <h1 className={styles.cardTitle}>Invalid reset link</h1>
              <p className={styles.cardSubtitle}>
                This link is missing its reset token. Follow the link from your email, or
                request a new one.
              </p>
              <Link href="/forgot-password" className={styles.submitBtn}>
                Request a New Link
              </Link>
              <p className={styles.footNote}>
                <Link href="/login">Back to sign in</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
