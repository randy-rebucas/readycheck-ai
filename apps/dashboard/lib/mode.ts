/**
 * Experience mode: how much the dashboard explains. Guided opens every
 * explanation, Standard keeps them one click away, Expert hides them.
 * A per-browser preference, so a plain cookie the client can write.
 */
export const MODE_COOKIE = "rc_mode";

export const MODES = ["guided", "standard", "expert"] as const;
export type ExperienceMode = (typeof MODES)[number];

export function parseMode(value: string | undefined): ExperienceMode {
  return (MODES as readonly string[]).includes(value ?? "") ? (value as ExperienceMode) : "standard";
}
