// apps/frontend/src/pages/dashboard/Employee.tsx
import { useEffect } from "react";
import AttendanceChart from "../../components/charts/AttendanceChart";
import LeavePie from "../../components/charts/LeavePie";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

// temporary demo data
const sampleAttendance = [
  { date: "01", present: 1 },
  { date: "02", present: 1 },
  { date: "03", present: 0 },
  { date: "04", present: 1 },
  { date: "05", present: 1 },
  { date: "06", present: 1 },
];

const sampleLeaves = [
  { name: "Casual", value: 4 },
  { name: "Sick", value: 2 },
  { name: "Paid", value: 8 },
];

export default function Employee() {
  const { user } = useAuth(); // token no longer exists in AuthCtx

  useEffect(() => {
    (async () => {
      try {
        // example API call (token automatically handled in api client)
        await api.get("/attendance/reports?range=month");
      } catch {
        // ignore demo error for now
      }
    })();
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">This Month</div>
          <div className="text-3xl font-semibold">18 / 20</div>
          <div className="text-xs text-emerald-600">Attendance</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">Leave Balance</div>
          <div className="text-3xl font-semibold">12</div>
          <div className="text-xs text-indigo-600">days remaining</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-zinc-500">Upcoming Holiday</div>
          <div className="text-3xl font-semibold">15 Aug</div>
          <div className="text-xs text-rose-600">Independence Day</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">
            Attendance (last 6 days)
          </div>
          <AttendanceChart data={sampleAttendance} />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium mb-2">Leave mix</div>
          <LeavePie data={sampleLeaves} />
        </div>
      </div>
    </div>
  );
}
