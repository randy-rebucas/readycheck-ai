import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/get-current-user";
import AppHeader from "../../AppHeader";
import dashStyles from "../dashboard.module.css";
import BillingPanel from "./BillingPanel";
import OrgPanel from "./OrgPanel";
import styles from "./settings.module.css";
import SettingsPanels from "./SettingsPanels";
import { ArrowRightIcon, ChevronRightIcon, UserIcon } from "../../landing-icons";

export const metadata = {
  title: "Settings — ReadyCheck AI",
};

export default async function SettingsPage() {
  // Guaranteed by middleware.ts (which gates /dashboard), but re-checked here
  // since this page can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  return (
    <main className={dashStyles.page}>
      <AppHeader user={user} />

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
          <Link href="/dashboard/profile" className={styles.accountLink}>
            View profile
            <ChevronRightIcon size={14} />
          </Link>
        </section>

        <OrgPanel currentUserId={user.id} />

        <BillingPanel />

        <SettingsPanels />
      </div>
    </main>
  );
}
