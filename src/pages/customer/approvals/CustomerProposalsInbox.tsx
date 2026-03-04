// apps/frontend/src/pages/customer/approvals/CustomerProposalsInbox.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  customerProposalAction,
  getMyProposals,
  getProposalById,
  openProposalAttachment,
  type CustomerProposalAction,
  type MyProposalsScope,
  type ProposalDoc,
  type ProposalOption,
  type ProposalLineItem,
} from "../../../lib/proposalsApi";

type DrawerMode = "details" | "action";
type ViewMode = "summary" | "detailed";
type StatusFilter = ProposalDoc["status"] | "ALL";

/* ------------------------------------------------------------- */
/* Helpers                                                       */
/* ------------------------------------------------------------- */

function fmtMoney(amount?: number, currency?: string) {
  if (amount == null) return "—";
  const c = currency || "INR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${c} ${amount}`;
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function shortId(id?: string) {
  const s = String(id || "");
  if (!s) return "—";
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function statusClass(status: ProposalDoc["status"]) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    case "DECLINED":
      return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
    case "SUBMITTED":
      return "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200";
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
    case "EXPIRED":
      return "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300";
    default:
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
  }
}

function scopeLabel(scope?: MyProposalsScope) {
  if (scope === "WORKSPACE_L0") return "Company view (L0)";
  return "My view";
}

function ensureArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function getBestOption(p: ProposalDoc | null | undefined): ProposalOption | null {
  const opts = ensureArray(p?.options);
  if (!opts.length) return null;
  // pick highest totalAmount as “best option”
  return [...opts].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))[0] || null;
}

function deriveRouteLabel(p: ProposalDoc | null | undefined): string {
  const anyP: any = p as any;

  // Prefer backend-enriched request summary if present
  const rs = anyP?.requestSummary || anyP?._requestSummary;
  if (rs?.routeLabel) return String(rs.routeLabel);
  if (rs?.route) return String(rs.route);
  if (rs?.tripLabel) return String(rs.tripLabel);

  const opt = getBestOption(p);
  const t = String(opt?.title || "").trim();
  if (t) return t;

  // ✅ Option A: never show Mongo requestId; only show _requestCode if present
  const reqCode = String(anyP?._requestCode || "").trim();
  return reqCode ? `Request ${reqCode}` : "—";
}

function approvalPill(decision?: string) {
  const d = String(decision || "PENDING").toUpperCase();
  if (d === "APPROVED") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (d === "DECLINED") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
}

function computeApprovalProgress(p: ProposalDoc | null | undefined) {
  const l2 = String((p as any)?.approvals?.l2?.decision || "PENDING").toUpperCase();
  const l0 = String((p as any)?.approvals?.l0?.decision || "PENDING").toUpperCase();

  // ✅ For now: L0 is OPTIONAL (future: make this dynamic from backend)
  const l0Required = false;

  const isDeclined = l2 === "DECLINED" || l0 === "DECLINED";
  const isFullyApproved = l2 === "APPROVED" && (!l0Required || l0 === "APPROVED");

  // “Partial” only makes sense when L0 is actually required
  const isPartial = l0Required && l2 === "APPROVED" && l0 === "PENDING";

  let label = "Waiting";
  if (isDeclined) label = "Declined";
  else if (isFullyApproved) label = "Approved";
  else if (isPartial) label = "Partially approved";
  else label = "Waiting approvals";

  return { l2, l0, isFullyApproved, isDeclined, isPartial, label, l0Required };
}

/**
 * ✅ UI-only status override:
 * If L2 is final approval (L0 optional) and L2 is APPROVED/DECLINED,
 * show that status in UI even if backend proposal.status is still SUBMITTED.
 */
function getUiStatus(p: ProposalDoc | null | undefined): ProposalDoc["status"] {
  const st = (p?.status || "SUBMITTED") as ProposalDoc["status"];
  const ap = computeApprovalProgress(p);

  if (ap.isDeclined) return "DECLINED";
  if (ap.isFullyApproved) return "APPROVED";

  return st;
}

function isoDateOnly(v?: string | Date | null) {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  // if it's already ISO, keep it; if it's Date.toString, still slice safe
  return s.length >= 10 ? s.slice(0, 10) : s;
}


/* ------------------------------------------------------------- */
/* Drawer                                                        */
/* ------------------------------------------------------------- */

function DrawerShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-hidden rounded-l-[28px] bg-white shadow-2xl">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-[#f5f7ff] via-white to-[#fff7f1] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                PlumTrips · Proposal Console
              </div>
              <div className="mt-1 text-base font-semibold text-zinc-900">{title}</div>
              {subtitle ? <div className="mt-1 text-xs text-zinc-600">{subtitle}</div> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-5rem)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */
/* Component                                                     */
/* ------------------------------------------------------------- */

export default function CustomerProposalsInbox() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProposalDoc[]>([]);
  const [scope, setScope] = useState<MyProposalsScope>("USER");
  const [q, setQ] = useState("");
  const [errMsg, setErrMsg] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ProposalDoc | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("details");

  const [viewMode, setViewMode] = useState<ViewMode>("summary");

  const [actionType, setActionType] = useState<CustomerProposalAction>("accept");
  const [actionNote, setActionNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const [openOpt, setOpenOpt] = useState<number | null>(null);
  const optionsAnchorRef = useRef<HTMLDivElement | null>(null);

  /* --------------------- Data Loading --------------------- */

  async function loadList() {
    setLoading(true);
    setErrMsg("");
    try {
      const payload = await getMyProposals();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setScope((payload?.scope as MyProposalsScope) || "USER");
    } catch (e: any) {
      setItems([]);
      setScope("USER");
      setErrMsg(String(e?.message || "Failed to load proposals"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    setErrMsg("");
    try {
      const payload = await getProposalById(id);
      setDetail(payload?.proposal || null);
    } catch (e: any) {
      setDetail(null);
      setErrMsg(String(e?.message || "Failed to load proposal details"));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  /* --------------------- Derived --------------------- */

  const stats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of items) {
      const ui = getUiStatus(p);
      map[ui] = (map[ui] || 0) + 1;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return items.filter((x) => {
      const uiStatus = getUiStatus(x);

      if (statusFilter !== "ALL" && uiStatus !== statusFilter) return false;

      if (!term) return true;

      const opt = getBestOption(x);
      const route = opt?.title || "";
      const approvals = `${(x as any)?.approvals?.l2?.decision || ""} ${(x as any)?.approvals?.l0?.decision || ""}`;

      return [
        x._id,
        String((x as any)?._requestCode || ""),
        x.status, // backend status (kept)
        uiStatus, // ✅ ui status (added)
        x.currency,
        String(x.totalAmount ?? ""),
        String(x.version ?? ""),
        route,
        approvals,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, q, statusFilter]);

  const selectedSummary = useMemo(() => {
    if (!selectedId) return null;
    return items.find((x) => x._id === selectedId) || null;
  }, [items, selectedId]);

  // ✅ Action allowed only when:
  // - proposal status is SUBMITTED
  // - AND current logged-in user is the request owner (backend returns _isOwner on /:id)
  const canAct = useMemo(() => {
    const st = detail?.status || selectedSummary?.status;
    return st === "SUBMITTED" && detail?._isOwner === true;
  }, [detail?._isOwner, detail?.status, selectedSummary?.status]);

  const isOwner = useMemo(() => detail?._isOwner === true, [detail?._isOwner]);

  const bestOpt = useMemo(() => getBestOption(detail), [detail]);
  const displayTotal = useMemo(() => {
    const amt = bestOpt?.totalAmount ?? detail?.totalAmount;
    const cur = bestOpt?.currency ?? detail?.currency;
    return { amt, cur };
  }, [bestOpt, detail]);

  function openDrawer(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
    setDrawerMode("details");
    setViewMode("summary");
    setActionType("accept");
    setActionNote("");
    setOpenOpt(null);
    void loadDetail(id);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerMode("details");
    setViewMode("summary");
    setActionType("accept");
    setActionNote("");
    setOpenOpt(null);
    setDetail(null);
    setSelectedId(null);
  }

  function startAction(a: CustomerProposalAction) {
    setActionType(a);
    setActionNote("");
    setDrawerMode("action");
  }

  function toggleStatusFilter(s: ProposalDoc["status"]) {
    setStatusFilter((prev) => (prev === s ? "ALL" : s));
  }

  function goDetailedProposal() {
    setViewMode("detailed");
    // Open first option by default to avoid “blank/what is inside?” confusion
    const firstNo = Number((detail?.options?.[0] as any)?.optionNo || 1);
    setOpenOpt(firstNo);
    // smooth scroll to options area
    setTimeout(() => {
      optionsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  /* --------------------- Actions --------------------- */

  async function submitAction() {
    if (!selectedId) return;
    if (!detail?._isOwner) return;

    setActionBusy(true);
    setErrMsg("");
    try {
      await customerProposalAction(selectedId, { action: actionType, note: actionNote });
      await Promise.all([loadList(), loadDetail(selectedId)]);
      setDrawerMode("details");
      setActionNote("");
    } catch (e: any) {
      setErrMsg(String(e?.message || "Failed to submit action"));
    } finally {
      setActionBusy(false);
    }
  }

  /* ------------------------------------------------------------- */

  return (
    <div className="py-6 space-y-6">
      {/* ---------------- Header ---------------- */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-zinc-900">Proposals</h1>

          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200">
            {scopeLabel(scope)}
          </span>

          {statusFilter !== "ALL" ? (
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-black"
              title="Clear status filter"
            >
              Filter: {statusFilter} · Clear
            </button>
          ) : null}
        </div>

        <p className="text-sm text-zinc-500">
          Filter, review, and take actions. For approvals: currently <b>L2 approval</b> is treated as{" "}
          <b>final approval</b>. (We can enable <b>L0-required</b> later based on amount thresholds.)
        </p>

        {errMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errMsg}
          </div>
        ) : null}
      </div>

      {/* ---------------- Status Strip (NOW CLICKABLE FILTERS) ---------------- */}
      <div className="flex flex-wrap gap-3">
        {(["SUBMITTED", "APPROVED", "DECLINED", "DRAFT"] as const).map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatusFilter(s)}
              className={[
                "px-4 py-2 rounded-xl border bg-white shadow-sm text-left transition",
                active ? "border-slate-900 ring-2 ring-slate-900/20" : "hover:bg-zinc-50",
              ].join(" ")}
              title={active ? "Click to clear this filter" : `Filter by ${s}`}
            >
              <div className="text-xs text-zinc-500 flex items-center gap-2">
                <span>{s}</span>
                {active ? (
                  <span className="rounded-full bg-slate-900 px-2 py-[2px] text-[10px] font-semibold text-white">
                    ACTIVE
                  </span>
                ) : null}
              </div>
              <div className="text-lg font-semibold text-zinc-900">{stats[s] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* ---------------- Search ---------------- */}
      <div className="flex items-center gap-3">
        <input
          className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          placeholder="Search by request ID, route, status, approval…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="px-4 py-2 rounded-lg border text-sm hover:bg-zinc-50 disabled:opacity-60"
          onClick={() => void loadList()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ---------------- List ---------------- */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-zinc-500">Loading proposals…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="text-lg font-medium text-zinc-800">No proposals found</div>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">Try clearing filters or adjusting search terms.</p>
            {statusFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Clear status filter
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((p) => {
              const opt = getBestOption(p);
              const amt = opt?.totalAmount ?? p.totalAmount;
              const cur = opt?.currency ?? p.currency;

              const approvals = computeApprovalProgress(p);
              const uiStatus = getUiStatus(p);

              // show customer action state if already recorded
              const customerTag = p?.customer?.action ? String(p.customer.action).toUpperCase() : "";

              // Optional (future): backend can add requestSummary and this UI will show it automatically
              const anyP: any = p as any;
              const rs = anyP?.requestSummary || anyP?._requestSummary;
              const requester =
                rs?.requesterName || rs?.requesterEmail || rs?.frontlinerEmail || rs?.raisedBy || "";
              const manager = rs?.managerName || rs?.managerEmail || rs?.manager || "";

              const routeLabel = deriveRouteLabel(p);
              const itemCount = ensureArray(opt?.lineItems).length;

              return (
                <button
                  key={p._id}
                  onClick={() => openDrawer(p._id)}
                  className="w-full text-left p-5 hover:bg-zinc-50 transition"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
  <span className="font-semibold text-zinc-900 truncate">
    {(() => {
      const reqCode = String((p as any)?._requestCode || "").trim();
      return reqCode ? `Request ${reqCode}` : "Request";
    })()}
  </span>

  <span className={`text-xs px-3 py-1 rounded-full ${statusClass(uiStatus)}`}>{uiStatus}</span>

  {p.version != null ? (
    <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
      v{p.version}
    </span>
  ) : null}

  <span className={`text-[11px] px-3 py-1 rounded-full ${approvalPill(approvals.l2)}`}>
    L2: {approvals.l2}
  </span>
  <span className={`text-[11px] px-3 py-1 rounded-full ${approvalPill(approvals.l0)}`}>
    L0: {approvals.l0}
  </span>

  {customerTag ? (
    <span className="text-xs px-3 py-1 rounded-full bg-slate-900 text-white">
      CUSTOMER: {customerTag}
    </span>
  ) : null}
</div>

                      <div className="text-sm text-zinc-900 font-medium truncate">{routeLabel}</div>

                      <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Updated {fmtDate(p.updatedAt || p.createdAt)}</span>
                        <span>•</span>
                        <span>Proposal v{p.version ?? "—"}</span>
                        <span>•</span>
                        <span>
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </span>

                        {/* Requester/Manager (if backend provides requestSummary) */}
                        {requester ? (
                          <>
                            <span>•</span>
                            <span className="truncate">Raised by: {requester}</span>
                          </>
                        ) : null}
                        {manager ? (
                          <>
                            <span>•</span>
                            <span className="truncate">Manager: {manager}</span>
                          </>
                        ) : null}
                      </div>

                      <div className="mt-1 text-[11px] font-semibold text-zinc-600">
                        Approval:{" "}
                        <span
                          className={
                            approvals.isFullyApproved
                              ? "text-emerald-700"
                              : approvals.isDeclined
                              ? "text-rose-700"
                              : approvals.isPartial
                              ? "text-amber-800"
                              : "text-zinc-600"
                          }
                        >
                          {approvals.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-semibold text-zinc-900">{fmtMoney(amt, cur)}</div>
                      <div className="text-xs text-zinc-500">{opt?.title ? "Best option" : "—"}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- Drawer ---------------- */}
      <DrawerShell
        open={drawerOpen}
        onClose={closeDrawer}
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>Proposal</span>

            {detail ? (() => {
              const uiStatus = getUiStatus(detail);
              return (
                <span className={`text-xs px-3 py-1 rounded-full ${statusClass(uiStatus)}`}>
                  {uiStatus}
                </span>
              );
            })() : null}

            {/* ✅ View Detailed Proposal chip */}
            {detail ? (
              <button
                type="button"
                onClick={goDetailedProposal}
                className={[
                  "text-xs px-3 py-1 rounded-full ring-1 transition",
                  viewMode === "detailed"
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-900 ring-slate-200 hover:bg-zinc-50",
                ].join(" ")}
                title="Expand and show the full proposal details"
              >
                View Detailed Proposal
              </button>
            ) : null}

            {detail?._isOwner ? (
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                Owner
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">
                Read-only
              </span>
            )}
          </div>
        }
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            {(detail as any)?._requestCode ? (
  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-700 ring-1 ring-zinc-200">
    Request: <b>{String((detail as any)._requestCode)}</b>
  </span>
) : null}

            {detail?.version != null ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-700 ring-1 ring-zinc-200">
                Version: <b>v{detail.version}</b>
              </span>
            ) : null}
            {detail?._id ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] text-zinc-700 ring-1 ring-zinc-200">
                ID: <b>{shortId(detail._id)}</b>
              </span>
            ) : null}
          </div>
        }
      >
        {detailLoading ? (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600 shadow-sm">
            Loading proposal…
          </div>
        ) : !detail ? (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600 shadow-sm">
            No proposal details available.
          </div>
        ) : drawerMode === "action" ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Confirm action</div>
              <div className="mt-1 text-xs text-zinc-600">
                You are about to{" "}
                <b>
                  {actionType === "accept"
                    ? "ACCEPT"
                    : actionType === "reject"
                    ? "REJECT"
                    : "REQUEST CHANGES"}
                </b>{" "}
                for this proposal.
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-zinc-700">Note (optional)</div>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                  rows={4}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Add a short message for our team…"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                  onClick={() => setDrawerMode("details")}
                  disabled={actionBusy}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-full bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  onClick={() => void submitAction()}
                  disabled={actionBusy}
                >
                  {actionBusy ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Approval progress (fixes “not able to find approved or not”) */}
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
              {(() => {
                const ap = computeApprovalProgress(detail);
                const uiStatus = getUiStatus(detail);

                return (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-zinc-500">Approval progress</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] px-3 py-1 rounded-full ${approvalPill(ap.l2)}`}>
                          L2: <b>{ap.l2}</b>
                        </span>
                        <span className={`text-[11px] px-3 py-1 rounded-full ${approvalPill(ap.l0)}`}>
                          L0: <b>{ap.l0}</b>
                        </span>

                        <span
                          className={[
                            "text-[11px] px-3 py-1 rounded-full ring-1",
                            ap.isFullyApproved
                              ? "bg-emerald-600 text-white ring-emerald-700"
                              : ap.isDeclined
                              ? "bg-rose-600 text-white ring-rose-700"
                              : ap.isPartial
                              ? "bg-amber-100 text-amber-900 ring-amber-200"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200",
                          ].join(" ")}
                        >
                          {ap.label}
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-zinc-600">
                        Note: Currently <b>L2 approval</b> is treated as final approval. L0 is optional (for now).
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-zinc-500">Current status</div>
                      <div className={`mt-1 inline-flex text-xs px-3 py-1 rounded-full ${statusClass(uiStatus)}`}>
                        {uiStatus}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Total */}
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-500">Total (best option)</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">
                    {fmtMoney(displayTotal.amt, displayTotal.cur)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Updated {fmtDate(detail.updatedAt || detail.createdAt)}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-900 px-3 py-2 text-right text-white">
                  <div className="text-[10px] text-zinc-200">Options</div>
                  <div className="text-sm font-semibold">{detail.options?.length || 0}</div>
                </div>
              </div>
            </div>

            {/* Customer status */}
            {detail.customer?.action ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-800">Customer response</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {String(detail.customer.action).toUpperCase()}
                </div>
                {detail.customer.note ? (
                  <div className="mt-2 text-[12px] text-slate-700 whitespace-pre-wrap">{detail.customer.note}</div>
                ) : null}
                {detail.customer.at ? (
                  <div className="mt-2 text-[11px] text-slate-600">
                    {fmtDate(detail.customer.at)} • {detail.customer.byName || detail.customer.byEmail || ""}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Options */}
            <div ref={optionsAnchorRef} className="space-y-3">
              {(detail.options || []).map((opt: ProposalOption) => {
                const isOpen = openOpt === opt.optionNo;
                const lineItems = Array.isArray(opt.lineItems) ? (opt.lineItems as ProposalLineItem[]) : [];

                // Summary vs Detailed rendering
                const showLineItems = viewMode === "detailed" || isOpen;
                const showNotes = isOpen && Boolean(opt.notes);

                const routeLabel = opt.title || "—";
                const itemsLabel = `${lineItems.length} item${lineItems.length !== 1 ? "s" : ""}`;

                return (
                  <div key={opt.optionNo} className="rounded-3xl border border-zinc-100 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setOpenOpt(isOpen ? null : opt.optionNo)}
                      className="w-full rounded-3xl px-4 py-4 text-left hover:bg-zinc-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 truncate">
                            Option {opt.optionNo}: {routeLabel}
                          </div>

                          <div className="mt-1 text-[11px] text-zinc-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* Collapsed itinerary indicator */}
{!isOpen && opt.notes ? (
  <div className="mt-2">
    <span className="inline-flex text-[11px] rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 ring-1 ring-zinc-200">
      Itinerary added
    </span>
  </div>
) : null}
                            {opt.vendor ? (
                              <>
                                <span>
                                  Vendor: <b>{opt.vendor}</b>
                                </span>
                                <span>•</span>
                              </>
                            ) : null}
                            {opt.validityTill ? (
                              <>
                                <span>
                                  Valid till: <b>{fmtDate(isoDateOnly(opt.validityTill))}</b>
                                </span>
                                <span>•</span>
                              </>
                            ) : null}
                            <span>{itemsLabel}</span>
                          </div>

                          {showNotes && opt.notes ? (
                            <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700 whitespace-pre-wrap">
                              <span className="mr-1 font-semibold text-zinc-500">Itinerary:</span>
                              {viewMode === "summary"
                                ? opt.notes.slice(0, 260) + (opt.notes.length > 260 ? "…" : "")
                                : opt.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white shrink-0">
                          <div className="text-[10px] text-slate-200">Total</div>
                          <div className="text-sm font-semibold">{fmtMoney(opt.totalAmount, opt.currency)}</div>
                          <div className="text-[10px] text-slate-200">{isOpen ? "▲" : "▼"}</div>
                        </div>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="px-4 pb-4">
                        {/* Line items */}
                        {showLineItems ? (
                          lineItems.length ? (
                            <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-100">
                              <div className="grid grid-cols-12 bg-zinc-50 px-3 py-2 text-[10px] font-semibold text-zinc-600">
                                <div className="col-span-6">Item</div>
                                <div className="col-span-2 text-right">Qty</div>
                                <div className="col-span-2 text-right">Unit</div>
                                <div className="col-span-2 text-right">Total</div>
                              </div>

                              {lineItems.map((li: ProposalLineItem, i: number) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-12 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-700"
                                >
                                  <div className="col-span-6">
                                    <div className="font-semibold text-zinc-900">{li.title}</div>
                                    <div className="text-[10px] text-zinc-500">{li.category}</div>
                                    {li.notes ? (
                                      <div className="mt-1 text-[10px] text-zinc-600 whitespace-pre-wrap">
                                        {li.notes}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="col-span-2 text-right">{li.qty}</div>
                                  <div className="col-span-2 text-right">{fmtMoney(li.unitPrice, li.currency)}</div>
                                  <div className="col-span-2 text-right font-semibold">{fmtMoney(li.totalPrice, li.currency)}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-zinc-500">No line items added yet.</div>
                          )
                        ) : null}

                        {/* Attachments */}
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-zinc-800">Attachments</div>
                          {!opt.attachments || opt.attachments.length === 0 ? (
                            <div className="mt-1 text-[11px] text-zinc-500">No attachments.</div>
                          ) : (
                            <div className="mt-2 flex flex-col gap-2">
                              {opt.attachments.map((url: string, idx: number) => (
                                <button
                                  key={`${opt.optionNo}-${idx}`}
                                  type="button"
                                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-left text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                                  onClick={() => openProposalAttachment(url)}
                                >
                                  Open attachment {idx + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Your action</div>

              {!isOwner ? (
                <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
                  You’re viewing this proposal as an approver / workspace viewer. Only the original request owner can
                  submit Accept/Reject/Needs Changes.
                </div>
              ) : (
                <div className="mt-1 text-xs text-zinc-600">
                  Actions are available only when status is <b>SUBMITTED</b>.
                </div>
              )}

              {isOwner ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="flex-1 min-w-[140px] rounded-full bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    disabled={!canAct}
                    onClick={() => startAction("accept")}
                    title={!canAct ? "Not actionable in current status." : ""}
                  >
                    Accept
                  </button>
                  <button
                    className="flex-1 min-w-[140px] rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    disabled={!canAct}
                    onClick={() => startAction("needs_changes")}
                    title={!canAct ? "Not actionable in current status." : ""}
                  >
                    Needs Changes
                  </button>
                  <button
                    className="flex-1 min-w-[140px] rounded-full bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    disabled={!canAct}
                    onClick={() => startAction("reject")}
                    title={!canAct ? "Not actionable in current status." : ""}
                  >
                    Reject
                  </button>
                </div>
              ) : null}

              {isOwner && detail.customer?.action && detail.status === "SUBMITTED" ? (
                <div className="mt-3 text-[11px] text-zinc-500">
                  You already responded ({String(detail.customer.action).toUpperCase()}). You can update it if needed.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </DrawerShell>
    </div>
  );
}
