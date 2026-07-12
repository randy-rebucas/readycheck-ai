import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/get-current-user";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "../UserMenu";
import dashStyles from "../dashboard/dashboard.module.css";
import styles from "./profile.module.css";
import {
  ArrowRightIcon,
  BellIcon,
  BrandMark,
  HashIcon,
  HelpCircleIcon,
  LogOutIcon,
  MailIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserIcon,
} from "../landing-icons";

export const metadata = {
  title: "Profile — ReadyCheck AI",
};

export default async function ProfilePage() {
  // Guaranteed by middleware.ts (which gates /profile), but re-checked here
  // since this page can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

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

        <section className={styles.card}>
          <div className={styles.identity}>
            <span className={styles.bigAvatar}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className={styles.bigAvatarImg} />
              ) : (
                initial
              )}
            </span>
            <div>
              <h1 className={styles.name}>{user.name ?? "Unnamed account"}</h1>
              {user.email && <p className={styles.email}>{user.email}</p>}
            </div>
          </div>

          <div className={styles.fieldList}>
            <div className={styles.field}>
              <span className={styles.fieldIcon}>
                <UserIcon size={16} />
              </span>
              <span className={styles.fieldLabel}>Display name</span>
              <span className={styles.fieldValue}>{user.name ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldIcon}>
                <MailIcon size={16} />
              </span>
              <span className={styles.fieldLabel}>Email</span>
              <span className={styles.fieldValue}>{user.email ?? "—"}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldIcon}>
                <HashIcon size={16} />
              </span>
              <span className={styles.fieldLabel}>Account ID</span>
              <span className={`${styles.fieldValue} ${styles.mono}`}>{user.id}</span>
            </div>
          </div>

          <p className={styles.note}>
            Profile details come from your sign-in provider and can&apos;t be edited here
            yet.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <ShieldCheckIcon size={17} />
            Session
          </h2>
          <p className={styles.sectionText}>
            You&apos;re signed in on this device. Sessions expire automatically after 30
            days, or you can end this one now.
          </p>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={styles.signOutBtn}>
              <LogOutIcon size={15} />
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
