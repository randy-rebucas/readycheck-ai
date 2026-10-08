"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ExperienceMode } from "../../lib/mode";
import type { SessionUser } from "../../lib/session";
import NotificationBell from "../NotificationBell";
import OrgSwitcher from "../OrgSwitcher";
import ThemeToggle from "../ThemeToggle";
import UserMenu from "../UserMenu";
import {
  AlertTriangleIcon,
  BrandMark,
  DashboardIcon,
  FileTextIcon,
  RocketIcon,
  ShieldIcon,
  SettingsIcon,
} from "../landing-icons";
import ModeSwitch from "./ModeSwitch";
import styles from "./shell.module.css";

const NAV = [
  { href: "/dashboard", label: "Projects", icon: DashboardIcon },
  { href: "/dashboard/scans", label: "Audits", icon: ShieldIcon },
  { href: "/dashboard/fixes", label: "Fix Center", icon: AlertTriangleIcon },
  { href: "/dashboard/deployments", label: "Deployments", icon: RocketIcon },
  { href: "/dashboard/rules", label: "Rule packs", icon: FileTextIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/projects");
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  user: SessionUser;
  /** Critical and high findings open across all projects. */
  urgentCount: number;
  mode: ExperienceMode;
}

export default function Sidebar({ user, urgentCount, mode }: SidebarProps) {
  const pathname = usePathname();

  // The intake wizard is a focused, full-width flow with its own exit.
  if (pathname.endsWith("/intake")) return null;

  return (
    <aside className={styles.sidebar}>
      <Link href="/dashboard" className={styles.brand}>
        <BrandMark size={30} />
        ReadyCheck AI
      </Link>

      <div className={styles.workspace}>
        <span className={styles.workspaceLabel}>Workspace</span>
        <OrgSwitcher chipClassName={styles.workspaceChip} />
      </div>

      <nav className={styles.nav} aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {href === "/dashboard/fixes" && urgentCount > 0 && (
                <span className={styles.navCount} aria-label={`${urgentCount} urgent findings`}>
                  {urgentCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <ModeSwitch initial={mode} />

      <div className={styles.sidebarFoot}>
        <div className={styles.footTools}>
          <ThemeToggle className={styles.iconBtn} />
          <NotificationBell className={styles.iconBtn} panelClassName={styles.upMenu} />
        </div>
        <UserMenu
          user={user}
          chipClassName={styles.userChip}
          avatarClassName={styles.userAvatar}
          nameClassName={styles.userName}
          menuClassName={styles.upMenu}
        />
      </div>
    </aside>
  );
}
