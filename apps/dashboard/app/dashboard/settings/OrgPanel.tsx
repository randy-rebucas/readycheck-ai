"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { OrgMember, OrgRole, OrgSummary } from "../../../lib/api";
import { FolderIcon } from "../../landing-icons";
import styles from "./settings.module.css";

const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) return "Couldn't reach the server.";
  if (res.ok) return null;
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : `Request failed (${res.status}).`;
}

export default function OrgPanel({ currentUserId }: { currentUserId: string }) {
  const [current, setCurrent] = useState<OrgSummary | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [newOrgName, setNewOrgName] = useState("");

  const load = useCallback(async () => {
    try {
      const [orgsRes, membersRes] = await Promise.all([fetch("/api/orgs"), fetch("/api/orgs/members")]);
      if (!orgsRes.ok || !membersRes.ok) throw new Error();
      const orgs: { currentOrgId: string; orgs: OrgSummary[] } = await orgsRes.json();
      setCurrent(orgs.orgs.find((o) => o.id === orgs.currentOrgId) ?? null);
      setMembers(await membersRes.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<string | null>, after?: () => void) {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    after?.();
    await load();
  }

  function addMember(event: FormEvent) {
    event.preventDefault();
    void run(
      () => send("/api/orgs/members", "POST", { email: inviteEmail, role: inviteRole }),
      () => {
        setInviteEmail("");
        setInviteRole("member");
      }
    );
  }

  async function createOrg(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const failure = await send("/api/orgs", "POST", { name: newOrgName });
    if (failure) {
      setBusy(false);
      setError(failure);
      return;
    }
    // The new org is now the active one; reload so every panel and the header follow.
    window.location.reload();
  }

  async function leave() {
    if (!window.confirm(`Leave ${current?.name}? You'll lose access to its scans.`)) return;
    setBusy(true);
    const failure = await send(`/api/orgs/members/${currentUserId}`, "DELETE");
    if (failure) {
      setBusy(false);
      setError(failure);
      return;
    }
    window.location.assign("/dashboard");
  }

  const canManage = current ? ROLE_RANK[current.role] >= ROLE_RANK.admin : false;
  const isOwner = current?.role === "owner";

  return (
    <section className={styles.card} id="organization">
      <h2 className={styles.sectionTitle}>
        <FolderIcon size={17} />
        Organization
      </h2>

      {loadError && (
        <p className={styles.noteError}>Couldn&apos;t load your organization. Refresh to try again.</p>
      )}

      {current && (
        <>
          <p className={styles.sectionText}>
            {current.personal ? (
              <>
                You&apos;re in your <strong>personal workspace</strong>. Only you can see its scans.
                Create an organization to share scans and billing with a team.
              </>
            ) : (
              <>
                You&apos;re in <strong>{current.name}</strong> as {current.role === "admin" ? "an" : "a"}{" "}
                <strong>{current.role}</strong>. Scans, notifications and billing here are shared with
                every member.
              </>
            )}
          </p>

          {!current.personal && (
            <ul className={styles.memberList} aria-label="Members">
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                // Mirrors the API's rules; the API still enforces them.
                const canEditThis = canManage && !isSelf && (isOwner || m.role !== "owner");
                return (
                  <li key={m.userId} className={styles.memberRow}>
                    <div className={styles.prefText}>
                      <span className={styles.prefLabel}>
                        {m.name ?? m.email ?? "Unnamed user"}
                        {isSelf && <span className={styles.youTag}> (you)</span>}
                      </span>
                      {m.email && m.name && <span className={styles.prefDesc}>{m.email}</span>}
                    </div>
                    <div className={styles.memberActions}>
                      {canEditThis ? (
                        <>
                          <select
                            className={styles.roleSelect}
                            value={m.role}
                            disabled={busy}
                            aria-label={`Role for ${m.name ?? m.email ?? "member"}`}
                            onChange={(e) =>
                              void run(() =>
                                send(`/api/orgs/members/${m.userId}`, "PATCH", { role: e.target.value })
                              )
                            }
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            {isOwner && <option value="owner">Owner</option>}
                          </select>
                          <button
                            type="button"
                            className={styles.cancelBtn}
                            disabled={busy}
                            onClick={() => void run(() => send(`/api/orgs/members/${m.userId}`, "DELETE"))}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className={styles.roleTag}>{m.role}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!current.personal && canManage && (
            <form className={styles.inlineForm} onSubmit={addMember}>
              <label className={styles.srOnly} htmlFor="invite-email">
                Member email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                placeholder="teammate@company.com"
                className={styles.textInput}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className={styles.roleSelect}
                value={inviteRole}
                aria-label="Role for new member"
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                {isOwner && <option value="owner">Owner</option>}
              </select>
              <button type="submit" className={styles.primaryBtn} disabled={busy || !inviteEmail}>
                Add member
              </button>
            </form>
          )}
          {!current.personal && canManage && (
            <p className={styles.note}>They need a ReadyCheck account first. Email invitations are coming.</p>
          )}

          <form className={styles.inlineForm} onSubmit={createOrg}>
            <label className={styles.srOnly} htmlFor="new-org-name">
              New organization name
            </label>
            <input
              id="new-org-name"
              type="text"
              required
              maxLength={80}
              placeholder="New organization name"
              className={styles.textInput}
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <button type="submit" className={styles.secondaryBtn} disabled={busy || !newOrgName.trim()}>
              Create organization
            </button>
          </form>

          {!current.personal && (
            <button type="button" className={styles.leaveBtn} disabled={busy} onClick={() => void leave()}>
              Leave {current.name}
            </button>
          )}
        </>
      )}

      {error && (
        <p className={styles.noteError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
