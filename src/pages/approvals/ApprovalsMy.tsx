import { useEffect, useState } from "react";
import api from "../../lib/api";

export default function ApprovalsMy() {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    try {
      const res: any = await api.get("/approvals/requests/mine");
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="bg-white/70 border border-black/10 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold">My Requests</div>
        <button
          onClick={load}
          className="text-xs px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      {!!msg && <div className="mt-2 text-sm text-ink/70">{msg}</div>}

      <div className="mt-3 space-y-2">
        {!rows.length && <div className="text-sm text-ink/60">No requests found.</div>}
        {rows.map((r) => (
          <div key={r._id} className="border border-black/10 bg-white rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{r.ticketId || r._id}</div>
                <div className="text-xs text-ink/60">
                  Status: <b>{String(r.status || "-")}</b> · Admin: <b>{String(r.adminState || "-")}</b>
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
          </div>
        ))}
      </div>
    </div>
  );
}
