"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OrgSummary } from "../lib/api";
import { CheckIcon, ChevronDownIcon, FolderIcon, SettingsIcon } from "./landing-icons";
import menuStyles from "./UserMenu.module.css";
import styles from "./OrgSwitcher.module.css";

interface OrgList {
  currentOrgId: string;
  orgs: OrgSummary[];
}

/** Header control for the org every dashboard page and API call acts in. */
export default function OrgSwitcher({ chipClassName }: { chipClassName: string }) {
  const [data, setData] = useState<OrgList | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orgs")
      .then((res) => (res.ok ? res.json() : null))
      .then((list: OrgList | null) => {
        if (!cancelled) setData(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!data) return null;
  const current = data.orgs.find((o) => o.id === data.currentOrgId);

  async function switchTo(orgId: string) {
    if (orgId === data?.currentOrgId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    const res = await fetch("/api/orgs/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    }).catch(() => null);
    if (res?.ok) {
      // A full navigation, not router.refresh(): the page being viewed (e.g. a
      // scan) usually belongs to the org being left.
      window.location.assign("/dashboard");
    } else {
      setSwitching(false);
    }
  }

  return (
    <div ref={rootRef} className={menuStyles.root}>
      <button
        type="button"
        className={`${chipClassName} ${styles.chip}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Organization: ${current?.name ?? "unknown"}. Switch organization`}
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
      >
        <FolderIcon size={15} />
        <span className={styles.chipName}>{current?.personal ? "Personal" : current?.name}</span>
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <div className={`${menuStyles.menu} ${styles.menu}`} role="menu">
          <div className={menuStyles.menuHeader}>
            <span className={menuStyles.menuEmail}>Organizations</span>
          </div>
          {data.orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              role="menuitemradio"
              aria-checked={org.id === data.currentOrgId}
              className={menuStyles.menuItem}
              onClick={() => switchTo(org.id)}
            >
              <span className={styles.check}>
                {org.id === data.currentOrgId && <CheckIcon size={14} />}
              </span>
              <span className={styles.orgName}>{org.personal ? "Personal workspace" : org.name}</span>
              <span className={styles.role}>{org.role}</span>
            </button>
          ))}
          <div className={menuStyles.menuDivider} />
          <Link
            href="/dashboard/settings#organization"
            className={menuStyles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <SettingsIcon size={15} />
            Manage organizations
          </Link>
        </div>
      )}
    </div>
  );
}
