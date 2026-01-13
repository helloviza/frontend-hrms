// apps/frontend/src/pages/leaves/Apply.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

interface LeaveRow {
  _id?: string;
  type?: string;
  from?: string;
  to?: string;
  status?: string;
  halfDay?: boolean;
  createdAt?: string;
}

const STATUS_OPTIONS = ["Pending", "Approved", "Rejected"];

/* ----------------------------------------------------------------------------
 * Policy + helpers (aligned with MyLeaves)
 * -------------------------------------------------------------------------- */

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | string;

type LeavePolicyEntry = {
  key: string; // CASUAL, SICK, PAID, etc.
  label: string;
  annual: number | null; // days/year (null => flexible)
  hasQuota: boolean;
  colorClass: string;
};

type TypeSummary = {
  type: string;
  label: string;
  allowed: number | null;
  used: number;
  pending: number;
  remaining: number | null;
  colorClass: string;
};

type LeaveSummaryApply = {
  year: number;
  joinDate?: string | null;
  map: Record<string, TypeSummary>;
};

const LEAVE_POLICY: LeavePolicyEntry[] = [
  {
    key: "CASUAL",
    label: "Casual Leave",
    annual: 12,
    hasQuota: true,
    colorClass: "bg-sky-500",
  },
  {
    key: "SICK",
    label: "Sick Leave",
    annual: 10,
    hasQuota: true,
    colorClass: "bg-emerald-500",
  },
  {
    key: "PAID",
    label: "Earned / Privilege Leave",
    annual: 18,
    hasQuota: true,
    colorClass: "bg-indigo-500",
  },
  {
    key: "COMPOFF",
    label: "Compensatory Off",
    annual: null,
    hasQuota: false,
    colorClass: "bg-amber-500",
  },
  {
    key: "UNPAID",
    label: "Loss of Pay (LOP)",
    annual: null,
    hasQuota: false,
    colorClass: "bg-slate-500",
  },
  {
    key: "BEREAVEMENT",
    label: "Bereavement Leave",
    annual: 5,
    hasQuota: true,
    colorClass: "bg-rose-500",
  },
  {
    key: "MATERNITY",
    label: "Maternity Leave",
    annual: null,
    hasQuota: false,
    colorClass: "bg-fuchsia-500",
  },
  {
    key: "PATERNITY",
    label: "Paternity Leave",
    annual: 7,
    hasQuota: true,
    colorClass: "bg-teal-500",
  },
];

// UI options driven from the same policy list as MyLeaves
const TYPE_KEY_OPTIONS = LEAVE_POLICY.map((p) => p.key);

function normalizeType(raw?: string): string {
  if (!raw) return "";
  return raw.toUpperCase().trim();
}

function normalizeStatus(raw?: string): LeaveStatus {
  if (!raw) return "PENDING";
  return raw.toUpperCase().trim();
}

function safeDateFromYmd(ymd?: string): Date | null {
  if (!ymd) return null;
  if (ymd.length >= 10) {
    const trimmed = ymd.slice(0, 10);
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(ymd);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDaysInclusive(from?: string, to?: string, halfDay?: boolean): number {
  const fromDate = safeDateFromYmd(from);
  const toDate = safeDateFromYmd(to || from);
  if (!fromDate || !toDate) return 0;

  const start = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );
  const end = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate(),
  );
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;

  const days = diffMs / (1000 * 60 * 60 * 24) + 1;

  if (halfDay && days === 1) return 0.5;

  return days;
}

function resolveJoinDate(user: any): Date | null {
  if (!user) return null;
  const raw: string =
    (user.dateOfJoining as string) ||
    (user.doj as string) ||
    (user.joiningDate as string) ||
    (user.joinDate as string) ||
    (user.createdAt as string) ||
    "";

  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeMonthsWorked(effectiveStart: Date, now: Date): number {
  const yDiff = now.getFullYear() - effectiveStart.getFullYear();
  const mDiff = now.getMonth() - effectiveStart.getMonth();
  let months = yDiff * 12 + mDiff + 1; // include current month
  if (months < 0) months = 0;
  if (months > 12) months = 12;
  return months;
}

function getPolicyForType(typeKey: string | undefined): LeavePolicyEntry | undefined {
  if (!typeKey) return undefined;
  const key = typeKey.toUpperCase();
  return LEAVE_POLICY.find((p) => p.key === key);
}

function buildLeaveSummaryForApply(leaves: LeaveRow[], user: any): LeaveSummaryApply {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);

  const joinDate = resolveJoinDate(user);
  const effectiveStart = joinDate && joinDate > yearStart ? joinDate : yearStart;

  const monthsWorked = computeMonthsWorked(effectiveStart, now);
  const ratio = monthsWorked / 12;

  const map: Record<string, TypeSummary> = {};

  for (const policy of LEAVE_POLICY) {
    const allowed =
      policy.hasQuota && typeof policy.annual === "number"
        ? Math.round(policy.annual * ratio)
        : null;

    map[policy.key] = {
      type: policy.key,
      label: policy.label,
      allowed,
      used: 0,
      pending: 0,
      remaining: allowed,
      colorClass: policy.colorClass,
    };
  }

  for (const l of leaves) {
    const tKey = normalizeType(l.type);
    if (!tKey) continue;

    const policy = getPolicyForType(tKey);

    if (!map[tKey]) {
      map[tKey] = {
        type: tKey,
        label: policy?.label || tKey,
        allowed:
          policy?.hasQuota && typeof policy.annual === "number"
            ? Math.round(policy.annual * ratio)
            : null,
        used: 0,
        pending: 0,
        remaining: null,
        colorClass: policy?.colorClass || "bg-slate-500",
      };
    }

    const status = normalizeStatus(l.status);
    const days = diffDaysInclusive(l.from, l.to, l.halfDay);

    if (status === "APPROVED") {
      map[tKey].used += days;
    } else if (status === "PENDING") {
      map[tKey].pending += days;
    }
  }

  for (const entry of Object.values(map)) {
    if (entry.allowed == null) {
      entry.remaining = null;
    } else {
      const rem = entry.allowed - entry.used - entry.pending;
      entry.remaining = rem < 0 ? 0 : rem;
    }
  }

  return {
    year,
    joinDate: joinDate ? joinDate.toISOString().slice(0, 10) : null,
    map,
  };
}

/* ----------------------------------------------------------------------------
 * Existing helpers (adapted to work with type keys)
 * -------------------------------------------------------------------------- */

function formatType(t?: string) {
  if (!t) return "—";
  const key = t.toUpperCase();
  const policy = getPolicyForType(key);
  if (policy) return policy.label;

  // Fallbacks if some legacy types come from backend
  if (key === "PAID") return "Paid";
  if (key === "CASUAL") return "Casual";
  if (key === "SICK") return "Sick";
  if (key === "UNPAID") return "Unpaid";
  if (key === "MATERNITY") return "Maternity";
  if (key === "COMPOFF") return "Comp-off";
  return t;
}

function formatStatus(raw?: string) {
  if (!raw) return "—";
  const upper = raw.toUpperCase();
  if (upper === "APPROVED") return "Approved";
  if (upper === "REJECTED") return "Rejected";
  if (upper === "PENDING") return "Pending";
  return raw;
}

function statusClass(raw?: string) {
  const upper = (raw || "").toUpperCase();
  if (upper === "APPROVED") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
  if (upper === "REJECTED") return "bg-rose-500/10 text-rose-300 border-rose-500/40";
  if (upper === "PENDING") return "bg-amber-500/10 text-amber-300 border-amber-500/40";
  return "bg-slate-700/40 text-slate-200 border-slate-500/40";
}

function prettyDate(d?: string) {
  if (!d) return "—";
  const nd = new Date(d);
  if (Number.isNaN(nd.getTime())) return d;
  return nd.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ----------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

export default function LeaveApply() {
  const { user: authUser } = useAuth();

  // ── Apply form state ─────────────────────────────────
  // IMPORTANT: this now stores the *backend key* (PAID, CASUAL, etc.)
  const [type, setType] = useState<string>("PAID");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [dayLength, setDayLength] = useState<"FULL" | "HALF">("FULL");
  const [halfSession, setHalfSession] = useState<"FIRST" | "SECOND">("FIRST");

  // ── History + filters ───────────────────────────────
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterMonth, setFilterMonth] = useState<"all" | "this" | "last">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | string>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | string>("ALL");

  async function loadLeaves() {
    try {
      setLoading(true);
      const resp = (await api.get("/leave/my")) as { items?: LeaveRow[] } | LeaveRow[];
      const items = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? (resp as any).items
        : [];
      setLeaves(items);
    } catch (e: any) {
      alert(e.message || "Failed to load leaves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeaves();
  }, []);

  // ── Quota summary from MyLeaves logic ───────────────
  const leaveSummary = useMemo(
    () => buildLeaveSummaryForApply(leaves, authUser),
    [leaves, authUser],
  );

  // Backend type key for currently selected leave
  const backendTypeKey = useMemo(
    () => (type || "PAID").toUpperCase(),
    [type],
  );
  const selectedPolicy = useMemo(
    () => getPolicyForType(backendTypeKey),
    [backendTypeKey],
  );
  const selectedSummary = leaveSummary.map[backendTypeKey];

  const requestedDays = useMemo(() => {
    if (!from) return null;
    const start = new Date(from);
    const end = new Date(to || from);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0) return null;

    if (dayLength === "HALF") {
      if (diffDays === 1) return 0.5;
      return diffDays - 0.5;
    }
    return diffDays;
  }, [from, to, dayLength]);

  const requestedDaysLabel = useMemo(() => {
    if (requestedDays == null) return "—";
    if (requestedDays === 0.5) return "0.5 day (half day)";
    if (requestedDays % 1 === 0.5) return `${requestedDays} days (incl. half day)`;
    return `${requestedDays} day${requestedDays === 1 ? "" : "s"}`;
  }, [requestedDays]);

  const reasonSnippet = useMemo(() => {
    if (!reason.trim()) return "Reason not added yet.";
    const trimmed = reason.trim();
    return trimmed.length > 90 ? trimmed.slice(0, 87) + "…" : trimmed;
  }, [reason]);

  // ── Submit with quota checks ────────────────────────
  async function submit() {
    const fromDate = from;
    const toDate = to || from;

    if (!fromDate || !toDate || !reason.trim()) {
      alert("Please select from / to dates and enter a reason.");
      return;
    }

    // compute requested days again for safety
    const reqDays = requestedDays ?? 0;
    if (reqDays <= 0) {
      alert("Please select a valid date range for your leave.");
      return;
    }

    const canEnforceQuota =
      selectedPolicy &&
      selectedPolicy.hasQuota &&
      selectedSummary &&
      typeof selectedSummary.allowed === "number";

    if (canEnforceQuota) {
      const remaining = selectedSummary.remaining ?? 0;
      const humanLabel = formatType(backendTypeKey);

      if (remaining <= 0) {
        alert(
          `Your ${humanLabel} leave quota for the current year has already been fully utilised. ` +
            `Please choose a different leave type (for example, Unpaid) or speak with HR for an exception.`,
        );
        return;
      }

      if (reqDays > remaining) {
        const remLabel = remaining.toFixed(1).replace(/\.0$/, "");
        alert(
          `You are requesting ${reqDays} day(s) of ${humanLabel} leave, ` +
            `but only ${remLabel} day(s) are available in your remaining quota. ` +
            `Please reduce the duration or select another leave type.`,
        );
        return;
      }
    }

    try {
      setSubmitting(true);

      const payload: any = {
        type: backendTypeKey, // already in backend format: CASUAL, SICK, etc.
        from: fromDate,
        to: toDate,
        reason,
        dayLength,
      };

      if (dayLength === "HALF") {
        payload.halfDay = true;
        payload.halfSession = halfSession;
      }

      if (attachment) {
        payload.attachmentName = attachment.name;
      }

      await api.post("/leave/apply", payload);
      alert("Leave applied successfully!");
      setReason("");
      setAttachment(null);
      setTo("");
      // Refresh history → also refreshes quota numbers
      await loadLeaves();
    } catch (e: any) {
      alert(e.message || "Failed to apply leave");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered history (unchanged logic, type filter now uses keys) ─────────
  const filteredLeaves = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const parseDate = (d?: string) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const fromFilterDate = parseDate(filterFrom);
    const toFilterDate = parseDate(filterTo);

    return leaves.filter((row) => {
      const rowFrom = parseDate(row.from);

      if (filterMonth === "this" && rowFrom) {
        if (rowFrom.getMonth() !== thisMonth || rowFrom.getFullYear() !== thisYear) {
          return false;
        }
      }
      if (filterMonth === "last" && rowFrom) {
        if (rowFrom.getMonth() !== lastMonth || rowFrom.getFullYear() !== lastMonthYear) {
          return false;
        }
      }

      if (fromFilterDate && rowFrom && rowFrom < fromFilterDate) return false;
      if (toFilterDate && rowFrom && rowFrom > toFilterDate) return false;

      if (filterType !== "ALL") {
        const rawType = (row.type || "").toUpperCase();
        if (rawType !== filterType.toUpperCase()) return false;
      }

      if (filterStatus !== "ALL") {
        const upper = (row.status || "").toUpperCase();
        if (upper !== filterStatus.toUpperCase()) return false;
      }

      return true;
    });
  }, [leaves, filterMonth, filterFrom, filterTo, filterType, filterStatus]);

  const lastLeave = useMemo(() => {
    if (!leaves.length) return null;
    const sorted = [...leaves].sort((a, b) => {
      const da = a.from ? new Date(a.from).getTime() : 0;
      const db = b.from ? new Date(b.from).getTime() : 0;
      return db - da;
    });
    return sorted[0];
  }, [leaves]);

  // ── UI ──────────────────────────────────────────────
  const remainingLabel =
    selectedSummary && selectedSummary.allowed != null
      ? {
          left: Math.max(selectedSummary.remaining ?? 0, 0)
            .toFixed(1)
            .replace(/\.0$/, ""),
          allowed: selectedSummary.allowed,
        }
      : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Top: Copilot layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)] items-start">
        {/* LEFT: Apply form in a glass card */}
        <div className="rounded-3xl border border-sky-100/40 bg-gradient-to-br from-[#e7f5ff] via-[#f4f8ff] to-[#eaf7ff] shadow-[0_20px_80px_rgba(15,23,42,0.15)] p-4 md:p-6">
          {/* Copilot header strip */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 shadow-sm">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                  🤖
                </span>
                <span>PlumTrips HR Copilot</span>
              </div>
              <span className="hidden text-[11px] text-slate-600 md:inline">
                Smart, policy-aware leave requests.
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Live preview on the right →
            </span>
          </div>

          <div className="mb-4">
            <h1 className="text-xl font-semibold text-[#00477f] tracking-tight">
              Apply for leave in a few clicks
            </h1>
            <p className="mt-1 text-[12px] text-slate-600">
              I’ll bridge it with your manager, attendance and payroll in the
              background — while keeping your leave wallet in sync.
            </p>
          </div>

          {/* ── BEAUTIFIED COMPACT FORM SEGMENT ─────────────────── */}
          <div className="rounded-2xl border border-white/80 bg-white/95 px-3 py-3 md:px-4 md:py-4 backdrop-blur">
            {/* Small header inside the card */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Leave details
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  Compact control panel for a single request.
                </div>
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-medium text-slate-700 border border-slate-200 shadow-sm">
                Est. duration: <span className="text-[#00477f]">{requestedDaysLabel}</span>
              </div>
            </div>

            {/* Row: type + dates */}
            <div className="grid gap-2 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">
                  Leave type
                </label>
                <div className="relative">
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 pr-8 py-1.5 text-[13px] shadow-inner shadow-white focus:outline-none focus:ring-2 focus:ring-[#00477f]/35"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {TYPE_KEY_OPTIONS.map((key) => {
                      const policy = getPolicyForType(key);
                      return (
                        <option key={key} value={key}>
                          {policy?.label || key}
                        </option>
                      );
                    })}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] text-slate-400">
                    ▼
                  </span>
                </div>
                {/* Quota info for selected type */}
                <p className="mt-1 text-[10px] text-slate-500">
                  {remainingLabel ? (
                    <>
                      You have{" "}
                      <span className="font-semibold text-[#00477f]">
                        {remainingLabel.left} day
                        {remainingLabel.left === "1" ? "" : "s"}
                      </span>{" "}
                      left out of{" "}
                      <span className="font-semibold">
                        {remainingLabel.allowed} days
                      </span>{" "}
                      for this leave type (pro-rated for your joining date).
                    </>
                  ) : selectedPolicy && selectedPolicy.hasQuota ? (
                    <>
                      I&apos;m still syncing your consumption for this leave type.
                      You&apos;ll only be able to apply within your available quota.
                    </>
                  ) : (
                    <>
                      This leave type is tracked, but quota is{" "}
                      <span className="font-semibold">flexible / policy-based</span>.
                      HR will review the request.
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">From</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-1.5 text-[13px] shadow-inner shadow-white focus:outline-none focus:ring-2 focus:ring-[#00477f]/35"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">To</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-1.5 text-[13px] shadow-inner shadow-white focus:outline-none focus:ring-2 focus:ring-[#00477f]/35"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={dayLength === "HALF" ? "Same as From" : undefined}
                />
              </div>
            </div>

            {/* Day length toggle */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-700">
                  Day length
                </span>
                <div className="flex rounded-full bg-slate-50 border border-slate-200 shadow-inner shadow-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setDayLength("FULL")}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                      dayLength === "FULL"
                        ? "bg-[#00477f] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Full day
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayLength("HALF")}
                    className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                      dayLength === "HALF"
                        ? "bg-[#00477f] text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Half day
                  </button>
                </div>
              </div>

              {dayLength === "HALF" && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">Session</span>
                  <div className="flex rounded-full bg-slate-50 border border-slate-200 shadow-inner shadow-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setHalfSession("FIRST")}
                      className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        halfSession === "FIRST"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      First half
                    </button>
                    <button
                      type="button"
                      onClick={() => setHalfSession("SECOND")}
                      className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                        halfSession === "SECOND"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Second half
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-700">
                Reason for leave
              </label>
              <textarea
                className="w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3 py-1.5 text-[13px] shadow-inner shadow-white focus:outline-none focus:ring-2 focus:ring-[#00477f]/35"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Short, clear reason so your manager can approve faster."
              />
            </div>

            {/* Upload + CTA row */}
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Tiny upload pill */}
              <div className="flex flex-col gap-1 text-[11px] max-w-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">
                    Supporting document{" "}
                    <span className="text-[10px] text-slate-400">(optional)</span>
                  </span>
                  {attachment && (
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 shadow-sm">
                    <span className="mr-1">Upload file</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setAttachment(file);
                      }}
                    />
                  </label>
                  <span className="max-w-[200px] truncate text-[10px] text-slate-500">
                    {attachment
                      ? attachment.name
                      : "Medical note, ticket copy, etc. if policy asks for it."}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Tip: Single-day leave? Set the same date in <b>From</b> and{" "}
                  <b>To</b>. For half-day, you can leave <b>To</b> blank — I’ll mirror
                  the From date.
                </p>
              </div>

              {/* CTA */}
              <div className="md:self-end">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="mt-1 rounded-full bg-[--accent] px-7 py-2 text-[12px] font-semibold text-white shadow-lg shadow-[--accent]/40 hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </div>
          </div>
          {/* ── END BEAUTIFIED SEGMENT ─────────────────────────── */}
        </div>

        {/* RIGHT: Copilot insights panel (unchanged visuals, smarter brain) */}
        <div className="rounded-3xl border border-slate-900/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.9)] text-slate-50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-100">
                Copilot insights
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                I pre-visualise the request and validate it against your leave wallet.
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-500/20 border border-sky-400/40 text-lg">
              ✨
            </div>
          </div>

          <div className="grid gap-2 text-[11px] mb-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2">
              <div>
                <div className="text-slate-400">Planned duration</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-50">
                  {requestedDaysLabel}
                </div>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] text-slate-300 border border-slate-600">
                {dayLength === "HALF" ? "Half-day included" : "Full-day request"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2">
              <div>
                <div className="text-slate-400">Window</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-50">
                  {from ? prettyDate(from) : "Select From date"}{" "}
                  <span className="text-slate-500">→</span>{" "}
                  {to || dayLength === "HALF" ? prettyDate(to || from) : "Select To date"}
                </div>
              </div>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[10px] text-sky-100 border border-sky-500/50">
                {formatType(backendTypeKey)}
              </span>
            </div>
          </div>

          {/* Quota insight chip */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 mb-4">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px]">
                📊
              </span>
              <span className="text-[11px] font-medium text-slate-200">
                Quota check for this leave type
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {remainingLabel ? (
                <>
                  You&apos;re planning{" "}
                  <span className="font-semibold">{requestedDaysLabel}</span> of{" "}
                  <span className="font-semibold">{formatType(backendTypeKey)}</span>{" "}
                  leave. Your remaining quota for this type is{" "}
                  <span className="font-semibold">
                    {remainingLabel.left} day
                    {remainingLabel.left === "1" ? "" : "s"}
                  </span>{" "}
                  out of{" "}
                  <span className="font-semibold">
                    {remainingLabel.allowed} days
                  </span>{" "}
                  for the current year (pro-rated).
                </>
              ) : (
                <>
                  I&apos;m tracking your usage, but this leave type doesn&apos;t have
                  a fixed quota or is policy-based. HR will validate the request during
                  approval.
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 mb-4">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px]">
                💬
              </span>
              <span className="text-[11px] font-medium text-slate-200">
                Draft message to your manager
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              You’re requesting{" "}
              <span className="font-semibold">{requestedDaysLabel}</span> of{" "}
              <span className="font-semibold">{formatType(backendTypeKey)}</span>{" "}
              leave from{" "}
              <span className="font-semibold">
                {from ? prettyDate(from) : "—"}
              </span>{" "}
              to{" "}
              <span className="font-semibold">
                {to || dayLength === "HALF" ? prettyDate(to || from) : "—"}
              </span>
              . Reason you’ve shared:{" "}
              <span className="italic text-slate-200">{reasonSnippet}</span>
            </p>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium">
                Recent leave on record
              </span>
              <span className="text-[10px] text-slate-500">
                Historical view from your ledger
              </span>
            </div>

            {lastLeave ? (
              <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2">
                <div>
                  <div className="text-slate-200 font-medium">
                    {formatType(lastLeave.type)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {prettyDate(lastLeave.from)} → {prettyDate(lastLeave.to)}
                  </div>
                </div>
                <span
                  className={
                    "inline-flex items-center rounded-full border px-3 py-0.5 text-[10px] font-semibold " +
                    statusClass(lastLeave.status)
                  }
                >
                  {formatStatus(lastLeave.status)}
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
                No leave history yet. Your first request will appear here for quick
                reference.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: History table with filters (same as before, types now from policy) */}
      <div className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-7 shadow-[0_26px_80px_rgba(15,23,42,0.9)] text-slate-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
          <div>
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">
              My Leave History
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Filter by month, date range, type or status to review your past requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <div className="flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 border border-slate-700/80">
              <span className="text-slate-400 mr-1">Month</span>
              {[
                { id: "all", label: "All" },
                { id: "this", label: "This" },
                { id: "last", label: "Last" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setFilterMonth(m.id as "all" | "this" | "last")}
                  className={`px-2 py-0.5 rounded-full border text-[11px] ${
                    filterMonth === m.id
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-transparent text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <select
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "ALL" | string)}
            >
              <option value="ALL">All types</option>
              {LEAVE_POLICY.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "ALL" | string)}
            >
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt.toUpperCase()}>
                  {opt}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 border border-slate-700/80">
              <span className="text-slate-400 mr-1">Range</span>
              <input
                type="date"
                className="rounded-full bg-transparent px-2 py-0.5 text-[11px] border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
              <span className="text-slate-500">→</span>
              <input
                type="date"
                className="rounded-full bg-transparent px-2 py-0.5 text-[11px] border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setFilterMonth("all");
                setFilterFrom("");
                setFilterTo("");
                setFilterType("ALL");
                setFilterStatus("ALL");
              }}
              className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-900/90">
              <tr>
                <th className="p-3 text-left font-medium text-slate-300">Type</th>
                <th className="p-3 text-left font-medium text-slate-300">From</th>
                <th className="p-3 text-left font-medium text-slate-300">To</th>
                <th className="p-3 text-left font-medium text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((r, i) => (
                <tr
                  key={r._id || i}
                  className="border-t border-slate-800/80 hover:bg-slate-900/80 transition"
                >
                  <td className="p-3">{formatType(r.type)}</td>
                  <td className="p-3">{prettyDate(r.from)}</td>
                  <td className="p-3">{prettyDate(r.to)}</td>
                  <td className="p-3">
                    <span
                      className={
                        "inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-medium " +
                        statusClass(r.status)
                      }
                    >
                      {formatStatus(r.status)}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && filteredLeaves.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={4}>
                    No leaves found for the selected filters.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td className="p-4 text-center text-slate-400" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
