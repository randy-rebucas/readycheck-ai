"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "../ThemeToggle";
import styles from "./settings.module.css";
import { BellIcon, MoonIcon, SparklesIcon, SunIcon } from "../landing-icons";

const STORAGE_KEY = "rc_settings";

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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
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

  // Read after mount so server and client render the same initial markup.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // Corrupt or inaccessible storage: fall back to defaults.
    }
  }, []);

  function update(patch: Partial<Preferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or blocked: the toggle still works for this visit.
      }
      return next;
    });
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
            onChange={(v) => update({ scanComplete: v })}
            label="Scan completed"
            description="Notify me when a readiness scan finishes."
          />
          <Toggle
            checked={prefs.weeklyDigest}
            onChange={(v) => update({ weeklyDigest: v })}
            label="Weekly digest"
            description="A weekly summary of scans and score trends."
          />
          <Toggle
            checked={prefs.productUpdates}
            onChange={(v) => update({ productUpdates: v })}
            label="Product updates"
            description="Occasional news about new checks and features."
          />
        </div>
        <p className={styles.note}>
          Preferences are saved in this browser only for now — syncing them to your
          account is coming soon.
        </p>
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
