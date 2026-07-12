import Link from "next/link";
import { listScans, type Scan } from "../../lib/api";
import { getCurrentUser } from "../../lib/get-current-user";
import { triggerScanAction } from "../actions";
import UserMenu from "../UserMenu";
import styles from "./dashboard.module.css";
import {
  ArrowRightIcon,
  BellIcon,
  BrandMark,
  CalendarIcon,
  CheckCircleIcon,
  GitHubIcon,
  HelpCircleIcon,
  LockIcon,
  MoonIcon,
  RocketIcon,
  ScanIcon,
  ShieldCheckIcon,
  StarIcon,
} from "../landing-icons";

// Dark-theme variants of the shared light-bg palette in lib/styles.ts
const VERDICT_COLORS: Record<string, string> = {
  Ready: "#34d399",
  "Ready with Minor Improvements": "#fbbf24",
  "Not Ready": "#fb923c",
  "High Risk": "#f87171",
};

const STATUS_META: Record<Scan["status"], { color: string; live?: boolean }> = {
  queued: { color: "#9aa1b1", live: true },
  active: { color: "#818cf8", live: true },
  completed: { color: "#34d399" },
  failed: { color: "#f87171" },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #ec4899)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #34d399, #3b82f6)",
  "linear-gradient(135deg, #a78bfa, #38bdf8)",
];

function accentColor(scan: Scan): string {
  if (scan.status === "active" || scan.status === "queued") return "#6366f1";
  if (scan.status === "failed") return "#ef4444";
  return (scan.verdict && VERDICT_COLORS[scan.verdict]) || "#34d399";
}

function HeroArt() {
  return (
    <svg
      className={styles.heroArt}
      viewBox="0 0 260 270"
      width="260"
      height="270"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hexStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="hexFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1830" />
          <stop offset="1" stopColor="#0a1120" />
        </linearGradient>
      </defs>

      {/* stacked isometric platforms */}
      <polygon
        points="130,178 228,224 130,270 32,224"
        fill="#080d18"
        stroke="#1c2942"
        strokeWidth="1.5"
      />
      <polygon
        points="130,164 208,201 130,238 52,201"
        fill="#0b1222"
        stroke="#263553"
        strokeWidth="1.5"
      />
      <polygon
        points="130,152 186,179 130,206 74,179"
        fill="#0f182e"
        stroke="#324467"
        strokeWidth="1.5"
      />
      <ellipse cx="130" cy="176" rx="42" ry="12" fill="rgba(56, 189, 248, 0.18)" />

      {/* glowing hexagon shield */}
      <polygon
        points="130,38 178,66 178,122 130,150 82,122 82,66"
        fill="url(#hexFill)"
        stroke="url(#hexStroke)"
        strokeWidth="3"
      />
      <polygon
        points="130,52 166,73 166,115 130,136 94,115 94,73"
        fill="none"
        stroke="rgba(45, 212, 191, 0.35)"
        strokeWidth="1.5"
      />
      <path
        d="M110 94l15 15 26-30"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* deco */}
      <circle cx="30" cy="70" r="2.5" fill="#38bdf8" opacity="0.7" />
      <circle cx="40" cy="120" r="2" fill="#6366f1" opacity="0.7" />
      <circle cx="226" cy="90" r="2.5" fill="#2dd4bf" opacity="0.7" />
      <path d="M28 82v18M226 100v14" stroke="#233252" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default async function DashboardPage() {
  let scans: Scan[] = [];
  let apiError: string | null = null;

  try {
    scans = await listScans();
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the ReadyCheck API";
  }

  // Guaranteed by middleware.ts (which gates /dashboard), but re-checked here
  // since this page can't assume the middleware ran (e.g. direct RSC render).
  const user = await getCurrentUser();

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>
            <BrandMark size={38} />
          </span>
          <span>
            ReadyCheck <span className={styles.brandAI}>AI</span>
          </span>
        </Link>
        <div className={styles.topRight}>
          <button type="button" className={styles.iconBtn} aria-label="Toggle theme">
            <MoonIcon size={16} />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Help">
            <HelpCircleIcon size={16} />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Notifications">
            <BellIcon size={16} />
            <span className={styles.bellDot} />
          </button>
          {user && (
            <UserMenu
              user={user}
              chipClassName={styles.userChip}
              avatarClassName={styles.userAvatar}
              nameClassName={styles.userName}
            />
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <HeroArt />

        <div>
          <h1 className={styles.heroTitle}>
            ReadyCheck <span>AI</span>
          </h1>
          <p className={styles.heroTag}>
            <strong>AI-powered</strong> production readiness platform.
          </p>
          <p className={styles.heroDesc}>
            Trigger a scan of a public git repository (or a local path) to get a scored
            readiness verdict.
          </p>

          <form action={triggerScanAction} className={styles.scanForm}>
            <span className={styles.inputIcon}>
              <GitHubIcon size={18} />
            </span>
            <input
              name="path"
              className={styles.input}
              placeholder="https://github.com/org/repo.git or a local path"
              required
            />
            <button type="submit" className={styles.runBtn}>
              <RocketIcon size={16} />
              Run Scan
            </button>
          </form>

          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <LockIcon size={13} />
              We don&apos;t store your code.
            </span>
            <span>&middot;</span>
            <span className={styles.trustItem}>
              <ShieldCheckIcon size={13} />
              Secure, private and encrypted scans.
            </span>
          </div>
        </div>

        <aside className={styles.whyCard}>
          <h2 className={styles.whyTitle}>Why ReadyCheck AI?</h2>
          <p className={styles.whyText}>
            We analyze your codebase, architecture, security, tests, DevOps, and more to
            tell you if your app is truly production ready.
          </p>
          <div className={styles.whyProof}>
            <span className={styles.avatars}>
              {AVATAR_GRADIENTS.map((g) => (
                <span key={g} className={styles.avatar} style={{ background: g }} />
              ))}
            </span>
            <span className={styles.stars}>
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} size={13} />
              ))}
            </span>
            <span className={styles.whyProofText}>Trusted by developers and teams</span>
          </div>
        </aside>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.panelHead}>
            <span className={styles.panelIcon}>
              <ScanIcon size={19} />
            </span>
            <div>
              <h2 className={styles.panelTitle}>Recent Scans</h2>
              <p className={styles.panelSub}>
                Your latest repository scans and readiness scores
              </p>
            </div>
            <a href="#" className={styles.viewAllBtn}>
              View All Scans <ArrowRightIcon size={14} />
            </a>
          </div>

          {apiError && (
            <p className={styles.errorNote}>
              Could not reach the API ({apiError}). Is <code>apps/api</code> running?
            </p>
          )}

          {scans.length === 0 && !apiError && (
            <div className={styles.emptyState}>No scans yet — run one above.</div>
          )}

          <div className={styles.scanList}>
            {scans.map((scan) => {
              const status = STATUS_META[scan.status] ?? STATUS_META.queued;
              const verdictText =
                scan.verdict ??
                (scan.status === "active" || scan.status === "queued"
                  ? "Scanning in progress..."
                  : scan.status === "failed"
                    ? "Scan failed"
                    : null);
              const verdictColor =
                (scan.verdict && VERDICT_COLORS[scan.verdict]) ||
                (scan.status === "failed" ? "#f87171" : "#818cf8");

              return (
                <Link key={scan.id} href={`/scans/${scan.id}`} className={styles.scanRow}>
                  <span
                    className={styles.accent}
                    style={{ background: accentColor(scan) }}
                  />
                  <span className={styles.repoTile}>
                    <GitHubIcon size={20} />
                  </span>
                  <span className={styles.scanInfo}>
                    <span className={styles.scanPath}>{scan.path}</span>
                    <span className={styles.scanDate}>
                      <CalendarIcon size={12} />
                      {new Date(scan.createdAt).toLocaleString("en-US")}
                    </span>
                  </span>
                  <span className={styles.scanRight}>
                    <span className={styles.score}>
                      {scan.overallScore !== null ? `${scan.overallScore}%` : "—"}
                    </span>
                    <span className={styles.verdict} style={{ color: verdictColor }}>
                      {verdictText}
                    </span>
                    <span
                      className={styles.statusPill}
                      style={{
                        color: status.color,
                        borderColor: `${status.color}55`,
                        background: `${status.color}14`,
                      }}
                    >
                      {status.live ? (
                        <span className={styles.pulseDot} />
                      ) : scan.status === "completed" ? (
                        <CheckCircleIcon size={13} />
                      ) : null}
                      {scan.status}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
