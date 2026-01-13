// apps/frontend/src/pages/customer/approvals/ApprovalMine.tsx
import React, { useEffect, useState } from "react";
import {
  getMyApprovalRequests,
  approverAction,
  type ApprovalRequest,
} from "../../../lib/approvalsApi";
import { useNavigate } from "react-router-dom";

/* ───────────────────────── helpers / styling ───────────────────────── */

function badge(status: string) {
  const s = String(status || "").toLowerCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";
  if (s === "approved") return `${base} bg-green-50 text-green-700 border-green-100`;
  if (s === "declined") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (s === "on_hold") return `${base} bg-amber-50 text-amber-800 border-amber-100`;
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

/** Simple AI-ish signal like ApproverInbox – purely heuristic UX */
function getAiSignal(request: ApprovalRequest) {
  const cartItems = (request.cartItems || []) as any[];
  const total = cartItems.reduce(
    (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
    0,
  );
  const note = String((request as any).comments || "").toLowerCase();

  if (total > 200000) {
    return {
      label: "High-value trip",
      toneClass:
        "bg-amber-50 text-amber-800 ring-1 ring-amber-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Higher than typical band – approval may need extra attention.",
    };
  }
  if (note.includes("urgent") || note.includes("today") || note.includes("tomorrow")) {
    return {
      label: "Time-sensitive",
      toneClass:
        "bg-rose-50 text-rose-700 ring-1 ring-rose-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Marked as urgent – keep an eye on response time.",
    };
  }
  if (note.includes("official") || note.includes("client") || note.includes("business")) {
    return {
      label: "Business intent",
      toneClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Clearly business-aligned reason.",
    };
  }
  if (!total || total === 0) {
    return {
      label: "Pre-approval",
      toneClass:
        "bg-sky-50 text-sky-700 ring-1 ring-sky-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
      desc: "Looks like a route pre-approval; fares may be attached later.",
    };
  }

  return {
    label: "Looks routine",
    toneClass:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
    desc: "Within a typical band for value and context.",
  };
}

/* ───────────────────────── details drawer ───────────────────────── */

function MyRequestDetailsDrawer({
  request,
  busyId,
  onClose,
  onRevoke,
  onEdit,
}: {
  request: ApprovalRequest;
  busyId: string | null;
  onClose: () => void;
  onRevoke: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const cartItems = (request.cartItems || []) as any[];
  const primary = cartItems[0] || {};
  const meta: any = primary.meta || {};

  const tripType =
    meta.tripType ||
    meta.trip_type ||
    meta.trip ||
    (meta.returnDate || meta.return_date ? "Round Trip" : "One Way");

  const origin = meta.origin || meta.from || meta.source || meta.depAirportCode;
  const destination =
    meta.destination || meta.to || meta.target || meta.arrAirportCode;

  const departDate =
    meta.departDate || meta.depart_date || meta.startDate || meta.date;
  const returnDate =
    meta.returnDate || meta.return_date || meta.endDate || meta.return;

  const cabinClass =
    meta.cabinClass || meta.cabin || meta.class || meta.travelClass;

  const preferredTime =
    meta.preferredTime ||
    meta.preferred_time ||
    meta.timePreference ||
    meta.timeSlot;

  const preferredAirline =
    meta.preferredAirline ||
    meta.preferred_airline ||
    meta.airline ||
    meta.carrier;

  const needBy =
    meta.needBy || meta.need_by || meta.latestApprovalBy || meta.requiredBy;

  const notes =
    meta.note ||
    meta.notes ||
    meta.reason ||
    meta.purpose ||
    (request as any).comments ||
    "";

  const status = String((request as any).status || "").toUpperCase();
  const total = cartItems.reduce(
    (s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
    0,
  );
  const history = ((request as any).history || []) as any[];

  const createdAt =
    (request as any).createdAt ||
    (request as any).submittedAt ||
    (request as any).created_at;
  const updatedAt = (request as any).updatedAt;

  const createdAtStr = createdAt
    ? new Date(String(createdAt)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
  const updatedAtStr = updatedAt
    ? new Date(String(updatedAt)).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const ai = getAiSignal(request);
  const id = (request as any)._id as string;
  const canModify =
    String((request as any).status || "").toLowerCase() === "pending" ||
    String((request as any).status || "").toLowerCase() === "on_hold";

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-hidden rounded-l-[28px] bg-gradient-to-b from-white via-[#f4f5ff] to-[#fff7f1] shadow-2xl">
        {/* Header */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-white via-[#f4f5ff] to-[#fff7f1] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Pluto Copilot · Your request
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                  {shortReqCode(request)}
                </div>
                <span className={badge((request as any).status)}>
                  {status}
                </span>
              </div>
              {(createdAtStr || updatedAtStr) && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  {createdAtStr && <>Raised on {createdAtStr}</>}
                  {createdAtStr && updatedAtStr && " • "}
                  {updatedAtStr && <>Last update {updatedAtStr}</>}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-black"
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
              <span className="text-zinc-600">{ai.desc}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex h-[calc(100%-4.25rem)] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-zinc-900">
            {/* Trip summary */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Trip summary
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {origin && destination ? (
                      <>
                        {origin} <span className="text-zinc-400">→</span>{" "}
                        {destination}
                      </>
                    ) : (
                      primary.title || primary.type || "Travel request"
                    )}
                  </div>
                  {tripType && (
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                      {tripType}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-zinc-900 px-3 py-2 text-right text-white shadow-sm">
                  <div className="text-[10px] text-zinc-200/80">Estimate</div>
                  <div className="text-sm font-semibold">{formatInr(total)}</div>
                  <div className="text-[10px] text-zinc-200/80">
                    {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {(departDate || returnDate || cabinClass) && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-800">
                  {departDate && (
                    <div className="rounded-full bg-zinc-100 px-3 py-1">
                      Depart:{" "}
                      <span className="font-medium">
                        {String(departDate)}
                      </span>
                    </div>
                  )}
                  {returnDate && (
                    <div className="rounded-full bg-zinc-100 px-3 py-1">
                      Return:{" "}
                      <span className="font-medium">
                        {String(returnDate)}
                      </span>
                    </div>
                  )}
                  {cabinClass && (
                    <div className="rounded-full bg-zinc-100 px-3 py-1">
                      Cabin:{" "}
                      <span className="font-medium">
                        {String(cabinClass)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Preferences / context */}
            {(preferredTime ||
              preferredAirline ||
              needBy ||
              notes ||
              Object.keys(meta || {}).length > 0) && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Preferences &amp; context
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-zinc-900 md:grid-cols-2">
                  {preferredAirline && (
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Preferred airline
                      </div>
                      <div className="text-[11px] font-semibold">
                        {String(preferredAirline)}
                      </div>
                    </div>
                  )}
                  {preferredTime && (
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Time preference
                      </div>
                      <div className="text-[11px] font-semibold">
                        {String(preferredTime)}
                      </div>
                    </div>
                  )}
                  {needBy && (
                    <div className="rounded-xl bg-zinc-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Need approval by
                      </div>
                      <div className="text-[11px] font-semibold">
                        {String(needBy)}
                      </div>
                    </div>
                  )}
                </div>

                {notes && (
                  <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-800">
                    <span className="mr-1 font-semibold text-zinc-500">
                      Note:
                    </span>
                    {String(notes)}
                  </div>
                )}
              </section>
            )}

            {/* Itinerary items */}
            {cartItems.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Itinerary items
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {cartItems.length} item
                    {cartItems.length !== 1 ? "s" : ""} • {formatInr(total)}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {cartItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">
                          {item.title || item.type || "Travel item"}
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          {String(item.type || "").toUpperCase() || "SERVICE"} •
                          &nbsp;Qty {item.qty || 1} • {formatInr(item.price)}
                        </div>
                        {item.description && (
                          <div className="mt-1 text-[11px] text-zinc-800">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Activity history */}
            {history.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Activity history
                </div>
                <ol className="mt-2 space-y-1 text-[11px] text-zinc-800">
                  {history.map((h, idx) => {
                    const ts =
                      h.ts || h.date || h.createdAt || h.updatedAt || null;
                    const tsStr = ts
                      ? new Date(String(ts)).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "";
                    const st = String(h.status || h.action || "").toUpperCase();
                    return (
                      <li
                        key={idx}
                        className="flex items-start gap-2 rounded-xl bg-zinc-50 px-3 py-2"
                      >
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
                        <div>
                          <div className="font-semibold">
                            {st || "UPDATED"}{" "}
                            {h.byEmail && (
                              <span className="font-normal text-zinc-500">
                                • {h.byEmail}
                              </span>
                            )}
                          </div>
                          {tsStr && (
                            <div className="text-[10px] text-zinc-500">
                              {tsStr}
                            </div>
                          )}
                          {h.note && (
                            <div className="mt-0.5 text-[11px] text-zinc-800">
                              {h.note}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>

          {/* Action bar */}
          <div className="border-t border-zinc-200 bg-white/80 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#00477f] text-[11px] text-white">
                  ⚡
                </span>
                <span>
                  You can update this request until it is fully approved /
                  declined.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(id)}
                  disabled={!canModify}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                >
                  Edit request
                </button>
                <button
                  type="button"
                  onClick={() => onRevoke(id)}
                  disabled={!canModify || busyId === id}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
                >
                  Revoke request
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── main page ───────────────────────────── */

export default function ApprovalMine() {
  const nav = useNavigate();
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailReq, setDetailReq] = useState<ApprovalRequest | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await getMyApprovalRequests();
      const list = res?.rows || [];
      // Optional: newest first
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
        "Failed to load";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit(id: string) {
    // The "new" page can read ?edit=<id> to pre-fill for editing
    nav(`/customer/approvals/new?edit=${id}`);
  }

  async function handleRevoke(id: string) {
    if (
      !window.confirm(
        "Do you want to revoke this request? Your approvers will no longer see it as active.",
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      // Backend should treat "revoked" as cancel-by-requester.
      // NOTE: This uses the existing approverAction helper to avoid changing approvalsApi.ts.
      await (approverAction as any)(id, { action: "revoked" });
      await load();
      if (detailReq && (detailReq as any)._id === id) {
        setDetailReq(null);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to revoke request";
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
                ✈
              </span>
              <span className="px-3">Pluto Copilot – My Travel Approvals</span>
            </div>
            <h1 className="mt-3 text-xl font-semibold text-zinc-900">
              My Requests
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              Track every approval, see Copilot signals, and update or revoke
              requests before ticketing.
            </p>
          </div>

          <button
            className="rounded-full bg-[#00477f] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767]"
            onClick={() => nav("/customer/approvals/new")}
          >
            + New Request
          </button>
        </div>

        {err ? (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            Loading your requests…
          </div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((r) => {
              const cartItems = (r.cartItems || []) as any[];
              const total = cartItems.reduce(
                (s: number, i: any) =>
                  s + (Number(i.price) || 0) * (Number(i.qty) || 1),
                0,
              );
              const primary = cartItems[0] || {};
              const meta: any = primary.meta || {};
              const origin = meta.origin || meta.from;
              const destination = meta.destination || meta.to;
              const segLabel =
                origin && destination
                  ? `${origin} → ${destination}`
                  : primary.title || primary.type || "Travel item";
              const updatedAtStr = r.updatedAt
                ? new Date(r.updatedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "";
              const ai = getAiSignal(r);
              const canModify =
                String(r.status || "").toLowerCase() === "pending" ||
                String(r.status || "").toLowerCase() === "on_hold";

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
                        {ai && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold ${ai.toneClass}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span>{ai.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {segLabel}
                      </div>

                      <div className="mt-1 text-[11px] text-zinc-500">
                        Last updated: {updatedAtStr || "—"}
                      </div>

                      {r.comments && (
                        <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                          <span className="mr-1 font-semibold text-zinc-500">
                            Note:
                          </span>
                          {r.comments}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className={badge(r.status)}>
                        {String(r.status || "").toUpperCase()}
                      </span>
                      {r.adminState && (
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                          ADMIN: {String(r.adminState).toUpperCase()}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setDetailReq(r)}
                        className="mt-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                      >
                        View details
                      </button>

                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit((r as any)._id as string)}
                          disabled={!canModify}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRevoke((r as any)._id as string)
                          }
                          disabled={!canModify || busyId === (r as any)._id}
                          className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            You haven&apos;t raised any approvals yet. Click{" "}
            <span className="font-semibold">New Request</span> to start a
            Pluto-assisted travel approval.
          </div>
        )}
      </div>

      {detailReq && (
        <MyRequestDetailsDrawer
          request={detailReq}
          busyId={busyId}
          onClose={() => setDetailReq(null)}
          onRevoke={handleRevoke}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
