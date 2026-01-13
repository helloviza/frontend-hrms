// apps/frontend/src/pages/customer/CustomerAgreements.tsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { pickDisplayName, useCustomerContext } from "../../hooks/useCustomerContext";

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
        {value || "—"}
      </span>
    </div>
  );
}

function StatusChip({
  tone,
  text,
}: {
  tone: "ok" | "warn" | "info";
  text: string;
}) {
  const toneStyle =
    tone === "ok"
      ? {
          border: "1px solid rgba(34,197,94,.28)",
          background: "rgba(34,197,94,.10)",
          color: "rgba(200,255,220,.95)",
        }
      : tone === "warn"
      ? {
          border: "1px solid rgba(245,158,11,.28)",
          background: "rgba(245,158,11,.10)",
          color: "rgba(255,236,200,.95)",
        }
      : {
          border: "1px solid rgba(59,130,246,.28)",
          background: "rgba(59,130,246,.10)",
          color: "rgba(220,235,255,.95)",
        };

  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px]" style={toneStyle as any}>
      {text}
    </span>
  );
}

function DocCard({
  title,
  subtitle,
  href,
  metaRight,
}: {
  title: string;
  subtitle: string;
  href?: string;
  metaRight?: string;
}) {
  const Card = (
    <div
      className="group rounded-[22px] p-4"
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.18)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(255,255,255,.55)" }}>
            COMMERCIAL DOCUMENT
          </div>
          <div className="mt-2 text-sm font-semibold text-white break-words">
            {title || "Untitled document"}
          </div>
          <div className="mt-1 text-[12px] break-words" style={{ color: "rgba(255,255,255,.70)" }}>
            {subtitle}
          </div>
        </div>

        <div className="shrink-0 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
          {metaRight || ""}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
          {href ? "Open in new tab" : "No URL attached"}
        </div>

        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.06)",
            color: "rgba(255,255,255,.82)",
            transform: "translateY(0)",
          }}
        >
          {href ? "View ↗" : "On file"}
        </span>
      </div>
    </div>
  );

  if (!href) return Card;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {Card}
    </a>
  );
}

function cleanUrl(u?: string) {
  return String(u || "").trim();
}

function fileLabelFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(last) || url;
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  }
}

export default function CustomerAgreements() {
  const navigate = useNavigate();
  const { profile, loadingProfile, authEmail } = useCustomerContext() as any;

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
    profile?.officialEmail ||
    payload.officialEmail ||
    profile?.email ||
    payload.email ||
    authEmail ||
    "";

  const docs = useMemo(() => {
    const list = Array.isArray(profile?.documents) ? profile.documents : [];

    // Normalize shape: { name?: string; url?: string; kind?: string; createdAt?: string }
    const normalized = list
      .map((d: any) => {
        const url = cleanUrl(d?.url);
        const name = String(d?.name || "").trim() || (url ? fileLabelFromUrl(url) : "Document");
        const kind = String(d?.kind || d?.type || "").trim();
        const createdAt = String(d?.createdAt || d?.uploadedAt || "").trim();
        return { name, url, kind, createdAt };
      })
      .filter((d: any) => d.name || d.url);

    // light sort: newest first if has createdAt, else keep order
    normalized.sort((a: any, b: any) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : NaN;
      const tb = b.createdAt ? Date.parse(b.createdAt) : NaN;
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
      if (!Number.isNaN(tb)) return 1;
      if (!Number.isNaN(ta)) return -1;
      return 0;
    });

    return normalized;
  }, [profile]);

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
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs tracking-[0.28em]" style={{ color: "rgba(255,255,255,.55)" }}>
                  WORKSPACE • COMMERCIALS
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="text-2xl md:text-3xl font-semibold text-white">Agreements</div>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px]"
                    style={{
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      color: "rgba(255,255,255,.78)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Executive vault
                  </span>
                </div>

                <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.70)" }}>
                  Commercial documents linked to your workspace — clean, controlled, and audit-friendly.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <MetricPill label="Organisation" value={orgName} />
                  <MetricPill label="Primary email" value={primaryEmail || "—"} />
                  <MetricPill label="Synced" value={nowStr} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {docs.length > 0 ? (
                    <StatusChip tone="ok" text={`${docs.length} document${docs.length === 1 ? "" : "s"} on file`} />
                  ) : (
                    <StatusChip tone="warn" text="No agreements attached yet" />
                  )}
                  <StatusChip tone="info" text="Access: Workspace Leader" />
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

            {/* Body */}
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
                {/* Left: Document list */}
                <div className="lg:col-span-8">
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                          DOCUMENTS
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">Documents &amp; Agreements</div>
                        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                          Open any document in a new tab. Links are shown exactly as attached.
                        </div>
                      </div>
                      <div className="text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                        {docs.length ? `${docs.length} total` : ""}
                      </div>
                    </div>

                    {docs.length ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {docs.map((d: any, idx: number) => (
                          <DocCard
                            key={`${d.url || d.name}-${idx}`}
                            title={d.name}
                            subtitle={d.kind ? d.kind : d.url ? "External link" : "On file"}
                            href={d.url || undefined}
                            metaRight={d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ""}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="mt-4 rounded-2xl p-4 text-[13px]"
                        style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)", color: "rgba(255,255,255,.72)" }}
                      >
                        No commercial agreements are attached yet.
                        <div className="mt-2 text-[12px]" style={{ color: "rgba(255,255,255,.60)" }}>
                          Once your HR/Admin uploads agreements, they’ll appear here automatically.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Executive note */}
                <div className="lg:col-span-4 grid gap-4">
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
                    <div className="mt-2 text-sm font-semibold text-white">Commercial clarity, always</div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                      Keeping agreements in one place reduces billing disputes, improves compliance, and accelerates approvals.
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-[11px]"
                        style={{
                          border: "1px solid rgba(255,255,255,.12)",
                          background: "rgba(0,0,0,.18)",
                          color: "rgba(255,255,255,.82)",
                        }}
                      >
                        Cleaner auditability
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-[11px]"
                        style={{
                          border: "1px solid rgba(255,255,255,.12)",
                          background: "rgba(0,0,0,.18)",
                          color: "rgba(255,255,255,.82)",
                        }}
                      >
                        Faster approvals
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-[11px]"
                        style={{
                          border: "1px solid rgba(255,255,255,.12)",
                          background: "rgba(0,0,0,.18)",
                          color: "rgba(255,255,255,.82)",
                        }}
                      >
                        Lower policy risk
                      </span>
                    </div>

                    <div className="mt-4 text-[12px]" style={{ color: "rgba(255,255,255,.70)" }}>
                      <span style={{ color: "rgba(255,255,255,.60)" }}>Tip:</span>{" "}
                      Prefer naming formats like{" "}
                      <span className="font-mono" style={{ color: "rgba(255,255,255,.88)" }}>
                        MSA_2025_PlumTrips_Visaero.pdf
                      </span>{" "}
                      for easy retrieval.
                    </div>
                  </div>

                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      VISIBILITY
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">Who can see these?</div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.68)" }}>
                      Workspace Leaders can view attached agreements. Editing/uploading is managed by HR/Admin.
                    </div>

                    <div className="mt-3 rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)" }}>
                      <div className="text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                        If you need an update
                      </div>
                      <div className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,.78)" }}>
                        Ask your HR/Admin team to upload the latest agreement version.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
              Executive vault: shows workspace-ready documents only (no internal notes).
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}
