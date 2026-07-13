export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

export type ReportFormat = "json" | "markdown" | "csv" | "html" | "pdf";

export interface PlanLimits {
  label: string;
  /** Distinct repository paths a user may scan. Infinity = unlimited. */
  maxRepositories: number;
  /** Scans a user may trigger per rolling 24h window. Infinity = unlimited (falls back to the flat per-minute throttle only). */
  dailyScanLimit: number;
  reportFormats: ReportFormat[];
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    label: "Free",
    maxRepositories: 1,
    dailyScanLimit: 5,
    reportFormats: ["markdown", "html", "csv", "json"],
  },
  PRO: {
    label: "Pro",
    maxRepositories: Infinity,
    dailyScanLimit: Infinity,
    reportFormats: ["markdown", "html", "csv", "json", "pdf"],
  },
  ENTERPRISE: {
    label: "Enterprise",
    maxRepositories: Infinity,
    dailyScanLimit: Infinity,
    reportFormats: ["markdown", "html", "csv", "json", "pdf"],
  },
};

export interface SubscriptionLike {
  plan: PlanTier;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | string | null;
}

/**
 * A user's real access level right now. Absence of a subscription row means
 * FREE (no need to backfill one row per existing user). A subscription past
 * its cancelled period end also falls back to FREE, even though the local
 * `plan` field may still say PRO until the next webhook/read reconciles it.
 *
 * Outside production, every user is treated as ENTERPRISE so plan limits
 * don't get in the way of local development/testing -- there's no PayPal
 * sandbox subscription to set up just to try Pro-gated features.
 */
export function getEffectivePlan(subscription: SubscriptionLike | null | undefined): PlanTier {
  if (process.env.NODE_ENV !== "production") return "ENTERPRISE";
  if (!subscription) return "FREE";
  if (subscription.status !== "ACTIVE") return "FREE";
  if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const periodEnd = new Date(subscription.currentPeriodEnd);
    if (periodEnd.getTime() < Date.now()) return "FREE";
  }
  return subscription.plan;
}

export function planAllowsFormat(plan: PlanTier, format: ReportFormat): boolean {
  return PLAN_LIMITS[plan].reportFormats.includes(format);
}
