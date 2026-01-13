// apps/frontend/src/pages/admin/Analytics.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type KpiResponse = Record<string, any>;

type PeriodType = "overall" | "month" | "range";
type DimensionType = "overall" | "manager" | "department";

export default function AdminAnalytics() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiResponse>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [periodType, setPeriodType] = useState<PeriodType>("overall");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [dimension, setDimension] = useState<DimensionType>("overall");

  // derive display name
  const displayName = useMemo(() => {
    const raw = (user as any)?.name || (user as any)?.fullName || user?.email;
    if (!raw) return "Admin";
    const trimmed = String(raw).trim();
    if (!trimmed) return "Admin";
    return trimmed.split(/\s+/)[0];
  }, [user]);

  // Build query string for backend – backend can ignore filters it doesn’t use
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (dimension && dimension !== "overall") {
      params.set("dimension", dimension); // e.g. manager / department
    }

    if (periodType === "month" && selectedMonth) {
      params.set("mode", "month");
      params.set("month", selectedMonth); // e.g. 2025-11
    } else if (periodType === "range" && (fromDate || toDate)) {
      params.set("mode", "range");
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
    } else {
      params.set("mode", "overall");
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [periodType, selectedMonth, fromDate, toDate, dimension]);

  // Load analytics whenever filters change
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<KpiResponse>("/admin/analytics" + queryString);
        if (!cancelled) {
          setKpis(data || {});
        }
      } catch (e: any) {
        console.error("Failed to load analytics:", e);
        if (!cancelled) {
          setError(e?.message || "Failed to load analytics");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const metricNames = ["attrition", "absenteeism", "headcount", "vendors"];

  const breakdown =
    (Array.isArray(kpis?.breakdown) ? (kpis.breakdown as any[]) : []) || [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#020617] via-[#020b16] to-[#020617] text-slate-50 px-4 py-6 md:px-6 lg:px-10">
      {/* Top hero */}
      <section className="mb-6 rounded-3xl border border-cyan-500/40 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.2),transparent_55%)] px-5 py-5 md:px-7 md:py-6 shadow-[0_22px_80px_rgba(8,47,73,0.9)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-950/60 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.4)]" />
              PlumTrips HRMS · Admin Analytics
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-slate-50">
              People &amp; HR analytics
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-300 max-w-2xl">
              Hi <span className="font-semibold text-cyan-200">{displayName}</span>,
              track attrition, absenteeism, headcount and vendor health. Use the
              filters to slice data by month, date range or reporting line.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950/60 border border-slate-700 px-4 py-3 text-xs max-w-xs">
            <p className="text-slate-400 text-[11px] uppercase tracking-[0.2em] mb-1">
              Snapshot
            </p>
            <p className="text-slate-100">
              {loading
                ? "Refreshing analytics…"
                : "Numbers are based on the latest HR events synced into the system."}
            </p>
          </div>
        </div>
      </section>

      {/* Filters bar */}
      <section className="mb-6 rounded-3xl bg-slate-950/70 border border-slate-800 px-4 py-4 md:px-5 md:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Period selector */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Time window
          </span>
          <div className="flex flex-wrap gap-2 mt-1 md:mt-0">
            {([
              ["overall", "Overall"],
              ["month", "This month / specific month"],
              ["range", "Custom range"],
            ] as [PeriodType, string][]).map(([value, label]) => {
              const active = periodType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriodType(value)}
                  className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                    active
                      ? "bg-cyan-500 text-slate-950 font-semibold shadow-[0_0_0_1px_rgba(8,145,178,0.9)]"
                      : "bg-slate-900/80 text-slate-300 border border-slate-700 hover:border-cyan-400/70"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Period controls */}
        <div className="flex flex-wrap gap-3 items-center">
          {periodType === "month" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Month</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {periodType === "range" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">From</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">To</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-cyan-400"
                />
              </div>
            </>
          )}

          {/* Reporting / dimension selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Reporting view</span>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as DimensionType)}
              className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-cyan-400"
            >
              <option value="overall">Overall org</option>
              <option value="manager">By manager</option>
              <option value="department">By department</option>
            </select>
          </div>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
          <p className="font-semibold mb-1">Analytics error</p>
          <p>{error}</p>
        </div>
      )}

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        {metricNames.map((key) => {
          const value = kpis?.[key];
          const label =
            key === "attrition"
              ? "Attrition %"
              : key === "absenteeism"
              ? "Absenteeism %"
              : key === "headcount"
              ? "Active headcount"
              : key === "vendors"
              ? "Active vendors"
              : key;

          return (
            <div
              key={key}
              className="relative overflow-hidden rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.9)]"
            >
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="w-full h-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.26),transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.2),transparent_55%)]" />
              </div>
              <div className="relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {label}
                  </p>
                  <span className="rounded-full bg-slate-900/70 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                    {dimension === "overall"
                      ? "Overall"
                      : dimension === "manager"
                      ? "By manager"
                      : "By dept"}
                  </span>
                </div>
                <p className="text-3xl font-semibold text-cyan-300">
                  {value ?? (loading ? "…" : "—")}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Breakdown table (optional – only if backend sends kpis.breakdown as array) */}
      {breakdown.length > 0 && (
        <section className="rounded-3xl bg-slate-950/70 border border-slate-800 px-4 py-4 md:px-6 md:py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                {dimension === "manager"
                  ? "Reporting line – manager view"
                  : dimension === "department"
                  ? "Reporting line – department view"
                  : "Org breakdown"}
              </p>
              <p className="text-sm text-slate-100 mt-1">
                Highest impact segments based on current filters.
              </p>
            </div>
            <span className="hidden md:inline-flex text-[10px] rounded-full bg-slate-900/70 border border-slate-700 px-3 py-1 text-slate-300">
              {breakdown.length} rows
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4 text-left font-normal">Segment</th>
                  <th className="py-2 px-4 text-right font-normal">
                    Headcount
                  </th>
                  <th className="py-2 px-4 text-right font-normal">
                    Attrition %
                  </th>
                  <th className="py-2 pl-4 text-right font-normal">
                    Absenteeism %
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-900/80 last:border-0 hover:bg-slate-900/50"
                  >
                    <td className="py-2 pr-4 text-slate-100">
                      {row.label || row.name || "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-slate-100">
                      {row.headcount ?? row.headCount ?? "—"}
                    </td>
                    <td className="py-2 px-4 text-right text-emerald-300">
                      {row.attrition ?? "—"}
                    </td>
                    <td className="py-2 pl-4 text-right text-cyan-300">
                      {row.absenteeism ?? row.absence ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[10px] text-slate-500">
            Tip: use the time window and reporting filters above to compare how
            different managers or departments are trending month-on-month.
          </p>
        </section>
      )}
    </div>
  );
}
