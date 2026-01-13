
// apps/frontend/src/pages/onboarding/PublicFlow.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../lib/api";
import VendorFlow from "./flows/VendorFlow";
import BusinessAssociationFlow from "./flows/BusinessAssociationFlow";
import EmployeeFlow from "./flows/EmployeeFlow";

/* ============ Types ============ */
export type OnboardingType =
  | "Vendor"
  | "Supplier"
  | "Business"
  | "Business Association"
  | "Business_Association"
  | "BA"
  | "Employee"
  | (string & {});

export type CanonType = "Vendor" | "BusinessAssociation" | "Employee";

export type Status =
  | "Invited"
  | "In-Progress"
  | "InProgress"
  | "Pending"
  | "Draft"
  | "Submitted"
  | "Verified"
  | "Approved"
  | "Rejected"
  | "Expired"
  | (string & {});

export type LoaderResponse = {
  valid?: boolean;
  type?: OnboardingType;
  status?: Status;
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    type?: OnboardingType;
  };
  brand?: {
    logoUrl?: string;
    primary?: string;
    accent?: string;
    supportPhone?: string;
    supportEmail?: string;
  };
  turnaroundHours?: number;
  expiresAt?: string | null;
  reason?: string;
  welcome?: string;
  onboarding?: { type?: OnboardingType };
  meta?: { type?: OnboardingType };
};

/* ============ Utils ============ */
const isDev =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as any)?.env?.DEV);

export function norm(s?: string) {
  return (s || "").toLowerCase().replace(/\s+|_/g, "");
}

function includesAny(hay: string, needles: string[]) {
  return needles.some((n) => hay.includes(n));
}

/** Robust mapping for many API variants; Employee is fallback */
export function coerceType(raw?: OnboardingType): CanonType {
  const n = norm(String(raw || ""));
  if (!n) return "Employee";

  // Vendor / Supplier buckets
  if (
    includesAny(n, [
      "vendor",
      "supplier",
      "vendorsignup",
      "supplieronboarding",
      "travelpartner",
      "hotelpartner",
      "cabpartner",
      "visapartner",
    ])
  ) {
    return "Vendor";
  }

  // Business Association buckets
  if (
    n === "business" ||
    includesAny(n, ["businessassociation", "association", "partnerassociation", "ba", "bizassoc"])
  ) {
    return "BusinessAssociation";
  }

  // Employee buckets
  if (includesAny(n, ["employee", "candidate", "joiner", "newhire", "staff"])) {
    return "Employee";
  }

  // Safe fallback
  return "Employee";
}

export function labelFromCanon(t: CanonType) {
  return t === "BusinessAssociation" ? "Business Association" : t;
}

export function isActuallyExpired(ex?: string | null) {
  return !!ex && new Date(ex).getTime() <= Date.now();
}

export function isProcessedStatus(s?: string) {
  const n = norm(s);
  return ["submitted", "verified", "approved", "rejected", "closed", "completed"].includes(n);
}

export function isBlockedReason(reason?: string) {
  const n = norm(reason);
  if (!n) return false;
  return includesAny(n, ["revoked", "blacklist", "blocked", "deleted", "cancel", "notfound"]);
}

export function cx(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

/* ============ Inline styles & wrappers ============ */
function InlineStyles() {
  return (
    <style>{`
      .pt-input {
        display:block;
        width:100%;
        background:#fff;
        color:#111827;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:10px 12px;
        font-size:14px;
        line-height:1.4;
        outline:none;
        transition: box-shadow .15s, border-color .15s;
      }
      .pt-input::placeholder {
        color:#9ca3af;
        opacity:1;
      }
      .pt-input:focus {
        border-color:#bfdbfe;
        box-shadow:0 0 0 3px rgba(191,219,254,.55);
      }
      .pt-btn-primary {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:10px 16px;
        font-weight:600;
        font-size:14px;
        color:#fff;
        background:linear-gradient(135deg,#9ab8ff,#7cc5ff);
        border:0;
        border-radius:14px;
        box-shadow:0 6px 16px rgba(124,197,255,.35);
      }
      .pt-btn-primary:disabled {
        opacity:.6;
      }
      .pt-btn-ghost {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:10px 16px;
        font-weight:600;
        font-size:14px;
        color:#0f172a;
        background:#fff;
        border:1px solid #e5e7eb;
        border-radius:14px;
      }
      .pt-btn-xs {
        padding:4px 8px;
        font-size:12px;
        border-radius:10px;
      }
      .pt-chip {
        background:#f4f4f5;
        color:#71717a;
        border-radius:9999px;
        padding:2px 8px;
        font-size:11px;
      }
    `}</style>
  );
}

export function Shell({
  children,
  pastel,
}: {
  children: React.ReactNode;
  pastel?: boolean;
}) {
  return (
    <div
      className={cx(
        "min-h-screen p-6",
        pastel ? "grid place-items-center bg-gradient-to-b from-white to-[#f7f8ff]" : "bg-white"
      )}
    >
      <InlineStyles />
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}

export function Card({
  children,
  center,
  className,
}: {
  children: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "w-full rounded-2xl border bg-white p-6 shadow-sm",
        center && "text-center",
        className
      )}
    >
      {children}
    </div>
  );
}

/* small info cell */
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

/* ============ Main ============ */
export default function PublicFlow() {
  const { token = "" } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<LoaderResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const niceDate = useMemo(
    () => (d?: string | null) => (d ? new Date(d).toLocaleString() : "—"),
    []
  );

  async function load() {
    if (!token) {
      setErr("Missing token in URL");
      setMeta(null);
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const raw = (await api.get(
        `/onboarding/invite/${encodeURIComponent(token)}`
      )) as any;

      const base: LoaderResponse =
        (raw && raw.type ? raw : raw?.invite || raw?.onboarding || raw || {}) ||
        {};

      // Patch type from any plausible location
      const rawType =
        base.type ||
        base.prefill?.type ||
        base.onboarding?.type ||
        base.meta?.type;

      if (rawType && !base.type) {
        base.type = rawType;
      }

      setMeta(base);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load invite");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* Guards */
  if (loading && !meta) {
    return (
      <Shell pastel>
        <Card className="text-sm text-zinc-600">Loading…</Card>
      </Shell>
    );
  }

  if (err && !meta) {
    return (
      <Shell pastel>
        <Card>
          <div className="text-red-600 text-sm">{err}</div>
        </Card>
      </Shell>
    );
  }

  if (!meta) {
    return (
      <Shell pastel>
        <Card center>
          <h1 className="text-2xl font-extrabold mb-2">This link is not valid</h1>
          <p className="text-sm text-zinc-600">
            Please contact your PlumTrips HR contact to request a new onboarding link.
          </p>
        </Card>
      </Shell>
    );
  }

  // If backend explicitly marks it invalid
  if (meta.valid === false) {
    return (
      <Shell pastel>
        <Card center>
          <h1 className="text-2xl font-extrabold mb-2">This link is not valid</h1>
          <p className="text-sm text-zinc-600">
            Please contact your PlumTrips HR contact to request a new onboarding link.
          </p>
        </Card>
      </Shell>
    );
  }

  if (isActuallyExpired(meta.expiresAt)) {
    return (
      <Shell pastel>
        <Card center>
          <h1 className="text-2xl font-extrabold mb-2">This link has expired</h1>
          <p className="text-sm text-zinc-600">
            Please contact your PlumTrips HR contact to request a new onboarding link.
          </p>
          <p className="mt-4 text-xs text-zinc-400">
            Expired at: {niceDate(meta.expiresAt)}
          </p>
        </Card>
      </Shell>
    );
  }

  if (isProcessedStatus(meta.status) || norm(meta.reason) === "alreadysubmitted") {
    return (
      <Shell pastel>
        <Card center>
          <h1 className="text-2xl font-extrabold mb-2">Already submitted</h1>
          <p className="text-sm text-zinc-600">
            Our team has your details and will be in touch.
          </p>
        </Card>
      </Shell>
    );
  }

  if (isBlockedReason(meta.reason)) {
    return (
      <Shell pastel>
        <Card center>
          <h1 className="text-2xl font-extrabold mb-2">This link is not valid</h1>
          <p className="text-sm text-zinc-600">
            Please contact your PlumTrips HR contact to request a new onboarding link.
          </p>
        </Card>
      </Shell>
    );
  }

  const resolvedRawType =
    meta.type ||
    meta.prefill?.type ||
    meta.onboarding?.type ||
    meta.meta?.type ||
    "(none)";
  const canon = coerceType(resolvedRawType);
  const label = labelFromCanon(canon);

  const tatLabel = `${meta.turnaroundHours ?? 72} hours`;
  const email = meta.prefill?.email || "—";

  return (
    <Shell pastel>
      <Card>
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-1">PlumTrips HRMS</div>
          <h1 className="text-2xl font-extrabold">Start Onboarding</h1>
        </div>

        <p className="text-sm text-zinc-700 mb-4">
          {meta.welcome || "Welcome to PlumTrips! This guided flow takes ~5–10 minutes."}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <Info label="Type" value={label} />
          <Info label="Email" value={email} />
          <Info label="Expires" value={niceDate(meta.expiresAt)} />
          <Info label="TAT" value={tatLabel} />
        </div>

        {/* Dev-only debug strip to verify type resolution */}
        {isDev && (
          <div className="mt-2 text-[11px] text-zinc-500 bg-zinc-50 border rounded-lg p-2 space-y-0.5">
            <div>
              debug: raw.type = <b>{String(meta.type || "—")}</b>
            </div>
            <div>
              debug: prefill.type = <b>{String(meta.prefill?.type || "—")}</b>
            </div>
            <div>
              debug: onboarding.type = <b>{String(meta.onboarding?.type || "—")}</b>
            </div>
            <div>
              debug: meta.meta.type = <b>{String(meta.meta?.type || "—")}</b>
            </div>
            <div>
              debug: canon = <b>{canon}</b>
            </div>
          </div>
        )}
      </Card>

      {/* Key ensures a fresh mount per flow so React never reuses the previous one */}
      {canon === "Vendor" && (
        <VendorFlow key={`flow-${canon}`} token={token} meta={meta} />
      )}
      {canon === "BusinessAssociation" && (
        <BusinessAssociationFlow key={`flow-${canon}`} token={token} meta={meta} />
      )}
      {canon === "Employee" && (
        <EmployeeFlow key={`flow-${canon}`} token={token} meta={meta} />
      )}
    </Shell>
  );
}
