import { useEffect, useState } from "react";
import api from "../../lib/api";

export default function ApprovalsAdminQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [agentName, setAgentName] = useState("");
  const [comment, setComment] = useState("");

  async function load() {
    setMsg("");
    try {
      const res: any = await api.get("/approvals/admin/approved");
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load admin queue");
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function doAssign(id: string) {
    try {
      await api.put(`/approvals/admin/${id}/assign`, {
        agentType: "human",
        agentName,
        comment,
      });
      setAgentName("");
      setComment("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Assign failed");
    }
  }

  async function doState(id: string, action: "done" | "on-hold" | "cancel") {
    try {
      await api.put(`/approvals/admin/${id}/${action}`, { comment });
      setComment("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Action failed");
    }
  }

  return (
    <div className="bg-white/70 border border-black/10 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold">Admin Queue</div>
        <button
          onClick={load}
          className="text-xs px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Assign to (agent name)"
        />
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Admin comment (optional)"
        />
      </div>

      {!!msg && <div className="mt-2 text-sm text-ink/70">{msg}</div>}

      <div className="mt-3 space-y-2">
        {!rows.length && <div className="text-sm text-ink/60">No approved requests waiting.</div>}
        {rows.map((r) => (
          <div key={r._id} className="border border-black/10 bg-white rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{r.ticketId || r._id}</div>
                <div className="text-xs text-ink/60">
                  Customer: <b>{r.customerName || "-"}</b> · Approved by: <b>{r.approvedByEmail || "-"}</b>
                </div>
              </div>
              <div className="text-xs text-ink/60">
                Admin: <b>{String(r.adminState || "-")}</b>
              </div>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => doAssign(r._id)}
                className="px-3 py-2 rounded-xl text-sm bg-brand text-white hover:opacity-95"
              >
                Assign
              </button>
              <button
                onClick={() => doState(r._id, "done")}
                className="px-3 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:opacity-95"
              >
                Done
              </button>
              <button
                onClick={() => doState(r._id, "on-hold")}
                className="px-3 py-2 rounded-xl text-sm bg-amber-600 text-white hover:opacity-95"
              >
                On Hold
              </button>
              <button
                onClick={() => doState(r._id, "cancel")}
                className="px-3 py-2 rounded-xl text-sm bg-red-600 text-white hover:opacity-95"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
