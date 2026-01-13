// apps/frontend/src/pages/attendance/Reports.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type PunchEntry = {
  ts?: string;
  type?: string; // "IN" | "OUT"
  geo?: any;
};

type AttendanceItem = {
  _id?: string;
  userId?: string;
  date?: string; // "YYYY-MM-DD"
  punches?: PunchEntry[];
};

type LeaveItem = {
  _id?: string;
  type?: string;
  from?: string;
  to?: string;
  status?: string;
};

type DayStatus = "PRESENT" | "HALF" | "LEAVE" | "MISSING" | "UPCOMING";

type CalendarDay = {
  dayKey: string;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
  firstIn?: PunchEntry;
  lastOut?: PunchEntry;
  leaveType?: string;
  hours?: number;
};

// ============================================================================
// SHARED HELPERS
// ============================================================================

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad(m)}-${pad(day)}`;
}

function keyFromDateStr(s?: string): string {
  if (!s) return "";
  if (s.length >= 10) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return toYMD(d);
}

function timeLabel(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeHours(punches: PunchEntry[] | undefined): number {
  if (!punches || !punches.length) return 0;

  const ins = punches.filter(
    (p) => (p.type || "").toUpperCase() === "IN",
  );
  const outs = punches.filter(
    (p) => (p.type || "").toUpperCase() === "OUT",
  );
  if (!ins.length || !outs.length) return 0;

  const firstIn = ins[0];
  const lastOut = outs[outs.length - 1];

  const firstInTs = firstIn?.ts
    ? new Date(firstIn.ts as string | number | Date).getTime()
    : NaN;

  const lastOutTs = lastOut?.ts
    ? new Date(lastOut.ts as string | number | Date).getTime()
    : NaN;

  if (
    Number.isNaN(firstInTs) ||
    Number.isNaN(lastOutTs) ||
    lastOutTs <= firstInTs
  ) {
    return 0;
  }

  const diffMs = lastOutTs - firstInTs;
  return diffMs / (1000 * 60 * 60); // hours
}

// ============================================================================
// ROOT – TABBED LAYOUT: My calendar / Team & exports
// ============================================================================

export default function AttendanceReports() {
  const { user } = useAuth();

  const rawRole =
    (user as any)?.role ||
    (user as any)?.profile?.role ||
    (user as any)?.roleType ||
    (user as any)?.roleName ||
    (user as any)?.userRole ||
    "";

  const normRole = String(rawRole).trim().toLowerCase();

  const isManagerLike =
    normRole === "admin" ||
    normRole === "manager" ||
    normRole === "hr" ||
    normRole === "lead" ||
    normRole === "team_lead" ||
    normRole === "team-lead" ||
    normRole === "superadmin" ||
    normRole === "super-admin" ||
    normRole === "owner";

  // who can actually see download buttons
  const canDownload =
    isManagerLike || normRole === "" /* temp: allow when role is missing */;

  const [activeTab, setActiveTab] = useState<"ME" | "TEAM">(
    isManagerLike ? "TEAM" : "ME",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Tiny tab switcher on top */}
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-1 py-1 text-xs shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("ME")}
          className={`rounded-full px-3 py-1 transition ${
            activeTab === "ME"
              ? "bg-[#00477f] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          My calendar
        </button>

        {/* 🔒 Only show Team tab for manager-like roles */}
        {isManagerLike && (
          <button
            type="button"
            onClick={() => setActiveTab("TEAM")}
            className={`rounded-full px-3 py-1 transition ${
              activeTab === "TEAM"
                ? "bg-[#00477f] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Team & exports
          </button>
        )}
      </div>

      {activeTab === "ME" && <EmployeeAttendanceCalendar />}

      {isManagerLike && activeTab === "TEAM" && (
        <ManagerAttendanceReports canDownload={canDownload} />
      )}
    </div>
  );
}

// ============================================================================
// EMPLOYEE VIEW – calendar with Present / Half / Leave / Missing Punch
// ============================================================================

function EmployeeAttendanceCalendar() {
  const { user } = useAuth();

  // 🔒 derive current logged-in user's id
  const currentUserId = useMemo(
    () => getUserIdFromAuth(user as any),
    [user],
  );

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const todayKey = toYMD(today);

  async function load() {
    try {
      setLoading(true);
      const year = viewMonth.getFullYear();
      const month = viewMonth.getMonth();

      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);

      const from = toYMD(start);
      const to = toYMD(end);

      const params = new URLSearchParams({ from, to });
      // 🔒 scope attendance to current user
      if (currentUserId) {
        params.set("userId", currentUserId);
      }

      const [attResp, leaveResp] = await Promise.all([
        api.get(`/attendance/reports?${params.toString()}`),
        api.get("/leave/my"),
      ]);

      const attItems = Array.isArray((attResp as any).items)
        ? ((attResp as any).items as AttendanceItem[])
        : Array.isArray(attResp)
        ? (attResp as AttendanceItem[])
        : [];

      const leaveItems = Array.isArray((leaveResp as any).items)
        ? ((leaveResp as any).items as LeaveItem[])
        : Array.isArray(leaveResp)
        ? (leaveResp as LeaveItem[])
        : [];

      setAttendance(attItems);
      setLeaves(leaveItems);
    } catch (e: any) {
      alert(e.message || "Failed to load attendance calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, currentUserId]);

  function shiftMonth(delta: number) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  const byDate = useMemo(() => {
    const map: Record<string, AttendanceItem> = {};
    for (const rec of attendance) {
      const k = keyFromDateStr(rec.date);
      if (!k) continue;
      map[k] = rec;
    }
    return map;
  }, [attendance]);

  const leavesByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const lv of leaves) {
      const status = (lv.status || "").toUpperCase();
      if (status !== "APPROVED") continue;

      const base = lv.type || "Leave";
      const typeLabel =
        base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();

      const fromStr = lv.from;
      const toStr = lv.to || lv.from;
      if (!fromStr || !toStr) continue;

      const fromDate = new Date(fromStr);
      const toDate = new Date(toStr);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()))
        continue;

      const cur = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate(),
      );
      const end = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate(),
      );

      while (cur <= end) {
        const k = toYMD(cur);
        map[k] = typeLabel;
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [leaves]);

  const calendarSlots: CalendarDay[] = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const slots: CalendarDay[] = [];

    const firstWeekday = (start.getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) {
      // placeholder blanks – handled in rendering
      slots.push({
        dayKey: `blank-${i}`,
        date: new Date(),
        isToday: false,
        isFuture: false,
        status: "UPCOMING",
      });
    }

    for (let d = 1; d <= end.getDate(); d++) {
      const current = new Date(year, month, d);
      const key = toYMD(current);
      const att = byDate[key];
      const punches = att?.punches || [];
      const hrs = computeHours(punches);
      const leaveType = leavesByKey[key];
      const isFuture = current > today;
      const isToday = key === todayKey;

      let status: DayStatus;
      if (leaveType) {
        status = "LEAVE";
      } else if (isFuture) {
        status = "UPCOMING";
      } else if (!punches.length) {
        status = "MISSING";
      } else if (hrs >= 7) {
        status = "PRESENT";
      } else if (hrs > 0) {
        status = "HALF";
      } else {
        status = "MISSING";
      }

      const ins = punches.filter(
        (p) => (p.type || "").toUpperCase() === "IN",
      );
      const outs = punches.filter(
        (p) => (p.type || "").toUpperCase() === "OUT",
      );
      const firstIn = ins[0];
      const lastOut = outs.length ? outs[outs.length - 1] : undefined;

      slots.push({
        dayKey: key,
        date: current,
        isToday,
        isFuture,
        status,
        firstIn,
        lastOut,
        leaveType,
        hours: hrs > 0 ? hrs : undefined,
      });
    }

    return slots;
  }, [viewMonth, byDate, leavesByKey, today, todayKey]);

  const monthLabel = viewMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const legendCounts = useMemo(() => {
    const counts: Record<DayStatus, number> = {
      PRESENT: 0,
      HALF: 0,
      LEAVE: 0,
      MISSING: 0,
      UPCOMING: 0,
    };
    for (const slot of calendarSlots) {
      if (slot.dayKey.startsWith("blank-")) continue;
      counts[slot.status]++;
    }
    return counts;
  }, [calendarSlots]);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="rounded-3xl border border-sky-100/70 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                🧭
              </span>
              <span>Plumtrips HR Copilot · Attendance</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Attendance overview
            </h1>
            <p className="mt-1 text-[12px] text-slate-600 max-w-lg">
              See your month at a glance — present days, half days, approved
              leave and missing punches. I keep your timesheets and HR in sync
              behind the scenes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 hover:bg-white"
            >
              ← Prev
            </button>
            <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-1 text-slate-900 font-medium">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 hover:bg-white"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-600">
          <LegendPill
            color="bg-emerald-500"
            label={`Present · ${legendCounts.PRESENT}`}
          />
          <LegendPill
            color="bg-amber-400"
            label={`Half day · ${legendCounts.HALF}`}
          />
          <LegendPill
            color="bg-sky-400"
            label={`Leave · ${legendCounts.LEAVE}`}
          />
          <LegendPill
            color="bg-rose-400"
            label={`Missing punch · ${legendCounts.MISSING}`}
          />
          <LegendPill
            color="bg-slate-500"
            label={`Upcoming · ${legendCounts.UPCOMING}`}
          />
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.9)] text-slate-50">
        <div className="mb-3 grid grid-cols-7 gap-2 text-[11px] text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 text-[11px]">
          {calendarSlots.map((slot, idx) =>
            slot.dayKey.startsWith("blank-") ? (
              <div key={slot.dayKey || `blank-${idx}`} />
            ) : (
              <EmployeeDayTile key={slot.dayKey} {...slot} />
            ),
          )}
        </div>

        {loading && (
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Loading…
          </p>
        )}
      </div>
    </div>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-[11px] text-slate-700 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function EmployeeDayTile(props: CalendarDay) {
  const { date, isToday, status, firstIn, lastOut, leaveType, hours } = props;

  const dayNumber = date.getDate();

  let badgeLabel = "";
  let badgeColor = "";
  switch (status) {
    case "PRESENT":
      badgeLabel = "Present";
      badgeColor = "bg-emerald-500/90 text-emerald-50 border-emerald-400";
      break;
    case "HALF":
      badgeLabel = "Half day";
      badgeColor = "bg-amber-400/90 text-amber-950 border-amber-300";
      break;
    case "LEAVE":
      badgeLabel = leaveType || "Leave";
      badgeColor = "bg-sky-500/90 text-sky-50 border-sky-300";
      break;
    case "MISSING":
      badgeLabel = "Missing";
      badgeColor = "bg-rose-500/90 text-rose-50 border-rose-300";
      break;
    case "UPCOMING":
    default:
      badgeLabel = "Upcoming";
      badgeColor = "bg-slate-700/90 text-slate-100 border-slate-500";
      break;
  }

  const base =
    "flex flex-col gap-1 rounded-2xl border px-2.5 py-2 min-h-[68px] bg-slate-950/70";
  const variant = isToday
    ? "border-sky-400 bg-sky-950/60 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]"
    : "border-slate-800";

  return (
    <div className={`${base} ${variant}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-50">
          {dayNumber}
        </span>
        {isToday && (
          <span className="rounded-full bg-sky-500/25 px-2 py-[1px] text-[9px] text-sky-100 border border-sky-500/60">
            Today
          </span>
        )}
      </div>
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2 py-[2px] text-[9px] font-medium ${badgeColor}`}
      >
        {badgeLabel}
      </span>
      <div className="mt-0.5 text-[9px] leading-snug text-slate-300">
        {firstIn?.ts && (
          <>
            In: <span className="font-medium">{timeLabel(firstIn.ts)}</span>{" "}
          </>
        )}
        {lastOut?.ts && (
          <>
            · Out: <span className="font-medium">{timeLabel(lastOut.ts)}</span>{" "}
          </>
        )}
        {hours && (
          <>
            · Hrs:{" "}
            <span className="font-medium">
              {hours.toFixed(1).replace(/\.0$/, "")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MANAGER / ADMIN VIEW – team filter + export
// ============================================================================

type ReportRow = {
  date: string;
  userId?: string;
  employeeName?: string;
  employeeCode?: string;
  employeeEmail?: string;
  in?: string;
  out?: string;
  hours?: string;
  status?: string;
};

type EmployeeMeta = {
  name: string;
  code: string;
  email: string;
};

function ManagerAttendanceReports({ canDownload }: { canDownload: boolean }) {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [team, setTeam] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const monthLabel = viewMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  // Load team (reportees)
  useEffect(() => {
    async function loadTeam() {
      try {
        const data = await api.get("/reports/manager/summary");
        const members = Array.isArray((data as any).team)
          ? ((data as any).team as any[])
          : [];
        setTeam(members);
      } catch {
        // non-fatal
      }
    }
    void loadTeam();
  }, []);

  // Build rich meta per userId for table + export
  const employeeMetaById = useMemo(() => {
    const map: Record<string, EmployeeMeta> = {};

    for (const m of team) {
      const uid =
        m.userId ||
        m.employeeId ||
        m._id ||
        m.id ||
        m.employee?._id;
      if (!uid) continue;

      const idStr = String(uid);

      const nameRaw =
        m.name ||
        m.employeeName ||
        m.employee?.name ||
        m.email ||
        m.employee?.email ||
        idStr;

      const codeRaw =
        m.employeeCode ||
        m.empCode ||
        m.employeeId ||
        m.employee?.employeeCode ||
        m.employee?.employeeId ||
        "";

      const emailRaw =
        m.email ||
        m.employee?.email ||
        "";

      map[idStr] = {
        name: String(nameRaw),
        code: codeRaw ? String(codeRaw) : "",
        email: emailRaw ? String(emailRaw) : "",
      };
    }

    return map;
  }, [team]);

  async function load() {
    try {
      setLoading(true);

      const year = viewMonth.getFullYear();
      const month = viewMonth.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const from = toYMD(start);
      const to = toYMD(end);

      const params = new URLSearchParams({ from, to });
      if (selectedUserId !== "ALL" && selectedUserId) {
        params.set("userId", selectedUserId);
      }

      const data = await api.get(`/attendance/reports?${params.toString()}`);
      const items = Array.isArray((data as any).items)
        ? ((data as any).items as AttendanceItem[])
        : Array.isArray(data)
        ? (data as AttendanceItem[])
        : [];

      const nextRows: ReportRow[] = items.map((item) => {
        const key = keyFromDateStr(item.date);
        const hrs = computeHours(item.punches || []);
        const punches = item.punches || [];
        const ins = punches.filter(
          (p) => (p.type || "").toUpperCase() === "IN",
        );
        const outs = punches.filter(
          (p) => (p.type || "").toUpperCase() === "OUT",
        );
        const firstIn = ins[0];
        const lastOut = outs.length ? outs[outs.length - 1] : undefined;

        let status: string;
        if (!punches.length) {
          status = "Missing";
        } else if (hrs >= 7) {
          status = "Present";
        } else if (hrs > 0) {
          status = "Half day";
        } else {
          status = "Missing";
        }

        const uid = item.userId ? String(item.userId) : "";
        const meta = uid ? employeeMetaById[uid] : undefined;

        return {
          date: key || item.date || "—",
          userId: uid,
          employeeName: meta?.name || uid || "",
          employeeCode: meta?.code || "",
          employeeEmail: meta?.email || "",
          in: firstIn?.ts ? timeLabel(firstIn.ts) : "",
          out: lastOut?.ts ? timeLabel(lastOut.ts) : "",
          hours: hrs > 0 ? hrs.toFixed(1).replace(/\.0$/, "") : "",
          status,
        };
      });

      setRows(nextRows);
    } catch (e: any) {
      alert(e.message || "Failed to load attendance report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, selectedUserId, employeeMetaById]);

  function downloadCSV(asExcel = false) {
    const headers = [
      "Employee Name",
      "Employee ID",
      "Email",
      "Date",
      "In",
      "Out",
      "Hours",
      "Status",
    ];
    const lines = [headers.join(",")];

    for (const r of rows) {
      const esc = (val?: string) =>
        (val || "").replace(/"/g, '""'); // basic quote escape

      const line = [
        `"${esc(r.employeeName)}"`,
        `"${esc(r.employeeCode)}"`,
        `"${esc(r.employeeEmail)}"`,
        `"${esc(r.date)}"`,
        `"${esc(r.in)}"`,
        `"${esc(r.out)}"`,
        `"${esc(r.hours)}"`,
        `"${esc(r.status)}"`,
      ].join(",");
      lines.push(line);
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], {
      type: asExcel
        ? "application/vnd.ms-excel;charset=utf-8;"
        : "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = asExcel ? "attendance-report.xlsx" : "attendance-report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Hero / filters */}
      <div className="rounded-3xl border border-indigo-100/70 bg-gradient-to-r from-[#eef2ff] via-[#f5f3ff] to-[#ecfeff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                📊
              </span>
              <span>Plumtrips HR Copilot · Manager view</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Attendance reports
            </h1>
            <p className="mt-1 text-[12px] text-slate-600 max-w-xl">
              Filter by month and employee to audit attendance, spot missing
              punches and download CSV / Excel-ready summaries for payroll or
              compliance.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs md:items-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 hover:bg-white"
              >
                ← Prev
              </button>
              <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-1 text-slate-900 font-medium">
                {monthLabel}
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 hover:bg-white"
              >
                Next →
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
              >
                <option value="ALL">All reportees</option>
                {team.map((m) => {
                  const id =
                    m.userId ||
                    m.employeeId ||
                    m._id ||
                    m.id ||
                    m.employee?._id;
                  const name =
                    m.name ||
                    m.employeeName ||
                    m.employee?.name ||
                    m.email ||
                    m.employee?.email ||
                    id;
                  if (!id) return null;
                  return (
                    <option key={String(id)} value={String(id)}>
                      {String(name)}
                    </option>
                  );
                })}
              </select>

              {canDownload && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadCSV(false)}
                    disabled={!rows.length}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCSV(true)}
                    disabled={!rows.length}
                    className="rounded-full border border-indigo-500 bg-indigo-500/90 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-600 disabled:opacity-40"
                  >
                    Download Excel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-600">
                  Employee
                </th>
                <th className="text-left p-3 font-semibold text-slate-600">
                  Date
                </th>
                <th className="text-left p-3 font-semibold text-slate-600">
                  In
                </th>
                <th className="text-left p-3 font-semibold text-slate-600">
                  Out
                </th>
                <th className="text-left p-3 font-semibold text-slate-600">
                  Hours
                </th>
                <th className="text-left p-3 font-semibold text-slate-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={`${r.userId || "row"}-${idx}`}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="p-3 whitespace-nowrap">
                    <div className="text-[13px] font-medium text-slate-900">
                      {r.employeeName || "—"}
                    </div>
                    {(r.employeeCode || r.employeeEmail) && (
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {r.employeeCode && (
                          <span>Emp ID: {r.employeeCode}</span>
                        )}
                        {r.employeeCode && r.employeeEmail && (
                          <span>{" · "}</span>
                        )}
                        {r.employeeEmail && <span>{r.employeeEmail}</span>}
                      </div>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.date || "—"}</td>
                  <td className="p-3 whitespace-nowrap">{r.in || "—"}</td>
                  <td className="p-3 whitespace-nowrap">{r.out || "—"}</td>
                  <td className="p-3 whitespace-nowrap">{r.hours || "—"}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-[2px] text-[11px] ${
                        r.status === "Present"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : r.status === "Half day"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {r.status || "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    className="p-4 text-center text-slate-500 text-xs"
                    colSpan={6}
                  >
                    No attendance data for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="border-t border-slate-100 p-3 text-center text-[11px] text-slate-500">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}

// 🔒 Common helper for both Attendance & Punch
function getUserIdFromAuth(user: any): string {
  if (!user) return "";
  const candidates = [
    user.userId,
    user.id,
    user._id,
    user.employeeId,
    user.employee_id,
    user.profile?.userId,
    user.profile?.id,
    user.profile?._id,
    user.profile?.employeeId,
    user.profile?.employee_id,
  ];
  const found = candidates.find(Boolean);
  return found ? String(found) : "";
}
