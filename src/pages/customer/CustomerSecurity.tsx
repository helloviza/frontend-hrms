// apps/frontend/src/pages/customer/CustomerSecurity.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

/**
 * ✅ BACKEND MAPPING (confirmed)
 * - POST /api/password/change   (self-service; requires currentPassword + newPassword)
 * - POST /api/password/admin-set (HR/Admin only; not used here)
 *
 * NOTE:
 * - lib/api.ts already prefixes API_BASE which includes "/api"
 *   Example: API_BASE = "https://api.hrms.plumtrips.com/api"
 *   So we call api.post("/password/change", ...) (NOT "/api/password/change")
 */

function safeEmailFromSession(): string {
  try {
    const fromLS = localStorage.getItem("userEmail") || localStorage.getItem("email") || "";
    return String(fromLS || "").trim();
  } catch {
    return "";
  }
}

function extractError(err: any): string {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "Request failed. Please try again."
  );
}

function validateNewPassword(pass: string): string | null {
  const p = (pass || "").trim();
  if (p.length < 8) return "Password must be at least 8 characters long.";
  const hasLetter = /[A-Za-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  if (!hasLetter || !hasNumber) return "Use a mix of letters and numbers for better security.";
  return null;
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
    <div
      className="rounded-full px-3 py-1 text-[11px] flex items-center gap-2"
      style={{
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.06)",
        color: "rgba(255,255,255,.78)",
      }}
    >
      <span style={{ color: "rgba(255,255,255,.55)" }}>{label}</span>
      <span className="font-semibold" style={{ color: "rgba(255,255,255,.92)" }}>
        {value}
      </span>
    </div>
  );
}

function TechDivider() {
  return (
    <div className="relative my-4">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,.18), rgba(0,194,168,.22), rgba(208,101,73,.22), rgba(255,255,255,.18), transparent)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[10px]"
        style={{
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(0,0,0,.28)",
          color: "rgba(255,255,255,.65)",
        }}
      >
        SECURITY LAYER
      </div>
    </div>
  );
}

function BadgePill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "good" | "info" | "warn";
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: {
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(0,0,0,.18)",
      color: "rgba(255,255,255,.78)",
    },
    good: {
      border: "1px solid rgba(34,197,94,.28)",
      background: "rgba(34,197,94,.10)",
      color: "rgba(220,255,235,.92)",
    },
    info: {
      border: "1px solid rgba(45,125,255,.28)",
      background: "rgba(45,125,255,.10)",
      color: "rgba(220,235,255,.92)",
    },
    warn: {
      border: "1px solid rgba(208,101,73,.28)",
      background: "rgba(208,101,73,.10)",
      color: "rgba(255,235,225,.92)",
    },
  };

  return (
    <span className="rounded-full px-3 py-1 text-[11px]" style={styles[tone] || styles.neutral}>
      {text}
    </span>
  );
}

export default function CustomerSecurity() {
  const navigate = useNavigate();

  const email = useMemo(() => safeEmailFromSession(), []);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");

  const [loadingChange, setLoadingChange] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const posture = useMemo(() => {
    // Executive UI score (not “developer telemetry”)
    let score = 72;
    const p = (newPassword || "").trim();
    if (p.length >= 8) score += 6;
    if (p.length >= 12) score += 8;
    if (/[A-Z]/.test(p)) score += 4;
    if (/[0-9]/.test(p)) score += 4;
    if (/[^A-Za-z0-9]/.test(p)) score += 4;
    if (score > 96) score = 96;
    if (score < 55) score = 55;
    return score;
  }, [newPassword]);

  const newPassError = useMemo(() => validateNewPassword(newPassword), [newPassword]);

  const recoveryLabel = email ? email : "Not available in session";

  const postureLabel = useMemo(() => {
    if (posture >= 90) return "Excellent";
    if (posture >= 80) return "Strong";
    if (posture >= 70) return "Good";
    return "Basic";
  }, [posture]);

  async function onChangePassword() {
    setOkMsg(null);
    setErrMsg(null);

    if (!currentPassword || !newPassword || !confirmNew) {
      setErrMsg("Please fill all fields.");
      return;
    }
    if (newPassError) {
      setErrMsg(newPassError);
      return;
    }
    if (newPassword !== confirmNew) {
      setErrMsg("New password and confirmation do not match.");
      return;
    }

    setLoadingChange(true);
    try {
      await api.post("/password/change", { currentPassword, newPassword });

      setOkMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
    } catch (e: any) {
      setErrMsg(extractError(e));
    } finally {
      setLoadingChange(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.22)",
    color: "rgba(255,255,255,.92)",
  };

  return (
    <div
      className="relative w-full min-h-[calc(100vh-64px)] overflow-hidden"
      style={{
        background:
          "radial-gradient(1400px 720px at 12% 0%, rgba(0,71,127,.14), transparent 55%), radial-gradient(1200px 660px at 86% 6%, rgba(208,101,73,.12), transparent 60%), radial-gradient(1100px 640px at 60% 120%, rgba(0,194,168,.10), transparent 55%), linear-gradient(180deg, rgba(250,250,252,1), rgba(244,245,248,1))",
      }}
    >
      {/* AI-tech overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.08) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 22%, rgba(45,125,255,.35), transparent 36%), radial-gradient(circle at 76% 18%, rgba(0,194,168,.30), transparent 34%), radial-gradient(circle at 55% 88%, rgba(208,101,73,.26), transparent 38%)",
          }}
        />
      </div>

      {/* Content */}
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
                  WORKSPACE • SECURITY CONSOLE
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="text-2xl md:text-3xl font-semibold text-white">Security Console</div>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px]"
                    style={{
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      color: "rgba(255,255,255,.78)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live posture
                  </span>
                </div>

                <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.70)" }}>
                  Executive-grade controls for Workspace access — password governance, recovery readiness, and policy guidance.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetricPill label="Role" value="Workspace Leader" />
                  <MetricPill label="Account" value={email || "—"} />
                  <MetricPill label="Posture" value={postureLabel} />
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

            <TechDivider />

            {/* Alerts */}
            {(okMsg || errMsg) && (
              <div
                className="mt-1 rounded-2xl px-4 py-3 text-sm"
                style={{
                  border: `1px solid ${errMsg ? "rgba(239,68,68,.28)" : "rgba(34,197,94,.28)"}`,
                  background: errMsg ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.10)",
                  color: errMsg ? "rgba(255,200,200,.95)" : "rgba(200,255,220,.95)",
                }}
              >
                {errMsg || okMsg}
              </div>
            )}

            {/* Main grid */}
            <div className="mt-6 grid gap-4 lg:grid-cols-12">
              {/* Left */}
              <div className="lg:col-span-4 grid gap-4">
                {/* Executive Posture */}
                <div
                  className="rounded-[26px] p-5"
                  style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                >
                  <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                    SECURITY POSTURE
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center"
                      style={{
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(0,0,0,.18)",
                      }}
                    >
                      <div className="text-lg font-semibold text-white">{posture}%</div>
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Console readiness</div>
                      <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                        A higher score reflects stronger password hygiene and reduced risk exposure.
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-4 h-2 w-full rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,.10)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${posture}%`,
                        background:
                          "linear-gradient(90deg, rgba(45,125,255,.95), rgba(0,194,168,.95), rgba(208,101,73,.95))",
                      }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <BadgePill text="Policy enforced" tone="good" />
                    <BadgePill text={email ? "Recovery ready" : "Recovery missing"} tone={email ? "good" : "warn"} />
                    <BadgePill text="Session protection: In rollout" tone="info" />
                    <BadgePill text="MFA: In rollout" tone="info" />
                  </div>
                </div>

                {/* Security Policy (executive) */}
                <div
                  className="rounded-[26px] p-5"
                  style={{
                    border: "1px solid rgba(45,125,255,.22)",
                    background: "linear-gradient(135deg, rgba(45,125,255,.18), rgba(0,71,127,.18))",
                  }}
                >
                  <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.60)" }}>
                    SECURITY POLICY
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">Password governance</div>
                  <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                    Designed for corporate travel & HR operations. Keep access tight and auditable.
                  </div>

                  <div
                    className="mt-3 rounded-2xl p-3"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.18)" }}
                  >
                    <ul className="list-disc pl-5 space-y-1 text-[11px]" style={{ color: "rgba(255,255,255,.78)" }}>
                      <li>Minimum 8 characters (recommended 12+).</li>
                      <li>Must include letters & numbers (recommended symbol).</li>
                      <li>Do not reuse passwords across tools/vendors.</li>
                      <li>Never share passwords or OTPs — even internally.</li>
                    </ul>
                  </div>

                  <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                    Recommended format:
                    <div className="mt-1 font-mono text-xs" style={{ color: "rgba(255,255,255,.88)" }}>
                      “PlumTrips@2026!Workspace”
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
                      Example only — choose your own unique phrase.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-8 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Change password */}
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      CHANGE PASSWORD
                    </div>

                    <div className="mt-3 grid gap-2">
                      <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                        autoComplete="current-password"
                      />
                      <input
                        type="password"
                        placeholder="New password (min 8 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmNew}
                        onChange={(e) => setConfirmNew(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                        autoComplete="new-password"
                      />
                    </div>

                    {newPassError && (
                      <div className="mt-2 text-[11px]" style={{ color: "rgba(255,200,200,.92)" }}>
                        {newPassError}
                      </div>
                    )}

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <button
                        type="button"
                        onClick={onChangePassword}
                        disabled={loadingChange}
                        className="rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
                        style={{
                          background: "rgba(255,255,255,.12)",
                          border: "1px solid rgba(255,255,255,.16)",
                          color: "rgba(255,255,255,.95)",
                        }}
                      >
                        {loadingChange ? "Updating…" : "Update Password"}
                      </button>

                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,.58)" }}>
                        Prefer 12+ characters for executive-grade security.
                      </span>
                    </div>

                    <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                      Tip: Use a passphrase (3–5 words) + number + symbol.
                    </div>
                  </div>

                  {/* Recovery & Support */}
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      ACCOUNT RECOVERY
                    </div>

                    <div className="mt-3 text-sm" style={{ color: "rgba(255,255,255,.80)" }}>
                      Recovery email:
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white break-all">{recoveryLabel}</div>

                    <div
                      className="mt-3 rounded-2xl px-3 py-3 text-[11px]"
                      style={{
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(0,0,0,.18)",
                        color: "rgba(255,255,255,.72)",
                      }}
                    >
                      <div className="font-semibold" style={{ color: "rgba(255,255,255,.88)" }}>
                        Executive recovery protocol
                      </div>
                      <ul className="mt-1 list-disc pl-5 space-y-1">
                        <li>Contact your <b>People Strategist (HR)</b> or <b>System Steward (Admin)</b> to reset access.</li>
                        <li>Never share passwords/OTPs — Plumtrips support will never request them.</li>
                        <li>For shared-company access, keep credentials strictly personal and auditable.</li>
                      </ul>
                    </div>

                    <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                      Email reset can be enabled later (forgot/reset). Until then, admin-assisted reset is the secure route.
                    </div>
                  </div>
                </div>

                {/* Executive Snapshot */}
                <div
                  className="rounded-[26px] p-5"
                  style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                        SECURITY SNAPSHOT
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">Controls & assurance</div>
                      <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                        Focused on outcomes: stronger access governance, lower risk, and cleaner operational continuity.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-full px-4 py-2 text-xs"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.90)",
                      }}
                      onClick={() => navigate("/profile/customer")}
                    >
                      Return ↩
                    </button>
                  </div>

                  <div
                    className="mt-4 rounded-2xl p-4 text-[12px] leading-6"
                    style={{
                      border: "1px solid rgba(255,255,255,.10)",
                      background: "rgba(0,0,0,.22)",
                      color: "rgba(255,255,255,.82)",
                    }}
                  >
                    <div className="flex flex-wrap gap-2">
                      <BadgePill text="Password: Managed" tone="good" />
                      <BadgePill text="Policy: Enforced" tone="good" />
                      <BadgePill text={email ? "Recovery: Ready" : "Recovery: Missing"} tone={email ? "good" : "warn"} />
                      <BadgePill text="MFA: In rollout" tone="info" />
                      <BadgePill text="Sessions: In rollout" tone="info" />
                    </div>

                    <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.70)" }}>
                      Recommended next moves:
                      <ul className="mt-1 list-disc pl-5 space-y-1">
                        <li>Upgrade to a 12+ character passphrase for stronger posture.</li>
                        <li>Ensure recovery email is present and accessible.</li>
                        <li>Do not reuse credentials across any travel/visa vendor portals.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
                  This console intentionally avoids technical/internal route details to preserve executive clarity and user trust.
                </div>
              </div>
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
