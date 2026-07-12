"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "../ThemeToggle";
import styles from "./settings.module.css";
import { BellIcon, MoonIcon, SparklesIcon, SunIcon } from "../landing-icons";

interface Preferences {
  scanComplete: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

const DEFAULTS: Preferences = {
  scanComplete: true,
  weeklyDigest: false,
  productUpdates: false,
};

type SaveState = "loading" | "idle" | "saving" | "error";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className={styles.prefRow}>
      <div className={styles.prefText}>
        <span className={styles.prefLabel}>{label}</span>
        <span className={styles.prefDesc}>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchKnob} />
      </button>
    </div>
  );
}

export default function SettingsPanels() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [theme, setTheme] = useState<Theme>("dark");

  // Track the html[data-theme] attribute so this stays in sync with the
  // topbar toggle (and any other tab-local change).
  useEffect(() => {
    const root = document.documentElement;
    setTheme(currentTheme());
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const [saveState, setSaveState] = useState<SaveState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((stored: Partial<Preferences>) => {
        if (cancelled) return;
        setPrefs({ ...DEFAULTS, ...stored });
        setSaveState("idle");
      })
      .catch(() => {
        if (!cancelled) setSaveState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch: Partial<Preferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaveState("saving");
    fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        setSaveState("idle");
      })
      .catch(() => setSaveState("error"));
  }

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <BellIcon size={17} />
          Notifications
        </h2>
        <div className={styles.prefList}>
          <Toggle
            checked={prefs.scanComplete}
            disabled={saveState === "loading"}
            onChange={(v) => update({ scanComplete: v })}
            label="Scan completed"
            description="Notify me when a readiness scan finishes."
          />
          <Toggle
            checked={prefs.weeklyDigest}
            disabled={saveState === "loading"}
            onChange={(v) => update({ weeklyDigest: v })}
            label="Weekly digest"
            description="A weekly summary of scans and score trends."
          />
          <Toggle
            checked={prefs.productUpdates}
            disabled={saveState === "loading"}
            onChange={(v) => update({ productUpdates: v })}
            label="Product updates"
            description="Occasional news about new checks and features."
          />
        </div>
        {saveState === "error" ? (
          <p className={styles.noteError}>
            Couldn&apos;t reach the API to save your preferences — check that
            <code> apps/api</code> is running, then try again.
          </p>
        ) : (
          <p className={styles.note}>
            {saveState === "loading"
              ? "Loading your preferences…"
              : saveState === "saving"
                ? "Saving…"
                : "Preferences are saved to your account."}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <SparklesIcon size={17} />
          Appearance
        </h2>
        <div className={styles.prefRow}>
          <div className={styles.prefText}>
            <span className={styles.prefLabel}>Theme</span>
            <span className={styles.prefDesc}>
              Choose how ReadyCheck looks on this device.
            </span>
          </div>
          <div className={styles.themePicker} role="radiogroup" aria-label="Theme">
            <button
              type="button"
              role="radio"
              aria-checked={theme === "dark"}
              className={`${styles.themeOption} ${theme === "dark" ? styles.themeOptionActive : ""}`}
              onClick={() => applyTheme("dark")}
            >
              <MoonIcon size={14} />
              Dark
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === "light"}
              className={`${styles.themeOption} ${theme === "light" ? styles.themeOptionActive : ""}`}
              onClick={() => applyTheme("light")}
            >
              <SunIcon size={14} />
              Light
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
