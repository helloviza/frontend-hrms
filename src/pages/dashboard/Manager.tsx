// apps/frontend/src/pages/dashboard/Manager.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type AnyObj = Record<string, any>;

export default function Manager() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Copilot state
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState("");
  const [copilotMode, setCopilotMode] = useState<
    "idle" | "demo" | "live" | "quota_exceeded"
  >("idle");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<AnyObj | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get("/reports/manager/summary");
        setSummary(data as AnyObj);
      } catch (err: any) {
        console.warn("Manager summary failed, using empty state", err);
        setError("I couldn’t reach the reports API. Showing a minimal view.");
        setSummary({});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ----- Copilot handler ----------------------------------------------------

  async function handleAskCopilot() {
    const q = copilotQuestion.trim();
    if (!q) {
      setCopilotError("Please type a question for Copilot.");
      return;
    }

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotAnswer("");
    setCopilotMode("idle");

    try {
      const data = (await api.post("/copilot/manager", {
        question: q,
      })) as AnyObj;

      const answer =
        data?.answer ||
        "I’m not sure how to answer that yet. Please try rephrasing your question.";
      const mode =
        (data?.mode as "demo" | "live" | "quota_exceeded" | undefined) ||
        "demo";

      setCopilotAnswer(answer);
      setCopilotMode(mode);
    } catch (err) {
      console.error("Copilot request failed", err);
      setCopilotError(
        "Copilot could not respond right now. Please try again in a bit.",
      );
    } finally {
      setCopilotLoading(false);
    }
  }

  // ----- defensive extraction of parts from summary ------------------------

  const teamMembers: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.teamMembers)
        ? summary!.teamMembers
        : Array.isArray(summary?.directReports)
        ? summary!.directReports
        : [],
    [summary],
  );

  const pendingLeaves: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.pendingLeaves)
        ? summary!.pendingLeaves
        : Array.isArray(summary?.pendingLeaveRequests)
        ? summary!.pendingLeaveRequests
        : [],
    [summary],
  );

  const pendingAttendance: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.pendingAttendanceRequests)
        ? summary!.pendingAttendanceRequests
        : Array.isArray(summary?.attendanceApprovals)
        ? summary!.attendanceApprovals
        : [],
    [summary],
  );

  const pendingOnboarding: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.pendingOnboarding)
        ? summary!.pendingOnboarding
        : [],
    [summary],
  );

  const upcomingBirthdays: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.upcomingBirthdays)
        ? summary!.upcomingBirthdays
        : [],
    [summary],
  );

  const upcomingAnniversaries: AnyObj[] = useMemo(
    () =>
      Array.isArray(summary?.upcomingAnniversaries)
        ? summary!.upcomingAnniversaries
        : [],
    [summary],
  );

  const teamSize = summary?.teamSize ?? teamMembers.length ?? 0;
  const pendingApprovalsTotal =
    summary?.pendingApprovals ??
    summary?.pending ??
    pendingLeaves.length +
      pendingAttendance.length +
      pendingOnboarding.length;

  const onLeaveToday = summary?.onLeaveToday ?? summary?.onLeave ?? 0;

  const coveragePct =
    teamSize > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((teamSize - onLeaveToday) / teamSize) * 100),
          ),
        )
      : 0;

  const managerName =
    (user as AnyObj)?.firstName ||
    (user as AnyObj)?.name ||
    (user as AnyObj)?.email ||
    "there";

  // ------------------------------------------------------------------------ //

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header + Copilot badge */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
              🤖
            </span>
            <span>Plumtrips HR Copilot · Manager view</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#00477f]">
            Manager dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-600 max-w-xl">
            Hi {managerName}, this is your control room for{" "}
            <span className="font-medium">your team</span>: approvals, coverage,
            and people insights in one place. No need to hop across menus.
          </p>
          {error && (
            <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-1 inline-block">
              {error}
            </p>
          )}
        </div>

        {/* Copilot quick ask */}
        <div className="w-full md:w-[320px] rounded-2xl border border-sky-100 bg-gradient-to-br from-[#eaf6ff] via-white to-[#e0f2fe] px-4 py-3 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-medium text-slate-700">
              Ask HR Copilot about your team
            </div>
            {copilotMode !== "idle" && (
              <span className="text-[9px] rounded-full px-2 py-[2px] border border-slate-200 bg-white/70 text-slate-500">
                {copilotMode === "live"
                  ? "Live AI"
                  : copilotMode === "quota_exceeded"
                  ? "Demo (quota)"
                  : "Demo mode"}
              </span>
            )}
          </div>
          <textarea
            rows={2}
            value={copilotQuestion}
            onChange={(e) => setCopilotQuestion(e.target.value)}
            placeholder='e.g. “Who has the most leave balance left?” or “Summarise pending approvals by person.”'
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-2 py-1.5 text-[11px] text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-[#00477f]"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-[#00477f] px-3 py-[5px] text-[11px] font-semibold text-white shadow-sm shadow-[#00477f]/40 hover:bg-[#003767] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleAskCopilot}
              disabled={copilotLoading}
            >
              {copilotLoading ? "Thinking…" : "✨ Ask Copilot"}
            </button>
            <div className="text-[9px] text-slate-500 text-right">
              Suggested prompts:
              <br />
              <span className="italic">
                “Who is overloaded this week?” · “Show my team&apos;s leave
                pattern”
              </span>
            </div>
          </div>

          {copilotError && (
            <p className="mt-1 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
              {copilotError}
            </p>
          )}

          {copilotAnswer && (
            <div className="mt-1 rounded-xl border border-slate-200 bg-white/80 px-2 py-2 text-[11px] text-slate-700 max-h-32 overflow-y-auto">
              {copilotAnswer.split("\n").map((line, idx) => (
                <p key={idx} className={idx > 0 ? "mt-[2px]" : ""}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Team size"
          value={teamSize}
          hint="Direct reports mapped to you in HRMS."
        />
        <KpiCard
          label="Pending approvals"
          value={pendingApprovalsTotal}
          accent="warning"
          hint="Leaves, attendance & onboarding waiting for you."
        />
        <KpiCard
          label="On leave today"
          value={onLeaveToday}
          accent="info"
          hint="Approved leaves that fall on today."
        />
        <CoverageCard coverage={coveragePct} teamSize={teamSize} />
      </div>

      {/* Approvals section */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Pending approvals
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              These are the items waiting on your action. Clear this list daily
              so your team doesn&apos;t get blocked.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <BadgePill
              label="Leaves"
              count={pendingLeaves.length}
              tone="emerald"
            />
            <BadgePill
              label="Attendance"
              count={pendingAttendance.length}
              tone="sky"
            />
            <BadgePill
              label="Onboarding"
              count={pendingOnboarding.length}
              tone="violet"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 text-[11px]">
          <ApprovalList
            title="Leave requests"
            emptyText="No pending leave approvals."
            items={pendingLeaves}
            primaryKey="employeeName"
            secondaryKey="dateRange"
            metaKey="reason"
          />
          <ApprovalList
            title="Attendance regularisations"
            emptyText="No attendance requests at the moment."
            items={pendingAttendance}
            primaryKey="employeeName"
            secondaryKey="date"
            metaKey="reason"
          />
          <ApprovalList
            title="Onboarding tasks"
            emptyText="No onboarding items pending your review."
            items={pendingOnboarding}
            primaryKey="employeeName"
            secondaryKey="task"
            metaKey="status"
          />
        </div>
      </div>

      {/* Team snapshot */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Your team at a glance
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              Quick view of your direct reports. Use{" "}
              <span className="font-medium">Info</span> to open a detailed
              person card (role, contact, leave &amp; attendance snapshot –
              salary is never shown here).
            </p>
          </div>
          <div className="text-[10px] text-slate-500">
            Showing {teamMembers.length || "no"} team member
            {teamMembers.length === 1 ? "" : "s"} mapped to you.
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-[11px]">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-slate-600">
                <th className="px-3 py-2 font-semibold">Team member</th>
                <th className="px-3 py-2 font-semibold">Role / Department</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 font-semibold">Status today</th>
                <th className="px-3 py-2 font-semibold text-right">
                  Leave (YTD)
                </th>
                <th className="px-3 py-2 font-semibold text-right">
                  Attendance health
                </th>
                <th className="px-3 py-2 font-semibold text-right">Info</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-[11px] text-slate-500"
                  >
                    No team members are mapped to you yet. Once HR links your
                    reporting tree, this list will auto-populate.
                  </td>
                </tr>
              )}

              {teamMembers.map((m) => {
                const fullName =
                  m.fullName ||
                  m.name ||
                  `${m.firstName || ""} ${m.lastName || ""}`.trim() ||
                  "Unknown";
                const role =
                  m.roleTitle || m.designation || m.role || "—";
                const dept = m.department || m.team || "";
                const location = m.location || m.baseLocation || "—";
                const statusToday =
                  m.todayStatus || m.currentStatus || "—";

                const ytdLeaves = m.ytdLeaves ?? m.leaveDaysYtd ?? 0;
                const attendanceHealth =
                  m.attendanceScore ??
                  m.attendanceHealth ??
                  m.attendancePercentage ??
                  null;

                return (
                  <tr
                    key={String(m.id || m.employeeId || fullName)}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {fullName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Emp ID: {m.employeeCode || m.employeeId || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-slate-800">{role}</span>
                        {dept && (
                          <span className="text-[10px] text-slate-500">
                            {dept}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {location}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusPill label={statusToday} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-slate-700">
                      {ytdLeaves} days
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {attendanceHealth == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={
                            attendanceHealth >= 95
                              ? "text-emerald-700 font-medium"
                              : attendanceHealth >= 85
                              ? "text-amber-700 font-medium"
                              : "text-rose-700 font-medium"
                          }
                        >
                          {attendanceHealth}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedMember(m)}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-[4px] text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        ℹ️ Info
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* People moments: birthdays & anniversaries */}
      <div className="grid gap-4 md:grid-cols-2">
        <PeopleMomentsCard
          title="Upcoming birthdays"
          items={upcomingBirthdays}
          emptyText="No upcoming birthdays in the next few weeks."
        />
        <PeopleMomentsCard
          title="Upcoming work anniversaries"
          items={upcomingAnniversaries}
          emptyText="No upcoming anniversaries in the next few weeks."
        />
      </div>

      {/* Right-side member detail drawer */}
      {selectedMember && (
        <MemberDrawer
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {loading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 text-white text-[11px] px-4 py-2 shadow-lg shadow-slate-900/40">
          Loading manager dashboard…
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "warning" | "info";
}) {
  let ring = "border-slate-100";
  if (accent === "warning") ring = "border-amber-200";
  if (accent === "info") ring = "border-sky-200";

  return (
    <div
      className={`rounded-2xl bg-white px-4 py-3 shadow-sm border ${ring} flex flex-col gap-1`}
    >
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
      <span className="text-2xl font-semibold text-slate-900 leading-none">
        {value ?? "—"}
      </span>
      {hint && (
        <span className="text-[10px] text-slate-500 leading-snug">{hint}</span>
      )}
    </div>
  );
}

function CoverageCard({ coverage, teamSize }: { coverage: number; teamSize: number }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-emerald-100 flex flex-col gap-2">
      <span className="text-[11px] font-medium text-slate-600">
        Today&apos;s coverage
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold text-slate-900 leading-none">
          {teamSize === 0 ? "—" : `${coverage}%`}
        </span>
        <div className="flex-1 ml-3">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${coverage}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {teamSize === 0
              ? "Team not mapped yet."
              : "Higher coverage means more people available today."}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgePill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "emerald" | "sky" | "violet";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-[3px] text-[10px] ${tones[tone]}`}
    >
      <span className="font-medium">{label}</span>
      <span className="inline-flex h-4 min-w-[1.25rem] items-center justify-center rounded-full bg-white/70 px-1 text-[9px] font-semibold">
        {count}
      </span>
    </span>
  );
}

function ApprovalList({
  title,
  items,
  emptyText,
  primaryKey,
  secondaryKey,
  metaKey,
}: {
  title: string;
  items: AnyObj[];
  emptyText: string;
  primaryKey: string;
  secondaryKey?: string;
  metaKey?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">
          {title}
        </span>
        <span className="text-[10px] text-slate-500">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-1.5 max-h-44 overflow-auto pr-1">
        {items.length === 0 && (
          <div className="text-[10px] text-slate-500">{emptyText}</div>
        )}
        {items.map((it, idx) => (
          <div
            key={String(it.id || it._id || idx)}
            className="rounded-xl bg-white px-2 py-1.5 border border-slate-100 flex flex-col"
          >
            <span className="text-[11px] font-medium text-slate-800">
              {it[primaryKey] || "Unknown"}
            </span>
            {(secondaryKey || metaKey) && (
              <span className="text-[10px] text-slate-500">
                {secondaryKey && it[secondaryKey] ? it[secondaryKey] : ""}
                {secondaryKey && metaKey && it[metaKey] ? " · " : ""}
                {metaKey && it[metaKey] ? it[metaKey] : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleMomentsCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: AnyObj[];
  emptyText: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#00477f]">{title}</h3>
        <span className="text-[10px] text-slate-500">
          {items.length} upcoming
        </span>
      </div>
      <div className="space-y-2 text-[11px]">
        {items.length === 0 && (
          <p className="text-[11px] text-slate-500">{emptyText}</p>
        )}
        {items.map((p, idx) => {
          const name =
            p.fullName ||
            p.name ||
            `${p.firstName || ""} ${p.lastName || ""}`.trim() ||
            "Unknown";
          const dateStr = p.date || p.when || p.eventDate || "";
          const dt = dateStr ? new Date(dateStr) : null;
          const prettyDate = dt
            ? dt.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })
            : dateStr || "—";
          const years = p.years || p.yearsCompleted;

          return (
            <div
              key={String(p.id || p.employeeId || idx)}
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 border border-slate-100"
            >
              <div className="flex flex-col">
                <span className="font-medium text-slate-800">{name}</span>
                <span className="text-[10px] text-slate-500">
                  {p.roleTitle || p.designation || p.department || ""}
                </span>
              </div>
              <div className="text-right text-[10px] text-slate-600">
                <div className="font-medium">{prettyDate}</div>
                {years && (
                  <div className="text-[9px] text-slate-400">
                    completing {years} yr{years === 1 ? "" : "s"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const norm = (label || "").toLowerCase();
  let classes =
    "bg-slate-50 text-slate-700 border border-slate-200";
  if (norm.includes("present") || norm.includes("working")) {
    classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (norm.includes("leave") || norm.includes("holiday")) {
    classes = "bg-amber-50 text-amber-700 border border-amber-200";
  } else if (norm.includes("wfh") || norm.includes("remote")) {
    classes = "bg-sky-50 text-sky-700 border border-sky-200";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[3px] text-[10px] ${classes}`}
    >
      {label || "—"}
    </span>
  );
}

function MemberDrawer({
  member,
  onClose,
}: {
  member: AnyObj;
  onClose: () => void;
}) {
  const name =
    member.fullName ||
    member.name ||
    `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
    "Team member";

  const empId = member.employeeCode || member.employeeId || "—";
  const role = member.roleTitle || member.designation || member.role || "—";
  const dept = member.department || member.team || "—";
  const location = member.location || member.baseLocation || "—";
  const email = member.email || member.workEmail || "—";
  const phone = member.phone || member.mobile || "—";
  const joiningDate = member.joiningDate || member.dateOfJoining || "";
  const managerName = member.managerName || member.reportingManager || "You";

  const leaveBalance = member.leaveBalance ?? member.leavesRemaining;
  const ytdLeaves = member.ytdLeaves ?? member.leaveDaysYtd;
  const attendanceHealth =
    member.attendanceScore ??
    member.attendanceHealth ??
    member.attendancePercentage;

  const last1on1 = member.lastOneOnOne || member.lastCheckinDate;
  const notes = member.managerNotes || member.notes;

  // salary is intentionally NOT read / shown

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-slate-900/40">
      <div
        className="flex-1"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900">
              {name}
            </span>
            <span className="text-[11px] text-slate-500">
              Emp ID: {empId}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[11px]">
          {/* Role & org */}
          <section className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
            <h3 className="text-[11px] font-semibold text-slate-800 mb-1.5">
              Role &amp; org
            </h3>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <InfoRow label="Role" value={role} />
              <InfoRow label="Department / Team" value={dept} />
              <InfoRow label="Location" value={location} />
              <InfoRow label="Reporting to" value={managerName} />
              <InfoRow label="Date of joining" value={joiningDate || "—"} />
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
            <h3 className="text-[11px] font-semibold text-slate-800 mb-1.5">
              Contact details
            </h3>
            <div className="grid grid-cols-1 gap-y-1">
              <InfoRow label="Email" value={email} />
              <InfoRow label="Phone" value={phone} />
            </div>
          </section>

          {/* Leave & attendance snapshot */}
          <section className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
            <h3 className="text-[11px] font-semibold text-slate-800 mb-1.5">
              Leave &amp; attendance snapshot
            </h3>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <InfoRow
                label="Leave balance"
                value={
                  leaveBalance == null ? "—" : `${leaveBalance} day(s) remaining`
                }
              />
              <InfoRow
                label="Leave taken (YTD)"
                value={ytdLeaves == null ? "—" : `${ytdLeaves} day(s)`}
              />
              <InfoRow
                label="Attendance health"
                value={
                  attendanceHealth == null ? "—" : `${attendanceHealth}%`
                }
              />
              <InfoRow
                label="Last 1:1 / check-in"
                value={last1on1 || "—"}
              />
            </div>
          </section>

          {/* Manager notes – not salary */}
          <section className="rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-3">
            <h3 className="text-[11px] font-semibold text-slate-800 mb-1">
              Manager notes (private)
            </h3>
            <p className="text-[10px] text-slate-600">
              {notes
                ? notes
                : "You can use the Manager Notes field in HRMS to keep track of coaching points, strengths and follow-ups for this person."}
            </p>
          </section>

          <p className="text-[9px] text-slate-400">
            Salary &amp; compensation details are intentionally hidden from this
            view.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <span className="text-[11px] text-slate-800">{value || "—"}</span>
    </div>
  );
}
