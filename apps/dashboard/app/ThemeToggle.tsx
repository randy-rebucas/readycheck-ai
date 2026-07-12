"use client";

import { MoonIcon, SunIcon } from "./landing-icons";
import styles from "./ThemeToggle.module.css";

export const THEME_STORAGE_KEY = "rc_theme";

export type Theme = "dark" | "light";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

/**
 * Which icon shows is driven purely by CSS off html[data-theme], so this
 * renders identically on server and client (no hydration mismatch).
 */
export default function ThemeToggle({ className }: { className: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Toggle theme"
      onClick={() => applyTheme(currentTheme() === "light" ? "dark" : "light")}
    >
      <span className={styles.moon}>
        <MoonIcon size={16} />
      </span>
      <span className={styles.sun}>
        <SunIcon size={16} />
      </span>
    </button>
  );
}
