// apps/frontend/src/pages/holidays/Holidays.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type RawHoliday = {
  _id?: string;
  date?: string; // YYYY-MM-DD or ISO
  name?: string;
  type?: string; // GENERAL / OPTIONAL / etc.
  description?: string;
  region?: string;
  location?: string;
  country?: string;
  isOptional?: boolean;
};

type HolidayType = "GENERAL" | "OPTIONAL" | "OTHER";

type Holiday = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  description?: string;
  region?: string;
};

/* -------------------------------------------------------------------------- */
/* Fallback static list (used when /api/holidays is not available)            */
/* -------------------------------------------------------------------------- */

const STATIC_HOLIDAYS: RawHoliday[] = [
  {
    date: "2025-01-01",
    name: "New Year’s Day",
    type: "GENERAL",
    description: "Company-wide holiday to welcome the new year.",
  },
  {
    date: "2025-01-26",
    name: "Republic Day",
    type: "GENERAL",
    description: "National holiday (India).",
  },
  {
    date: "2025-03-14",
    name: "Optional Festival Holiday",
    type: "OPTIONAL",
    description: "Choose based on your region / religion with manager approval.",
  },
  {
    date: "2025-08-15",
    name: "Independence Day",
    type: "GENERAL",
    description: "National holiday (India).",
  },
  {
    date: "2025-10-20",
    name: "Diwali (Optional)",
    type: "OPTIONAL",
    description: "Festival of lights – choose as per policy.",
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDateFromYmd(ymd?: string): Date | null {
  if (!ymd) return null;
  const str = ymd.length >= 10 ? ymd.slice(0, 10) : ymd;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad(m)}-${pad(day)}`;
}

function normalizeType(raw?: string, isOptionalFlag?: boolean): HolidayType {
  if (isOptionalFlag) return "OPTIONAL";
  const t = (raw || "").toUpperCase().trim();
  if (!t) return "GENERAL"; // default
  if (t.includes("OPTION")) return "OPTIONAL";
  if (
    t === "GENERAL" ||
    t.includes("PUBLIC") ||
    t.includes("NATIONAL") ||
    t.includes("GAZETTED") ||
    t.includes("COMPANY")
  ) {
    return "GENERAL";
  }
  return "OTHER";
}

function mapRawHoliday(h: RawHoliday, idx: number): Holiday | null {
  const dateObj = safeDateFromYmd(h.date);
  if (!dateObj) return null;
  const date = toYmd(dateObj);
  const name = (h.name || "Holiday").trim();
  const type = normalizeType(h.type, h.isOptional);
  const region =
    h.region || h.location || h.country || "All locations / Company-wide";

  return {
    id: h._id || `${date}-${idx}`,
    date,
    name,
    type,
    description: h.description,
    region,
  };
}

function dayOfWeekLabel(dateStr: string): string {
  const d = safeDateFromYmd(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
  });
}

function monthYearLabel(dateStr: string): string {
  const d = safeDateFromYmd(dateStr);
  if (!d) return "";
  return d.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Holidays() {
  const { user } = useAuth();

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // filters
  const [filterType, setFilterType] = useState<"ALL" | HolidayType>("ALL");
  const [filterYear, setFilterYear] = useState<string>("CURRENT");
  const [search, setSearch] = useState<string>("");

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    (user as any)?.email ||
    "there";

  /* -------------------- robust role detection -------------------- */
  const roles: string[] = useMemo(() => {
    const u: any = user || {};
    const collected: string[] = [];

    // array-based roles
    if (Array.isArray(u.roles)) {
      collected.push(...u.roles);
    }

    // single-value role fields we’ve used in other pages
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

  const canManageHolidays = useMemo(
    () =>
      roles.some((r) => {
        const v = r.replace(/[\s_-]+/g, "");
        // Admin + SuperAdmin only, as per requirement
        return v === "ADMIN" || v === "SUPERADMIN";
      }),
    [roles],
  );

  async function load() {
    setLoading(true);
    setUsingFallback(false);

    try {
      const resp = (await api.get("/holidays")) as
        | { items?: RawHoliday[] }
        | RawHoliday[];

      const list: RawHoliday[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? ((resp as any).items as RawHoliday[])
        : [];

      if (!list.length) {
        // No data from API – fallback to static
        setUsingFallback(true);
        setHolidays(
          STATIC_HOLIDAYS.map(mapRawHoliday).filter(Boolean) as Holiday[],
        );
      } else {
        const mapped = list
          .map(mapRawHoliday)
          .filter(Boolean) as Holiday[];
        mapped.sort((a, b) => {
          const da = safeDateFromYmd(a.date)?.getTime() ?? 0;
          const db = safeDateFromYmd(b.date)?.getTime() ?? 0;
          return da - db;
        });
        setHolidays(mapped);
      }
    } catch (e) {
      // Backend route likely missing (/api/holidays 404) – use static data silently
      console.warn("Holiday API not available, using fallback:", e);
      setUsingFallback(true);
      const mapped = STATIC_HOLIDAYS.map(mapRawHoliday).filter(
        Boolean,
      ) as Holiday[];
      mapped.sort((a, b) => {
        const da = safeDateFromYmd(a.date)?.getTime() ?? 0;
        const db = safeDateFromYmd(b.date)?.getTime() ?? 0;
        return da - db;
      });
      setHolidays(mapped);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    holidays.forEach((h) => {
      const d = safeDateFromYmd(h.date);
      if (!d) return;
      years.add(d.getFullYear());
    });
    const arr = Array.from(years).sort((a, b) => a - b);
    if (!arr.includes(currentYear)) arr.push(currentYear);
    return arr;
  }, [holidays, currentYear]);

  const upcoming = useMemo(() => {
    const todayYmd = toYmd(now);
    const upcomingList = holidays.filter(
      (h) => h.date >= todayYmd && h.type !== "OTHER",
    );
    const nextGeneral = upcomingList.find((h) => h.type === "GENERAL");
    const nextOptional = upcomingList.find((h) => h.type === "OPTIONAL");
    return { nextGeneral, nextOptional, count: upcomingList.length };
  }, [holidays, now]);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const currentYearStr = String(currentYear);

    return holidays.filter((h) => {
      const d = safeDateFromYmd(h.date);
      const yearStr = d ? String(d.getFullYear()) : "";

      if (filterYear === "CURRENT" && yearStr && yearStr !== currentYearStr) {
        return false;
      }
      if (filterYear !== "CURRENT" && filterYear !== "ALL") {
        if (yearStr && yearStr !== filterYear) return false;
      }

      if (filterType !== "ALL" && h.type !== filterType) return false;

      if (searchLower) {
        const hay =
          `${h.name} ${h.description || ""} ${h.region || ""}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }

      return true;
    });
  }, [holidays, filterType, filterYear, search, currentYear]);

  // group by month label
  const groupedByMonth = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of filtered) {
      const label = monthYearLabel(h.date) || "Unknown month";
      if (!map[label]) map[label] = [];
      map[label].push(h);
    }
    return map;
  }, [filtered]);

  /* ------------------------------------------------------------------------ */

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Hero / Copilot intro */}
      <div className="rounded-3xl border border-sky-100/70 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                📅
              </span>
              <span>Plumtrips HR Copilot · Holiday Calendar</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Company holidays — General &amp; Optional
            </h1>
            <p className="mt-1 text-xs text-slate-600 max-w-xl">
              Hi {displayName}, this is your AI-assisted view of{" "}
              <span className="font-medium">official holidays</span> for the
              year — neatly split into{" "}
              <span className="font-semibold">General holidays</span> (everyone
              is off) and{" "}
              <span className="font-semibold">Optional holidays</span> (you can
              choose based on policy &amp; manager approval).
            </p>
            <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
              Use the filters on the right to explore by year, type or keyword.
              I&apos;ll highlight your next upcoming break and help you plan
              long weekends smartly.
            </p>
          </div>

          {/* Right side – admin CTA + upcoming highlights */}
          <div className="flex flex-col items-start md:items-end gap-2 text-xs">
            {canManageHolidays && (
              <Link
                to="/holidays/admin"
                className="inline-flex items-center justify-center self-end rounded-full bg-[#00477f] px-4 py-2 text-[11px] font-semibold text-white shadow-lg shadow-[#00477f]/40 hover:bg-[#003767]"
              >
                ⚙️ Manage holidays (Admin)
              </Link>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm max-w-xs">
              <div className="text-[11px] font-medium text-slate-700">
                Next upcoming breaks
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                {upcoming.nextGeneral ? (
                  <div>
                    <span className="font-semibold text-[#00477f]">
                      General:
                    </span>{" "}
                    {upcoming.nextGeneral.name}{" "}
                    <span className="text-slate-500">
                      · {upcoming.nextGeneral.date} (
                      {dayOfWeekLabel(upcoming.nextGeneral.date)})
                    </span>
                  </div>
                ) : (
                  <div>No upcoming general holiday found.</div>
                )}
                {upcoming.nextOptional ? (
                  <div>
                    <span className="font-semibold text-[#00477f]">
                      Optional:
                    </span>{" "}
                    {upcoming.nextOptional.name}{" "}
                    <span className="text-slate-500">
                      · {upcoming.nextOptional.date} (
                      {dayOfWeekLabel(upcoming.nextOptional.date)})
                    </span>
                  </div>
                ) : (
                  <div>No upcoming optional holiday found.</div>
                )}
                <div className="mt-1 text-[10px] text-slate-500">
                  Total upcoming (general + optional):{" "}
                  <span className="font-semibold">{upcoming.count || 0}</span>
                </div>
              </div>
            </div>

            {/* Small explainer chip */}
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[10px] text-slate-600 shadow-sm max-w-xs text-left">
              General = everyone off · Optional ={" "}
              <span className="font-medium">
                choose with manager approval
              </span>{" "}
              as per policy.
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <KpiCard
            title="Total holidays listed"
            value={holidays.length.toString()}
            caption="Configured in your HR policy for this year (or static defaults)."
          />
          <KpiCard
            title="General holidays"
            value={holidays
              .filter((h) => h.type === "GENERAL")
              .length.toString()}
            caption="Company-wide mandatory off days."
          />
          <KpiCard
            title="Optional holidays"
            value={holidays
              .filter((h) => h.type === "OPTIONAL")
              .length.toString()}
            caption="Pick as per your religion / region / manager approval."
          />
        </div>

        {usingFallback && (
          <p className="mt-3 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 inline-block">
            Holiday API is not configured yet, so I&apos;m showing a{" "}
            <span className="font-semibold">static sample calendar</span>.
            Once /api/holidays is available, this page will automatically use
            live data.
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Smart filters
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              Filter holidays by year, category and keyword. I’ll keep the
              timeline below clean so you can quickly spot clusters, long
              weekends and regional breaks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {/* Year filter */}
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px]"
            >
              <option value="CURRENT">Current year</option>
              <option value="ALL">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>

            {/* Type filter */}
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1 py-[2px]">
              <button
                type="button"
                onClick={() => setFilterType("ALL")}
                className={`px-3 py-[4px] rounded-full ${
                  filterType === "ALL"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("GENERAL")}
                className={`px-3 py-[4px] rounded-full ${
                  filterType === "GENERAL"
                    ? "bg-emerald-100 text-emerald-800 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setFilterType("OPTIONAL")}
                className={`px-3 py-[4px] rounded-full ${
                  filterType === "OPTIONAL"
                    ? "bg-amber-100 text-amber-800 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Optional
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name / region…"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px] min-w-[180px]"
            />

            <button
              type="button"
              onClick={() => {
                setFilterType("ALL");
                setFilterYear("CURRENT");
                setSearch("");
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-[6px] hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-[11px] text-slate-500 mt-1">
            Loading holiday calendar…
          </p>
        )}
      </div>

      {/* Timeline / grouped view */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
        {filtered.length === 0 && !loading && (
          <div className="text-center text-[11px] text-slate-500 py-6">
            No holidays match your current filters. If you think something is
            missing, please check with HR or update the holidays master.
          </div>
        )}

        {Object.entries(groupedByMonth).map(([monthLabel, list]) => (
          <div key={monthLabel} className="mb-6 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] flex-1 bg-slate-200" />
              <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                {monthLabel}
              </div>
              <div className="h-[1px] flex-1 bg-slate-200" />
            </div>

            <div className="space-y-2">
              {list.map((h) => (
                <HolidayRow key={h.id} holiday={h} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

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

function HolidayRow({ holiday }: { holiday: Holiday }) {
  const d = safeDateFromYmd(holiday.date);
  const dateLabel = d
    ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : holiday.date;

  const weekday = dayOfWeekLabel(holiday.date);

  let typeClass =
    "bg-slate-50 text-slate-700 border border-slate-200 text-[11px]";
  let typeLabel = "Other / Policy-defined";

  if (holiday.type === "GENERAL") {
    typeClass =
      "bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]";
    typeLabel = "General holiday";
  } else if (holiday.type === "OPTIONAL") {
    typeClass =
      "bg-amber-50 text-amber-700 border border-amber-200 text-[11px]";
    typeLabel = "Optional holiday";
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 hover:bg-slate-50 transition">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col items-center justify-center rounded-xl bg-white px-3 py-2 border border-slate-200 text-[11px] text-slate-800">
          <span className="text-xs font-semibold">{weekday}</span>
          <span className="text-[11px]">{dateLabel}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-900 truncate">
              {holiday.name}
            </span>
            <span className={`inline-flex rounded-full px-2 py-[2px] ${typeClass}`}>
              {typeLabel}
            </span>
          </div>
          <div className="mt-[2px] text-[10px] text-slate-500">
            {holiday.region || "All locations / Company-wide"}
          </div>
          {holiday.description && (
            <div className="mt-[2px] text-[10px] text-slate-600 line-clamp-2">
              {holiday.description}
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-col items-end text-[10px] text-slate-500">
        {holiday.type === "OPTIONAL" ? (
          <>
            <span className="font-medium text-amber-700">
              Optional · needs leave request
            </span>
            <span>
              Apply via Leave Copilot and choose this date as{" "}
              <span className="font-semibold">Optional Holiday</span>.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-emerald-700">
              Company-wide off
            </span>
            <span>Attendance punches are auto-marked as holiday.</span>
          </>
        )}
      </div>
    </div>
  );
}
