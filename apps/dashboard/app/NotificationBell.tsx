"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Notification } from "../lib/api";
import { AlertTriangleIcon, BellIcon, CheckCircleIcon } from "./landing-icons";
import styles from "./NotificationBell.module.css";

const POLL_INTERVAL_MS = 30_000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { notifications: Notification[]; unreadCount: number }) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setLoaded(true);
      })
      .catch(() => {
        // Silent: the bell just shows nothing new until the next poll succeeds.
      });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

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

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {
      // Best-effort -- the next poll will resync if this failed.
    });
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {
      // Best-effort -- the next poll will resync if this failed.
    });
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={className}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon size={16} />
        {unreadCount > 0 && <span className={styles.bellDot} />}
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllBtn} onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {!loaded && <div className={styles.empty}>Loading…</div>}
            {loaded && notifications.length === 0 && (
              <div className={styles.empty}>You&apos;re all caught up.</div>
            )}
            {notifications.map((n) => {
              const failed = n.type === "scan_failed";
              const content = (
                <>
                  <span className={`${styles.icon} ${failed ? styles.iconFailed : styles.iconOk}`}>
                    {failed ? <AlertTriangleIcon size={14} /> : <CheckCircleIcon size={14} />}
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    <span className={styles.itemText}>{n.body}</span>
                    <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className={styles.unreadDot} />}
                </>
              );

              const itemClass = `${styles.item} ${n.read ? "" : styles.itemUnread}`;

              return n.scanId ? (
                <Link
                  key={n.id}
                  href={`/dashboard/scans/${n.scanId}`}
                  className={itemClass}
                  role="menuitem"
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    setOpen(false);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  className={itemClass}
                  role="menuitem"
                  onClick={() => markRead(n.id)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
