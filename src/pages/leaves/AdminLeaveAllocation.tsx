// apps/frontend/src/pages/leaves/AdminLeaveAllocation.tsx
import { Link } from "react-router-dom";

export default function AdminLeaveAllocation() {
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Hero */}
      <div className="rounded-3xl border border-indigo-100/70 bg-gradient-to-r from-[#eef2ff] via-[#f5f3ff] to-[#ecfeff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                ⚙️
              </span>
              <span>Leave Control Panel · Admin</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#00477f]">
              Leave allocation & annual quotas
            </h1>
            <p className="mt-1 text-xs text-slate-600 max-w-xl">
              This console is meant for{" "}
              <span className="font-semibold">Admin / SuperAdmin</span> to
              manage annual leave quotas for all employees – aligned with
              company policy, departments and special cases.
            </p>
            <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
              Version 1 is a{" "}
              <span className="font-medium">read-only / planning view</span>{" "}
              with placeholders for Excel import and per-employee overrides.
              We&apos;ll later wire this to real backend APIs.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 text-xs">
            <Link
              to="/leaves/my"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to My Leaves
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm max-w-xs text-left md:text-right">
              <div className="text-[11px] font-medium text-slate-700">
                Future roadmap
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                • Map leave policy types (CL, SL, PL) to each employee. <br />
                • Override quotas for specific people or roles. <br />
                • Sync allocations to payroll & attendance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Import / global actions */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Global actions
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              Use these actions to bulk manage leave quotas for the
              organisation. In this first cut, the buttons are placeholders –
              you can wire them to real upload / export APIs later.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-[6px] hover:bg-slate-100"
            >
              ⬆️ Upload allocation (Excel)
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-[6px] hover:bg-slate-50"
            >
              ⬇️ Download current allocation
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-[11px] text-slate-600">
          <p className="font-medium text-slate-700">
            Suggested Excel structure:
          </p>
          <p className="mt-1">
            <code className="bg-white px-1 py-[2px] rounded">
              EmployeeId, EmployeeName, Email, Department, Role, CL_Annual,
              SL_Annual, PL_Annual, CompOff_Policy, LOP_Allowed
            </code>
          </p>
          <p className="mt-1">
            You can later parse this on the backend and store it in a{" "}
            <span className="font-mono">leave_allocations</span> collection /
            table.
          </p>
        </div>
      </div>

      {/* Allocation table (static placeholder for now) */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#00477f]">
              Planned allocation view
            </h2>
            <p className="text-[11px] text-slate-500 max-w-xl">
              A sample layout of how per-employee allocation could look.
              We&apos;ll later replace this with real data from the backend or
              Excel import.
            </p>
          </div>
          <div className="text-[10px] text-slate-500">
            Policy types: CL = Casual, SL = Sick, PL = Privilege/Earned
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-100">
          <table className="w-full text-[11px] md:text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Employee
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Department / Role
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  CL (annual)
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  SL (annual)
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  PL (annual)
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Total (d)
                </th>
                <th className="p-3 text-left font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Static sample rows for now */}
              <tr className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-3 whitespace-nowrap">
                  Imran Ali ·{" "}
                  <span className="text-slate-500 text-[10px]">
                    EMP001 / imran@plumtrips.com
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  Product & Growth · Founder
                </td>
                <td className="p-3 text-center">6</td>
                <td className="p-3 text-center">6</td>
                <td className="p-3 text-center">12</td>
                <td className="p-3 text-center font-semibold">24</td>
                <td className="p-3 whitespace-nowrap">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-[4px] text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    Adjust
                  </button>
                </td>
              </tr>

              <tr className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-3 whitespace-nowrap">
                  Travel Ops Lead ·{" "}
                  <span className="text-slate-500 text-[10px]">
                    EMP010 / ops.lead@plumtrips.com
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  Operations · Team Lead
                </td>
                <td className="p-3 text-center">8</td>
                <td className="p-3 text-center">8</td>
                <td className="p-3 text-center">10</td>
                <td className="p-3 text-center font-semibold">26</td>
                <td className="p-3 whitespace-nowrap">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-[4px] text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    Adjust
                  </button>
                </td>
              </tr>

              <tr className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-3 whitespace-nowrap">
                  Sales Executive ·{" "}
                  <span className="text-slate-500 text-[10px]">
                    EMP025 / sales.exec@plumtrips.com
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  Corporate Sales · IC
                </td>
                <td className="p-3 text-center">6</td>
                <td className="p-3 text-center">6</td>
                <td className="p-3 text-center">8</td>
                <td className="p-3 text-center font-semibold">20</td>
                <td className="p-3 whitespace-nowrap">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-[4px] text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    Adjust
                  </button>
                </td>
              </tr>

              {/* Empty state hint */}
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-[11px] text-slate-500"
                >
                  In the real system this table will be populated from your{" "}
                  <span className="font-medium">leave_allocations</span> data
                  source or Excel upload.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
