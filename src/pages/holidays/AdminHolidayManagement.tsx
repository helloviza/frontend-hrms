// apps/frontend/src/pages/holidays/AdminHolidayManagement.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/* -------------------------------------------------------------------------- */
/* Types & sample data                                                        */
/* -------------------------------------------------------------------------- */

type HolidayType = "GENERAL" | "OPTIONAL";

type HolidayItem = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  region: string;
  shortNote: string;
  longNote?: string;
};

const SAMPLE_HOLIDAYS: HolidayItem[] = [
  {
    id: "2025-01-01",
    date: "2025-01-01",
    name: "New Year’s Day",
    type: "GENERAL",
    region: "All locations / Company-wide",
    shortNote: "Company-wide holiday to welcome the new year.",
  },
  {
    id: "2025-01-26",
    date: "2025-01-26",
    name: "Republic Day",
    type: "GENERAL",
    region: "India",
    shortNote: "National holiday (India).",
  },
  {
    id: "2025-03-14",
    date: "2025-03-14",
    name: "Optional Festival Holiday",
    type: "OPTIONAL",
    region: "All locations / Company-wide",
    shortNote:
      "Choose based on your region / religion with manager approval.",
  },
  {
    id: "2025-08-15",
    date: "2025-08-15",
    name: "Independence Day",
    type: "GENERAL",
    region: "India",
    shortNote: "National holiday (India).",
  },
  {
    id: "2025-10-20",
    date: "2025-10-20",
    name: "Diwali (Optional)",
    type: "OPTIONAL",
    region: "India",
    shortNote: "Festival of lights – choose as per policy.",
  },
];

function typeLabel(t: HolidayType): string {
  return t === "GENERAL" ? "General holiday" : "Optional holiday";
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminHolidayManagement() {
  const { user } = useAuth();

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    (user as any)?.email ||
    "there";

  const [holidays, setHolidays] = useState<HolidayItem[]>(SAMPLE_HOLIDAYS);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    date: string;
    name: string;
    type: HolidayType;
    region: string;
    shortNote: string;
    longNote: string;
  }>({
    date: "",
    name: "",
    type: "GENERAL",
    region: "",
    shortNote: "",
    longNote: "",
  });

  const stats = useMemo(() => {
    const total = holidays.length;
    const general = holidays.filter((h) => h.type === "GENERAL").length;
    const optional = holidays.filter((h) => h.type === "OPTIONAL").length;
    return { total, general, optional };
  }, [holidays]);

  function resetForm() {
    setEditingId(null);
    setForm({
      date: "",
      name: "",
      type: "GENERAL",
      region: "",
      shortNote: "",
      longNote: "",
    });
  }

  function handleEdit(h: HolidayItem) {
    setEditingId(h.id);
    setForm({
      date: h.date,
      name: h.name,
      type: h.type,
      region: h.region,
      shortNote: h.shortNote,
      longNote: h.longNote || "",
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this holiday from the master list?")) return;
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    if (editingId === id) {
      resetForm();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.date || !form.name.trim()) {
      alert("Please provide at least a date and holiday name.");
      return;
    }

    if (editingId) {
      // update existing
      setHolidays((prev) =>
        prev
          .map((h) =>
            h.id === editingId
              ? {
                  ...h,
                  date: form.date,
                  name: form.name.trim(),
                  type: form.type,
                  region: form.region.trim() || "All locations / Company-wide",
                  shortNote: form.shortNote.trim(),
                  longNote: form.longNote.trim() || undefined,
                }
              : h,
          )
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
    } else {
      // add new
      const id = `${form.date}-${Date.now()}`;
      const newHoliday: HolidayItem = {
        id,
        date: form.date,
        name: form.name.trim(),
        type: form.type,
        region: form.region.trim() || "All locations / Company-wide",
        shortNote: form.shortNote.trim(),
        longNote: form.longNote.trim() || undefined,
      };
      setHolidays((prev) =>
        [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)),
      );
    }

    resetForm();
  }

  // group by month for nicer view
  const grouped = useMemo(() => {
    const map = new Map<string, HolidayItem[]>();
    for (const h of holidays) {
      const dt = new Date(h.date);
      const label = dt.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(h);
    }
    return Array.from(map.entries());
  }, [holidays]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Hero / Copilot header */}
      <div className="rounded-3xl border border-sky-100/70 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                🧩
              </span>
              <span>Plumtrips HR Copilot · Holiday master</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#00477f]">
              Holiday management – Admin console
            </h1>
            <p className="text-xs text-slate-600">
              Hi {displayName}, use this console to maintain your{" "}
              <span className="font-semibold">company holiday master</span>.
              Create General holidays (everyone is off) and Optional holidays
              (employee can choose with manager approval). Changes here power
              the employee holiday calendar and leave copilot.
            </p>
            <p className="text-[11px] text-slate-500">
              This is a <span className="font-semibold">UI-only demo</span> for
              now – data lives in this browser session. Once /api/holidays is
              wired, we&apos;ll persist these entries to the HRMS database.
            </p>
          </div>

          <div className="flex flex-col gap-3 items-stretch md:items-end text-xs">
            <Link
              to="/holidays"
              className="inline-flex items-center justify-center self-end rounded-full border border-[#00477f]/20 bg-white px-4 py-2 text-[11px] font-semibold text-[#00477f] shadow-sm hover:bg-[#00477f]/5"
            >
              ← Back to employee calendar
            </Link>

            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm max-w-xs text-left md:text-right">
              <div className="text-[11px] font-medium text-slate-700">
                Snapshot for this session
              </div>
              <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                <div>
                  Total holidays:{" "}
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div>
                  General:{" "}
                  <span className="font-semibold text-emerald-700">
                    {stats.general}
                  </span>
                  , Optional:{" "}
                  <span className="font-semibold text-amber-700">
                    {stats.optional}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Tip: keep 8–12 general holidays and 2–4 optional holidays per
                year for a balanced policy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              {editingId ? "Edit holiday" : "Add a new holiday"}
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              Pick the date, choose whether it&apos;s a{" "}
              <span className="font-semibold">General</span> or{" "}
              <span className="font-semibold">Optional</span> holiday and add a
              short note employees will see on the calendar.
            </p>
          </div>
          <div className="text-[10px] text-slate-400">
            General = company-wide off · Optional = employee can choose with
            manager approval.
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {/* Left column */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] focus:border-[#00477f] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">
                Holiday name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Republic Day, Diwali (Optional)"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] focus:border-[#00477f] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">Type</label>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1 py-1 w-fit">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, type: "GENERAL" }))
                  }
                  className={`px-3 py-1 rounded-full text-[11px] ${
                    form.type === "GENERAL"
                      ? "bg-emerald-100 text-emerald-800 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  General
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, type: "OPTIONAL" }))
                  }
                  className={`px-3 py-1 rounded-full text-[11px] ${
                    form.type === "OPTIONAL"
                      ? "bg-amber-100 text-amber-800 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Optional
                </button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">
                Region / location
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
                placeholder="e.g. India, All locations / Company-wide"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] focus:border-[#00477f] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">
                Short note (shown on calendar)
              </label>
              <input
                type="text"
                value={form.shortNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shortNote: e.target.value }))
                }
                placeholder="e.g. National holiday (India)."
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] focus:border-[#00477f] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1 text-[11px]">
              <label className="font-medium text-slate-700">
                Longer description (optional)
              </label>
              <textarea
                value={form.longNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, longNote: e.target.value }))
                }
                rows={3}
                placeholder="Extra context for HR or managers – optional."
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] resize-none focus:border-[#00477f] focus:outline-none"
              />
            </div>
          </div>

          {/* Actions row (spans both columns) */}
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[10px] text-slate-400">
              {editingId ? (
                <>You&apos;re updating an existing holiday.</>
              ) : (
                <>New entries are added to the in-memory master list.</>
              )}{" "}
              We&apos;ll wire this to the HRMS API in the next step.
            </div>

            <div className="flex gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-slate-300 bg-white px-4 py-[6px] text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="submit"
                className="rounded-full bg-[#00477f] px-5 py-[6px] text-[11px] font-semibold text-white shadow-md shadow-[#00477f]/30 hover:bg-[#003767]"
              >
                {editingId ? "Update holiday" : "Add holiday"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* List / table view */}
      <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-[#eaf6ff] via-white to-[#eaf7ff] shadow-[0_18px_60px_rgba(15,23,42,0.08)] px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#00477f]">
            Holiday master list
          </h2>
          <p className="text-[10px] text-slate-500">
            {holidays.length} holidays configured in this session.
          </p>
        </div>

        {grouped.length === 0 && (
          <p className="text-center text-[11px] text-slate-500 py-4">
            No holidays in the master list yet. Use the form above to add one.
          </p>
        )}

        {grouped.map(([month, items]) => (
          <div key={month} className="mb-5 last:mb-0">
            <div className="flex justify-center">
              <span className="rounded-full bg-white px-4 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 shadow-sm">
                {month}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {items.map((h) => (
                <HolidayRow
                  key={h.id}
                  holiday={h}
                  onEdit={() => handleEdit(h)}
                  onDelete={() => handleDelete(h.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row component                                                              */
/* -------------------------------------------------------------------------- */

function HolidayRow({
  holiday,
  onEdit,
  onDelete,
}: {
  holiday: HolidayItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dt = new Date(holiday.date);
  const weekday = dt.toLocaleDateString("en-IN", { weekday: "short" });
  const day = dt.toLocaleDateString("en-IN", { day: "2-digit" });
  const month = dt.toLocaleDateString("en-IN", { month: "short" });
  const year = dt.getFullYear();

  const isGeneral = holiday.type === "GENERAL";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/90 px-3 py-3 shadow-sm border border-slate-100 md:flex-row md:items-center md:justify-between">
      {/* Left: date + name */}
      <div className="flex items-center gap-3 min-w-[120px]">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900 text-slate-50 px-3 py-2 text-[10px] leading-tight shadow-sm">
          <span className="text-[9px] uppercase tracking-[0.18em] text-slate-300">
            {weekday}
          </span>
          <span className="text-lg font-semibold">
            {day}
            <span className="text-[11px] align-top ml-[1px]">{month}</span>
          </span>
          <span className="text-[9px] text-slate-400">{year}</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-slate-900">
            {holiday.name}
          </div>
          <div className="mt-1 inline-flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] ${
                isGeneral
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {typeLabel(holiday.type)}
            </span>
            <span className="text-[10px] text-slate-500">
              {holiday.region}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: notes */}
      <div className="text-[11px] text-slate-600 md:flex-1 md:px-4">
        <div>{holiday.shortNote}</div>
        {holiday.longNote && (
          <div className="mt-1 text-[10px] text-slate-500">
            {holiday.longNote}
          </div>
        )}
        <div className="mt-1 text-[10px] text-slate-400">
          {isGeneral ? (
            <>
              <span className="font-medium text-emerald-700">
                Company-wide off.
              </span>{" "}
              Attendance punches will be auto-marked as holiday (once policy is
              configured).
            </>
          ) : (
            <>
              <span className="font-medium text-amber-700">Optional.</span> Apply
              via Leave Copilot and choose this date as Optional Holiday.
            </>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 md:flex-col md:items-end">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-slate-300 bg-white px-3 py-[6px] text-[10px] text-slate-700 hover:bg-slate-50"
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-[6px] text-[10px] text-red-700 hover:bg-red-100"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
