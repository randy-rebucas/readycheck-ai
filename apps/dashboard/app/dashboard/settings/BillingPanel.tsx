"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircleIcon, MailIcon, SparklesIcon } from "../../landing-icons";
import PayPalSubscribeButton from "./PayPalSubscribeButton";
import styles from "./settings.module.css";

interface PlanSummary {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    repositories: number;
    repositoryLimit: number;
  };
}

type LoadState = "loading" | "ready" | "error";

export default function BillingPanel() {
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const refresh = useCallback(() => {
    setLoadState("loading");
    fetch("/api/billing/plan")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: PlanSummary) => {
        setSummary(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubscribed = useCallback(
    (subscriptionId: string) => {
      setActionError(null);
      fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionID: subscriptionId }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then(() => refresh())
        .catch(() => setActionError("Payment succeeded, but we couldn't confirm the upgrade. Contact support."));
    },
    [refresh]
  );

  const handleCancel = useCallback(() => {
    setIsCancelling(true);
    setActionError(null);
    fetch("/api/billing/cancel", { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(() => refresh())
      .catch(() => setActionError("Failed to cancel subscription. Try again or contact support."))
      .finally(() => setIsCancelling(false));
  }, [refresh]);

  if (loadState === "loading") {
    return (
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <SparklesIcon size={17} />
          Plan &amp; Billing
        </h2>
        <p className={styles.sectionText}>Loading…</p>
      </section>
    );
  }

  if (loadState === "error" || !summary) {
    return (
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <SparklesIcon size={17} />
          Plan &amp; Billing
        </h2>
        <p className={styles.noteError}>Couldn&apos;t load your plan. Try refreshing the page.</p>
      </section>
    );
  }

  const usagePercent =
    Number.isFinite(summary.usage.repositoryLimit) && summary.usage.repositoryLimit > 0
      ? Math.min(100, (summary.usage.repositories / summary.usage.repositoryLimit) * 100)
      : 0;
  const isFull = usagePercent >= 100;

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <SparklesIcon size={17} />
        Plan &amp; Billing
      </h2>

      <div className={styles.planRow}>
        <span className={styles.planBadge}>
          <CheckCircleIcon size={13} />
          {summary.plan === "FREE" ? "Free" : summary.plan === "PRO" ? "Pro" : "Enterprise"}
        </span>
        {summary.plan === "PRO" && summary.currentPeriodEnd && (
          <span className={styles.usageText}>
            {summary.cancelAtPeriodEnd ? "Cancels" : "Renews"} on{" "}
            {new Date(summary.currentPeriodEnd).toLocaleDateString()}
          </span>
        )}
      </div>

      {Number.isFinite(summary.usage.repositoryLimit) && (
        <>
          <p className={styles.usageText}>
            {summary.usage.repositories}/{summary.usage.repositoryLimit} repositories used
          </p>
          <div className={styles.usageBar}>
            <div
              className={`${styles.usageBarFill} ${isFull ? styles.usageBarFillFull : ""}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </>
      )}

      {actionError && <p className={styles.noteError}>{actionError}</p>}

      {summary.plan === "FREE" && (
        <PayPalSubscribeButton onSubscribed={handleSubscribed} onError={setActionError} />
      )}

      {summary.plan === "PRO" && !summary.cancelAtPeriodEnd && (
        <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={isCancelling}>
          {isCancelling ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}

      {summary.plan === "ENTERPRISE" && (
        <p className={styles.sectionText}>
          Your account is on the Enterprise plan. Contact your account manager for changes.
        </p>
      )}

      {summary.plan === "FREE" && (
        <p className={styles.note}>
          Need SSO, custom rules, or on-prem AI?{" "}
          <a href="mailto:sales@readycheck.ai" className={styles.contactBtn}>
            <MailIcon size={13} />
            Contact Sales
          </a>
        </p>
      )}
    </section>
  );
}
