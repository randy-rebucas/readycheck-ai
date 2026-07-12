import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/get-current-user";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "../UserMenu";
import dashStyles from "../dashboard/dashboard.module.css";
import styles from "./settings.module.css";
import SettingsPanels from "./SettingsPanels";
import {
  ArrowRightIcon,
  BellIcon,
  BrandMark,
  ChevronRightIcon,
  HelpCircleIcon,
  SettingsIcon,
  UserIcon,
} from "../landing-icons";

export const metadata = {
  title: "Settings — ReadyCheck AI",
};

export default async function SettingsPage() {
  // Guaranteed by middleware.ts (which gates /settings), but re-checked here
  // since this page can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  return (
    <main className={dashStyles.page}>
      <header className={dashStyles.topbar}>
        <Link href="/" className={dashStyles.brand}>
          <span className={dashStyles.brandIcon}>
            <BrandMark size={38} />
          </span>
          <span>
            ReadyCheck <span className={dashStyles.brandAI}>AI</span>
          </span>
        </Link>
        <div className={dashStyles.topRight}>
          <ThemeToggle className={dashStyles.iconBtn} />
          <button type="button" className={dashStyles.iconBtn} aria-label="Help">
            <HelpCircleIcon size={16} />
          </button>
          <button type="button" className={dashStyles.iconBtn} aria-label="Notifications">
            <BellIcon size={16} />
            <span className={dashStyles.bellDot} />
          </button>
          <Link href="/settings" className={dashStyles.iconBtn} aria-label="Settings">
            <SettingsIcon size={16} />
          </Link>
          <UserMenu
            user={user}
            chipClassName={dashStyles.userChip}
            avatarClassName={dashStyles.userAvatar}
            nameClassName={dashStyles.userName}
          />
        </div>
      </header>

      <div className={styles.container}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowRightIcon size={14} style={{ transform: "rotate(180deg)" }} />
          Back to dashboard
        </Link>

        <h1 className={styles.pageTitle}>Settings</h1>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <UserIcon size={17} />
            Account
          </h2>
          <p className={styles.sectionText}>
            Signed in as <strong>{user.name ?? user.email ?? "your account"}</strong>
            {user.name && user.email ? ` (${user.email})` : ""}.
          </p>
          <Link href="/profile" className={styles.accountLink}>
            View profile
            <ChevronRightIcon size={14} />
          </Link>
        </section>

        <SettingsPanels />
      </div>
    </main>
  );
}
