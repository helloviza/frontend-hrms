// apps/frontend/src/pages/customer/approvals/ApproverInbox.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getApproverInbox,
  approverAction,
  type ApprovalRequest,
} from "../../../lib/approvalsApi";

// ✅ Correct path (as per your note)
import { ApprovalItemsDetail } from "../components/approvals/ApprovalItemDetails";

type ApproverAction = "approved" | "declined" | "on_hold";

function badge(status: string) {
  const s = String(status || "").toLowerCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";
  if (s === "approved") return `${base} bg-green-50 text-green-700 border-green-100`;
  if (s === "declined") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (s === "on_hold") return `${base} bg-amber-50 text-amber-800 border-amber-100`;
  if (s === "pending") return `${base} bg-sky-50 text-sky-700 border-sky-100`;
  return `${base} bg-zinc-50 text-zinc-700 border-zinc-200`;
}

function formatInr(num: number | null | undefined) {
  const v = Number(num || 0);
  if (!Number.isFinite(v)) return "₹0";
  return `₹${v.toLocaleString("en-IN")}`;
}

function shortReqCode(r: ApprovalRequest) {
  if ((r as any).ticketId) return (r as any).ticketId as string;
  return `REQ-${String((r as any)._id || "").slice(-6).toUpperCase()}`;
}

function normalizeTripType(v: any): "oneway" | "roundtrip" | "multicity" | "" {
  const s = String(v || "").toLowerCase().trim();
  if (!s) return "";
  if (s === "roundtrip" || s === "round_trip" || s === "round trip") return "roundtrip";
  if (s === "oneway" || s === "one_way" || s === "one way") return "oneway";
  if (s === "multicity" || s === "multi_city" || s === "multi city") return "multicity";
  return s as any;
}

function tripTypeLabel(v: any) {
  const t = normalizeTripType(v);
  if (t === "roundtrip") return "Round Trip";
  if (t === "multicity") return "Multi City";
  if (t === "oneway") return "One Way";
  return "";
}

/**
 * ✅ Trip summary should be based on the FLIGHT item meta (if present)
 * Falls back to cartItems[0].meta when no flight is present.
 */
function pickTripMeta(cartItems: any[]) {
  const flight = cartItems.find((x) => String(x?.type || "").toLowerCase() === "flight");
  const primary = cartItems[0];
  const meta = (flight?.meta || primary?.meta || {}) as any;

  const origin = meta.origin || meta.from || meta.source || meta.depAirportCode || "";
  const destination = meta.destination || meta.to || meta.target || meta.arrAirportCode || "";

  const tt =
    meta.tripType ||
    meta.trip_type ||
    meta.trip ||
    (meta.returnDate || meta.return_date ? "roundtrip" : "");

  return { meta, origin, destination, tripType: tt };
}

/** Tiny heuristic “AI signal” so it feels like an assisted flow */
function getAiSignal(request: ApprovalRequest) {
  const cartItems = (request.cartItems || []) as any[];
  const total = cartItems.reduce(
    (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
    0
  );
  const note = String((request as any).comments || "").toLowerCase();

  if (total > 200000) {
    return {
      label: "High-value trip",
      toneClass:
        "bg-amber-50 text-amber-800 ring-1 ring-amber-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Amount is higher than typical; double-check purpose and policy fit.",
    };
  }
  if (note.includes("urgent") || note.includes("today") || note.includes("tomorrow")) {
    return {
      label: "Time-sensitive",
      toneClass:
        "bg-rose-50 text-rose-700 ring-1 ring-rose-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Marked as urgent; consider response speed along with policy.",
    };
  }
  if (note.includes("official") || note.includes("client") || note.includes("business")) {
    return {
      label: "Business intent",
      toneClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Reason looks business-aligned; check budget & traveller profile.",
    };
  }
  if (!total || total === 0) {
    return {
      label: "Awaiting fare",
      toneClass:
        "bg-sky-50 text-sky-700 ring-1 ring-sky-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "No fare attached yet; treat as pre-approval for the route.",
    };
  }

  return {
    label: "Looks routine",
    toneClass:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
    desc: "Request looks within a typical band for value and context.",
  };
}

/* ───────────────────────── Request Drawer (unchanged) ───────────────────── */

function ApproverDetailsDrawer({
  request,
  busyId,
  onClose,
  onAction,
}: {
  request: ApprovalRequest;
  busyId: string | null;
  onClose: () => void;
  onAction: (id: string, action: ApproverAction) => void;
}) {
  const cartItems = (request.cartItems || []) as any[];

  const total = useMemo(() => {
    return cartItems.reduce(
      (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
      0
    );
  }, [cartItems]);

  const { meta, origin, destination, tripType } = useMemo(
    () => pickTripMeta(cartItems),
    [cartItems]
  );

  const primary = cartItems[0] || {};

  const departDate = meta.departDate || meta.depart_date || meta.startDate || meta.date;
  const returnDate = meta.returnDate || meta.return_date || meta.endDate || meta.return;

  const cabinClass = meta.cabinClass || meta.cabin || meta.class || meta.travelClass;

  const preferredTime =
    meta.preferredTime || meta.preferred_time || meta.timePreference || meta.timeSlot;

  const preferredAirline =
    meta.preferredAirline || meta.preferred_airline || meta.airline || meta.carrier;

  const needBy = meta.needBy || meta.need_by || meta.latestApprovalBy || meta.requiredBy;

  const notes =
    meta.note ||
    meta.notes ||
    meta.reason ||
    meta.purpose ||
    (request as any).comments ||
    "";

  const status = String((request as any).status || "").toUpperCase();
  const history = ((request as any).history || []) as any[];

  const createdAt =
    (request as any).createdAt || (request as any).submittedAt || (request as any).created_at;

  const createdAtStr = createdAt
    ? new Date(String(createdAt)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const ai = getAiSignal(request);

  const summaryTitle =
    origin && destination
      ? `${origin} → ${destination}`
      : primary.title || primary.type || "Travel request";

  const summaryTripType = tripTypeLabel(tripType);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-hidden rounded-l-[28px] bg-gradient-to-b from-[#020617] via-[#020617] to-[#020617] shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-[#0f172a] via-[#020617] to-[#111827] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/80">
                Pluto Copilot · Approval Lens
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                  {shortReqCode(request)}
                </div>
                <span className={badge((request as any).status)}>{status}</span>
              </div>
              {createdAtStr && (
                <div className="mt-1 text-[11px] text-slate-300">Raised on {createdAtStr}</div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-50 hover:bg-white/20"
            >
              ✕ Close
            </button>
          </div>

          {ai && (
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <div
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${ai.toneClass}`}
              >
                <span className="text-[10px]">◎</span>
                <span>{ai.label}</span>
              </div>
              <span className="text-slate-300/80">{ai.desc}</span>
            </div>
          )}
        </div>

        <div className="flex h-[calc(100%-4.25rem)] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-slate-50">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-900/50 via-slate-900/80 to-indigo-900/40 p-4 shadow-lg shadow-black/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-sky-300/80">
                    Trip summary
                  </div>
                  <div className="mt-1 text-sm font-semibold">{summaryTitle}</div>
                  {summaryTripType && (
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                      {summaryTripType}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-900/80 px-3 py-2 text-right shadow-inner shadow-black/40">
                  <div className="text-[10px] text-slate-400">Estimate</div>
                  <div className="text-sm font-semibold">{formatInr(total)}</div>
                  <div className="text-[10px] text-slate-400">
                    {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {(departDate || returnDate || cabinClass || preferredTime || preferredAirline || needBy) ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-200">
                  {departDate ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Depart</div>
                      <div className="font-semibold">{String(departDate)}</div>
                    </div>
                  ) : null}
                  {returnDate ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Return</div>
                      <div className="font-semibold">{String(returnDate)}</div>
                    </div>
                  ) : null}
                  {cabinClass ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Cabin</div>
                      <div className="font-semibold">{String(cabinClass)}</div>
                    </div>
                  ) : null}
                  {preferredTime ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Preferred time</div>
                      <div className="font-semibold">{String(preferredTime)}</div>
                    </div>
                  ) : null}
                  {preferredAirline ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Preferred airline</div>
                      <div className="font-semibold">{String(preferredAirline)}</div>
                    </div>
                  ) : null}
                  {needBy ? (
                    <div className="rounded-xl bg-white/5 px-3 py-2">
                      <div className="text-[10px] text-slate-400">Need by</div>
                      <div className="font-semibold">{String(needBy)}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {notes ? (
                <div className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-[11px] text-slate-100">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Notes
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{String(notes)}</div>
                </div>
              ) : null}
            </section>

            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-white/8 bg-slate-900/70 p-4">
                <ApprovalItemsDetail items={cartItems} />
              </section>
            )}

            {history.length > 0 && (
              <section className="rounded-2xl border border-white/8 bg-slate-900/70 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Activity history
                </div>
                <ol className="mt-2 space-y-1 text-[11px] text-slate-100">
                  {history.map((h, idx) => {
                    const ts = h.ts || h.date || h.createdAt || h.updatedAt || h.at || null;
                    const tsStr = ts
                      ? new Date(String(ts)).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "";
                    const st = String(h.status || h.action || "").toUpperCase();
                    const byEmail = h.byEmail || h.userEmail || h.email || "";
                    const note = h.note || h.comment || "";

                    return (
                      <li key={idx} className="flex items-start gap-2 rounded-xl bg-slate-800/80 px-3 py-2">
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-sky-400" />
                        <div>
                          <div className="font-semibold">
                            {st || "UPDATED"}{" "}
                            {byEmail && <span className="font-normal text-slate-300">• {byEmail}</span>}
                          </div>
                          {tsStr && <div className="text-[10px] text-slate-400">{tsStr}</div>}
                          {note && <div className="mt-0.5 text-[11px] text-slate-100">{note}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>

          {(String((request as any).status).toLowerCase() === "pending" ||
            String((request as any).status).toLowerCase() === "on_hold") && (
            <div className="border-t border-white/10 bg-slate-950/80 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/80 text-[11px]">
                    ⚡
                  </span>
                  <span>Decide here, we will sync this decision with your HRMS approvals.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === (request as any)._id}
                    onClick={() => onAction((request as any)._id, "approved")}
                    className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === (request as any)._id}
                    onClick={() => onAction((request as any)._id, "on_hold")}
                    className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
                  >
                    Hold
                  </button>
                  <button
                    disabled={busyId === (request as any)._id}
                    onClick={() => onAction((request as any)._id, "declined")}
                    className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Inbox main page ───────────────────────────── */

export default function ApproverInbox() {
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detailReq, setDetailReq] = useState<ApprovalRequest | null>(null);

  async function loadRequests() {
    setErr(null);
    setLoading(true);
    try {
      const res = await getApproverInbox();
      const list = (res?.rows || []) as any[];
      list.sort((a: any, b: any) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setRows(list);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load inbox";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function actRequest(id: string, action: ApproverAction) {
    setBusyId(id);
    try {
      await approverAction(id, { action });
      await loadRequests();
      if (detailReq && (detailReq as any)._id === id) setDetailReq(null);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Action failed";
      setErr(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 pb-8">
      <div className="rounded-[32px] bg-gradient-to-b from-[#f5f7ff] via-white to-[#fff7f1] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-black text-[10px] font-semibold text-white shadow-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px]">
                ⚡
              </span>
              <span className="px-3">Pluto Copilot – Approval Signals</span>
            </div>

            <h1 className="mt-3 text-xl font-semibold text-zinc-900">Approver Inbox (L2)</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Travel requests awaiting your approval decision.
            </p>
          </div>

          <button
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            onClick={() => loadRequests()}
          >
            ↻ Refresh
          </button>
        </div>

        {err ? (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600 shadow-sm">
            Loading your approver inbox…
          </div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((r) => {
              const cartItems = (r.cartItems || []) as any[];
              const total = cartItems.reduce(
                (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
                0
              );

              const { origin, destination, tripType } = pickTripMeta(cartItems);
              const primary = cartItems[0] || {};
              const segLabel =
                origin && destination
                  ? `${origin} → ${destination}`
                  : primary.title || primary.type || "Travel item";

              const tripLabel = tripTypeLabel(tripType);
              const ai = getAiSignal(r);

              return (
                <div
                  key={(r as any)._id}
                  className="rounded-[28px] border border-zinc-100 bg-white px-4 py-3 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white">
                          {shortReqCode(r)}
                        </div>

                        <span className="text-[11px] text-zinc-500">
                          Items {cartItems.length} • {formatInr(total)}
                        </span>

                        {tripLabel ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                            {tripLabel}
                          </span>
                        ) : null}

                        {ai && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold ${ai.toneClass}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span>{ai.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm font-semibold text-zinc-900">{segLabel}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={badge((r as any).status)}>
                        {String((r as any).status || "").toUpperCase()}
                      </span>

                      <button
                        type="button"
                        onClick={() => setDetailReq(r)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                      >
                        View details
                      </button>

                      {(String((r as any).status).toLowerCase() === "pending" ||
                        String((r as any).status).toLowerCase() === "on_hold") ? (
                        <div className="mt-1 flex gap-2">
                          <button
                            disabled={busyId === (r as any)._id}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                            onClick={() => actRequest((r as any)._id as string, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === (r as any)._id}
                            className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
                            onClick={() => actRequest((r as any)._id as string, "on_hold")}
                          >
                            Hold
                          </button>
                          <button
                            disabled={busyId === (r as any)._id}
                            className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                            onClick={() => actRequest((r as any)._id as string, "declined")}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-500">No actions available</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            Your approver inbox is empty.
          </div>
        )}
      </div>

      {detailReq && (
        <ApproverDetailsDrawer
          request={detailReq}
          busyId={busyId}
          onClose={() => setDetailReq(null)}
          onAction={actRequest}
        />
      )}
    </div>
  );
}
