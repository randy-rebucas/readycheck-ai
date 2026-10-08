import Link from "next/link";
import { redirect } from "next/navigation";
import { listScans, type Scan } from "../../../lib/api";
import { getCurrentUser } from "../../../lib/get-current-user";
import AppHeader from "../../AppHeader";
import Pagination from "../Pagination";
import ScanList from "../ScanList";
import dashStyles from "../dashboard.module.css";
import { RocketIcon, ScanIcon } from "../../landing-icons";

export const metadata = {
  title: "Scans — ReadyCheck AI",
};

const STATUS_FILTERS: { key: Scan["status"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "queued", label: "Queued" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 10;

interface ScansPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function ScansPage({ searchParams }: ScansPageProps) {
  const { status: statusParam, page: pageParam } = await searchParams;
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === statusParam)?.key ?? "all";

  // Guaranteed by middleware.ts (which gates /dashboard), but re-checked here
  // since this page can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/scans");

  let scans: Scan[] = [];
  let apiError: string | null = null;

  try {
    scans = await listScans();
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  const filteredScans =
    activeFilter === "all" ? scans : scans.filter((scan) => scan.status === activeFilter);

  const totalPages = Math.max(1, Math.ceil(filteredScans.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;
  const visibleScans = filteredScans.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className={dashStyles.page}>
      <AppHeader user={user} active="scans" />

      <section className={`${dashStyles.panel} ${dashStyles.panelStandalone}`}>
        <div className={dashStyles.panelInner}>
          <div className={dashStyles.panelHead}>
            <span className={dashStyles.panelIcon}>
              <ScanIcon size={19} />
            </span>
            <div>
              <h2 className={dashStyles.panelTitle}>All Scans</h2>
              <p className={dashStyles.panelSub}>
                {scans.length} {scans.length === 1 ? "scan" : "scans"} on your account
              </p>
            </div>
            <Link href="/dashboard" className={dashStyles.viewAllBtn}>
              <RocketIcon size={14} />
              New Scan
            </Link>
          </div>

          {apiError && (
            <p className={dashStyles.errorNote}>
              Could not reach the API ({apiError}). Is <code>apps/api</code> running?
            </p>
          )}

          {scans.length > 0 && (
            <div className={dashStyles.filterRow}>
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.key === "all"
                    ? scans.length
                    : scans.filter((scan) => scan.status === filter.key).length;
                if (filter.key !== "all" && count === 0) return null;
                const href = filter.key === "all" ? "/dashboard/scans" : `/dashboard/scans?status=${filter.key}`;
                const isActive = filter.key === activeFilter;
                return (
                  <Link
                    key={filter.key}
                    href={href}
                    className={`${dashStyles.filterChip} ${isActive ? dashStyles.filterChipActive : ""}`}
                  >
                    {filter.label} ({count})
                  </Link>
                );
              })}
            </div>
          )}

          {scans.length === 0 && !apiError && (
            <div className={dashStyles.emptyState}>No scans yet — run one from the dashboard.</div>
          )}

          {scans.length > 0 && visibleScans.length === 0 && (
            <div className={dashStyles.emptyState}>No scans match this filter.</div>
          )}

          <ScanList scans={visibleScans} />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/dashboard/scans"
            extraParams={activeFilter === "all" ? {} : { status: activeFilter }}
          />
        </div>
      </section>
    </main>
  );
}
