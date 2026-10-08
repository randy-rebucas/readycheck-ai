import Link from "next/link";
import type { SessionUser } from "../lib/session";
import styles from "./AppHeader.module.css";
import NotificationBell from "./NotificationBell";
import OrgSwitcher from "./OrgSwitcher";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { BrandMark, HelpCircleIcon, SettingsIcon } from "./landing-icons";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/dashboard/scans", label: "Scans", key: "scans" }
] as const;

interface AppHeaderProps {
  user: SessionUser | null;
  active?: (typeof NAV_LINKS)[number]["key"];
}

export default function AppHeader({ user, active }: AppHeaderProps) {
  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <BrandMark size={34} />
        </span>
        <span>
          ReadyCheck <span className={styles.brandAI}>AI</span>
        </span>
      </Link>

      {user && (
        <nav className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={`${styles.navLink} ${active === link.key ? styles.navLinkActive : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <div className={styles.topRight}>
        <ThemeToggle className={styles.iconBtn} />
        {user ? (
          <>
            <OrgSwitcher chipClassName={styles.userChip} />
            <UserMenu
              user={user}
              chipClassName={styles.userChip}
              avatarClassName={styles.userAvatar}
              nameClassName={styles.userName}
            />
          </>
        ) : (
          <>
            <Link href="/login" className={styles.loginLink}>
              Log in
            </Link>
            <Link href="/dashboard" className={styles.signupBtn}>
              Start Free Scan
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
