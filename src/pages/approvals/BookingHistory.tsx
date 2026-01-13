// apps/frontend/src/pages/approvals/BookingHistory.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type Row = any;

function formatInr(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

function getId(r: any): string {
  return String(r?._id || r?.id || r?.requestId || "");
}

function shortReqCode(r: any) {
  const id = getId(r);
  return id ? `REQ-${String(id).slice(-6).toUpperCase()}` : "REQ-—";
}

function toLocal(dt: any) {
  if (!dt) return "";
  try {
    return new Date(String(dt)).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(dt);
  }
}

function norm(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");
}

function collectRoles(user: any): string[] {
  if (!user) return [];
  const out: string[] = [];
  if (Array.isArray(user.roles)) out.push(...user.roles);
  if (user.role) out.push(user.role);
  if (user.hrmsAccessRole) out.push(user.hrmsAccessRole);
  if (user.hrmsAccessLevel) out.push(user.hrmsAccessLevel);
  if (user.userType) out.push(user.userType);
  if (user.accountType) out.push(user.accountType);
  if (user.approvalRole) out.push(user.approvalRole);
  return out.map(norm).filter(Boolean);
}

function isAdminUser(user: any) {
  const roles = collectRoles(user);
  return (
    roles.includes("ADMIN") ||
    roles.includes("SUPERADMIN") ||
    roles.includes("SUPER_ADMIN") ||
    roles.includes("HR") ||
    roles.includes("HR_ADMIN")
  );
}

function csvEscape(v: any) {
  const s = String(v ?? "");
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadTextFile(filename: string, content: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function pickRows(payload: any): Row[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

/** Remove any sensitive info from strings shown to non-admin users */
function scrubSensitiveText(s: any, isAdmin: boolean) {
  const str = String(s ?? "");
  if (isAdmin) return str;

  // remove bracket tokens if present
  // e.g. [ACTUAL_BOOKING_PRICE:ENC:xxxx]
  let out = str.replace(/\[\s*ACTUAL_BOOKING_PRICE\s*:[^\]]*\]/gi, "");

  // also remove anything like ACTUAL_BOOKING_PRICE=... (if your format changes later)
  out = out.replace(/ACTUAL_BOOKING_PRICE\s*[:=]\s*[^\s\]]+/gi, "");

  // collapse extra spaces
  out = out.replace(/\s{2,}/g, " ").trim();

  return out;
}

/** Remove sensitive keys from latestParsed for non-admin UI */
function sanitizeLatest(latest: any, isAdmin: boolean) {
  const src = latest && typeof latest === "object" ? latest : {};
  if (isAdmin) return src;

  // shallow clone
  const out: any = { ...src };

  // delete any suspicious actual booking price keys (current + future-proof)
  for (const k of Object.keys(out)) {
    if (/actual\s*booking\s*price/i.test(k) || /actualBookingPrice/i.test(k)) {
      delete out[k];
    }
    if (/enc/i.test(k) && /booking/i.test(k) && /price/i.test(k)) {
      delete out[k];
    }
  }

  // scrub raw string if present
  if (out.raw) out.raw = scrubSensitiveText(out.raw, isAdmin);

  return out;
}

/** Make download url usable in browser (relative -> ok, absolute -> ok) */
function resolveUrl(u: any) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  return s;
}

export default function BookingHistory() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [stateFilter, setStateFilter] = useState<"all" | "done" | "cancelled">("all");
  const [search, setSearch] = useState("");

  // admin-only reveal map
  const [revealPrice, setRevealPrice] = useState<Record<string, boolean>>({});

  // details modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  const openDetails = useCallback((r: Row) => {
    setDetailRow(r);
    setDetailOpen(true);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailOpen(false);
    setDetailRow(null);
  }, []);

  // close on ESC
  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeDetails();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen, closeDetails]);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);

    try {
      const qs = new URLSearchParams();
      qs.set("states", "done,cancelled");

      // ✅ IMPORTANT: DO NOT prefix /api here.
      const path = isAdmin
        ? `/booking-history/admin/history?${qs.toString()}`
        : `/booking-history/history?${qs.toString()}`;

      const payload = await api.get<any>(path);
      setRows(pickRows(payload));
    } catch (e: any) {
      setRows([]);
      const msg = String(e?.message || "Failed to load booking history");

      if (msg.includes("Cannot GET") || msg.includes("404")) {
        setErr(
          "Booking History route not found. Check frontend call path: it must be /booking-history/... (NOT /api/booking-history/...)."
        );
      } else if (msg.toLowerCase().includes("session expired") || msg.includes("401")) {
        setErr("Session expired or not authorized. Please login again.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (stateFilter !== "all" && String(r?.adminState || "").toLowerCase() !== stateFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const latest = sanitizeLatest(r?._latestParsed || {}, isAdmin);
        const hay = [
          shortReqCode(r),
          r?.customerName,
          r?.customerId,
          r?.frontlinerEmail,
          r?.requesterEmail,
          r?.managerEmail,
          r?.approverEmail,
          latest?.mode,
          latest?.service,
          latest?.reason,
          latest?.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [rows, stateFilter, search, isAdmin]);

  function exportCsv() {
    const headers = [
      "RequestCode",
      "AdminState",
      "Customer",
      "RequesterEmail",
      "ManagerEmail",
      "CreatedAt",
      "UpdatedAt",
      "Mode",
      "Service",
      "Reason",
      "Note",
      "BookingAmount",
      ...(isAdmin ? ["ActualBookingPrice"] : []),
      "AttachmentDownloadUrl",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const r of filtered) {
      const latest = sanitizeLatest(r?._latestParsed || {}, isAdmin);
      const base = [
        shortReqCode(r),
        r?.adminState || "",
        r?.customerName || r?.customerId || "Workspace",
        r?.requesterEmail || r?.frontlinerEmail || "",
        r?.managerEmail || r?.approverEmail || "",
        toLocal(r?.createdAt),
        toLocal(r?.updatedAt),
        latest?.mode || "",
        latest?.service || "",
        latest?.reason || "",
        latest?.note || "",
        latest?.bookingAmount ?? "",
      ];

      if (isAdmin) base.push(latest?.actualBookingPrice ?? "");
      base.push(latest?.attachmentDownloadUrl || "");

      lines.push(base.map(csvEscape).join(","));
    }

    downloadTextFile(`booking-history-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  }

  // details computed
  const detailLatestRaw = detailRow?._latestParsed || {};
  const detailLatest = useMemo(() => sanitizeLatest(detailLatestRaw, isAdmin), [detailLatestRaw, isAdmin]);

  const detailMeta = useMemo(() => {
    if (!detailRow) return null;
    return {
      code: shortReqCode(detailRow),
      state: String(detailRow?.adminState || "").toUpperCase(),
      customer: detailRow?.customerName || detailRow?.customerId || "Workspace",
      requester: detailRow?.requesterEmail || detailRow?.frontlinerEmail || "—",
      approver: detailRow?.managerEmail || detailRow?.approverEmail || "—",
      createdAt: toLocal(detailRow?.createdAt),
      updatedAt: toLocal(detailRow?.updatedAt),
    };
  }, [detailRow]);

  const attachmentUrl = useMemo(() => resolveUrl(detailLatest?.attachmentDownloadUrl), [detailLatest]);

  const copyAdminJson = useCallback(async () => {
    if (!detailRow) return;
    const payload = {
      request: {
        id: getId(detailRow),
        code: shortReqCode(detailRow),
        state: detailRow?.adminState,
        customerName: detailRow?.customerName,
        customerId: detailRow?.customerId,
        requesterEmail: detailRow?.requesterEmail,
        managerEmail: detailRow?.managerEmail,
        createdAt: detailRow?.createdAt,
        updatedAt: detailRow?.updatedAt,
      },
      latestParsed: detailRow?._latestParsed || {},
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      // ignore
    }
  }, [detailRow]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-5">
      <div className="rounded-[32px] bg-gradient-to-b from-[#f5f7ff] via-white to-[#fff7f1] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Booking History</div>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900">Booked & Cancelled Requests</h1>
            <p className="mt-1 text-xs text-zinc-500">
              View booking outcomes, open details, and download the ticket/confirmation PDF.
              {isAdmin ? " (Admin: you can reveal Actual Booking Price.)" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">State</div>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
            >
              <option value="all">All</option>
              <option value="done">Done / Booked</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
              placeholder="Search by requester/customer/mode/reason…"
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
        )}

        {loading ? (
          <div className="mt-4 rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            Loading booking history…
          </div>
        ) : filtered.length ? (
          <div className="mt-4 space-y-3">
            {filtered.map((r) => {
              const latest = sanitizeLatest(r?._latestParsed || {}, isAdmin);
              const id = getId(r);
              const showActual = !!revealPrice[id];

              return (
                <div key={id} className="rounded-[28px] border border-zinc-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white">
                          {shortReqCode(r)}
                        </span>
                        <span className="rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200">
                          {String(r?.adminState || "").toUpperCase()}
                        </span>
                        {latest?.mode && (
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                            MODE: {latest.mode}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-[11px] text-zinc-600">
                        {r?.customerName || r?.customerId || "Workspace"} •{" "}
                        {r?.requesterEmail || r?.frontlinerEmail || "—"}
                      </div>

                      <div className="mt-1 text-[11px] text-zinc-600">
                        {latest?.service ? `SERVICE: ${latest.service}` : ""}
                        {latest?.reason ? ` • REASON: ${latest.reason}` : ""}
                      </div>

                      {latest?.note && (
                        <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                          {scrubSensitiveText(latest.note, isAdmin)}
                        </div>
                      )}

                      <div className="mt-1 text-[10px] text-zinc-500">
                        Created: {toLocal(r?.createdAt)} • Updated: {toLocal(r?.updatedAt)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="text-[11px] font-semibold text-zinc-700">
                        Booking Amount: <span className="text-zinc-900">{formatInr(latest?.bookingAmount)}</span>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-700">
                          Actual Booking Price:{" "}
                          <span className="text-zinc-900">
                            {showActual ? formatInr(latest?.actualBookingPrice) : "₹XXXXXX"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealPrice((m) => ({ ...m, [id]: !m[id] }))}
                            className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                            title={showActual ? "Hide" : "View"}
                          >
                            {showActual ? "🙈" : "👁"}
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openDetails(r)}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                          title="View booking details"
                        >
                          🔎 View details
                        </button>

                        {latest?.attachmentDownloadUrl ? (
                          <a
                            href={resolveUrl(latest.attachmentDownloadUrl)}
                            className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                          >
                            ⬇ Download PDF
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-500">No PDF</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            No records found.
          </div>
        )}
      </div>

      {/* ✅ Details Modal — NO JSON FOR NORMAL USERS */}
      {detailOpen && detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetails();
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#00477f]/10 via-white to-[#d06549]/10 px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Booking details</div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white">
                    {detailMeta?.code}
                  </span>
                  <span className="rounded-full bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {detailMeta?.state}
                  </span>
                  {detailLatest?.mode && (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                      MODE: {String(detailLatest.mode)}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-zinc-700">
                  <span className="font-semibold">Customer:</span> {detailMeta?.customer}
                </div>
                <div className="mt-1 text-[11px] text-zinc-700">
                  <span className="font-semibold">Requester:</span> {detailMeta?.requester}{" "}
                  <span className="text-zinc-400">•</span> <span className="font-semibold">Approver:</span>{" "}
                  {detailMeta?.approver}
                </div>

                <div className="mt-1 text-[10px] text-zinc-500">
                  Created: {detailMeta?.createdAt} • Updated: {detailMeta?.updatedAt}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  ✕ Close
                </button>

                {/* ✅ ADMIN ONLY */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void copyAdminJson()}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                    title="Admin: Copy JSON"
                  >
                    ⧉ Copy JSON
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[75vh] overflow-auto px-5 py-4">
              {/* Proper view format */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Service</div>
                  <div className="mt-1 text-[12px] font-semibold text-zinc-900">{String(detailLatest?.service || "—")}</div>
                  <div className="mt-1 text-[11px] text-zinc-700">
                    <span className="font-semibold">Reason:</span> {String(detailLatest?.reason || "—")}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Amount</div>
                  <div className="mt-1 text-[12px] font-semibold text-zinc-900">{formatInr(detailLatest?.bookingAmount)}</div>
                  <div className="mt-1 text-[11px] text-zinc-700">
                    <span className="font-semibold">Status:</span> {detailMeta?.state || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ticket</div>
                  {attachmentUrl ? (
                    <a
                      href={attachmentUrl}
                      className="mt-1 inline-flex w-fit rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                    >
                      ⬇ Download PDF
                    </a>
                  ) : (
                    <div className="mt-1 text-[11px] text-zinc-600">No ticket PDF attached</div>
                  )}
                  <div className="mt-1 text-[11px] text-zinc-600">Match itinerary inside the PDF.</div>
                </div>
              </div>

              {detailLatest?.note && (
                <div className="mt-4 rounded-[24px] border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-4 py-3">
                    <div className="text-[11px] font-semibold text-zinc-900">Note</div>
                  </div>
                  <div className="px-4 py-3 text-[12px] text-zinc-800">
                    {scrubSensitiveText(detailLatest.note, isAdmin)}
                  </div>
                </div>
              )}

              {/* ✅ Admin debug only (hidden for users) */}
              {isAdmin && (
                <div className="mt-4 rounded-[24px] border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-4 py-3">
                    <div className="text-[11px] font-semibold text-zinc-900">Admin debug</div>
                    <div className="mt-1 text-[11px] text-zinc-600">Raw payload for support/troubleshooting.</div>
                  </div>
                  <div className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-700">
                        View raw booking payload
                      </summary>
                      <pre className="mt-2 overflow-auto rounded-2xl bg-zinc-50 p-3 text-[11px] text-zinc-700">
                        {safeJson(detailRow?._latestParsed || {})}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              <div className="h-2" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
