import { getRules, type CatalogRule, type RulesCatalog } from "../../../lib/api";
import { SEVERITY_LABEL, categoryName } from "../../../lib/projects";
import ui from "../ui.module.css";
import RuleToggle from "./RuleToggle";
import styles from "./rules.module.css";

export const metadata = {
  title: "Rule packs — ReadyCheck AI",
};

const SEVERITY_CLASS: Record<CatalogRule["severity"], string> = {
  critical: ui.sevCritical,
  high: ui.sevHigh,
  medium: ui.sevMedium,
  low: ui.sevLow,
};

function FixKind({ rule }: { rule: CatalogRule }) {
  if (rule.fix.kind === "guided") return <span className={ui.muted}>Guided fix</span>;
  return (
    <span className={rule.fix.confidence === "high" ? ui["text-green"] : ui["text-amber"]}>
      {rule.fix.kind === "ai" ? "AI fix · review" : rule.fix.confidence === "high" ? "Auto-fix" : "Auto-fix · review"}
    </span>
  );
}

export default async function RulesPage() {
  let catalog: RulesCatalog | undefined;
  let error: string | null = null;
  try {
    catalog = await getRules();
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load rules";
  }

  return (
    <main className={ui.page}>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Rule packs</h1>
          <p className={ui.pageSub}>
            The checks every readiness scan runs. Switching a rule off applies to this organization&apos;s next scans.
          </p>
        </div>
      </div>

      {error && <p className={ui.error}>{error}</p>}

      {catalog?.packs.map((pack) => {
        const rules = catalog.rules.filter((r) => r.pack === pack.id);
        const on = rules.filter((r) => r.enabled).length;
        return (
          <section key={pack.id} className={ui.card} aria-labelledby={`pack-${pack.id}`}>
            <div className={ui.cardHead}>
              <div>
                <h2 id={`pack-${pack.id}`} className={ui.cardTitle}>
                  {pack.name}
                </h2>
                <p className={ui.cardSub}>{pack.description}</p>
              </div>
              <span className={ui.muted}>
                {on} of {rules.length} on
              </span>
            </div>
            <ul className={styles.rules}>
              {rules.map((rule) => (
                <li key={rule.id} className={`${styles.rule} ${rule.enabled ? "" : styles.ruleOff}`}>
                  <span className={`${ui.badge} ${styles.sev} ${SEVERITY_CLASS[rule.severity]}`}>
                    {SEVERITY_LABEL[rule.severity]}
                  </span>
                  <span className={styles.ruleBody}>
                    <span className={ui.rowTitle}>{rule.description}</span>
                    <span className={ui.rowSub}>
                      {rule.id} · {categoryName(rule.category)}
                      {rule.standards.length > 0 && ` · ${rule.standards.join(", ")}`}
                    </span>
                  </span>
                  <span className={styles.fix}>
                    <FixKind rule={rule} />
                  </span>
                  <RuleToggle id={rule.id} enabled={rule.enabled} label={rule.description} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className={ui.muted}>Only organization owners and admins can switch rules on or off.</p>
    </main>
  );
}
