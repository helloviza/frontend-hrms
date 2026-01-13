import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { consumeEmailActionToken } from "../../lib/approvalsApi";

type Action = "approved" | "declined" | "on_hold";
type UiState = "idle" | "loading" | "ok" | "error";

function normAction(a: string | null): Action | "" {
  const v = String(a || "").trim().toLowerCase();

  if (v === "approved" || v === "approve") return "approved";
  if (v === "declined" || v === "decline" || v === "rejected" || v === "reject") return "declined";
  if (v === "on_hold" || v === "hold" || v === "onhold") return "on_hold";

  return "";
}

function titleFor(action: Action) {
  if (action === "approved") return "Approve";
  if (action === "declined") return "Decline";
  return "On Hold";
}

function headingFor(state: UiState) {
  if (state === "loading") return "Processing…";
  if (state === "ok") return "Done";
  if (state === "error") return "Error";
  return "Approval action";
}

export default function EmailApprovalAction() {
  const [sp] = useSearchParams();

  const token = useMemo(() => (sp.get("t") || sp.get("token") || "").trim(), [sp]);
  const actionFromUrl = useMemo(() => normAction(sp.get("a")), [sp]);

  const [state, setState] = useState<UiState>(() => (!token ? "error" : "idle"));
  const [msg, setMsg] = useState<string>(() => (!token ? "Missing or invalid token." : ""));
  const [comment, setComment] = useState<string>("");

  // Guard React 18 StrictMode effect double-run (dev)
  const ranRef = useRef(false);

  async function act(action: Action) {
    try {
      if (!token) throw new Error("Missing token");

      setState("loading");
      setMsg("");

      // Keep payload compatible: action + optional comment
      const res: any = await consumeEmailActionToken({
        token,
        action,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });

      const fallback =
        action === "approved"
          ? "Approved successfully."
          : action === "declined"
            ? "Declined successfully."
            : "Marked as on hold successfully.";

      setMsg(res?.message || fallback);
      setState("ok");
    } catch (e: any) {
      setMsg(e?.message || "Failed to complete action.");
      setState("error");
    }
  }

  // One-click link support: auto-run when ?a= is present
  useEffect(() => {
    if (!token) return;
    if (!actionFromUrl) return;

    if (ranRef.current) return;
    ranRef.current = true;

    void act(actionFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, actionFromUrl]);

  const heading = headingFor(state);

  const showButtons = token && state === "idle" && !actionFromUrl;
  const showDoneHint = state === "ok" || state === "error";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6">
          <div className="text-sm font-semibold tracking-wide text-[#00477f]">PlumTrips HRMS</div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{heading}</h1>

          {!token ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Missing or invalid token.
            </div>
          ) : (
            <>
              <div className="mt-3 text-sm text-zinc-600">
                {state === "idle"
                  ? actionFromUrl
                    ? `Submitting: ${titleFor(actionFromUrl)}…`
                    : "Choose an action. This will route the request to Admin after approval."
                  : state === "loading"
                    ? "Please wait while we apply your decision."
                    : msg}
              </div>

              {showButtons && (
                <>
                  {/* Optional comment box (nice-to-have) */}
                  <div className="mt-5">
                    <label className="block text-xs font-semibold text-zinc-600 mb-2">
                      Comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-[#00477f]/20"
                      placeholder="Add a short note (optional)"
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => act("approved")}
                      className="rounded-xl bg-[#00477f] px-4 py-3 text-sm font-bold text-white hover:opacity-95"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => act("declined")}
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-800 hover:bg-zinc-50"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => act("on_hold")}
                      className="rounded-xl bg-[#d06549] px-4 py-3 text-sm font-bold text-white hover:opacity-95"
                    >
                      On Hold
                    </button>
                  </div>
                </>
              )}

              {showDoneHint && (
                <div className="mt-6 text-xs text-zinc-500">
                  You can close this tab now.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
