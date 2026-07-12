import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/get-current-user";
import { safeInternalPath } from "../../lib/session";
import LoginCard from "./LoginCard";
import styles from "./login.module.css";
import {
  BrandMark,
  CheckCircleIcon,
  CubeIcon,
  FileTextIcon,
  FlaskIcon,
  GaugeIcon,
  InfinityIcon,
  LockIcon,
  MoonIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
} from "../landing-icons";

// Same-origin entry point that plants the login-CSRF nonce cookie before
// bouncing to the API's OAuth kickoff (see app/api/auth/start/route.ts).
function providerUrl(provider: "github" | "google", next: string): string {
  return `/api/auth/start?provider=${provider}&next=${encodeURIComponent(next)}`;
}

// x/y as percentages of the art container; lineX/lineY in the 100x70 SVG space.
const NODES = [
  { label: "Security", icon: LockIcon, color: "#34d399", x: 14, y: 20 },
  { label: "Architecture", icon: CubeIcon, color: "#38bdf8", x: 82, y: 18 },
  { label: "Tests", icon: FlaskIcon, color: "#60a5fa", x: 8, y: 50 },
  { label: "DevOps", icon: InfinityIcon, color: "#a78bfa", x: 88, y: 50 },
  { label: "Performance", icon: GaugeIcon, color: "#2dd4bf", x: 16, y: 82 },
  { label: "Documentation", icon: FileTextIcon, color: "#a78bfa", x: 80, y: 82 },
];

const STATS = [
  { icon: CheckCircleIcon, color: "#38bdf8", value: "300+", label: "Production Checks" },
  { icon: SparklesIcon, color: "#818cf8", value: "AI", label: "Powered Analysis" },
  { icon: ShieldCheckIcon, color: "#34d399", value: "Secure", label: "Private & Encrypted" },
  { icon: FileTextIcon, color: "#a78bfa", value: "Instant", label: "Actionable Reports" },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #ec4899)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #34d399, #3b82f6)",
  "linear-gradient(135deg, #a78bfa, #38bdf8)",
];

function ShieldArt() {
  return (
    <svg width="210" height="220" viewBox="0 0 200 210" aria-hidden="true">
      <defs>
        <linearGradient id="loginShieldStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="loginShieldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2547" />
          <stop offset="1" stopColor="#101731" />
        </linearGradient>
      </defs>

      <polygon
        points="100,150 172,182 100,210 28,182"
        fill="#080d18"
        stroke="#1c2942"
        strokeWidth="1.5"
      />
      <polygon
        points="100,140 152,164 100,188 48,164"
        fill="#0c1326"
        stroke="#2a3a5e"
        strokeWidth="1.5"
      />
      <ellipse cx="100" cy="160" rx="38" ry="10" fill="rgba(56, 189, 248, 0.22)" />

      <path
        d="M100 12 L157 36 V88 C157 128 131 152 100 168 C69 152 43 128 43 88 V36 Z"
        fill="url(#loginShieldFill)"
        stroke="url(#loginShieldStroke)"
        strokeWidth="4"
      />
      <path
        d="M100 26 L145 45 V88 C145 120 124 140 100 153 C76 140 55 120 55 88 V45 Z"
        fill="none"
        stroke="rgba(56, 189, 248, 0.35)"
        strokeWidth="1.5"
      />
      <path
        d="M76 88l17 17 31-35"
        fill="none"
        stroke="#bae6fd"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = safeInternalPath(next);

  const user = await getCurrentUser();
  if (user) {
    redirect(nextPath);
  }

  return (
    <div className={styles.page}>
      <div className={styles.split}>
        <section className={styles.left}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandIcon}>
              <BrandMark size={38} />
            </span>
            <span>
              ReadyCheck <span className={styles.brandAI}>AI</span>
            </span>
          </Link>

          <h2 className={styles.headline}>
            Ship Confidently.
            <br />
            <span>Ship Successfully.</span>
          </h2>
          <p className={styles.lede}>
            AI-powered platform that analyzes your codebase, architecture, security,
            tests, and DevOps to deliver a production readiness verdict you can trust.
          </p>

          <div className={styles.art}>
            <svg
              className={styles.artLines}
              viewBox="0 0 100 70"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {NODES.map((node) => (
                <line
                  key={node.label}
                  x1={node.x}
                  y1={node.y * 0.7}
                  x2={50}
                  y2={33.6}
                  stroke="#243052"
                  strokeWidth="0.35"
                  strokeDasharray="1.4 1.4"
                />
              ))}
            </svg>
            <span className={styles.artCenter}>
              <ShieldArt />
            </span>
            {NODES.map((node) => (
              <span
                key={node.label}
                className={styles.node}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <span className={styles.nodeTile} style={{ color: node.color }}>
                  <node.icon size={20} />
                </span>
                <span className={styles.nodeLabel}>{node.label}</span>
              </span>
            ))}
          </div>

          <div className={styles.stats}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <span className={styles.statIcon} style={{ color: stat.color }}>
                  <stat.icon size={19} />
                </span>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.proof}>
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
            <span>Trusted by developers and teams worldwide</span>
          </div>
        </section>

        <section className={styles.right}>
          <LoginCard
            githubUrl={providerUrl("github", nextPath)}
            googleUrl={providerUrl("google", nextPath)}
            nextPath={nextPath}
            error={error}
          />
        </section>
      </div>

      <footer className={styles.footer}>
        <span>&copy; 2026 ReadyCheck AI. All rights reserved.</span>
        <div className={styles.footerLinks}>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Security</a>
          <a href="#">Contact Us</a>
          <span className={styles.themeToggle} aria-hidden="true">
            <MoonIcon size={14} />
            <span className={styles.togglePill} />
            <SunIcon size={14} />
          </span>
        </div>
      </footer>
    </div>
  );
}
