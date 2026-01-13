// apps/frontend/src/pages/admin/Reports.tsx
import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type DateMode = "overall" | "month" | "range";
type Dimension = "overall" | "manager" | "department";

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== "") {
      search.set(k, v.trim());
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export default function AdminReports() {
  const { user } = useAuth();

  // ---------- role detection (for messaging only) ----------
  const roles = useMemo(() => {
    const u: any = user || {};
    const collected: string[] = [];

    if (Array.isArray(u.roles)) {
      collected.push(...u.roles);
    }

    const singleCandidates = [
      u.role,
      u.roleType,
      u.roleName,
      u.userRole,
      u.profile?.role,
    ];

    for (const r of singleCandidates) {
      if (r) collected.push(r);
    }

    if (!collected.length) collected.push("EMPLOYEE");

    return collected
      .filter(Boolean)
      .map((r: string) => String(r).toUpperCase().trim());
  }, [user]);

  const isHrOrAdmin = useMemo(
    () =>
      roles.some((r) => {
        const v = r.replace(/[\s_-]+/g, "");
        return v === "HR" || v === "ADMIN" || v === "SUPERADMIN";
      }),
    [roles]
  );

  // ---------- Filter state ----------
  const [dateMode, setDateMode] = useState<DateMode>("overall");
  const [month, setMonth] = useState<string>(""); // YYYY-MM
  const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>("");
  const [dimension, setDimension] = useState<Dimension>("overall");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  async function exportCsv(
    key: string,
    basePath: string // e.g. "/admin/reports/attendance.csv"
  ) {
    try {
      setExportingKey(key);

      const params: Record<string, string | undefined> = {
        mode: dateMode,
        dimension,
      };

      if (dateMode === "month" && month) {
        params.month = month; // backend can parse "YYYY-MM"
      } else if (dateMode === "range") {
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;
      }

      const qs = buildQuery(params);

      const res = await fetch(`${api.BASE}${basePath}${qs}`, {
        credentials: "include", // ensures cookies/JWT go along
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${key}-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Failed to export report");
    } finally {
      setExportingKey(null);
    }
  }

  const isMonthMode = dateMode === "month";
  const isRangeMode = dateMode === "range";

  return (
    <div className="grid gap-6">
      {/* HERO */}
      <section className="rounded-3xl border border-sky-100/80 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                📊
              </span>
              <span>PlumTrips HRMS · Reports</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Admin reports &amp; exports
            </h1>
            <p className="mt-1 text-[12px] text-slate-600 max-w-xl">
              Export ready-to-share CSVs for attendance, leaves and vendor
              data. Filters below apply to all downloads.
            </p>
          </div>

          <div className="text-[11px] text-slate-600 max-w-xs">
            {isHrOrAdmin ? (
              <>
                <span className="font-semibold text-emerald-700">
                  HR / Admin access.
                </span>{" "}
                Use these exports for audits, MIS and leadership reviews. Avoid
                sharing outside approved channels.
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-800">
                  Limited access.
                </span>{" "}
                Talk to HR if you need additional report types or access levels.
              </>
            )}
          </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm px-4 py-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Filters
          </p>
          <div className="flex flex-wrap gap-3 text-[12px]">
            {/* Dimension */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-500">
                Reporting view
              </label>
              <select
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] outline-none focus:border-[#00477f]"
                value={dimension}
                onChange={(e) => setDimension(e.target.value as Dimension)}
              >
                <option value="overall">Overall company</option>
                <option value="manager">By reporting manager</option>
                <option value="department">By department</option>
              </select>
            </div>

            {/* Date mode */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-500">Date range</label>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDateMode("overall")}
                  className={`px-3 py-1 rounded-full ${
                    dateMode === "overall"
                      ? "bg-[#00477f] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Overall
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("month")}
                  className={`px-3 py-1 rounded-full ${
                    dateMode === "month"
                      ? "bg-[#00477f] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("range")}
                  className={`px-3 py-1 rounded-full ${
                    dateMode === "range"
                      ? "bg-[#00477f] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Custom range
                </button>
              </div>
            </div>

            {/* Month picker */}
            {isMonthMode && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-500">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] outline-none focus:border-[#00477f]"
                />
              </div>
            )}

            {/* Range picker */}
            {isRangeMode && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500">
                    From date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] outline-none focus:border-[#00477f]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500">To date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] outline-none focus:border-[#00477f]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 max-w-xs">
          Filters are applied to all exports below. If your CSV doesn&apos;t
          reflect the expected date range, confirm that backend logic is wired
          for <code className="font-mono text-[10px]">mode</code>,{" "}
          <code className="font-mono text-[10px]">month</code>,{" "}
          <code className="font-mono text-[10px]">from</code>, and{" "}
          <code className="font-mono text-[10px]">to</code>.
        </p>
      </section>

      {/* REPORT CARDS */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Attendance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                People &amp; Attendance
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Attendance reports
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
              CSV
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Daily presence, absenteeism &amp; check-in patterns. Use this for
            monthly reviews and payroll support.
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                exportCsv(
                  "attendance-summary",
                  "/admin/reports/attendance.csv"
                )
              }
              className="rounded-full bg-[#00477f] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767] disabled:opacity-60"
              disabled={exportingKey === "attendance-summary"}
            >
              {exportingKey === "attendance-summary"
                ? "Exporting…"
                : "Export attendance"}
            </button>
          </div>
        </div>

        {/* Leaves */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Leaves &amp; time off
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Leave reports
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              CSV
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Approved, pending and rejected leaves by employee, manager or
            department.
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                exportCsv("leaves-summary", "/admin/reports/leaves.csv")
              }
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
              disabled={exportingKey === "leaves-summary"}
            >
              {exportingKey === "leaves-summary"
                ? "Exporting…"
                : "Export leaves"}
            </button>
          </div>
        </div>

        {/* Vendors */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Vendors &amp; partners
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Vendor master
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
              CSV
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Export your vendor list for finance, compliance or onboarding
            reviews.
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                exportCsv("vendors", "/admin/reports/vendors.csv")
              }
              className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-60"
              disabled={exportingKey === "vendors"}
            >
              {exportingKey === "vendors" ? "Exporting…" : "Export vendors"}
            </button>
          </div>
        </div>

        {/* Placeholder for future reports */}
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Coming soon
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Custom HR dashboards
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              We can wire additional CSVs or direct dashboard embeds here:
              performance bands, hiring funnels, cost per hire and more.
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            Talk to your tech / HR admin to define the next set of MIS reports
            you need.
          </p>
        </div>
      </section>
    </div>
  );
}
