// src/profile/ChangePasswordSection.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PasswordCard from "./PasswordCard";

/**
 * We don't assume the exact mount path.
 * This tries common mounts for your backend `routes/password.ts`.
 *
 * ✅ Preferred if your server mounts router like: app.use("/api/password", passwordRouter)
 * - POST /api/password/change
 * - POST /api/password/forgot
 *
 * Fallbacks:
 * - /api/auth/change-password, /api/auth/forgot-password
 * - /api/auth/password/change, /api/auth/password/forgot
 */
const ENDPOINTS = {
  change: ["/api/password/change", "/api/auth/change-password", "/api/auth/password/change"],
  forgot: ["/api/password/forgot", "/api/auth/forgot-password", "/api/auth/password/forgot"],
};

function safeGetLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readAccessToken(authAny: any): string {
  const keys = ["accessToken", "hrms:accessToken", "pt:accessToken", "plumtrips:accessToken", "jwt", "token"];
  const fromCtx = authAny?.accessToken || authAny?.token || authAny?.jwt || authAny?.authToken || "";
  if (fromCtx && typeof fromCtx === "string") return fromCtx;
  for (const k of keys) {
    const v = safeGetLS(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function postJson(url: string, body: any, token?: string) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      (text && text.length < 200 ? text : "") ||
      `Request failed (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return json;
}

/** Try multiple endpoints until one succeeds; fallback only on 404/405 */
async function postFirstOk(urls: string[], body: any, token?: string) {
  let lastErr: any = null;

  for (const url of urls) {
    try {
      return await postJson(url, body, token);
    } catch (e: any) {
      lastErr = e;
      const status = e?.status;
      if (status === 404 || status === 405) continue; // try next
      throw e; // real error -> stop
    }
  }

  throw lastErr || new Error("Password endpoint not found on server.");
}

function Pill({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px]"
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(0,0,0,.18)",
        color: "rgba(255,255,255,.78)",
      }}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-400"} `} />
      {label}
    </span>
  );
}

export default function ChangePasswordSection() {
  const authAny = useAuth() as any;

  const token = useMemo(() => readAccessToken(authAny), [authAny]);
  const email = useMemo(() => {
    const fromAuth = authAny?.user?.email;
    const fromLS = safeGetLS("userEmail");
    return String(fromAuth || fromLS || "");
  }, [authAny]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");

  const [loadingChange, setLoadingChange] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const strength = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 8) score += 25;
    if (newPassword.length >= 12) score += 15;
    if (/[A-Z]/.test(newPassword)) score += 15;
    if (/[0-9]/.test(newPassword)) score += 15;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 20;
    if (score > 95) score = 95;
    return score;
  }, [newPassword]);

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.22)",
    color: "rgba(255,255,255,.92)",
  };

  async function onChangePassword() {
    setOkMsg(null);
    setErrMsg(null);

    if (!currentPassword || !newPassword || !confirmNew) {
      setErrMsg("Please fill all fields.");
      return;
    }
    if (newPassword.length < 8) {
      setErrMsg("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNew) {
      setErrMsg("New password and confirmation do not match.");
      return;
    }

    setLoadingChange(true);
    try {
      await postFirstOk(ENDPOINTS.change, { currentPassword, newPassword }, token);
      setOkMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to update password.");
    } finally {
      setLoadingChange(false);
    }
  }

  async function onSendResetLink() {
    setOkMsg(null);
    setErrMsg(null);

    if (!email) {
      setErrMsg("Email not found in session. Please logout → login again.");
      return;
    }

    setLoadingReset(true);
    try {
      await postFirstOk(ENDPOINTS.forgot, { email }, token);
      setOkMsg(`Reset link sent to ${email}.`);
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to send reset link.");
    } finally {
      setLoadingReset(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PasswordCard
        eyebrow="CHANGE PASSWORD"
        title="Credential Update"
        subtitle="Keep access secured with a strong passphrase."
        rightSlot={
          <span
            className="rounded-full px-3 py-1 text-[11px]"
            style={{
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.86)",
            }}
          >
            Strength {strength}%
          </span>
        }
      >
        {(okMsg || errMsg) && (
          <div
            className="mb-3 rounded-2xl px-4 py-3 text-sm"
            style={{
              border: `1px solid ${errMsg ? "rgba(239,68,68,.28)" : "rgba(34,197,94,.28)"}`,
              background: errMsg ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.10)",
              color: errMsg ? "rgba(255,200,200,.95)" : "rgba(200,255,220,.95)",
            }}
          >
            {errMsg || okMsg}
          </div>
        )}

        <div className="grid gap-2">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmNew}
            onChange={(e) => setConfirmNew(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
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

          <div className="flex flex-wrap gap-2">
            <Pill label="8+ chars" ok={newPassword.length >= 8} />
            <Pill label="Number" ok={/[0-9]/.test(newPassword)} />
            <Pill label="Symbol" ok={/[^A-Za-z0-9]/.test(newPassword)} />
          </div>
        </div>

        <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
          Tip: Prefer 12+ chars with a symbol. Avoid reusing old passwords.
        </div>
      </PasswordCard>

      <PasswordCard
        eyebrow="RESET VIA EMAIL"
        title="Recovery Link"
        subtitle="Send a secure reset link to your registered email."
        rightSlot={
          <span
            className="rounded-full px-3 py-1 text-[11px]"
            style={{
              border: "1px solid rgba(0,194,168,.22)",
              background: "rgba(0,194,168,.10)",
              color: "rgba(220,255,245,.92)",
            }}
          >
            Verified channel
          </span>
        }
      >
        <div className="text-sm" style={{ color: "rgba(255,255,255,.80)" }}>
          Reset link will be sent to:
        </div>
        <div className="mt-1 text-sm font-semibold text-white break-all">{email || "—"}</div>

        <button
          type="button"
          onClick={onSendResetLink}
          disabled={loadingReset}
          className="mt-3 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{
            background: "rgba(0,0,0,.18)",
            border: "1px solid rgba(255,255,255,.16)",
            color: "rgba(255,255,255,.95)",
          }}
        >
          {loadingReset ? "Sending…" : "Send Reset Link"}
        </button>

        <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
          If you don’t receive it, check spam or ensure your email is verified.
        </div>
      </PasswordCard>
    </div>
  );
}
