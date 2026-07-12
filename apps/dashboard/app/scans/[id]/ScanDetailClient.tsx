"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Issue, ScanDetail } from "../../../lib/api";
import type { SessionUser } from "../../../lib/session";
import { triggerScanAction } from "../../actions";
import ThemeToggle from "../../ThemeToggle";
import UserMenu from "../../UserMenu";
import styles from "./scan-detail.module.css";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BarChartIcon,
  BellIcon,
  BracesIcon,
  BrandMark,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CodeIcon,
  CubeIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FlaskIcon,
  GaugeIcon,
  HashIcon,
  HelpCircleIcon,
  InfinityIcon,
  LockIcon,
  PlayCircleIcon,
  RefreshIcon,
  ScanIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  ZapIcon,
} from "../../landing-icons";

const progressLabels: Record<string, string> = {
  cloning: "Cloning repository",
  scanning: "Scanning files",
  evaluating_rules: "Evaluating rules",
  evaluating_plugins: "Checking plugins",
  scoring: "Scoring results",
  ai_narrative: "Generating AI assessment",
  persisting: "Saving results",
  done: "Finishing up",
};

const progressStages = [
  "cloning",
  "scanning",
  "evaluating_rules",
  "evaluating_plugins",
  "scoring",
  "ai_narrative",
  "persisting",
  "done",
] as const;

const scanningFiles = [
  "package.json",
  "src/index.ts",
  "README.md",
  "tsconfig.json",
  "src/app/page.tsx",
  "src/lib/api.ts",
];

type IconComponent = (props: { size?: number }) => React.ReactNode;

const CATEGORY_META: Record<string, { icon: IconComponent; color: string; gradient: string }> = {
  architecture: {
    icon: CubeIcon,
    color: "#2dd4bf",
    gradient: "linear-gradient(90deg, #10b981, #2dd4bf)",
  },
  security: {
    icon: ShieldIcon,
    color: "#fbbf24",
    gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  },
  devops: {
    icon: InfinityIcon,
    color: "#f472b6",
    gradient: "linear-gradient(90deg, #ec4899, #f472b6)",
  },
  testing: {
    icon: FlaskIcon,
    color: "#38bdf8",
    gradient: "linear-gradient(90deg, #3b82f6, #38bdf8)",
  },
  documentation: {
    icon: FileTextIcon,
    color: "#a78bfa",
    gradient: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
  },
  performance: {
    icon: ZapIcon,
    color: "#4ade80",
    gradient: "linear-gradient(90deg, #22c55e, #4ade80)",
  },
  database: {
    icon: DatabaseIcon,
    color: "#fbbf24",
    gradient: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  },
};

const DEFAULT_CATEGORY = {
  icon: GaugeIcon as IconComponent,
  color: "#818cf8",
  gradient: "linear-gradient(90deg, #6366f1, #818cf8)",
};

const SEVERITY_COLORS: Record<Issue["severity"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#60a5fa",
};

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

const DOWNLOAD_FORMATS = [
  { format: "markdown", label: "Markdown", color: "#34d399", icon: FileTextIcon },
  { format: "html", label: "HTML", color: "#38bdf8", icon: CodeIcon },
  { format: "csv", label: "CSV", color: "#4ade80", icon: BarChartIcon },
  { format: "json", label: "JSON", color: "#a78bfa", icon: BracesIcon },
] as const;

const VERDICT_COLORS: Record<string, string> = {
  Ready: "#34d399",
  "Ready with Minor Improvements": "#fbbf24",
  "Not Ready": "#fb923c",
  "High Risk": "#f87171",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

interface ScanDetailWithProgress extends ScanDetail {
  progress?: string | null;
}

interface ScanDetailClientProps {
  initialScan: ScanDetailWithProgress;
  user: SessionUser | null;
}

export default function ScanDetailClient({ initialScan, user }: ScanDetailClientProps) {
  const [scan, setScan] = useState<ScanDetailWithProgress>(initialScan);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"all" | Issue["severity"]>("all");
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const isPending = scan.status === "queued" || scan.status === "active";
  const isGitUrl = /^https?:\/\//.test(scan.path);

  const progressText = useMemo(() => {
    if (scan.progress) {
      return `Mission: ${progressLabels[scan.progress] ?? String(scan.progress)}`;
    }
    if (scan.status === "queued") {
      return "Mission queued";
    }
    if (scan.status === "active") {
      return "Mission in progress";
    }
    return null;
  }, [scan.progress, scan.status]);

  const progressValue = useMemo(() => {
    if (scan.progress) {
      const index = progressStages.indexOf(scan.progress as (typeof progressStages)[number]);
      return index === -1 ? 100 : Math.round(((index + 1) / progressStages.length) * 100);
    }
    if (scan.status === "active") return 28;
    if (scan.status === "queued") return 12;
    return 0;
  }, [scan.progress, scan.status]);

  const currentStageIndex = useMemo(() => {
    if (scan.progress) {
      return progressStages.indexOf(scan.progress as (typeof progressStages)[number]);
    }
    if (scan.status === "queued") return 0;
    if (scan.status === "active") return 1;
    return -1;
  }, [scan.progress, scan.status]);

  const [scanTick, setScanTick] = useState(0);

  useEffect(() => {
    if (!isPending) {
      return undefined;
    }

    const interval = window.setInterval(() => setScanTick((value) => value + 1), 800);
    return () => {
      window.clearInterval(interval);
    };
  }, [isPending]);

  const scanningFile = useMemo(() => {
    if (!isPending) return null;
    const index = scanTick % scanningFiles.length;
    return scanningFiles[index];
  }, [isPending, scanTick]);

  useEffect(() => {
    if (!isPending) return undefined;

    let mounted = true;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/scans/${scan.id}`);
        if (!res.ok) {
          throw new Error(`Failed to refresh scan: ${res.status}`);
        }
        const updated: ScanDetailWithProgress = await res.json();
        if (mounted) {
          setScan(updated);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to refresh scan");
        }
      } finally {
        if (mounted) {
          setIsRefreshing(false);
        }
      }
    };

    const timer = window.setInterval(refresh, 2000);
    refresh();
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [isPending, scan.id]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of scan.issues) {
      counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
    }
    return counts;
  }, [scan.issues]);

  const visibleIssues = useMemo(
    () =>
      severityFilter === "all"
        ? scan.issues
        : scan.issues.filter((issue) => issue.severity === severityFilter),
    [scan.issues, severityFilter]
  );

  const verdictColor = (scan.verdict && VERDICT_COLORS[scan.verdict]) || "#34d399";

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>
            <BrandMark size={32} />
          </span>
          <span>
            ReadyCheck <span className={styles.brandAI}>AI</span>
          </span>
        </Link>
        <nav className={styles.navLinks}>
          <Link href="/dashboard" className={styles.navLink}>
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className={`${styles.navLink} ${styles.navLinkActive}`}
          >
            Scans
          </Link>
          <a href="#" className={styles.navLink}>
            Projects
          </a>
          <a href="#" className={styles.navLink}>
            Reports
          </a>
          <a href="#" className={styles.navLink}>
            Integrations
          </a>
          <Link href="/settings" className={styles.navLink}>
            Settings
          </Link>
        </nav>
        <div className={styles.topRight}>
          <ThemeToggle className={styles.iconBtn} />
          <button type="button" className={styles.iconBtn} aria-label="Notifications">
            <BellIcon size={15} />
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

      <div className={styles.container}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowRightIcon size={14} style={{ transform: "rotate(180deg)" }} />
          All scans
        </Link>

        <div className={styles.headGrid}>
          <div>
            <div className={styles.titleRow}>
              <h1 className={styles.repoTitle}>{scan.path}</h1>
              {isGitUrl && (
                <a
                  href={scan.path.replace(/\.git$/, "")}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.extLink}
                  aria-label="Open repository"
                >
                  <ExternalLinkIcon size={17} />
                </a>
              )}
            </div>

            {scan.status === "completed" && (
              <div className={styles.statusBanner}>
                <span className={styles.statusLeft} style={{ color: "#34d399" }}>
                  <CheckCircleIcon size={26} />
                  Completed
                </span>
                {scan.overallScore !== null && (
                  <span className={styles.bigScore}>{scan.overallScore}%</span>
                )}
                {scan.verdict && (
                  <>
                    <span className={styles.bannerDivider} />
                    <span className={styles.bannerVerdict} style={{ color: verdictColor }}>
                      {scan.verdict}
                    </span>
                  </>
                )}
              </div>
            )}

            {scan.status === "failed" && (
              <div className={`${styles.statusBanner} ${styles.statusBannerFailed}`}>
                <span className={styles.statusLeft} style={{ color: "#f87171" }}>
                  <AlertTriangleIcon size={24} />
                  Failed
                </span>
                <span className={styles.failedText} style={{ marginBottom: 0 }}>
                  {scan.errorMessage ?? "The scan could not be completed."}
                </span>
              </div>
            )}

            {isPending && (
              <div className={styles.progressCard}>
                <div className={styles.progressHead}>
                  <div>
                    <div className={styles.progressTitle}>
                      <span className={styles.progressIconWrap}>
                        <SearchIcon size={15} />
                      </span>
                      {progressText}
                    </div>
                    <div className={styles.progressSub}>
                      {scanningFile ? `Inspecting ${scanningFile}` : "Exploring the repository"}
                    </div>
                  </div>
                  <span className={styles.liveBadge}>{isRefreshing ? "Live" : "Active"}</span>
                </div>

                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progressValue}%` }} />
                </div>

                <div className={styles.stageChips}>
                  {progressStages.map((stage, index) => {
                    const isActive = index === currentStageIndex;
                    const isComplete = index < currentStageIndex;
                    return (
                      <span
                        key={stage}
                        className={`${styles.stageChip} ${
                          isActive
                            ? styles.stageChipActive
                            : isComplete
                              ? styles.stageChipDone
                              : ""
                        }`}
                      >
                        {isComplete && <CheckIcon size={11} />}
                        {progressLabels[stage]}
                      </span>
                    );
                  })}
                </div>

                {scanningFile && (
                  <div className={styles.scanTarget}>
                    <span className={styles.scanTargetIcon}>
                      <ScanIcon size={16} />
                    </span>
                    <span>
                      <span className={styles.scanTargetLabel}>Active scan target</span>
                      <br />
                      <span className={styles.scanTargetFile}>{scanningFile}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {scan.status === "completed" && (
              <div className={styles.downloadRow}>
                <span>Download report:</span>
                {DOWNLOAD_FORMATS.map(({ format, label, color, icon: Icon }) => (
                  <a
                    key={format}
                    href={`/scans/${scan.id}/report?format=${format}`}
                    className={styles.dlBtn}
                    style={{ color, borderColor: `${color}66` }}
                  >
                    <Icon size={13} />
                    {label.toUpperCase()}
                  </a>
                ))}
              </div>
            )}
          </div>

          <aside className={styles.metaCard}>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <HashIcon size={15} />
              </span>
              <span className={styles.metaLabel}>Scan ID</span>
              <span className={styles.metaValue} title={scan.id}>
                {scan.id}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <PlayCircleIcon size={15} />
              </span>
              <span className={styles.metaLabel}>Scan started</span>
              <span className={styles.metaValue}>{formatDate(scan.createdAt)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <CheckCircleIcon size={15} />
              </span>
              <span className={styles.metaLabel}>Scan completed</span>
              <span className={styles.metaValue}>{formatDate(scan.completedAt)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>
                <ClockIcon size={15} />
              </span>
              <span className={styles.metaLabel}>Duration</span>
              <span className={styles.metaValue}>
                {formatDuration(scan.createdAt, scan.completedAt)}
              </span>
            </div>
          </aside>
        </div>

        {scan.status === "completed" && (
          <div className={styles.aiCard}>
            <span className={styles.aiIcon}>
              <SparklesIcon size={22} />
            </span>
            <div>
              <h2 className={styles.aiTitle}>AI Assessment</h2>
              {scan.aiNarrative ? (
                <p className={styles.aiText}>{scan.aiNarrative}</p>
              ) : (
                <p className={styles.aiText}>
                  No AI narrative available for this scan (no AI provider configured, or
                  generation failed).
                  <br />
                  The score and issues above are unaffected &mdash; they&apos;re computed
                  deterministically by the rule engine.
                </p>
              )}
            </div>
          </div>
        )}

        {scan.categoryScores.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <BarChartIcon size={19} />
              </span>
              <h2 className={styles.sectionTitle}>Category Scores</h2>
            </div>
            <div className={styles.catGrid}>
              {scan.categoryScores.map((c) => {
                const meta = CATEGORY_META[c.category.toLowerCase()] ?? DEFAULT_CATEGORY;
                const Icon = meta.icon;
                return (
                  <div key={c.id} className={styles.catCard}>
                    <div className={styles.catHead}>
                      <span
                        className={styles.catIcon}
                        style={{ background: `${meta.color}1f`, color: meta.color }}
                      >
                        <Icon size={17} />
                      </span>
                      <span className={styles.catName}>{c.category}</span>
                      <span className={styles.catScore}>{c.score}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${c.score}%`, background: meta.gradient }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className={styles.issuesHead}>
          <span className={styles.sectionIcon} style={{ color: "#f87171" }}>
            <AlertTriangleIcon size={19} />
          </span>
          <h2 className={styles.sectionTitle}>Issues ({scan.issues.length})</h2>
          {scan.issues.length > 0 && (
            <div className={styles.issueFilters}>
              <button
                type="button"
                className={styles.filterChip}
                onClick={() => setSeverityFilter("all")}
                style={{
                  color: "#a5b4fc",
                  borderColor:
                    severityFilter === "all" ? "#6366f1" : undefined,
                  background:
                    severityFilter === "all" ? "rgba(99, 102, 241, 0.12)" : undefined,
                }}
              >
                All ({scan.issues.length})
              </button>
              {SEVERITIES.map((severity) => {
                const count = severityCounts[severity] ?? 0;
                if (count === 0) return null;
                const color = SEVERITY_COLORS[severity];
                const isActive = severityFilter === severity;
                return (
                  <button
                    key={severity}
                    type="button"
                    className={styles.filterChip}
                    onClick={() => setSeverityFilter(isActive ? "all" : severity)}
                    style={{
                      color,
                      borderColor: isActive ? color : undefined,
                      background: isActive ? `${color}1f` : undefined,
                    }}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {scan.issues.length === 0 && !isPending && (
          <p className={styles.noIssues}>No issues found.</p>
        )}

        <div className={styles.issueList}>
          {visibleIssues.map((issue) => {
            const meta = CATEGORY_META[issue.category.toLowerCase()] ?? DEFAULT_CATEGORY;
            const Icon = meta.icon;
            const sevColor = SEVERITY_COLORS[issue.severity] ?? "#9aa1b1";
            const isExpanded = expandedIssue === issue.id;
            return (
              <div key={issue.id} className={styles.issueCard}>
                <span
                  className={styles.sevBadge}
                  style={{
                    color: sevColor,
                    borderColor: `${sevColor}55`,
                    background: `${sevColor}12`,
                  }}
                >
                  <Icon size={18} />
                  {issue.severity}
                </span>
                <div className={styles.issueBody}>
                  <p className={styles.issueTitle}>
                    {issue.ruleId} &mdash; {issue.message}
                  </p>
                  <p className={styles.issueRec}>{issue.recommendation}</p>
                  {isExpanded && (
                    <p className={styles.issueEffort}>
                      Estimated effort: <strong>{issue.estimatedEffort || "unknown"}</strong>
                    </p>
                  )}
                </div>
                <span className={styles.issueRight}>
                  <span className={styles.catChip}>{issue.category}</span>
                  <button
                    type="button"
                    className={`${styles.expandBtn} ${isExpanded ? styles.expandBtnOpen : ""}`}
                    onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                    aria-label={isExpanded ? "Collapse issue details" : "Expand issue details"}
                    aria-expanded={isExpanded}
                  >
                    <ChevronDownIcon size={17} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {scan.status === "completed" && (
          <form action={triggerScanAction} className={styles.ctaBanner}>
            <input type="hidden" name="path" value={scan.path} />
            <span className={styles.ctaText}>
              <SparklesIcon size={18} />
              Improve your score! Fix the issues above to increase your production readiness.
            </span>
            <button type="submit" className={styles.rescanBtn}>
              Rescan Repository <RefreshIcon size={15} />
            </button>
          </form>
        )}

        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    </main>
  );
}
