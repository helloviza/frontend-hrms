// apps/frontend/src/pages/attendance/Punch.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type Geo = { lat: number; lng: number } | null;

interface PunchEntry {
  ts?: string;
  type?: string; // "IN" | "OUT"
  geo?: any;
}

interface AttendanceItem {
  _id?: string;
  date?: string; // "YYYY-MM-DD"
  punches?: PunchEntry[];
}

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

export default function Punch() {
  const { user } = useAuth(); // keeps context wired

  // 🔒 derive current logged-in user's id (string) for scoping attendance
  const currentUserId = useMemo(
    () => getUserIdFromAuth(user as any),
    [user],
  );

  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [records, setRecords] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [punching, setPunching] = useState<"in" | "out" | null>(null);

  async function getGeo(): Promise<Geo> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => resolve(null),
      ),
    );
  }

  async function loadMonth(d: Date = monthCursor) {
    try {
      setLoading(true);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const from = toYMD(start);
      const to = toYMD(end);

      const params = new URLSearchParams({ from, to });
      // 🔒 Scope to current user if we have an id
      if (currentUserId) {
        params.set("userId", currentUserId);
      }

      const resp = (await api.get(
        `/attendance/reports?${params.toString()}`,
      )) as { items?: AttendanceItem[] } | AttendanceItem[];

      const items = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? ((resp as any).items as AttendanceItem[])
        : [];

      setRecords(items);
    } catch (e: any) {
      alert(e.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMonth(monthCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  async function doPunch(type: "in" | "out") {
    try {
      setPunching(type);
      const geo = await getGeo();

      // 🔒 Punch always for the current logged-in user on backend
      await api.post("/attendance/punch", { type, geo });

      alert(`Punch ${type.toUpperCase()} recorded successfully!`);
      await loadMonth(); // refresh calendar + today summary
    } catch (e: any) {
      alert(e.message || "Failed to record punch");
    } finally {
      setPunching(null);
    }
  }

  // ---- Derived: map by date, today summary, calendar slots ------------------

  const byDate = useMemo(() => {
    const map: Record<
      string,
      { punches: PunchEntry[]; firstIn?: PunchEntry; lastOut?: PunchEntry }
    > = {};
    for (const rec of records) {
      const k = keyFromDateStr(rec.date);
      if (!k) continue;
      const punches = [...(rec.punches || [])].sort((a, b) => {
        const ta = a.ts ? new Date(a.ts).getTime() : 0;
        const tb = b.ts ? new Date(b.ts).getTime() : 0;
        return ta - tb;
      });
      const firstIn = punches.find((p) => (p.type || "").toUpperCase() === "IN");
      const outs = punches.filter((p) => (p.type || "").toUpperCase() === "OUT");
      const lastOut = outs.length ? outs[outs.length - 1] : undefined;
      map[k] = { punches, firstIn, lastOut };
    }
    return map;
  }, [records]);

  const today = new Date();
  const todayKey = toYMD(today);
  const todayInfo = byDate[todayKey];

  const lastPunch = useMemo(() => {
    if (!todayInfo || !todayInfo.punches.length) return null;
    return todayInfo.punches[todayInfo.punches.length - 1];
  }, [todayInfo]);

  const todayStatusLabel = useMemo(() => {
    if (!todayInfo || !todayInfo.punches.length) return "No punches yet today";
    const lastType = (lastPunch?.type || "").toUpperCase();
    if (lastType === "IN") return "Currently marked as IN";
    if (lastType === "OUT") return "Last marked as OUT";
    return "Activity recorded today";
  }, [todayInfo, lastPunch]);

  type CalendarDay = {
    dayKey: string;
    date: Date;
    isToday: boolean;
    isFuture: boolean;
    firstIn?: PunchEntry;
    lastOut?: PunchEntry;
  };

  const calendarSlots = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const slots: (CalendarDay | null)[] = [];

    // Monday-based index (0 = Mon ... 6 = Sun)
    const firstWeekday = (start.getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) {
      slots.push(null);
    }

    for (let d = 1; d <= end.getDate(); d++) {
      const current = new Date(year, month, d);
      const key = toYMD(current);
      const info = byDate[key];
      slots.push({
        dayKey: key,
        date: current,
        isToday: key === todayKey,
        isFuture: current > today,
        firstIn: info?.firstIn,
        lastOut: info?.lastOut,
      });
    }

    return slots;
  }, [monthCursor, byDate, today, todayKey]);

  const monthLabel = monthCursor.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta: number) {
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  }

  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-8">
      {/* Top: Hero + Punch buttons + Today summary */}
      <div className="rounded-3xl border border-sky-100/60 bg-gradient-to-r from-[#e8f5ff] via-[#f2f5ff] to-[#eaf7ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.1)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                🕒
              </span>
              <span>Plumtrips HRMS · Attendance</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Attendance Punch
            </h1>
            <p className="mt-1 text-[12px] text-slate-600 max-w-md">
              Tap punch in or out. I’ll keep your daily timeline, attendance reports
              and HR analytics in sync behind the scenes.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => doPunch("in")}
              disabled={punching === "in"}
              className="min-w-[150px] rounded-full bg-[--accent] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[--accent]/40 hover:opacity-90 disabled:opacity-60"
            >
              {punching === "in" ? "Punching in…" : "Punch In"}
            </button>
            <button
              onClick={() => doPunch("out")}
              disabled={punching === "out"}
              className="min-w-[150px] rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 hover:opacity-90 disabled:opacity-60"
            >
              {punching === "out" ? "Punching out…" : "Punch Out"}
            </button>
          </div>
        </div>

        {/* Today summary strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 shadow-sm border border-slate-100">
            <span className="mr-1 text-slate-500">Today</span>
            <span className="font-medium text-[#00477f]">
              {today.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
          <div className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 border border-slate-100">
            <span className="mr-1 text-slate-500">Status:</span>
            <span className="font-medium text-slate-800">{todayStatusLabel}</span>
          </div>
          {lastPunch?.ts && (
            <div className="inline-flex items-center rounded-full bg-white/60 px-3 py-1 border border-slate-100">
              <span className="mr-1 text-slate-500">Last punch:</span>
              <span className="font-medium text-slate-800">
                {(lastPunch.type || "").toUpperCase()} at {timeLabel(lastPunch.ts)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Month calendar with punches */}
      <div className="rounded-3xl border border-slate-900/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.9)] text-slate-50">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">
              Attendance calendar
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Each tile shows your IN / OUT times. Use this view to quickly spot
              absences or missing punches.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 hover:bg-slate-800"
            >
              ← Prev
            </button>
            <div className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-1 text-slate-100 font-medium">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 hover:bg-slate-800"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-[11px] text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 text-[11px]">
          {calendarSlots.map((slot, idx) =>
            slot ? (
              <DayTile key={slot.dayKey} {...slot} />
            ) : (
              <div key={`blank-${idx}`} />
            ),
          )}
        </div>

        {loading && (
          <p className="mt-3 text-center text-[11px] text-slate-400">Loading…</p>
        )}
      </div>
    </div>
  );
}

// Small presentational component for each day tile
function DayTile(props: {
  dayKey: string;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  firstIn?: PunchEntry;
  lastOut?: PunchEntry;
}) {
  const { date, isToday, isFuture, firstIn, lastOut } = props;
  const hasAny = !!firstIn || !!lastOut;
  const label = date.getDate();

  let status: string;
  if (hasAny) {
    status = `${firstIn ? `In ${timeLabel(firstIn.ts)}` : ""}${
      firstIn && lastOut ? " · " : ""
    }${lastOut ? `Out ${timeLabel(lastOut.ts)}` : ""}`;
  } else if (isFuture) {
    status = "— upcoming —";
  } else {
    status = "Absent / no punches";
  }

  const base =
    "flex flex-col gap-1 rounded-2xl border px-2 py-2 min-h-[62px] bg-slate-950/70";

  const variant = isToday
    ? "border-sky-400 bg-sky-900/40 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]"
    : hasAny
    ? "border-emerald-600/40 bg-emerald-950/40"
    : "border-slate-800";

  return (
    <div className={`${base} ${variant}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-50">{label}</span>
        {isToday && (
          <span className="rounded-full bg-sky-500/20 px-2 py-[1px] text-[9px] text-sky-100 border border-sky-500/60">
            Today
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-300 leading-snug">{status}</div>
    </div>
  );
}

// 🔒 Common helper: extract a stable user id string from AuthContext.user
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
