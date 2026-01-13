import { useEffect, useState } from "react";
import api from "../../lib/api";

export default function ApprovalsInbox() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [comment, setComment] = useState<string>("");

  async function load() {
    setMsg("");
    try {
      const res: any = await api.get("/approvals/requests/inbox");
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load inbox (you might not be the configured approver).");
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "approved" | "declined" | "on_hold") {
    try {
      await api.put(`/approvals/requests/${id}/action`, { action, comment });
      setComment("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update");
    }
  }

  return (
    <div className="bg-white/70 border border-black/10 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold">Approver Inbox</div>
        <button
          onClick={load}
          className="text-xs px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3">
        <label className="text-sm text-ink/70">Comment (optional)</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Add a note for this decision…"
        />
      </div>

      {!!msg && <div className="mt-2 text-sm text-ink/70">{msg}</div>}

      <div className="mt-3 space-y-2">
        {!rows.length && <div className="text-sm text-ink/60">No pending requests.</div>}
        {rows.map((r) => (
          <div key={r._id} className="border border-black/10 bg-white rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{r.ticketId || r._id}</div>
                <div className="text-xs text-ink/60">
                  By: <b>{r.frontlinerEmail}</b> · Customer: <b>{r.customerName || "-"}</b>
                </div>
              </div>
              <div className="text-xs text-ink/60">
                {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ""}
              </div>
            </div>

            <div className="mt-2 text-sm text-ink/80">
              Items: <b>{Array.isArray(r.cartItems) ? r.cartItems.length : 0}</b>
              {r.comments ? <span className="ml-2 text-ink/60">· {r.comments}</span> : null}
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => act(r._id, "approved")}
                className="px-3 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:opacity-95"
              >
                Approve
              </button>
              <button
                onClick={() => act(r._id, "on_hold")}
                className="px-3 py-2 rounded-xl text-sm bg-amber-600 text-white hover:opacity-95"
              >
                On Hold
              </button>
              <button
                onClick={() => act(r._id, "declined")}
                className="px-3 py-2 rounded-xl text-sm bg-red-600 text-white hover:opacity-95"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
