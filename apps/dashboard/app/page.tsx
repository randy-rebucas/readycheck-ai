import Link from "next/link";
import { getCurrentUser } from "../lib/get-current-user";
import UserMenu from "./UserMenu";
import styles from "./landing.module.css";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  AzureDevOpsIcon,
  BitbucketIcon,
  BrandMark,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CubeIcon,
  DashboardIcon,
  DiscordIcon,
  DropboxIcon,
  FileTextIcon,
  FlaskIcon,
  FolderIcon,
  GaugeIcon,
  GitHubIcon,
  GitLabIcon,
  InfinityIcon,
  LightbulbIcon,
  LinearIcon,
  LinkedInIcon,
  MicrosoftIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  StarIcon,
  SupabaseIcon,
  VercelIcon,
  XIcon,
  YouTubeIcon,
} from "./landing-icons";

const SIDEBAR_ITEMS = [
  { label: "Overview", icon: DashboardIcon, active: true },
  { label: "Projects", icon: FolderIcon },
  { label: "Scans", icon: ScanIcon },
  { label: "Reports", icon: FileTextIcon },
  { label: "Issues", icon: AlertCircleIcon },
  { label: "Recommendations", icon: LightbulbIcon },
  { label: "Architecture", icon: CubeIcon },
  { label: "Security", icon: ShieldIcon },
  { label: "Performance", icon: GaugeIcon },
  { label: "DevOps", icon: InfinityIcon },
];

const ISSUE_STATS = [
  { label: "Critical Issues", count: 2, color: "#ef4444" },
  { label: "High Issues", count: 8, color: "#f97316" },
  { label: "Medium Issues", count: 12, color: "#f59e0b" },
  { label: "Low Issues", count: 18, color: "#3b82f6" },
];

const SUMMARY_ROWS = [
  { label: "Files Scanned", value: "8,432" },
  { label: "Lines of Code", value: "523,456" },
  { label: "Dependencies", value: "1,243" },
  { label: "Languages", value: "7" },
  { label: "Framework", value: "Next.js 14" },
];

const METRICS = [
  { label: "Architecture", value: 95, color: "#34d399" },
  { label: "Security", value: 89, color: "#f59e0b" },
  { label: "Performance", value: 93, color: "#34d399" },
  { label: "Testing", value: 85, color: "#3b82f6" },
  { label: "DevOps", value: 88, color: "#34d399" },
  { label: "Infrastructure", value: 90, color: "#34d399" },
  { label: "Documentation", value: 78, color: "#f59e0b" },
  { label: "Best Practices", value: 92, color: "#34d399" },
];

const RECENT_ISSUES = [
  { text: "Missing rate limiting on 2 API endpoints", severity: "High" },
  { text: "Hardcoded secret detected in .env.example", severity: "High" },
  { text: "3 dependencies have known vulnerabilities", severity: "Medium" },
  { text: "No database backup strategy detected", severity: "Medium" },
] as const;

const FEATURES = [
  {
    icon: CubeIcon,
    color: "#818cf8",
    bg: "rgba(129, 140, 248, 0.12)",
    title: "AI Architecture Review",
    desc: "Analyze code structure, design patterns, SOLID principles, and module boundaries.",
  },
  {
    icon: ShieldIcon,
    color: "#34d399",
    bg: "rgba(52, 211, 153, 0.12)",
    title: "Security Scanner",
    desc: "Detect vulnerabilities, insecure configurations, secret leaks, and OWASP Top 10 issues.",
  },
  {
    icon: ZapFeature,
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.12)",
    title: "Performance Analysis",
    desc: "Find performance bottlenecks, slow APIs, large bundles, N+1 queries, and memory issues.",
  },
  {
    icon: FlaskIcon,
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.12)",
    title: "Testing Coverage",
    desc: "Evaluate test coverage, missing tests, and overall code quality and reliability.",
  },
  {
    icon: InfinityIcon,
    color: "#f472b6",
    bg: "rgba(244, 114, 182, 0.12)",
    title: "DevOps Audit",
    desc: "Review CI/CD pipelines, Docker, Kubernetes, monitoring, logging, and rollback strategy.",
  },
];

// Zap needs a fill for visual weight matching the reference
function ZapFeature({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

const PLANS = [
  {
    name: "Free",
    tagline: "Perfect for developers getting started.",
    price: "$0",
    period: "/forever",
    features: ["1 Repository", "Basic Scan", "AI Summary", "Production Score"],
    cta: "Get Started Free",
    ctaClass: "btnSecondary" as const,
    href: "/dashboard",
    featured: false,
  },
  {
    name: "Pro",
    tagline: "Perfect for startups and small teams.",
    price: "$29",
    period: "/month",
    features: [
      "Unlimited Projects",
      "AI Recommendations",
      "Security & Architecture Analysis",
      "CI/CD Integration",
      "PDF Reports & Exports",
    ],
    cta: "Start Pro Trial",
    ctaClass: "btnSuccess" as const,
    href: "/dashboard/settings",
    featured: true,
  },
  {
    name: "Enterprise",
    tagline: "For organizations with advanced needs.",
    price: "Custom",
    period: "",
    features: [
      "Everything in Pro",
      "SSO & SAML",
      "Custom Rules & Policies",
      "Private AI / On-Premise",
      "Audit Logs & Compliance",
      "Priority Support",
    ],
    cta: "Contact Sales",
    ctaClass: "btnPurple" as const,
    href: "mailto:sales@readycheck.ai",
    featured: false,
  },
];

const LOGOS = [
  { name: "Vercel", icon: VercelIcon },
  { name: "Linear", icon: LinearIcon },
  { name: "supabase", icon: SupabaseIcon },
  { name: "Discord", icon: DiscordIcon },
  { name: "scale", icon: null },
  { name: "Dropbox", icon: DropboxIcon },
  { name: "Microsoft", icon: MicrosoftIcon },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #ec4899)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #34d399, #3b82f6)",
  "linear-gradient(135deg, #a78bfa, #38bdf8)",
];

const GRAPH_NODES = [
  { x: 20, y: 58, r: 6, color: "#6366f1" },
  { x: 62, y: 30, r: 7, color: "#34d399" },
  { x: 68, y: 74, r: 5, color: "#f59e0b" },
  { x: 118, y: 16, r: 6, color: "#38bdf8" },
  { x: 126, y: 52, r: 8, color: "#818cf8" },
  { x: 132, y: 88, r: 5, color: "#f472b6" },
  { x: 182, y: 34, r: 6, color: "#34d399" },
  { x: 190, y: 72, r: 6, color: "#f59e0b" },
  { x: 228, y: 54, r: 5, color: "#3b82f6" },
];

const GRAPH_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 4],
  [2, 5],
  [4, 6],
  [4, 7],
  [5, 7],
  [6, 8],
  [7, 8],
];

function HeroMockup() {
  return (
    <div className={styles.mock} aria-hidden="true">
      <div className={styles.mockTopbar}>
        <span className={styles.mockBrand}>
          <span className={styles.mockBrandIcon}>
            <BrandMark size={18} />
          </span>
          ReadyCheck AI
        </span>
        <span className={styles.mockTopRight}>
          <span className={styles.mockChip}>
            Acme Web App <ChevronDownIcon size={11} />
          </span>
          <span>Latest scan: 2 hours ago</span>
          <span className={styles.mockRescan}>Rescan</span>
        </span>
      </div>

      <div className={styles.mockBody}>
        <div className={styles.mockSidebar}>
          {SIDEBAR_ITEMS.map((item) => (
            <span
              key={item.label}
              className={`${styles.mockNavItem} ${item.active ? styles.mockNavItemActive : ""}`}
            >
              <item.icon size={13} />
              {item.label}
            </span>
          ))}
          <span className={styles.mockDivider} />
          <span className={styles.mockNavItem}>
            <SettingsIcon size={13} />
            Settings
          </span>
        </div>

        <div className={styles.mockMain}>
          <div className={styles.mockRowTop}>
            <div className={styles.mockCard}>
              <div className={styles.cardLabel}>Production Readiness Score</div>
              <div className={styles.scoreFlex}>
                <div className={styles.scoreRing}>
                  <div className={styles.scoreRingInner}>
                    <strong style={{ fontSize: "1.35rem", color: "#fff" }}>91%</strong>
                    <span style={{ fontSize: "0.55rem", color: "#34d399" }}>
                      Production Ready
                    </span>
                  </div>
                </div>
                <div className={styles.scoreIssues}>
                  <span className={styles.scoreHint}>
                    Great job! Your application is almost production ready.
                  </span>
                  {ISSUE_STATS.map((s) => (
                    <span key={s.label} className={styles.issueStatRow}>
                      <span className={styles.issueDot} style={{ background: s.color }} />
                      {s.label}
                      <strong>{s.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <span className={styles.viewReportBtn}>View Full Report</span>
            </div>

            <div className={styles.mockCard}>
              <div className={styles.cardLabel}>Summary</div>
              {SUMMARY_ROWS.map((row) => (
                <div key={row.label} className={styles.summaryRow}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.mockMetrics}>
            {METRICS.map((m) => (
              <div key={m.label} className={styles.metricCard}>
                <div className={styles.metricHead}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <ChevronRightIcon size={11} />
                </div>
                <div className={styles.metricValue}>{m.value}%</div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${m.value}%`, background: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.mockRowBottom}>
            <div className={styles.mockCard}>
              <div className={styles.issuesHead}>
                <span className={styles.cardLabel} style={{ marginBottom: 0 }}>
                  Recent Issues
                </span>
                <a>View All</a>
              </div>
              {RECENT_ISSUES.map((issue) => (
                <div key={issue.text} className={styles.issueRow}>
                  <span
                    className={styles.issueDot}
                    style={{
                      background: issue.severity === "High" ? "#ef4444" : "#f59e0b",
                    }}
                  />
                  <span className={styles.issueText}>{issue.text}</span>
                  <span
                    className={`${styles.sevChip} ${
                      issue.severity === "High" ? styles.sevHigh : styles.sevMedium
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.mockCard}>
              <div className={styles.cardLabel}>Architecture Graph</div>
              <svg className={styles.graphSvg} viewBox="0 0 248 104">
                {GRAPH_EDGES.map(([a, b]) => (
                  <line
                    key={`${a}-${b}`}
                    x1={GRAPH_NODES[a].x}
                    y1={GRAPH_NODES[a].y}
                    x2={GRAPH_NODES[b].x}
                    y2={GRAPH_NODES[b].y}
                    stroke="#2a2f3d"
                    strokeWidth="1.5"
                  />
                ))}
                {GRAPH_NODES.map((n, i) => (
                  <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.color} />
                ))}
              </svg>
              <span className={styles.graphBtn}>View Full Graph</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>
            <BrandMark size={34} />
          </span>
          <span>
            ReadyCheck <span className={styles.brandAI}>AI</span>
          </span>
        </Link>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className={styles.navRight}>
          {user ? (
            <UserMenu
              user={user}
              chipClassName={styles.userChip}
              avatarClassName={styles.userAvatar}
              nameClassName={styles.userName}
            />
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/dashboard" className={styles.btnPrimary}>
                Start Free Scan
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>
            Ship with
            <br />
            <span>Confidence.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            ReadyCheck AI scans your entire codebase, detects what&apos;s missing, and
            evaluates architecture, security, testing, DevOps, and deployment
            readiness&mdash;before your application reaches production.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/dashboard" className={styles.btnPrimary}>
              Start Free Scan <ArrowRightIcon size={15} />
            </Link>
            <a href="#how-it-works" className={styles.btnSecondary}>
              View Demo
            </a>
          </div>
          <div className={styles.socialProof}>
            <span className={styles.avatars}>
              {AVATAR_GRADIENTS.map((g) => (
                <span key={g} className={styles.avatar} style={{ background: g }} />
              ))}
            </span>
            <span className={styles.stars}>
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} size={14} />
              ))}
            </span>
            <span>Trusted by 5,000+ developers and teams</span>
          </div>
          <div className={styles.integrations}>
            <div className={styles.integrationsLabel}>Integrates With</div>
            <div className={styles.integrationsRow}>
              <span className={styles.integrationItem}>
                <GitHubIcon size={18} /> GitHub
              </span>
              <span className={styles.integrationItem}>
                <GitLabIcon size={18} style={{ color: "#fc6d26" }} /> GitLab
              </span>
              <span className={styles.integrationItem}>
                <BitbucketIcon size={17} style={{ color: "#2684ff" }} /> Bitbucket
              </span>
              <span className={styles.integrationItem}>
                <AzureDevOpsIcon size={17} style={{ color: "#0078d4" }} /> Azure DevOps
              </span>
            </div>
          </div>
        </div>

        <HeroMockup />
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.featurePanel}>
          <h2 className={`${styles.sectionTitle} ${styles.gradientTitle}`}>
            Everything Your CTO Checks&mdash;Automated
          </h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div
                  className={styles.featureIcon}
                  style={{ background: f.bg, color: f.color }}
                >
                  <f.icon size={20} />
                </div>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section}>
        <h2 className={styles.sectionTitle}>How ReadyCheck AI Works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepVisual}>
              <div className={styles.repoRow}>
                <span className={styles.repoTile}>
                  <GitHubIcon size={20} style={{ color: "#e6e8ee" }} />
                </span>
                <span className={styles.repoTile}>
                  <GitLabIcon size={20} style={{ color: "#fc6d26" }} />
                </span>
                <span className={styles.repoTile}>
                  <BitbucketIcon size={19} style={{ color: "#2684ff" }} />
                </span>
                <span className={styles.repoTile}>
                  <AzureDevOpsIcon size={19} style={{ color: "#0078d4" }} />
                </span>
              </div>
            </div>
            <div className={styles.stepTitle}>Connect Repository</div>
            <div className={styles.stepDesc}>
              Connect your GitHub, GitLab, Bitbucket, or Azure DevOps repository.
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepVisual}>
              <div className={styles.codeLines}>
                <div className={styles.codeLine} style={{ width: "85%" }} />
                <div className={styles.codeLine} style={{ width: "65%" }} />
                <div className={styles.codeLine} style={{ width: "92%" }} />
                <div className={styles.codeLine} style={{ width: "48%" }} />
                <div className={styles.codeLine} style={{ width: "74%" }} />
              </div>
              <span className={styles.magnifier}>
                <SearchIcon size={34} />
              </span>
            </div>
            <div className={styles.stepTitle}>AI Scans Your Project</div>
            <div className={styles.stepDesc}>
              Our AI analyzes your code, dependencies, infrastructure, tests, and
              configuration.
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepVisual}>
              <div className={styles.miniScore}>
                <div className={styles.miniRing}>
                  <div className={styles.miniRingInner}>91%</div>
                </div>
                <div className={styles.miniLines}>
                  <div className={styles.miniLine} style={{ width: 90 }} />
                  <div className={styles.miniLine} style={{ width: 70 }} />
                  <div className={styles.miniLine} style={{ width: 80 }} />
                  <div className={styles.miniLine} style={{ width: 56 }} />
                </div>
              </div>
            </div>
            <div className={styles.stepTitle}>Get Complete Report</div>
            <div className={styles.stepDesc}>
              Receive a detailed production readiness report with AI recommendations.
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className={styles.section}>
        <div className={styles.pricingWrap}>
          <h2 className={styles.sectionTitle}>Simple, Transparent Pricing</h2>
          <div className={styles.pricingGrid}>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`${styles.priceCard} ${
                  plan.featured ? styles.priceCardFeatured : ""
                }`}
              >
                {plan.featured && <span className={styles.popularBadge}>Most Popular</span>}
                <div className={styles.priceName}>{plan.name}</div>
                <div className={styles.priceTagline}>{plan.tagline}</div>
                <div className={styles.priceValue}>
                  {plan.price}
                  {plan.period && <span> {plan.period}</span>}
                </div>
                <ul className={styles.priceFeatures}>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className={styles.priceCheck}>
                        <CheckIcon size={14} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith("mailto:") ? (
                  <a href={plan.href} className={styles[plan.ctaClass]}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link href={plan.href} className={styles[plan.ctaClass]}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.logoWall}>
        <div className={styles.logoWallLabel}>Trusted by amazing teams</div>
        <div className={styles.logoRow}>
          {LOGOS.map((logo) => (
            <span key={logo.name} className={styles.logoItem}>
              {logo.icon && <logo.icon size={19} />}
              {logo.name}
            </span>
          ))}
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerCol}>
            <div className={styles.brand}>
              <span className={styles.brandIcon}>
                <BrandMark size={30} />
              </span>
              ReadyCheck AI
            </div>
            <p className={styles.footerDesc}>
              AI-powered platform that helps you ship secure, reliable, and
              production-ready software.
            </p>
            <div className={styles.socialRow}>
              <a href="#" className={styles.socialBtn} aria-label="X (Twitter)">
                <XIcon size={14} />
              </a>
              <a href="#" className={styles.socialBtn} aria-label="LinkedIn">
                <LinkedInIcon size={14} />
              </a>
              <a href="#" className={styles.socialBtn} aria-label="YouTube">
                <YouTubeIcon size={14} />
              </a>
              <a href="#" className={styles.socialBtn} aria-label="GitHub">
                <GitHubIcon size={14} />
              </a>
            </div>
          </div>
          <div className={styles.footerCol}>
            <h4>Product</h4>
            <span>Features</span>
            <span>Pricing</span>
            <span>Docs</span>
            <span>Changelog</span>
            <span>API</span>
          </div>
          <div className={styles.footerCol}>
            <h4>Resources</h4>
            <span>Blog</span>
            <span>Guides</span>
            <span>Security</span>
            <span>Status</span>
            <span>Help Center</span>
          </div>
          <div className={styles.footerCol}>
            <h4>Company</h4>
            <span>About</span>
            <span>Careers</span>
            <span>Contact</span>
            <span>Partners</span>
          </div>
          <div className={styles.footerCol}>
            <h4>Legal</h4>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Cookie Policy</span>
            <span>Security</span>
          </div>
          <div className={styles.newsCard}>
            <h4>Stay in the loop</h4>
            <p>
              Get the latest updates and best practices for production-ready software.
            </p>
            <form className={styles.newsForm}>
              <input
                type="email"
                className={styles.newsInput}
                placeholder="Enter your email"
                aria-label="Email address"
              />
              <button type="submit" className={styles.newsSubmit} aria-label="Subscribe">
                <ArrowRightIcon size={15} />
              </button>
            </form>
          </div>
        </div>
        <div className={styles.footerBottom}>
          &copy; 2026 ReadyCheck AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
