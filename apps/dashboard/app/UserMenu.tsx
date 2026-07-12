"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "../lib/session";
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserIcon } from "./landing-icons";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  user: SessionUser;
  chipClassName: string;
  avatarClassName: string;
  nameClassName?: string;
}

function initials(user: SessionUser): string {
  const source = user.name ?? user.email ?? "?";
  return source.trim().charAt(0).toUpperCase();
}

export default function UserMenu({
  user,
  chipClassName,
  avatarClassName,
  nameClassName,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={chipClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={avatarClassName}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
          ) : (
            initials(user)
          )}
        </span>
        <span className={nameClassName}>{user.name ?? user.email ?? "Account"}</span>
        <ChevronDownIcon size={14} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHeader}>
            <span className={styles.menuName}>{user.name ?? "Account"}</span>
            {user.email && <span className={styles.menuEmail}>{user.email}</span>}
          </div>
          <Link
            href="/dashboard/profile"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <UserIcon size={15} />
            Profile
          </Link>
          <Link
            href="/dashboard/settings"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <SettingsIcon size={15} />
            Settings
          </Link>
          <div className={styles.menuDivider} />
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={styles.menuItem} role="menuitem">
              <LogOutIcon size={15} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
