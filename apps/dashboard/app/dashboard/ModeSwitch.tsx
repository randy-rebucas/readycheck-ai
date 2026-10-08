"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODE_COOKIE, MODES, type ExperienceMode } from "../../lib/mode";
import styles from "./shell.module.css";

const LABEL: Record<ExperienceMode, string> = {
  guided: "Guided",
  standard: "Standard",
  expert: "Expert",
};

export default function ModeSwitch({ initial }: { initial: ExperienceMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initial);

  function choose(next: ExperienceMode) {
    setMode(next);
    document.cookie = `${MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Server components read the cookie; re-render them with the new mode.
    router.refresh();
  }

  return (
    <div className={styles.mode}>
      <p className={styles.modeLabel} id="mode-label">
        Experience mode
      </p>
      <div className={styles.modeSwitch} role="radiogroup" aria-labelledby="mode-label">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`${styles.modeOption} ${mode === m ? styles.modeOn : ""}`}
            onClick={() => choose(m)}
          >
            {LABEL[m]}
          </button>
        ))}
      </div>
      <p className={styles.modeNote}>Sets how much is explained along the way.</p>
    </div>
  );
}
