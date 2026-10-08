import { Archivo } from "next/font/google";
import { redirect } from "next/navigation";
import { listScans } from "../../lib/api";
import { getCurrentUser } from "../../lib/get-current-user";
import { getMode } from "../../lib/get-mode";
import { groupProjects } from "../../lib/projects";
import Sidebar from "./Sidebar";
import styles from "./shell.module.css";

const uiFont = Archivo({ subsets: ["latin"], variable: "--font-ui", display: "swap" });

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Guaranteed by middleware.ts (which gates /dashboard), but re-checked here
  // since a layout can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  // The sidebar badge is best-effort; pages report API errors themselves.
  const scans = await listScans().catch(() => []);
  const urgentCount = groupProjects(scans).reduce((sum, p) => {
    const counts = p.latestCompleted?.issueCounts;
    return sum + (counts ? counts.critical + counts.high : 0);
  }, 0);

  return (
    <div className={`${styles.shell} ${uiFont.variable}`}>
      <Sidebar user={user} urgentCount={urgentCount} mode={await getMode()} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
