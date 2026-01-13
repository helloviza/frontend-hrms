// apps/frontend/src/pages/customer/CustomerCompanyBilling.tsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pickDisplayName, useCustomerContext } from "../../hooks/useCustomerContext";

/**
 * Mongo payload reality (from your debug):
 * payload.legalName
 * payload.entityType
 * payload.industry
 * payload.employeesCount
 * payload.registeredAddress
 * payload.cin
 * payload.officialEmail
 * payload.gstNumber
 * payload.panNumber
 * payload.incorporationDate
 * payload.description
 * payload.bank { accountNumber, bankName, ifsc, branch }
 */

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
    <div
      className="rounded-full px-3 py-1 text-[11px] flex items-center gap-2 max-w-full"
      style={{
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.06)",
        color: "rgba(255,255,255,.78)",
      }}
      title={value}
    >
      <span className="shrink-0" style={{ color: "rgba(255,255,255,.55)" }}>
        {label}
      </span>
      <span className="font-semibold truncate" style={{ color: "rgba(255,255,255,.92)" }}>
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

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const v = (value ?? "").toString().trim();
  const empty = !v;

  return (
    <div
      className="rounded-[18px] p-4"
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.18)",
      }}
    >
      <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,.55)" }}>
        {label}
      </div>
      <div
        className={`mt-2 text-sm ${mono ? "font-mono" : "font-semibold"} ${multiline ? "whitespace-pre-line" : ""} break-words`}
        style={{
          color: empty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
          fontWeight: mono ? 500 : 600,
        }}
      >
        {empty ? "Not captured" : v}
      </div>
    </div>
  );
}

function pickFirst(...vals: any[]) {
  for (const v of vals) {
    if (v === 0) return "0";
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (v && typeof v === "object") return v; // allow object
    if (typeof v === "boolean") return v ? "true" : "false";
  }
  return "";
}

function maskAccount(acct: string) {
  const s = String(acct || "").trim();
  if (!s) return "";
  if (s.length <= 4) return s;
  return `${"•".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export default function CustomerCompanyBilling() {
  const navigate = useNavigate();
  const { profile, loadingProfile, authEmail } = useCustomerContext();

  // ✅ do not read unknown fields from "profile" typed as OnboardingCustomer
  // only use payload (Mongo) + safe fallbacks
  const payload: any = (profile as any)?.payload || {};

  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  const companyName = useMemo(() => {
    const fromPayload = pickFirst(payload.legalName, payload.companyName, payload.organizationName, payload.organisationName);
    const fromDisplay = pickDisplayName(profile) || "";
    return (fromPayload || fromDisplay || "—").toString();
  }, [payload, profile]);

  const primaryEmail = useMemo(() => {
    return (
      pickFirst(payload.officialEmail, payload.email, (profile as any)?.officialEmail, (profile as any)?.email, authEmail) || ""
    );
  }, [payload, profile, authEmail]);

  const entityType = useMemo(() => pickFirst(payload.entityType, payload.entity) || "", [payload]);
  const industry = useMemo(() => pickFirst(payload.industry) || "", [payload]);
  const employeesCount = useMemo(() => pickFirst(payload.employeesCount, payload.employeeCount) || "", [payload]);
  const incorporationDate = useMemo(() => pickFirst(payload.incorporationDate, payload.incorporatedOn) || "", [payload]);
  const cin = useMemo(() => pickFirst(payload.cin, payload.CIN) || "", [payload]);

  const gstNumber = useMemo(() => pickFirst(payload.gstNumber, payload.gstin) || "", [payload]);
  const panNumber = useMemo(() => pickFirst(payload.panNumber, payload.pan) || "", [payload]);

  const registeredAddress = useMemo(() => {
    const fromPayload = pickFirst(payload.registeredAddress, payload.billingAddress, payload.address);
    if (typeof fromPayload === "string") return fromPayload;
    if (fromPayload && typeof fromPayload === "object") {
      const a: any = fromPayload;
      return [a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ") || "";
    }
    return "";
  }, [payload]);

  const description = useMemo(() => pickFirst(payload.description, payload.about) || "", [payload]);

  const bank = useMemo(() => {
    const b: any = payload.bank && typeof payload.bank === "object" ? payload.bank : null;
    if (!b) return null;
    return {
      bankName: pickFirst(b.bankName, b.name) || "",
      branch: pickFirst(b.branch) || "",
      ifsc: pickFirst(b.ifsc, b.IFSC) || "",
      accountNumber: pickFirst(b.accountNumber, b.accountNo, b.acct) || "",
    };
  }, [payload]);

  const completeness = useMemo(() => {
    const missing: string[] = [];
    if (!companyName || companyName === "—") missing.push("Company name");
    if (!primaryEmail) missing.push("Official email");
    if (!gstNumber) missing.push("GST");
    if (!panNumber) missing.push("PAN");
    if (!registeredAddress) missing.push("Registered address");
    if (!bank?.ifsc) missing.push("Bank IFSC");
    if (!bank?.accountNumber) missing.push("Bank account");
    return { missing };
  }, [companyName, primaryEmail, gstNumber, panNumber, registeredAddress, bank]);

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
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs tracking-[0.28em]" style={{ color: "rgba(255,255,255,.55)" }}>
                  WORKSPACE • COMPANY & BILLING
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="text-2xl md:text-3xl font-semibold text-white">Company &amp; Billing</div>
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
                  Legal identity, compliance and billing rails — sourced from your Business master profile (Mongo).
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetricPill label="Organisation" value={companyName} />
                  <MetricPill label="Primary email" value={primaryEmail || "—"} />
                  <MetricPill label="Synced" value={nowStr} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {completeness.missing.length === 0 ? (
                    <StatusChip tone="ok" text="Billing profile complete" />
                  ) : (
                    <StatusChip
                      tone="warn"
                      text={`Action needed: missing ${completeness.missing.length} field${
                        completeness.missing.length === 1 ? "" : "s"
                      }`}
                    />
                  )}
                  <StatusChip tone="info" text="Compliance-ready snapshot" />
                </div>
              </div>

              <button
                type="button"
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
              <div
                className="mt-6 rounded-2xl p-4 text-sm"
                style={{
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(0,0,0,.18)",
                  color: "rgba(255,255,255,.72)",
                }}
              >
                Loading…
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-12">
                {/* Left */}
                <div className="lg:col-span-7 grid gap-4">
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      LEGAL IDENTITY
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Field label="Legal name" value={companyName} />
                      <Field label="Entity type" value={entityType} />
                      <Field label="Industry" value={industry} />
                      <Field label="Employees (approx.)" value={employeesCount} mono />
                      <Field label="Incorporation date" value={incorporationDate} mono />
                      <Field label="CIN" value={cin} mono />
                      <Field label="GST Number" value={gstNumber} mono />
                      <Field label="PAN Number" value={panNumber} mono />
                      <div className="md:col-span-2">
                        <Field label="Registered address" value={registeredAddress} multiline />
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Company description" value={description} multiline />
                      </div>
                    </div>
                  </div>

                  {completeness.missing.length > 0 && (
                    <div
                      className="rounded-[26px] p-5"
                      style={{
                        border: "1px solid rgba(245,158,11,.28)",
                        background: "linear-gradient(135deg, rgba(245,158,11,.14), rgba(0,71,127,.18))",
                      }}
                    >
                      <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.60)" }}>
                        ACTION REQUIRED
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">Missing fields</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {completeness.missing.map((m) => (
                          <span
                            key={m}
                            className="rounded-full px-3 py-1 text-[11px]"
                            style={{
                              border: "1px solid rgba(255,255,255,.12)",
                              background: "rgba(0,0,0,.18)",
                              color: "rgba(255,255,255,.82)",
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right */}
                <div className="lg:col-span-5 grid gap-4">
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      BILLING RAILS
                    </div>

                    <div className="mt-4 grid gap-3">
                      <Field label="Billing email" value={primaryEmail} />
                      <Field label="GST number (for invoices)" value={gstNumber} mono />
                      <Field label="PAN number" value={panNumber} mono />

                      <div
                        className="rounded-[18px] p-4"
                        style={{
                          border: "1px solid rgba(255,255,255,.10)",
                          background: "rgba(0,0,0,.18)",
                        }}
                      >
                        <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,.55)" }}>
                          BANK DETAILS
                        </div>

                        {bank ? (
                          <div className="mt-2 grid gap-2">
                            <div className="text-sm font-semibold text-white break-words">
                              {bank.bankName || "Bank name not captured"}
                            </div>

                            <div className="text-[12px] break-words" style={{ color: "rgba(255,255,255,.78)" }}>
                              <span style={{ color: "rgba(255,255,255,.60)" }}>Branch:</span> {bank.branch || "—"}
                            </div>

                            <div className="text-[12px] break-words" style={{ color: "rgba(255,255,255,.78)" }}>
                              <span style={{ color: "rgba(255,255,255,.60)" }}>IFSC:</span>{" "}
                              <span className="font-mono">{bank.ifsc || "—"}</span>
                            </div>

                            <div className="text-[12px] break-words" style={{ color: "rgba(255,255,255,.78)" }}>
                              <span style={{ color: "rgba(255,255,255,.60)" }}>Account:</span>{" "}
                              <span className="font-mono">
                                {bank.accountNumber ? maskAccount(bank.accountNumber) : "—"}
                              </span>
                            </div>

                            <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
                              (Account is masked on-screen for safety.)
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm" style={{ color: "rgba(255,255,255,.55)" }}>
                            Bank details not captured yet.
                          </div>
                        )}
                      </div>
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
                    <div className="mt-2 text-sm font-semibold text-white">Clean billing prevents delays</div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                      Accurate GST/PAN + verified bank record reduces invoice disputes and accelerates settlement cycles.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
              Sourced from Mongo Business profile (payload). No frontpage placeholders.
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
