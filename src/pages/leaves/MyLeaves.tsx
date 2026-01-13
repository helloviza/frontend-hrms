// apps/frontend/src/pages/leaves/MyLeaves.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

/* ----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | string;

type LeaveItem = {
  _id?: string;
  type?: string;
  from?: string;
  to?: string;
  status?: LeaveStatus;
  reason?: string;
  createdAt?: string;
  halfDay?: boolean;
};

type LeavePolicyEntry = {
  key: string; // CASUAL, SICK, PAID, etc.
  label: string;
  annual: number | null; // days/year (null => no fixed quota)
  hasQuota: boolean; // whether we consider quota in UI
  colorClass: string;
};

type LeaveSummaryPerType = {
  type: string;
  label: string;
  allowed: number | null; // pro-rata; null => unlimited/flexible
  used: number;
  pending: number;
  remaining: number | null; // null => N/A
  colorClass: string;
};

type LeaveSummary = {
  year: number;
  joinDate?: string | null;
  totalUsed: number;
  totalPending: number;
  types: LeaveSummaryPerType[];
};

/* ----------------------------------------------------------------------------
 * Policy – can later be driven from backend
 * -------------------------------------------------------------------------- */

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
    annual: null, // law-driven special case
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

/* ----------------------------------------------------------------------------
 * Helper functions
 * -------------------------------------------------------------------------- */

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

function diffDaysInclusive(
  from?: string,
  to?: string,
  halfDay?: boolean,
): number {
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

function getPolicyForType(
  typeKey: string | undefined,
): LeavePolicyEntry | undefined {
  if (!typeKey) return undefined;
  const key = typeKey.toUpperCase();
  return LEAVE_POLICY.find((p) => p.key === key);
}

function buildLeaveSummary(leaves: LeaveItem[], user: any): LeaveSummary {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);

  const joinDate = resolveJoinDate(user);
  const effectiveStart = joinDate && joinDate > yearStart ? joinDate : yearStart;

  const monthsWorked = computeMonthsWorked(effectiveStart, now);
  const ratio = monthsWorked / 12; // 0..1

  const map: Record<string, LeaveSummaryPerType> = {};

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

  let totalUsed = 0;
  let totalPending = 0;

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
      totalUsed += days;
    } else if (status === "PENDING") {
      map[tKey].pending += days;
      totalPending += days;
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

  const types = Object.values(map).sort((a, b) => a.label.localeCompare(b.label));

  return {
    year,
    joinDate: joinDate ? joinDate.toISOString().slice(0, 10) : null,
    totalUsed,
    totalPending,
    types,
  };
}

/* ----------------------------------------------------------------------------
 * Filters helpers for history
 * -------------------------------------------------------------------------- */

function monthKeyFromDate(dateStr?: string): string | null {
  const d = safeDateFromYmd(dateStr);
  if (!d) return null;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad(m)}`;
}

/* ----------------------------------------------------------------------------
 * Component
 * -------------------------------------------------------------------------- */

export default function MyLeaves() {
  const { user } = useAuth();

  const roles: string[] = useMemo(() => {
    const rawRoles = Array.isArray((user as any)?.roles)
      ? (user as any).roles
      : (user as any)?.role
      ? [(user as any).role]
      : ["EMPLOYEE"];
    return rawRoles
      .filter(Boolean)
      .map((r: string) => String(r).toUpperCase());
  }, [user]);

  const isBusinessOrVendor = roles.some(
    (r) => r === "BUSINESS" || r === "VENDOR",
  );

  // 🔐 Only Admin & SuperAdmin can allocate / adjust leave
  const canAllocateLeave = roles.some(
    (r) => r === "ADMIN" || r === "SUPERADMIN",
  );

  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(false);

  // History filters
  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  async function loadLeaves() {
    try {
      setLoading(true);
      const resp = (await api.get("/leave/my")) as
        | { items?: LeaveItem[] }
        | LeaveItem[];
      const items = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? ((resp as any).items as LeaveItem[])
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

  const summary = useMemo(
    () => buildLeaveSummary(leaves, user),
    [leaves, user],
  );

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of leaves) {
      const mk = monthKeyFromDate(l.from);
      if (mk) set.add(mk);
    }
    return Array.from(set).sort();
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return (leaves || []).filter((l) => {
      const tKey = normalizeType(l.type);
      const status = normalizeStatus(l.status);
      const d = safeDateFromYmd(l.from);

      if (filterType !== "ALL" && tKey !== filterType) return false;
      if (filterStatus !== "ALL" && status !== filterStatus) return false;

      const fromKey = monthKeyFromDate(l.from);
      if (filterMonth !== "ALL" && fromKey !== filterMonth) return false;

      if (filterFrom) {
        const f = safeDateFromYmd(filterFrom);
        if (f && d && d < f) return false;
      }
      if (filterTo) {
        const t = safeDateFromYmd(filterTo);
        if (t && d && d > t) return false;
      }

      return true;
    });
  }, [leaves, filterMonth, filterType, filterStatus, filterFrom, filterTo]);

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    (user as any)?.email ||
    "there";

  /* ------------------------------------------------------------------------ */

  if (isBusinessOrVendor) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-3xl border border-amber-100 bg-amber-50 px-6 py-5 shadow-sm">
          <h1 className="text-xl font-semibold text-[#00477f]">
            Leave tracking is for internal employees only
          </h1>
          <p className="mt-2 text-sm text-amber-800 max-w-2xl">
            Your account is currently registered as a{" "}
            <span className="font-semibold">Business / Vendor</span> profile.
            Leave balances and HR attendance are only maintained for internal
            Plumtrips employees. If this seems incorrect, please contact HR to
            update your role.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Top: Copilot hero + summary + CTA to Apply page */}
      <div className="rounded-3xl border border-sky-100/70 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                🧠
              </span>
              <span>Plumtrips HR Copilot · Leave Wallet</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Your leave availability for {summary.year}
            </h1>
            <p className="mt-1 text-xs text-slate-600 max-w-xl">
              Hi {displayName}, this is your live view of leave consumption —
              approved days, pending requests and remaining quota across leave
              types. Think of it as your personal leave wallet.
            </p>
            {summary.joinDate && (
              <p className="mt-1 text-[11px] text-slate-500">
                Quotas are auto-calculated on a{" "}
                <span className="font-medium">pro-rata basis</span> from your
                joining date:{" "}
                <span className="font-medium">{summary.joinDate}</span>.
              </p>
            )}

            {canAllocateLeave ? (
              <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
                As an <span className="font-semibold">Admin / SuperAdmin</span>,
                you control{" "}
                <span className="font-semibold">leave allocation & quotas</span>{" "}
                for employees. In this first version, numbers shown here are{" "}
                <span className="font-medium">policy-based + pro-rata</span>.
                Use the Leave Control Panel below to move towards a more
                granular allocation model.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
                Leave <span className="font-semibold">allocation</span> and
                quota overrides are controlled centrally by{" "}
                <span className="font-semibold">Admin / SuperAdmin</span>{" "}
                accounts. This page shows your leave availability as per
                company policy with pro-rata quotas. If your balance looks off,
                please contact HR / Admin.
              </p>
            )}
          </div>

          {/* CTA to Apply Leave page */}
          <div className="flex flex-col items-start md:items-end gap-2 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm max-w-xs text-left md:text-right">
              <div className="text-[11px] font-medium text-slate-700">
                Ready to request time off?
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                You can only apply within your available quota from here.
              </p>
            </div>
            <Link
              to="/leaves/apply"
              className="inline-flex items-center justify-center rounded-full bg-[--accent] px-5 py-2 text-[12px] font-semibold text-white shadow-lg shadow-[--accent]/40 hover:opacity-90"
            >
              Open AI Leave Copilot
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <KpiCard
            title="Approved usage"
            value={`${summary.totalUsed.toFixed(1).replace(/\.0$/, "")} d`}
            caption="Total approved leave days consumed this year."
          />
          <KpiCard
            title="Pending in workflow"
            value={`${summary.totalPending.toFixed(1).replace(/\.0$/, "")} d`}
            caption="Awaiting manager / HR approval."
          />
          <KpiCard
            title="Tracked leave types"
            value={`${summary.types.length}`}
            caption="All categories being monitored for you."
          />
        </div>

        {/* 🔐 Admin / SuperAdmin-only Leave Control Panel teaser */}
        {canAllocateLeave && (
          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 shadow-sm text-[11px] text-slate-800 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-[2px] text-[10px] font-semibold text-indigo-800">
                <span>⚙️</span>
                <span>Leave Control Panel · Admin</span>
              </div>
              <p className="mt-2">
                From the Leave Control Panel you&apos;ll be able to:
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[10px] text-slate-700">
                <li>See every employee&apos;s annual leave allocation.</li>
                <li>Adjust quotas for specific people or departments.</li>
                <li>Upload / import allocation from Excel sheets.</li>
                <li>Review summary by department and role.</li>
              </ul>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <Link
                to="/admin/leaves/allocation"
                className="inline-flex items-center justify-center rounded-full bg-[#00477f] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003360]"
              >
                Open Leave Control Panel
              </Link>
              <p className="text-[10px] text-slate-600 max-w-xs text-left md:text-right">
                This link points to{" "}
                <code className="bg-indigo-100 px-1 py-[1px] rounded">
                  /admin/leaves/allocation
                </code>
                . You can wire that route to a full admin screen when ready;
                until then, this block makes the admin capability visible and
                discoverable.
              </p>
            </div>
          </div>
        )}

        {/* Per-type leave chips */}
        <div className="mt-4 space-y-2">
          {summary.types.map((t) => (
            <div
              key={t.type}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-3 py-2 text-[11px] shadow-sm border border-slate-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${t.colorClass} text-[10px] text-white`}
                >
                  {t.type.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">
                    {t.label}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {typeof t.allowed === "number" ? (
                      <>
                        {t.used.toFixed(1).replace(/\.0$/, "")} used ·{" "}
                        {t.pending.toFixed(1).replace(/\.0$/, "")} pending ·{" "}
                        <span className="font-medium">
                          {Math.max(t.remaining ?? 0, 0)
                            .toFixed(1)
                            .replace(/\.0$/, "")}{" "}
                          left
                        </span>{" "}
                        from{" "}
                        <span className="font-medium">
                          {t.allowed} d/year
                        </span>{" "}
                        quota (pro-rata).
                      </>
                    ) : (
                      <>
                        {t.used.toFixed(1).replace(/\.0$/, "")} used ·{" "}
                        {t.pending.toFixed(1).replace(/\.0$/, "")} pending ·{" "}
                        <span className="font-medium">
                          flexible / policy-based quota
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {typeof t.remaining === "number" && (
                <div className="flex flex-col items-end text-[10px] text-slate-700">
                  <div className="w-24 h-[6px] rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[--accent]"
                      style={{
                        width: `${
                          t.allowed && t.allowed > 0
                            ? Math.min(
                                100,
                                ((t.used + t.pending) / t.allowed) * 100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="mt-1">
                    {(t.used + t.pending).toFixed(1).replace(/\.0$/, "")} /{" "}
                    {t.allowed} d booked
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* History + filters */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Leave history & consumption ledger
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              This is the audit trail of every leave request you’ve raised —
              across types, dates and statuses. Use the filters to slice it
              however you like.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            >
              <option value="ALL">All months</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            >
              <option value="ALL">All types</option>
              {LEAVE_POLICY.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            >
              <option value="ALL">All status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            />
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            />

            <button
              type="button"
              onClick={() => {
                setFilterMonth("ALL");
                setFilterType("ALL");
                setFilterStatus("ALL");
                setFilterFrom("");
                setFilterTo("");
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px] text-[11px] hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </div>

        {/* History table */}
        <div className="mt-4 overflow-auto rounded-2xl border border-slate-100">
          <table className="w-full text-[11px] md:text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Type
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Dates
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Days
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Status
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Applied on
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.map((l, idx) => {
                const tKey = normalizeType(l.type);
                const policy = getPolicyForType(tKey);
                const label = policy?.label || l.type || "Leave";
                const status = normalizeStatus(l.status);
                const days = diffDaysInclusive(l.from, l.to, l.halfDay);

                let statusClass =
                  "bg-amber-50 text-amber-700 border border-amber-200";
                if (status === "APPROVED") {
                  statusClass =
                    "bg-emerald-50 text-emerald-700 border border-emerald-200";
                } else if (status === "REJECTED") {
                  statusClass =
                    "bg-rose-50 text-rose-700 border border-rose-200";
                }

                const created = l.createdAt
                  ? new Date(l.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                const dateLabel =
                  l.from && l.to && l.to !== l.from
                    ? `${l.from} → ${l.to}`
                    : l.from || "—";

                return (
                  <tr
                    key={l._id || idx}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-[2px] text-[11px] text-slate-700">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            policy?.colorClass || "bg-slate-400"
                          }`}
                        />
                        {label}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dateLabel}</td>
                    <td className="p-3 whitespace-nowrap">
                      {days ? days.toFixed(1).replace(/\.0$/, "") : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 py-[2px] text-[11px] ${statusClass}`}
                      >
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{created}</td>
                    <td className="p-3 max-w-xs">
                      <span className="line-clamp-2 text-[11px] text-slate-600">
                        {l.reason || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredLeaves.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-[11px] text-slate-500"
                  >
                    No leave records match your current filters.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-[11px] text-slate-500"
                  >
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

/* ----------------------------------------------------------------------------
 * Small KPI card
 * -------------------------------------------------------------------------- */

function KpiCard(props: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-2xl bg-white/90 px-3 py-2 shadow-sm border border-slate-100 flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-600">
        {props.title}
      </span>
      <span className="text-lg font-semibold text-slate-900 leading-none">
        {props.value}
      </span>
      <span className="text-[10px] text-slate-500">{props.caption}</span>
    </div>
  );
}
