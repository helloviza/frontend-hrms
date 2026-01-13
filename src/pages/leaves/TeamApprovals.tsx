// apps/frontend/src/pages/leaves/TeamApprovals.tsx
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

export default function TeamApprovals() {
  const { user } = useAuth(); // ✅ token removed
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.get("/leave/team"); // ✅ token auto handled
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      alert(e.message || "Failed to load team approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    try {
      await api.post(`/leave/${action}/${id}`, {}); // ✅ no token argument
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to update request");
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold text-[#00477f]">Team Leave Approvals</h1>

      <div className="rounded-2xl border bg-white overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Dates</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r: any) => (
              <tr key={r._id} className="border-t hover:bg-zinc-50 transition">
                <td className="p-3">{r.employee?.email ?? r.employeeName ?? "—"}</td>
                <td className="p-3">{r.type ?? "—"}</td>
                <td className="p-3">
                  {r.from ?? "—"} → {r.to ?? "—"}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(r._id, "approve")}
                      className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => act(r._id, "reject")}
                      className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-3 text-zinc-500" colSpan={4}>
                  No pending requests
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
