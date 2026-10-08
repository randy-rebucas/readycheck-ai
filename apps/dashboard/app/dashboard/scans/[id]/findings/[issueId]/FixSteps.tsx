"use client";

import { useEffect, useState } from "react";
import styles from "./finding.module.css";

interface FixStepsProps {
  /** Keyed by repository + rule so progress carries over to the next scan. */
  storageKey: string;
  steps: string[];
}

/** A checklist of fix steps. Ticks are a per-browser convenience only. */
export default function FixSteps({ storageKey, steps }: FixStepsProps) {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (Array.isArray(saved)) setDone(steps.map((_, i) => saved[i] === true));
    } catch {
      // Storage blocked or corrupt: start unticked.
    }
  }, [storageKey, steps]);

  function toggle(index: number) {
    setDone((prev) => {
      const nextDone = prev.map((v, i) => (i === index ? !v : v));
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextDone));
      } catch {
        // Ticks still work for this visit.
      }
      return nextDone;
    });
  }

  return (
    <ol className={styles.steps}>
      {steps.map((step, i) => (
        <li key={i} className={styles.step}>
          <label className={styles.stepLabel}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={done[i] ?? false}
              onChange={() => toggle(i)}
            />
            <span className={done[i] ? styles.stepDone : undefined}>{step}</span>
          </label>
        </li>
      ))}
    </ol>
  );
}
