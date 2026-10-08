"use client";

import { useState, useTransition } from "react";
import { toggleRuleAction } from "./actions";
import styles from "./rules.module.css";

export default function RuleToggle({ id, enabled, label }: { id: string; enabled: boolean; label: string }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleRuleAction(id, next);
      if (!result.ok) {
        setOn(!next);
        setError(result.error ?? "Could not change the rule");
      }
    });
  }

  return (
    <span className={styles.toggleWrap}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? "on" : "off"}`}
        className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
        onClick={toggle}
        disabled={pending}
      >
        <span />
      </button>
      {error && (
        <span className={styles.toggleError} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
