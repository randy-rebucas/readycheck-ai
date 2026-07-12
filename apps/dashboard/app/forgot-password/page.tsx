import Link from "next/link";
import styles from "../login/login.module.css";
import { BrandMark } from "../landing-icons";
import ForgotPasswordCard from "./ForgotPasswordCard";

export const metadata = { title: "Forgot Password — ReadyCheck AI" };

export default function ForgotPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.centered}>
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandIcon}>
                <BrandMark size={38} />
              </span>
              <span>
                ReadyCheck <span className={styles.brandAI}>AI</span>
              </span>
            </Link>
          </div>
          <ForgotPasswordCard />
        </div>
      </div>
    </div>
  );
}
