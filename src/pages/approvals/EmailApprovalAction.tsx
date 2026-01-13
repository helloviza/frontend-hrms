import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../lib/api";

export default function EmailApprovalAction() {
  const [sp] = useSearchParams();
  const token = sp.get("t") || "";
  const action = (sp.get("a") || "").toLowerCase();

  const valid = useMemo(() => {
    return !!token && (action === "approved" || action === "declined");
  }, [token, action]);

  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setMsg("");
    try {
      const res: any = await api.post("/approvals/email/consume", {
        token,
        action,
        comment,
      });
      setMsg(res?.message || "Recorded.");
    } catch (e: any) {
      setMsg(e?.message || "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-xl bg-white border border-black/10 rounded-2xl p-5">
        <div className="text-xl font-semibold">Approval Action</div>
        <div className="text-sm text-ink/60 mt-1">
          This page is opened from email.
        </div>

        {!valid && (
          <div className="mt-4 text-sm text-red-600">
            Invalid or missing approval link.
          </div>
        )}

        {valid && (
          <>
            <div className="mt-4 text-sm">
              Action: <b>{action.toUpperCase()}</b>
            </div>

            <div className="mt-3">
              <label className="text-sm text-ink/70">Comment (optional)</label>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                placeholder="Add a note…"
              />
            </div>

            <button
              disabled={busy}
              onClick={submit}
              className="mt-4 w-full rounded-xl bg-brand text-white px-4 py-2 text-sm hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Confirm"}
            </button>
          </>
        )}

        {!!msg && <div className="mt-4 text-sm text-ink/80">{msg}</div>}
      </div>
    </div>
  );
}
