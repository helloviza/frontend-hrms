// apps/frontend/src/pages/dashboard/Employee.tsx
import { useEffect, useState } from "react";
import AttendanceChart, { AttendancePoint } from "../../components/charts/AttendanceChart";
import LeavePie, { LeaveSlice } from "../../components/charts/LeavePie";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type LeaveItem = { type: string; status: string };

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
      <div className="grid grid-cols-3 gap-4 mt-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-28 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="h-48 bg-slate-200 rounded-xl" />
        <div className="h-48 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function Employee() {
  const { user } = useAuth();
  const [attendanceChart, setAttendanceChart] = useState<AttendancePoint[]>([]);
  const [attendanceStat, setAttendanceStat] = useState<{ present: number; total: number } | null>(null);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [attRes, leaveRes] = await Promise.all([
          api.get("/attendance/reports?range=month"),
          api.get("/leaves/my"),
        ]);

        const points: AttendancePoint[] = (attRes?.chart?.points ?? []).map(
          (p: { label: string; value: number }) => ({ date: p.label, present: p.value })
        );
        const present = points.filter((p) => p.present === 100).length;
        setAttendanceChart(points);
        setAttendanceStat({ present, total: points.length });

        setLeaves(leaveRes?.items ?? []);
      } catch {
        // api client handles 401 refresh; other errors leave state as empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const leavePie: LeaveSlice[] = Object.entries(
    leaves.reduce<Record<string, number>>((acc, item) => {
      const key = item.type.charAt(0) + item.type.slice(1).toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const approvedLeaves = leaves.filter((i) => i.status === "APPROVED").length;
  const pendingLeaves = leaves.filter((i) => i.status === "PENDING").length;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">This Month</div>
          <div className="text-3xl font-semibold">
            {attendanceStat ? `${attendanceStat.present} / ${attendanceStat.total}` : "—"}
          </div>
          <div className="text-xs text-emerald-600">Attendance</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">Leaves Approved</div>
          <div className="text-3xl font-semibold">{approvedLeaves}</div>
          <div className="text-xs text-indigo-600">this year</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">Pending Requests</div>
          <div className="text-3xl font-semibold">{pendingLeaves}</div>
          <div className="text-xs text-rose-600">awaiting approval</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">Attendance (this month)</div>
          {attendanceChart.length ? (
            <AttendanceChart data={attendanceChart} />
          ) : (
            <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">
              No attendance data
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">Leave mix</div>
          {leavePie.length ? (
            <LeavePie data={leavePie} />
          ) : (
            <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">
              No leave requests
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
