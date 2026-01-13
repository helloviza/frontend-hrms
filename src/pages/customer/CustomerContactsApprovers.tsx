// apps/frontend/src/pages/customer/CustomerContactsApprovers.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pickDisplayName, useCustomerContext } from "../../hooks/useCustomerContext";

function pillBase() {
  return {
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "rgba(255,255,255,.82)",
  } as const;
}

function Glass({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[28px] ${className}`}
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
        boxShadow: "0 18px 50px rgba(0,0,0,.30)",
        backdropFilter: "blur(14px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full px-3 py-1 text-[11px] flex items-center gap-2" style={pillBase()}>
      <span style={{ color: "rgba(255,255,255,.55)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "rgba(255,255,255,.92)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function StatusChip({ tone, text }: { tone: "ok" | "warn" | "info"; text: string }) {
  const toneStyle =
    tone === "ok"
      ? { border: "1px solid rgba(34,197,94,.28)", background: "rgba(34,197,94,.10)", color: "rgba(200,255,220,.95)" }
      : tone === "warn"
      ? { border: "1px solid rgba(245,158,11,.28)", background: "rgba(245,158,11,.10)", color: "rgba(255,236,200,.95)" }
      : { border: "1px solid rgba(59,130,246,.28)", background: "rgba(59,130,246,.10)", color: "rgba(220,235,255,.95)" };

  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px]" style={toneStyle as any}>
      {text}
    </span>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.18)",
      }}
    >
      <div className="text-[11px] tracking-[0.20em]" style={{ color: "rgba(255,255,255,.55)" }}>
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white break-words">{value || "Not captured"}</div>
    </div>
  );
}

export default function CustomerContactsApprovers() {
  const navigate = useNavigate();
  const { profile, loadingProfile, authEmail } = useCustomerContext();

  const payload = profile?.payload || {};
  const displayName = pickDisplayName(profile);

  const orgName =
    payload.legalName ||
    payload.organisationName ||
    payload.organizationName ||
    payload.companyName ||
    displayName ||
    "—";

  const primaryEmail =
    profile?.officialEmail || payload.officialEmail || profile?.email || payload.email || authEmail || "";

  const keyContacts: any[] = Array.isArray(payload.keyContacts) ? payload.keyContacts : [];
  const key0 = keyContacts[0] || null;

  // Contact mapping (supports your current Mongo shape)
  const contactName =
    key0?.name ||
    payload?.contact?.name ||
    payload?.contacts?.primaryName ||
    payload?.contactName ||
    "";

  const contactEmail =
    key0?.email ||
    payload?.contact?.email ||
    payload?.contacts?.primaryEmail ||
    payload?.officialEmail ||
    primaryEmail ||
    "";

  const contactPhone =
    key0?.mobile ||
    key0?.phone ||
    payload?.contacts?.primaryPhone ||
    payload?.contact?.phone ||
    payload?.contact?.mobile ||
    "";

  const designation =
    key0?.designation ||
    payload?.contact?.designation ||
    payload?.signatory?.designation ||
    "";

  const signatoryName = payload?.signatory?.name || "";
  const signatoryDesig = payload?.signatory?.designation || "";

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!contactName) m.push("Contact name");
    if (!contactPhone) m.push("Contact phone");
    if (!contactEmail) m.push("Contact email");
    return m;
  }, [contactName, contactPhone, contactEmail]);

  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  return (
    <div
      className="relative w-full min-h-[calc(100vh-64px)] overflow-hidden"
      style={{
        background:
          "radial-gradient(1400px 720px at 12% 0%, rgba(0,71,127,.14), transparent 55%), radial-gradient(1200px 660px at 86% 6%, rgba(208,101,73,.12), transparent 60%), radial-gradient(1100px 640px at 60% 120%, rgba(0,194,168,.10), transparent 55%), linear-gradient(180deg, rgba(250,250,252,1), rgba(244,245,248,1))",
      }}
    >
      <div className="relative w-full px-4 sm:px-6 lg:px-10 py-6">
        <div
          className="w-full rounded-[34px] p-[18px]"
          style={{
            background:
              "radial-gradient(1400px 720px at 18% 12%, rgba(0,71,127,.55), transparent 62%), radial-gradient(1100px 720px at 82% 14%, rgba(0,194,168,.22), transparent 58%), radial-gradient(1000px 640px at 55% 120%, rgba(208,101,73,.22), transparent 62%), linear-gradient(180deg, #060812 0%, #070A12 60%, #060812 100%)",
            boxShadow: "0 26px 70px rgba(0,0,0,.22)",
          }}
        >
          <Glass className="p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs tracking-[0.28em]" style={{ color: "rgba(255,255,255,.55)" }}>
                  WORKSPACE • GOVERNANCE
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="text-2xl md:text-3xl font-semibold text-white">Contacts &amp; Approvers</div>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px]"
                    style={{
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      color: "rgba(255,255,255,.78)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Executive view
                  </span>
                </div>

                <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.70)" }}>
                  Clean, auditable ownership for travel coordination and approvals — corporate-ready.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetricPill label="Workspace" value="Leader" />
                  <MetricPill label="Organisation" value={orgName} />
                  <MetricPill label="Primary email" value={primaryEmail || "—"} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {missing.length > 0 ? (
                    <>
                      <StatusChip tone="warn" text="Action needed: Missing fields" />
                      <StatusChip tone="warn" text={`Missing: ${missing.join(", ")}`} />
                    </>
                  ) : (
                    <StatusChip tone="ok" text="All key fields captured" />
                  )}
                  <StatusChip tone="info" text={`Synced: ${nowStr}`} />
                </div>
              </div>

              <button
                className="rounded-full px-5 py-2 text-xs md:text-sm"
                style={{
                  border: "1px solid rgba(255,255,255,.14)",
                  background: "rgba(255,255,255,.10)",
                  color: "rgba(255,255,255,.92)",
                }}
                onClick={() => navigate("/profile/customer")}
              >
                Back to Dashboard
              </button>
            </div>

            {loadingProfile ? (
              <div className="mt-6 rounded-2xl p-4 text-sm" style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)", color: "rgba(255,255,255,.72)" }}>
                Loading…
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-12">
                {/* Left: Primary Travel Desk */}
                <div className="lg:col-span-7 rounded-[26px] p-5" style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                        PRIMARY TRAVEL DESK
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        Key contact — {contactName || displayName || "—"}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                        Receives confirmations, changes, traveller queries, and operational coordination.
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusChip tone={contactEmail ? "ok" : "warn"} text={contactEmail ? "Email on file" : "Email missing"} />
                      <StatusChip tone={contactPhone ? "ok" : "warn"} text={contactPhone ? "Phone on file" : "Phone missing"} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <FieldCard label="CONTACT NAME" value={contactName} />
                    <FieldCard label="CONTACT DESIGNATION" value={designation || "—"} />
                    <FieldCard label="CONTACT EMAIL" value={contactEmail} />
                    <FieldCard label="CONTACT PHONE" value={contactPhone} />
                  </div>

                  <div
                    className="mt-4 rounded-2xl p-4"
                    style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)" }}
                  >
                    <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      WHAT THIS CONTROLS
                    </div>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-[12px]" style={{ color: "rgba(255,255,255,.74)" }}>
                      <li>Who receives booking confirmations, changes, cancellations and invoice trails.</li>
                      <li>Who coordinates traveller documents (IDs, visas, policies) for your organisation.</li>
                      <li>Who becomes the operational point-of-contact for bookings and servicing.</li>
                    </ul>
                  </div>

                  {/* Key Contacts list (if present) */}
                  <div className="mt-4">
                    <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      KEY CONTACTS ON FILE
                    </div>

                    {keyContacts.length === 0 ? (
                      <div className="mt-2 text-[12px]" style={{ color: "rgba(255,255,255,.70)" }}>
                        No additional key contacts captured.
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {keyContacts.map((kc, idx) => (
                          <div
                            key={idx}
                            className="rounded-2xl p-4"
                            style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)" }}
                          >
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm font-semibold text-white">
                                {kc?.name || "Unnamed"}{" "}
                                <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,.65)" }}>
                                  {kc?.designation ? `• ${kc.designation}` : ""}
                                </span>
                              </div>
                              <div className="text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                                {kc?.email || "—"} {kc?.mobile ? `• ${kc.mobile}` : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Approver Flow */}
                <div className="lg:col-span-5 grid gap-4">
                  <div className="rounded-[26px] p-5" style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}>
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      APPROVER FLOW
                    </div>

                    <div className="mt-2 text-sm font-semibold text-white">Authorisation routing</div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                      Approver matrix will be enabled once your HR/Admin config is finalized.
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusChip tone="info" text="Approval matrix: in rollout" />
                      <StatusChip tone="info" text="Policy limits: in rollout" />
                      <StatusChip tone="info" text="Audit trail: in rollout" />
                    </div>

                    <div
                      className="mt-4 rounded-2xl px-3 py-3 text-[12px]"
                      style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)", color: "rgba(255,255,255,.72)" }}
                    >
                      <div className="font-semibold" style={{ color: "rgba(255,255,255,.88)" }}>
                        Coming next
                      </div>
                      <ul className="mt-2 list-disc pl-5 space-y-1">
                        <li>Approver list + multi-level routing (HR → Finance → CXO)</li>
                        <li>Policy rules (routes, class-of-travel, budgets, exceptions)</li>
                        <li>Spend thresholds + auto-approval windows</li>
                        <li>Approver notifications + escalation</li>
                      </ul>
                    </div>
                  </div>

                  <div
                    className="rounded-[26px] p-5"
                    style={{
                      border: "1px solid rgba(0,194,168,.28)",
                      background: "linear-gradient(135deg, rgba(0,194,168,.22), rgba(0,71,127,.20))",
                    }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.60)" }}>
                      EXECUTIVE NOTE
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">Clean governance wins</div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                      Accurate contacts + approvers reduce booking delays, improve compliance, and prevent invoice disputes.
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full px-3 py-1 text-[11px]" style={{ ...pillBase(), background: "rgba(0,0,0,.18)" }}>
                        Faster approvals
                      </span>
                      <span className="rounded-full px-3 py-1 text-[11px]" style={{ ...pillBase(), background: "rgba(0,0,0,.18)" }}>
                        Lower policy risk
                      </span>
                      <span className="rounded-full px-3 py-1 text-[11px]" style={{ ...pillBase(), background: "rgba(0,0,0,.18)" }}>
                        Cleaner auditability
                      </span>
                    </div>

                    {(signatoryName || signatoryDesig) && (
                      <div className="mt-4 text-[12px]" style={{ color: "rgba(255,255,255,.78)" }}>
                        <span style={{ color: "rgba(255,255,255,.60)" }}>Signatory on file:</span>{" "}
                        <span className="font-semibold text-white">{signatoryName || "—"}</span>
                        {signatoryDesig ? <span style={{ color: "rgba(255,255,255,.70)" }}> • {signatoryDesig}</span> : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
              Executive view: shows only workspace-ready governance details (no internal wiring details).
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
