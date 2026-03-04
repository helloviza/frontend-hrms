// apps/frontend/src/pages/approvals/ApprovalsAdminQueue.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

/* ───────────────────────────────── Types ───────────────────────────────── */

type CartItem = {
  _id?: string;
  id?: string;

  title?: string;
  name?: string;
  label?: string;

  serviceType?: string;
  service?: string;
  category?: string;

  qty?: number;
  quantity?: number;

  price?: number;
  amount?: number;
  total?: number;
  totalAmount?: number;

  notes?: string;
  note?: string;
  remarks?: string;
  comments?: string;
  description?: string;
};

type MainStatus =
  | "REQUEST_SUBMITTED"
  | "AWAITING_L2_REQUEST_APPROVAL"
  | "REQUEST_DECLINED_BY_L2"
  | "REQUEST_APPROVED_BY_L2"
  | "PROPOSAL_POSTED"
  | "AWAITING_PROPOSAL_APPROVAL_L2_L0"
  | "PROPOSAL_DECLINED"
  | "PROPOSAL_APPROVED"
  | "BOOKING_IN_PROGRESS"
  | "BOOKING_DONE"
  | "COMPLETED"
  | "CANCELLED"
  | string;

type ApprovalRow = {
  _id: string;
  ticketId?: string;

  customerName?: string;
  approvedByEmail?: string;

  // ✅ Truth source (new)
  status?: MainStatus;

  // ✅ Legacy fallback
  adminState?: string;

  updatedAt?: string;

  cartItems?: CartItem[];
  items?: CartItem[];
  cart?: CartItem[];

  comments?: string;
  note?: string;
};

type TabKey = "bookingProposal" | "proposalApproval" | "bookingExec" | "history";

/* ───────────────────────────────── Helpers ───────────────────────────────── */

function unwrapApi<T = any>(res: any): T {
  if (res && typeof res === "object") return (res as any).data ?? res;
  return res as T;
}

function safeText(v: any): string {
  return String(v ?? "").trim();
}

function inr(n: any): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "₹0";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${Math.round(num)}`;
  }
}

function pickCartItems(r: ApprovalRow): CartItem[] {
  const a = r.cartItems || r.items || r.cart || [];
  return Array.isArray(a) ? a : [];
}

function pickItemTitle(it: CartItem): string {
  const t = it.title || it.name || it.label || "";
  const s = safeText(t);
  return s || "Item";
}

function pickItemType(it: CartItem): string {
  const t = it.serviceType || it.service || it.category || "";
  return safeText(t).toUpperCase();
}

function pickItemQty(it: CartItem): number {
  const q = it.qty ?? it.quantity ?? 1;
  const n = Number(q);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Amount resolution:
 * 1) totalAmount / total / amount (already total)
 * 2) else price * qty
 */
function pickItemAmount(it: CartItem): number {
  const direct = it.totalAmount ?? it.total ?? it.amount;
  const dn = Number(direct);
  if (Number.isFinite(dn)) return dn;

  const price = Number(it.price ?? 0);
  if (!Number.isFinite(price)) return 0;

  return price * pickItemQty(it);
}

function pickItemNote(it: CartItem): string {
  const note =
    it.notes ||
    it.note ||
    it.remarks ||
    it.comments ||
    it.description ||
    "";
  return safeText(note);
}

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function shortId(id: string) {
  const s = safeText(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function timeAgo(iso?: string) {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "-";
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─────────────────────────── AI-ish heuristics (client) ───────────────────────────
   No backend dependency. Just smart labels for scanning.
*/

function computeTotals(r: ApprovalRow) {
  const items = pickCartItems(r);
  const totalAmount = items.reduce((sum, it) => sum + pickItemAmount(it), 0);
  const services = Array.from(
    new Set(items.map((it) => pickItemType(it)).filter(Boolean))
  );
  return { items, totalAmount, services };
}

function aiCues(r: ApprovalRow) {
  const status = safeText(r.status || r.adminState);
  const { items, totalAmount, services } = computeTotals(r);

  const cues: Array<{ label: string; tone: "good" | "warn" | "bad" | "neutral" }> =
    [];

  // Value cue
  if (totalAmount >= 200000) cues.push({ label: "High value", tone: "warn" });
  else if (totalAmount >= 80000) cues.push({ label: "Mid value", tone: "neutral" });

  // Complexity cue
  if (items.length >= 4) cues.push({ label: "Complex", tone: "warn" });
  else if (items.length === 1) cues.push({ label: "Simple", tone: "good" });

  // Service cue
  if (services.includes("FLIGHT") && services.includes("HOTEL"))
    cues.push({ label: "Trip bundle", tone: "good" });
  if (services.includes("VISA")) cues.push({ label: "Visa dependent", tone: "neutral" });

  // Status cue
  if (status === "AWAITING_PROPOSAL_APPROVAL_L2_L0")
    cues.push({ label: "Needs approval", tone: "warn" });
  if (status === "BOOKING_IN_PROGRESS")
    cues.push({ label: "Executing", tone: "neutral" });
  if (
    status === "PROPOSAL_DECLINED" ||
    status === "REQUEST_DECLINED_BY_L2" ||
    status === "CANCELLED"
  )
    cues.push({ label: "Blocked", tone: "bad" });
  if (status === "COMPLETED" || status === "BOOKING_DONE" || status === "PROPOSAL_APPROVED")
    cues.push({ label: "Clear", tone: "good" });

  // Fallback if nothing
  if (!cues.length) cues.push({ label: "Review", tone: "neutral" });

  return cues.slice(0, 3);
}

function aiSummary(r: ApprovalRow) {
  const { totalAmount, services, items } = computeTotals(r);
  const s = safeText(r.status || r.adminState || "-");
  const svc = services.length ? services.join(", ") : "No services found";
  const notes = safeText(r.comments || r.note);
  const noteHint = notes ? `Note: “${notes.slice(0, 90)}${notes.length > 90 ? "…" : ""}”` : "";
  return `Status: ${s}. Services: ${svc}. Items: ${items.length}. Total: ${inr(totalAmount)}.${
    noteHint ? " " + noteHint : ""
  }`;
}

/* ───────────────────────────────── UI atoms ───────────────────────────────── */

function Pill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-black/5 text-ink/70 border-black/10";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] leading-none",
        cls
      )}
    >
      {text}
    </span>
  );
}

function StatusPill({ status, fallback }: { status?: string; fallback?: string }) {
  const s = safeText(status);
  const f = safeText(fallback);
  const label = s || f || "-";

  const isGood = s === "PROPOSAL_APPROVED" || s === "BOOKING_DONE" || s === "COMPLETED";
  const isWarn = s === "AWAITING_PROPOSAL_APPROVAL_L2_L0" || s === "BOOKING_IN_PROGRESS";
  const isBad =
    s === "CANCELLED" || s === "PROPOSAL_DECLINED" || s === "REQUEST_DECLINED_BY_L2";

  const tone = isBad ? "bad" : isGood ? "good" : isWarn ? "warn" : "neutral";

  return <Pill text={label} tone={tone} />;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 w-full">
          <div className="h-4 w-40 bg-black/10 rounded" />
          <div className="h-3 w-72 bg-black/5 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="h-6 w-24 bg-black/5 rounded-xl" />
            <div className="h-6 w-20 bg-black/5 rounded-xl" />
            <div className="h-6 w-16 bg-black/5 rounded-xl" />
          </div>
        </div>
        <div className="h-9 w-24 bg-black/5 rounded-xl" />
      </div>
      <div className="mt-3 h-24 bg-black/5 rounded-2xl" />
    </div>
  );
}

/* ───────────────────────────────── Tabs ───────────────────────────────── */

const TABS: Array<{ key: TabKey; title: string; subtitle: string }> = [
  {
    key: "bookingProposal",
    title: "Booking/Proposal Queue",
    subtitle: "Requests approved by L2 → ready for proposal creation",
  },
  {
    key: "proposalApproval",
    title: "Proposal Approval Queue",
    subtitle: "Awaiting L2 + L0 approval on posted proposals",
  },
  {
    key: "bookingExec",
    title: "Booking Execution Queue",
    subtitle: "Proposal approved → execute booking + upload docs",
  },
  {
    key: "history",
    title: "Booking History",
    subtitle: "Completed / cancelled bookings & documentation",
  },
];

/* ───────────────────────────────── Component ───────────────────────────────── */

export default function ApprovalsAdminQueue() {
  const [tab, setTab] = useState<TabKey>("bookingProposal");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // command bar
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "value_desc" | "value_asc">("new");
  const [quick, setQuick] = useState<"all" | "highValue" | "needsAttention">("all");

  // actions (kept compatible with your current backend)
  const [agentName, setAgentName] = useState("");
  const [comment, setComment] = useState("");

  // expand/collapse
  const [openId, setOpenId] = useState<string | null>(null);

  const activeTabMeta = useMemo(
    () => TABS.find((t) => t.key === tab) || TABS[0],
    [tab]
  );

  function endpointForTab(t: TabKey) {
    // ✅ keep current working endpoint as default for Booking/Proposal
    if (t === "bookingProposal") return "/approvals/admin/approved";

    // ✅ new endpoints (backend will implement)
    if (t === "proposalApproval") return "/approvals/admin/queue/proposal-approval";
    if (t === "bookingExec") return "/approvals/admin/queue/booking-exec";
    return "/approvals/admin/history";
  }

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const ep = endpointForTab(tab);
      const res: any = await api.get(ep);
      const data = unwrapApi<any>(res);

      const list = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      setRows(list);
    } catch (e: any) {
      const m = e?.message || "Failed to load queue";
      if (String(m).toLowerCase().includes("404")) {
        setMsg(
          `Endpoint for "${activeTabMeta.title}" is not available yet. ` +
            `Backend should implement: GET ${endpointForTab(tab)}`
        );
      } else {
        setMsg(m);
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

 async function doUnderProcess(id: string) {
  try {
    await api.put(`/approvals/admin/${id}/under-process`, { comment });
    setComment("");
    await load();
  } catch (e: any) {
    setMsg(e?.response?.data?.error || e?.message || "Failed to mark IN_PROGRESS");
  }
}

async function doDone(id: string) {
  try {
    await api.put(`/approvals/admin/${id}/done`, { comment });
    setComment("");
    await load();
  } catch (e: any) {
    setMsg(e?.response?.data?.error || e?.message || "Failed to mark DONE");
  }
}

async function doOnHold(id: string) {
  try {
    await api.put(`/approvals/admin/${id}/on-hold`, { comment });
    setComment("");
    await load();
  } catch (e: any) {
    setMsg(e?.response?.data?.error || e?.message || "On Hold failed");
  }
}

async function doCancel(id: string) {
  try {
    await api.put(`/approvals/admin/${id}/cancel`, { comment });
    setComment("");
    await load();
  } catch (e: any) {
    setMsg(e?.response?.data?.error || e?.message || "Cancel failed");
  }
}

  const computed = useMemo(() => {
    const enriched = rows.map((r) => {
      const totals = computeTotals(r);
      return {
        r,
        total: totals.totalAmount,
        services: totals.services,
        itemsCount: totals.items.length,
        statusKey: safeText(r.status || r.adminState),
        updatedTs: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
      };
    });

    const query = safeText(q).toLowerCase();

    let filtered = enriched.filter(({ r, statusKey }) => {
      if (!query) return true;

      const hay = [
        r.ticketId,
        r._id,
        r.customerName,
        r.approvedByEmail,
        statusKey,
        r.comments,
        r.note,
      ]
        .map((x) => safeText(x).toLowerCase())
        .join(" | ");

      return hay.includes(query);
    });

    if (quick === "highValue") filtered = filtered.filter((x) => x.total >= 80000);
    if (quick === "needsAttention")
      filtered = filtered.filter((x) => {
        const s = x.statusKey;
        return (
          s === "AWAITING_PROPOSAL_APPROVAL_L2_L0" ||
          s === "BOOKING_IN_PROGRESS" ||
          s === "PROPOSAL_DECLINED" ||
          s === "REQUEST_DECLINED_BY_L2"
        );
      });

    filtered.sort((a, b) => {
      if (sort === "new") return (b.updatedTs || 0) - (a.updatedTs || 0);
      if (sort === "old") return (a.updatedTs || 0) - (b.updatedTs || 0);
      if (sort === "value_desc") return b.total - a.total;
      return a.total - b.total;
    });

    const stats = {
      count: filtered.length,
      totalValue: filtered.reduce((sum, x) => sum + x.total, 0),
      highValue: filtered.filter((x) => x.total >= 80000).length,
      needsAttention: filtered.filter((x) => {
        const s = x.statusKey;
        return (
          s === "AWAITING_PROPOSAL_APPROVAL_L2_L0" ||
          s === "BOOKING_IN_PROGRESS" ||
          s === "PROPOSAL_DECLINED" ||
          s === "REQUEST_DECLINED_BY_L2"
        );
      }).length,
    };

    return { filtered, stats };
  }, [rows, q, sort, quick]);

  const emptyText =
    tab === "bookingProposal"
      ? "No requests waiting for proposal creation."
      : tab === "proposalApproval"
      ? "No proposals waiting for approval."
      : tab === "bookingExec"
      ? "No approved proposals waiting for booking execution."
      : "No history found.";

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4 md:p-6">
      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">
            {activeTabMeta.title}
          </div>
          <div className="text-sm text-ink/60 mt-1">
            {activeTabMeta.subtitle}
          </div>

          {/* KPI chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill text={`${computed.stats.count} tickets`} tone="neutral" />
            <Pill text={`Value ${inr(computed.stats.totalValue)}`} tone="neutral" />
            <Pill text={`${computed.stats.highValue} high value`} tone="warn" />
            <Pill text={`${computed.stats.needsAttention} needs attention`} tone="warn" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                "px-3 py-2 rounded-xl text-sm transition",
                active
                  ? "bg-black text-white"
                  : "border border-black/10 hover:bg-black/5"
              )}
            >
              {t.title}
            </button>
          );
        })}
      </div>

      {/* Command bar */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-2">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2">
            <span className="text-ink/50 text-sm">⌘</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticket, customer, status, note…"
              className="w-full outline-none bg-transparent text-sm"
            />
            {q ? (
              <button
                onClick={() => setQ("")}
                className="text-xs px-2 py-1 rounded-lg border border-black/10 hover:bg-black/5"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-3">
          <select
            value={quick}
            onChange={(e) => setQuick(e.target.value as any)}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="highValue">High value (≥ ₹80k)</option>
            <option value="needsAttention">Needs attention</option>
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          >
            <option value="new">Sort: Latest update</option>
            <option value="old">Sort: Oldest update</option>
            <option value="value_desc">Sort: Value high → low</option>
            <option value="value_asc">Sort: Value low → high</option>
          </select>
        </div>
      </div>

      {/* Assignment / comment strip */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Assign to (agent name)"
        />
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Admin comment (optional)"
        />
      </div>

      {!!msg && (
        <div className="mt-3 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink/70">
          {msg}
        </div>
      )}

      {/* List */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : computed.filtered.length === 0 ? (
          <div className="text-sm text-ink/60">{emptyText}</div>
        ) : (
          computed.filtered.map(({ r, total, services, itemsCount, statusKey }) => {
            const isOpen = openId === r._id;
            const cues = aiCues(r);
            const ticketLabel = r.ticketId || shortId(r._id);

            return (
              <div
                key={r._id}
                className={cx(
                  "rounded-3xl border border-black/10 bg-white p-4 transition",
                  isOpen ? "shadow-sm" : "hover:bg-black/[0.015]"
                )}
              >
                {/* Top row */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <div className="text-base font-semibold tracking-tight">
                        {ticketLabel}
                      </div>
                      <StatusPill status={r.status} fallback={r.adminState} />
                      <Pill text={timeAgo(r.updatedAt)} tone="neutral" />
                    </div>

                    <div className="mt-1 text-sm text-ink/70">
                      <span className="text-ink/50">Customer:</span>{" "}
                      <b className="text-ink">{r.customerName || "-"}</b>
                      <span className="mx-2 text-ink/30">•</span>
                      <span className="text-ink/50">Approved by:</span>{" "}
                      <b className="text-ink">{r.approvedByEmail || "-"}</b>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill
                        text={`${itemsCount} ${itemsCount === 1 ? "item" : "items"}`}
                        tone="neutral"
                      />
                      <Pill text={inr(total)} tone={total >= 80000 ? "warn" : "neutral"} />
                      {services.slice(0, 3).map((s) => (
                        <Pill key={s} text={s} tone="neutral" />
                      ))}
                      {cues.map((c) => (
                        <Pill key={c.label} text={`AI: ${c.label}`} tone={c.tone} />
                      ))}
                    </div>
                  </div>

                  {/* Primary actions */}
                  <div className="flex gap-2 flex-wrap md:justify-end">
                    <button
                      onClick={() => setOpenId(isOpen ? null : r._id)}
                      className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-sm"
                    >
                      {isOpen ? "Hide details" : "View details"}
                    </button>

                    <button
                      onClick={() => doAssign(r._id)}
                      className="px-3 py-2 rounded-xl text-sm bg-brand text-white hover:opacity-95"
                    >
                      Assign
                    </button>

<button
  onClick={() => doUnderProcess(r._id)}
  className="px-3 py-2 rounded-xl text-sm bg-sky-600 text-white hover:opacity-95"
>
  Mark IN_PROGRESS
</button>

                    <button
  onClick={() => doDone(r._id)}
  className="px-3 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:opacity-95"
>
  {tab === "bookingExec" ? "Mark Booking Done" : "Done"}
</button>


                    <button
  onClick={() => doOnHold(r._id)}
  className="px-3 py-2 rounded-xl text-sm bg-amber-600 text-white hover:opacity-95"
>
  On Hold
</button>


                    <button
  onClick={() => doCancel(r._id)}
  className="px-3 py-2 rounded-xl text-sm bg-red-600 text-white hover:opacity-95"
>
  Cancel
</button>

                  </div>
                </div>

                {/* Expandable AI + Items */}
                {isOpen ? (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
                    {/* AI Summary */}
                    <div className="lg:col-span-5 rounded-3xl border border-black/10 bg-black/[0.02] p-4">
                      <div className="text-[11px] tracking-[0.25em] uppercase text-ink/50">
                        AI Summary
                      </div>
                      <div className="mt-2 text-sm text-ink/80 whitespace-pre-line break-words">
                        {aiSummary(r)}
                      </div>

                      {safeText(r.comments || r.note) ? (
                        <div className="mt-3 text-xs text-ink/60 whitespace-pre-line break-words">
                          <b>Request note:</b> {safeText(r.comments || r.note)}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-ink/50">
                          No request note provided.
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill text={`Status key: ${statusKey || "-"}`} tone="neutral" />
                        <Pill text={`ID: ${shortId(r._id)}`} tone="neutral" />
                      </div>
                    </div>

                    {/* Items */}
                    <div className="lg:col-span-7 rounded-3xl border border-black/10 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] tracking-[0.25em] uppercase text-ink/50">
                          Items
                        </div>
                        <div className="text-sm text-ink/70">
                          <b>{itemsCount}</b> • <b>{inr(total)}</b>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {pickCartItems(r).length === 0 ? (
                          <div className="text-sm text-ink/60">No items found.</div>
                        ) : (
                          pickCartItems(r).map((it, idx) => {
                            const title = pickItemTitle(it);
                            const type = pickItemType(it);
                            const qty = pickItemQty(it);
                            const amt = pickItemAmount(it);
                            const note = pickItemNote(it);

                            return (
                              <div
                                key={(it._id || it.id || `${idx}`) as string}
                                className="rounded-2xl border border-black/10 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-ink">
                                      {title}
                                    </div>
                                    <div className="mt-1 text-xs text-ink/70">
                                      {type ? (
                                        <>
                                          <span className="font-medium">{type}</span>
                                          <span className="mx-1">•</span>
                                        </>
                                      ) : null}
                                      <span>Qty {qty}</span>
                                      <span className="mx-1">•</span>
                                      <span>{inr(amt)}</span>
                                    </div>
                                  </div>
                                  {type ? <Pill text={type} tone="neutral" /> : null}
                                </div>

                                {note ? (
                                  <div className="mt-2 text-sm text-ink/80 whitespace-pre-line break-words">
                                    {note}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
