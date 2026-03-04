// apps/frontend/src/pages/admin/proposals/AdminProposalByRequest.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AirportAutocomplete from "../../../components/inputs/AirportAutocomplete";
import HotelSearchModal, { type HotelPick } from "../../../components/inputs/HotelSearchModal";

import {
  getProposalByRequest,
  createDraftProposalByRequest,
  updateProposal,
  submitProposal,
  decideProposal,
  startBookingFromProposal,
  markBookingDoneFromProposal,
  cancelBookingFromProposal,
  uploadProposalBookingAttachment,
  uploadProposalOptionAttachments,
  openProposalAttachment,
  type ProposalDoc,
  type ProposalOption,
  type ProposalLineItem,
} from "../../../lib/proposalsApi";

/* ------------------------------------------------------------- */
/* Small UI helpers (same visual language as ApprovalNew)         */
/* ------------------------------------------------------------- */

type ServiceKey =
  | "flight"
  | "hotel"
  | "visa"
  | "cab"
  | "forex"
  | "esim"
  | "holiday"
  | "mice"
  | "generic";

const SERVICE_TYPES: Array<{
  key: ServiceKey;
  label: string;
  emoji: string;
  hint: string;
}> = [
  { key: "flight", label: "Flights", emoji: "✈️", hint: "Build flight proposal option" },
  { key: "hotel", label: "Hotels", emoji: "🏨", hint: "Build hotel proposal option" },
  { key: "visa", label: "Visa", emoji: "🛂", hint: "Visa services option" },
  { key: "cab", label: "Cab", emoji: "🚕", hint: "Cab / transfer option" },
  { key: "forex", label: "Forex", emoji: "💱", hint: "Forex option" },
  { key: "esim", label: "eSIM", emoji: "📶", hint: "eSIM option" },
  { key: "holiday", label: "Holidays", emoji: "🌴", hint: "Holiday package option" },
  { key: "mice", label: "MICE", emoji: "🎤", hint: "Offsite / MICE option" },
  { key: "generic", label: "Generic", emoji: "📝", hint: "Any itinerary text + items + PDFs" },
];

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

function safeInt(v: any, min = 0) {
  const x = Number(v);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.floor(x));
}

function ensureStr(v: any) {
  return String(v ?? "").trim();
}

function computeLineTotal(li: Partial<ProposalLineItem>) {
  const qty = Number(li.qty || 0);
  const unit = Number(li.unitPrice || 0);
  const t = qty * unit;
  return Number.isFinite(t) ? t : 0;
}

function computeOptionTotal(opt: Partial<ProposalOption>) {
  const items = Array.isArray(opt.lineItems) ? opt.lineItems : [];
  return items.reduce((s, li) => s + computeLineTotal(li), 0);
}

function shortId(id?: string) {
  const s = String(id || "");
  if (!s) return "—";
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition",
        active
          ? "bg-[#00477f] text-white border-[#00477f]"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- */
/* Drawer                                                         */
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-hidden rounded-l-[28px] bg-white shadow-2xl">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-[#f5f7ff] via-white to-[#fff7f1] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                PLUMTRIPS · PROPOSAL BUILDER
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
/* Option meta (kept flexible)                                    */
/* ------------------------------------------------------------- */

type OptionMeta = Record<string, any>;

function buildDefaultMeta(service: ServiceKey): OptionMeta {
  if (service === "flight") {
    return {
      service: "flight",
      tripType: "oneway",
      origin: "",
      destination: "",
      departDate: "",
      returnDate: "",
      cabinClass: "Economy",
      adults: 1,
      children: 0,
      infants: 0,
      preferredAirline: "",
      preferredTime: "Any",
      notes: "",
      originMeta: null,
      destinationMeta: null,
    };
  }
  if (service === "hotel") {
    return {
      service: "hotel",
      city: "",
      hotel: null,
      checkIn: "",
      checkOut: "",
      rooms: 1,
      adults: 1,
      children: 0,
      mealPlan: "Breakfast",
      roomType: "Standard",
      starRating: "Any",
      hotelType: "Business",
      locationPreference: "",
      notes: "",
    };
  }
  return {
    service,
    notes: "",
  };
}

function buildOptionTitle(service: ServiceKey, meta: OptionMeta) {
  if (service === "flight") {
    const tt =
      String(meta.tripType || "").toLowerCase() === "roundtrip"
        ? "Round Trip"
        : String(meta.tripType || "").toLowerCase() === "multicity"
        ? "Multi City"
        : "One Way";
    const o = ensureStr(meta.origin) || "—";
    const d = ensureStr(meta.destination) || "—";
    return `${o} → ${d} (${tt})`;
  }
  if (service === "hotel") {
    const h = meta.hotel || null;
    const hotelName = ensureStr(h?.name);
    const q = ensureStr(meta.city);
    return `${hotelName || q || "Hotel"} • ${ensureStr(meta.hotelType || "Hotel")} stay`;
  }
  const def = SERVICE_TYPES.find((s) => s.key === service);
  return def?.label || "Option";
}

function buildDefaultLineItem(service: ServiceKey, meta: OptionMeta, currency: string): ProposalLineItem {
  const title = buildOptionTitle(service, meta);
  const category =
    service === "flight"
      ? "FLIGHT"
      : service === "hotel"
      ? "HOTEL"
      : service === "visa"
      ? "VISA"
      : service === "cab"
      ? "CAB"
      : service === "forex"
      ? "FOREX"
      : service === "esim"
      ? "ESIM"
      : service === "holiday"
      ? "HOLIDAY"
      : service === "mice"
      ? "MICE"
      : "SERVICE";

  const qty =
    service === "flight"
      ? safeInt(meta.adults, 1) + safeInt(meta.children, 0) + safeInt(meta.infants, 0)
      : service === "hotel"
      ? safeInt(meta.rooms, 1)
      : 1;

  const unitPrice = 0;
  const totalPrice = qty * unitPrice;

  return {
    itemIndex: 1,
    category,
    title,
    qty,
    unitPrice,
    totalPrice,
    currency: currency || "INR",
    notes: ensureStr(meta.notes || ""),
  };
}

function parseDateOrNull(iso: string): Date | null {
  const s = ensureStr(iso);
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/* ------------------------------------------------------------- */
/* Component                                                      */
/* ------------------------------------------------------------- */

export default function AdminProposalByRequest() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const requestIdFromUrl = params.get("requestId") || params.get("rid") || "";
  const [requestId, setRequestId] = useState(requestIdFromUrl);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [proposal, setProposal] = useState<ProposalDoc | null>(null);
  const proposalId = String((proposal as any)?._id || "");

  // Core proposal state
  const [currency, setCurrency] = useState("INR");

  // Actions state
  const [busy, setBusy] = useState<string | null>(null);

  // Decision state
  const [decisionRole, setDecisionRole] = useState<"L2" | "L0">("L2");
  const [decision, setDecision] = useState<"APPROVED" | "DECLINED">("APPROVED");
  const [decisionNote, setDecisionNote] = useState("");

  // Booking state
  const [bookingNote, setBookingNote] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [actualBookingPrice, setActualBookingPrice] = useState("");

  // Booking attachment (PDF)
  const [bookingPdf, setBookingPdf] = useState<File | null>(null);

  // Option builder drawer
  const [optDrawerOpen, setOptDrawerOpen] = useState(false);
  const [editingOptNo, setEditingOptNo] = useState<number | null>(null);

  const [optService, setOptService] = useState<ServiceKey>("flight");
  const [optTitle, setOptTitle] = useState("");
  const [optVendor, setOptVendor] = useState("");
  const [optValidityTill, setOptValidityTill] = useState<string>("");
  const [optNotes, setOptNotes] = useState<string>("");
  const [optMeta, setOptMeta] = useState<OptionMeta>(buildDefaultMeta("flight"));
  const [optLineItems, setOptLineItems] = useState<ProposalLineItem[]>([]);

  // ✅ MULTI upload
  const [optUploadFiles, setOptUploadFiles] = useState<File[]>([]);
  const [optUploadBusy, setOptUploadBusy] = useState(false);

  const options: ProposalOption[] = useMemo(() => {
    const p: any = proposal;
    return Array.isArray(p?.options) ? (p.options as ProposalOption[]) : [];
  }, [proposal]);

  const proposalStatus = String((proposal as any)?.status || "").toUpperCase();
  const bookingStatus = String((proposal as any)?.booking?.status || "NOT_STARTED").toUpperCase();

  const canEditDraft = proposalStatus === "DRAFT";
  const canSubmit = proposalStatus === "DRAFT";
  const canDecide = proposalStatus === "SUBMITTED";

  // Booking flow gates
  const canBooking = proposalStatus === "APPROVED";
  const canBookingStart = canBooking && bookingStatus === "NOT_STARTED";
  const canBookingDone = canBooking && bookingStatus === "IN_PROGRESS";
  const canBookingCancel =
    canBooking && (bookingStatus === "IN_PROGRESS" || bookingStatus === "NOT_STARTED");
  const canUploadBookingPdf =
    canBooking && (bookingStatus === "IN_PROGRESS" || bookingStatus === "DONE");

  const bookingAttachments: string[] = useMemo(() => {
    const p: any = proposal;
    const a1 = Array.isArray(p?.booking?.attachments) ? p.booking.attachments : [];
    return Array.from(new Set([...a1].map((x) => String(x || "").trim()).filter(Boolean)));
  }, [proposal]);

  const loadedRequestId = String(
    (proposal as any)?.requestId || requestIdFromUrl || requestId || ""
  ).trim();

  // ✅ Backend contract: proposal.totalAmount is always Option-1 total (customer-visible)
  const option1Total = useMemo(() => {
    const sorted = options.slice().sort((a, b) => Number(a.optionNo) - Number(b.optionNo));
    const option1 = sorted.find((o) => Number(o.optionNo) === 1) || sorted[0];
    if (!option1) return 0;
    const t = Number(option1.totalAmount);
    return Number.isFinite(t) ? t : computeOptionTotal(option1);
  }, [options]);

  // Informational only (admin may build many options)
  const optionsSumTotal = useMemo(() => {
    const tot = options.reduce((s, o) => s + (Number(o.totalAmount) || computeOptionTotal(o)), 0);
    return Number.isFinite(tot) ? tot : 0;
  }, [options]);

  /* --------------------- Busy helper (prevents nested overwrites) --------------------- */

  async function runBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  /* --------------------- Loaders --------------------- */

  const loadByRequest = useCallback(async (id: string) => {
    const rid = String(id || "").trim();
    if (!rid) {
      setProposal(null);
      return;
    }

    setErr(null);
    setLoading(true);
    try {
      const res = await getProposalByRequest(rid);
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      if (p?.currency) setCurrency(String(p.currency || "INR"));
    } catch (e: any) {
      setProposal(null);
      setErr(e?.message || "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const rid = String(requestIdFromUrl || "").trim();
    setRequestId(rid);
    if (rid) loadByRequest(rid);
    else setProposal(null);
  }, [requestIdFromUrl, loadByRequest]);

  function applyUrlParam(rid: string) {
    const v = String(rid || "").trim();
    const next = new URLSearchParams(params);
    if (v) next.set("requestId", v);
    else next.delete("requestId");
    setParams(next, { replace: true });
  }

  async function handleSearch() {
    const rid = String(requestId || "").trim();
    applyUrlParam(rid);
    await loadByRequest(rid);
  }

  async function handleCreateDraft() {
    const rid = String(requestId || "").trim();
    if (!rid) {
      setErr("Please enter requestId");
      return;
    }

    await runBusy("createDraft", async () => {
      const res = await createDraftProposalByRequest(rid, { currency: String(currency || "INR") });
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      applyUrlParam(rid);
    });
  }

  function getOption1TotalFromOptions(nextOptions: ProposalOption[]): number {
    const sorted = (nextOptions || []).slice().sort((a, b) => Number(a.optionNo) - Number(b.optionNo));
    const option1 = sorted.find((o) => Number(o.optionNo) === 1) || sorted[0];
    if (!option1) return 0;
    const t = Number(option1.totalAmount);
    return Number.isFinite(t) ? t : computeOptionTotal(option1);
  }

  async function saveDraftOptions(nextOptions: ProposalOption[], opts?: { silentBusy?: boolean }) {
    if (!proposalId) return;

    if (!opts?.silentBusy) setBusy("saveDraft");
    setErr(null);

    try {
      const patched = (nextOptions || []).map((o) => {
        const items = Array.isArray(o.lineItems) ? o.lineItems : [];

        const fixedItems = items.map((li, idx) => {
          const qty = Number(li.qty || 0);
          const unit = Number(li.unitPrice || 0);
          const cleanQty = Number.isFinite(qty) ? qty : 0;
          const cleanUnit = Number.isFinite(unit) ? unit : 0;

          const merged = {
            ...li,
            itemIndex: li.itemIndex ?? idx + 1,
            qty: cleanQty,
            unitPrice: cleanUnit,
            totalPrice: computeLineTotal({ qty: cleanQty, unitPrice: cleanUnit }),
            currency: li.currency || o.currency || currency || "INR",
          };

          return merged;
        });

        const total = computeOptionTotal({ ...o, lineItems: fixedItems });

        return {
          ...o,
          currency: o.currency || currency || "INR",
          lineItems: fixedItems,
          totalAmount: total,
          attachments: Array.isArray(o.attachments) ? o.attachments : [],
        };
      });

      // ✅ MUST MATCH backend: totalAmount = option-1 total
      const totalAmount = getOption1TotalFromOptions(patched);

      const res = await updateProposal(proposalId, {
        currency: String(currency || "INR"),
        options: patched,
        totalAmount,
      });

      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
    } catch (e: any) {
      setErr(e?.message || "Failed to save draft");
    } finally {
      if (!opts?.silentBusy) setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!proposalId) return;

    await runBusy("submit", async () => {
      // ✅ ensure draft saved BEFORE submit, but do NOT overwrite busy="submit"
      await saveDraftOptions(options, { silentBusy: true });

      const res = await submitProposal(proposalId);
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);

      if (loadedRequestId) await loadByRequest(loadedRequestId);
    });
  }

  async function handleDecide() {
    if (!proposalId) return;

    await runBusy("decide", async () => {
      const res = await decideProposal(proposalId, {
        role: decisionRole,
        decision,
        note: decisionNote.trim() || undefined,
      });
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      if (loadedRequestId) await loadByRequest(loadedRequestId);
    });
  }

  function numFromMoneyInput(v: string): number | null {
    const n = Number(String(v || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  async function handleBookingStart() {
    if (!proposalId) return;

    await runBusy("bookingStart", async () => {
      const res = await startBookingFromProposal(proposalId, {
        note: bookingNote.trim() || undefined,
      });
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      if (loadedRequestId) await loadByRequest(loadedRequestId);
    });
  }

  async function handleBookingDone() {
    if (!proposalId) return;

    const ba = numFromMoneyInput(bookingAmount);
    const ap = numFromMoneyInput(actualBookingPrice);

    if (ba === null || ap === null) {
      setErr("Booking Amount and Actual Booking Price must be valid numbers.");
      return;
    }

    await runBusy("bookingDone", async () => {
      const res = await markBookingDoneFromProposal(proposalId, {
        bookingAmount: ba,
        actualBookingPrice: ap,
        note: bookingNote.trim() || undefined,
      });
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      if (loadedRequestId) await loadByRequest(loadedRequestId);
    });
  }

  async function handleBookingCancel() {
    if (!proposalId) return;

    await runBusy("bookingCancel", async () => {
      const res = await cancelBookingFromProposal(proposalId, {
        note: bookingNote.trim() || undefined,
      });
      const p = (res as any)?.proposal ?? (res as any)?.data?.proposal ?? null;
      setProposal(p);
      if (loadedRequestId) await loadByRequest(loadedRequestId);
    });
  }

  async function handleUploadBookingPdf() {
    if (!proposalId) return;
    if (!bookingPdf) {
      setErr("Please choose a PDF file first.");
      return;
    }
    if (bookingPdf.type !== "application/pdf") {
      setErr("Only PDF files are allowed.");
      return;
    }

    await runBusy("uploadBookingPdf", async () => {
      const res = await uploadProposalBookingAttachment(proposalId, bookingPdf);
      const url = (res as any)?.url || (res as any)?.data?.url || (res as any)?.attachmentUrl || "";

      if (loadedRequestId) await loadByRequest(loadedRequestId);
     
      setBookingPdf(null);
    });
  }

  /* ------------------------------------------------------------- */
  /* Option builder                                                  */
  /* ------------------------------------------------------------- */

  const userTouchedTitleRef = useRef(false);

  function openCreateOption() {
    setErr(null);
    setEditingOptNo(null);

    userTouchedTitleRef.current = false;

    setOptService("flight");
    const meta = buildDefaultMeta("flight");
    setOptMeta(meta);
    setOptTitle(buildOptionTitle("flight", meta));
    setOptVendor("");
    setOptValidityTill("");
    setOptNotes("");
    setOptLineItems([buildDefaultLineItem("flight", meta, currency)]);
    setOptUploadFiles([]);
    setOptDrawerOpen(true);
  }

  function openEditOption(opt: ProposalOption) {
    setErr(null);
    setEditingOptNo(opt.optionNo);

    userTouchedTitleRef.current = true;

    const meta: any = (opt as any).meta || { service: "generic" };
    const service: ServiceKey = (meta?.service as ServiceKey) || (meta?.type as ServiceKey) || "generic";

    setOptService(service);
    setOptMeta(meta || buildDefaultMeta(service));
    setOptTitle(opt.title || buildOptionTitle(service, meta || {}));
    setOptVendor(opt.vendor || "");
    setOptValidityTill(opt.validityTill ? String(opt.validityTill).slice(0, 10) : "");
    setOptNotes(opt.notes || "");
    setOptLineItems(Array.isArray(opt.lineItems) ? opt.lineItems : []);
    setOptUploadFiles([]);
    setOptDrawerOpen(true);
  }

  function closeOptDrawer() {
    setOptDrawerOpen(false);
    setEditingOptNo(null);
  }

  function setOptMetaField(k: string, v: any) {
    setOptMeta((p) => ({ ...(p || {}), [k]: v }));
  }

  // ✅ Keep title in sync with meta IF user hasn't typed custom title (or they cleared it)
  useEffect(() => {
    if (!optDrawerOpen) return;

    const autoTitle = buildOptionTitle(optService, optMeta || {});
    const current = ensureStr(optTitle);

    if (!userTouchedTitleRef.current || !current) {
      setOptTitle(autoTitle);
    }

    setOptLineItems((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.length) return arr;
      return [buildDefaultLineItem(optService, optMeta || {}, currency)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optDrawerOpen, optService, optMeta]);

  function addLineItem() {
    setOptLineItems((p) => {
      const arr = Array.isArray(p) ? p : [];
      const nextIndex = arr.length + 1;
      const li: ProposalLineItem = {
        itemIndex: nextIndex,
        category: "SERVICE",
        title: "",
        qty: 1,
        unitPrice: 0,
        totalPrice: 0,
        currency: currency || "INR",
        notes: "",
      };
      return [...arr, li];
    });
  }

  function removeLineItem(idx: number) {
    setOptLineItems((p) => {
      const arr = Array.isArray(p) ? p : [];
      return arr.filter((_, i) => i !== idx).map((x, i) => ({ ...x, itemIndex: i + 1 }));
    });
  }

  function patchLineItem(idx: number, patch: Partial<ProposalLineItem>) {
    setOptLineItems((p) => {
      const arr = Array.isArray(p) ? p : [];
      const next = [...arr];
      const cur = next[idx] || ({} as ProposalLineItem);
      const merged = { ...cur, ...patch };

      const qty = Number(merged.qty || 0);
      const unit = Number(merged.unitPrice || 0);
      merged.qty = Number.isFinite(qty) ? qty : 0;
      merged.unitPrice = Number.isFinite(unit) ? unit : 0;
      merged.totalPrice = computeLineTotal(merged);
      merged.currency = merged.currency || currency || "INR";

      next[idx] = merged as ProposalLineItem;
      return next;
    });
  }

  const optTotal = useMemo(() => computeOptionTotal({ lineItems: optLineItems }), [optLineItems]);

  function validateOption(): string {
    if (!ensureStr(optTitle)) return "Option title is required.";
    if (!Array.isArray(optLineItems)) return "Line items missing.";
    return "";
  }

  function buildOptionFromDrawer(nextNo: number): ProposalOption {
  const normalizedItems = (optLineItems || []).map((li, idx) => {
    const qty = Number(li.qty || 0);
    const unit = Number(li.unitPrice || 0);
    const cleanQty = Number.isFinite(qty) ? qty : 0;
    const cleanUnit = Number.isFinite(unit) ? unit : 0;

    const clean: ProposalLineItem = {
      ...li,
      itemIndex: idx + 1,
      qty: cleanQty,
      unitPrice: cleanUnit,
      totalPrice: computeLineTotal({ qty: cleanQty, unitPrice: cleanUnit }),
      currency: li.currency || currency || "INR",
      title: ensureStr(li.title) || "Service",
      category: ensureStr(li.category) || "SERVICE",
    };
    return clean;
  });

  const validity = parseDateOrNull(optValidityTill);

  const nextOpt: ProposalOption = {
    optionNo: nextNo,
    title: ensureStr(optTitle),
    vendor: ensureStr(optVendor) || undefined,
    validityTill: validity,
    currency: currency || "INR",
    totalAmount: computeOptionTotal({ lineItems: normalizedItems }),
    notes: ensureStr(optNotes) || undefined,
    lineItems: normalizedItems,
    attachments:
      editingOptNo != null
        ? options.find((o) => Number(o.optionNo) === Number(nextNo))?.attachments || []
        : [],
    ...(optMeta ? { meta: { ...(optMeta || {}), service: optService } } : {}),
  } as any;

  return nextOpt;
}

  async function saveOptionToDraft() {
    if (!proposalId) {
      setErr("Load/Create a draft proposal first.");
      return;
    }
    if (!canEditDraft) {
      setErr("You can edit options only when proposal status is DRAFT.");
      return;
    }

    const vErr = validateOption();
    if (vErr) {
      setErr(vErr);
      return;
    }

    const isEditing = editingOptNo != null;
    const nextNo = isEditing
      ? (editingOptNo as number)
      : Math.max(0, ...options.map((o) => Number(o.optionNo || 0))) + 1;

    const normalizedItems = (optLineItems || []).map((li, idx) => {
      const qty = Number(li.qty || 0);
      const unit = Number(li.unitPrice || 0);
      const cleanQty = Number.isFinite(qty) ? qty : 0;
      const cleanUnit = Number.isFinite(unit) ? unit : 0;

      const clean: ProposalLineItem = {
        ...li,
        itemIndex: idx + 1,
        qty: cleanQty,
        unitPrice: cleanUnit,
        totalPrice: computeLineTotal({ qty: cleanQty, unitPrice: cleanUnit }),
        currency: li.currency || currency || "INR",
        title: ensureStr(li.title) || "Service",
        category: ensureStr(li.category) || "SERVICE",
      };
      return clean;
    });

    const validity = parseDateOrNull(optValidityTill);

    const nextOpt: ProposalOption = {
      optionNo: nextNo,
      title: ensureStr(optTitle),
      vendor: ensureStr(optVendor) || undefined,
      validityTill: validity,
      currency: currency || "INR",
      totalAmount: computeOptionTotal({ lineItems: normalizedItems }),
      notes: ensureStr(optNotes) || undefined,
      lineItems: normalizedItems,
      attachments: isEditing ? options.find((o) => o.optionNo === nextNo)?.attachments || [] : [],
      ...(optMeta ? { meta: { ...(optMeta || {}), service: optService } } : {}),
    } as any;

    const nextOptions = isEditing
      ? options.map((o) => (o.optionNo === nextNo ? nextOpt : o))
      : [...options, nextOpt].sort((a, b) => Number(a.optionNo) - Number(b.optionNo));

    await saveDraftOptions(nextOptions);
    closeOptDrawer();
  }

  async function deleteOption(optNo: number) {
    if (!proposalId) return;
    if (!canEditDraft) {
      setErr("You can delete options only in DRAFT status.");
      return;
    }
    const nextOptions = options.filter((o) => o.optionNo !== optNo);
    await saveDraftOptions(nextOptions);
  }

  function normalizeUploadResponse(res: any): string[] {
    // New backend: { added: string[], attachments: string[] }
    const added = Array.isArray(res?.added) ? res.added : Array.isArray(res?.data?.added) ? res.data.added : null;
    if (Array.isArray(added) && added.length) return added.map((x: any) => String(x || "").trim()).filter(Boolean);

    // Old backend: { url }
    const url = res?.url || res?.data?.url || res?.attachmentUrl || res?.data?.attachmentUrl;
    if (url) return [String(url).trim()];

    return [];
  }

async function uploadPdfForEditingOption() {
  if (!proposalId) return;
  if (!canEditDraft) {
    setErr("Upload allowed only in DRAFT (before submit).");
    return;
  }
  if (!optUploadFiles.length) {
    setErr("Choose PDF file(s) first.");
    return;
  }

  const nonPdf = optUploadFiles.find((f) => f.type !== "application/pdf");
  if (nonPdf) {
    setErr("Only PDF files are allowed.");
    return;
  }

  setOptUploadBusy(true);
  setErr(null);

  try {
    // ✅ Step 1: ensure we have an optionNo (persist option if it's new)
    let optNo = editingOptNo;

    if (optNo == null) {
      // validate before auto-saving
      const vErr = validateOption();
      if (vErr) {
        setErr(vErr);
        return;
      }

      // pick next option number
      const nextNo =
        Math.max(0, ...options.map((o) => Number(o.optionNo || 0))) + 1;

      const nextOpt = buildOptionFromDrawer(nextNo);

      const nextOptions = [...options, nextOpt].sort(
        (a, b) => Number(a.optionNo) - Number(b.optionNo)
      );

      // persist first so backend knows this option exists
      await saveDraftOptions(nextOptions, { silentBusy: true });

      // now we have a real option number for this drawer session
      optNo = nextNo;
      setEditingOptNo(nextNo);
    }

    // ✅ Step 2: upload PDFs
    const res = await uploadProposalOptionAttachments(
      proposalId,
      optNo as number,
      optUploadFiles
    );

    normalizeUploadResponse(res);

    // refresh proposal to show attachments immediately
    if (loadedRequestId) await loadByRequest(loadedRequestId);

    setOptUploadFiles([]);
  } catch (e: any) {
    setErr(e?.message || "Failed to upload option PDF(s)");
  } finally {
    setOptUploadBusy(false);
  }
}
  /* ------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 xl:max-w-7xl">
      <div className="rounded-[36px] bg-gradient-to-b from-[#f6f7ff] via-white to-[#fff7f1] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        {/* Top bar */}
        <div className="sticky top-0 z-20 rounded-t-[36px] border-b border-black/5 bg-white/70 backdrop-blur-xl">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white shadow-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px]">
                    ◎
                  </span>
                  <span>Pluto Copilot · Proposals</span>
                </div>

                <h1 className="mt-2 text-xl font-semibold text-zinc-900">Proposal for Request</h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Load request → create draft → build options (form) → save → submit → approve/decline → execute booking.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => nav("/admin/approvals")}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  ← Admin Queue
                </button>

                <button
                  type="button"
                  onClick={() => loadByRequest(String(requestId || "").trim())}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                  disabled={loading || !String(requestId || "").trim()}
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-4">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Request ID
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                  <span className="text-zinc-400">#</span>
                  <input
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    className="w-full bg-transparent text-[11px] outline-none"
                    placeholder="Paste ApprovalRequest _id here"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="rounded-full bg-zinc-900 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-60"
                    disabled={loading || !String(requestId || "").trim()}
                  >
                    {loading ? "Loading…" : "Load"}
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  Tip: open via URL:{" "}
                  <span className="font-semibold">/admin/proposals/by-request?requestId=...</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Current state
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                  {!proposal ? (
                    <div className="text-[11px] text-zinc-600">No proposal loaded</div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        STATUS: {proposalStatus || "—"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        BOOKING: {bookingStatus}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        ID: {shortId(proposalId)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Primary Total: {fmtMoney(option1Total, currency)}
                      </span>
                      {options.length > 1 ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          Sum (all options): {fmtMoney(optionsSumTotal, currency)}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {err && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {!proposal ? (
            <div className="rounded-3xl border border-zinc-100 bg-white px-4 py-6">
              <div className="text-sm font-semibold text-zinc-900">No proposal found</div>
              <div className="mt-1 text-[11px] text-zinc-600">
                If this request is in admin workflow, create a draft proposal for it.
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateDraft}
                  disabled={busy === "createDraft" || !String(requestId || "").trim()}
                  className="rounded-full bg-[#00477f] px-5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767] disabled:opacity-60"
                >
                  {busy === "createDraft" ? "Creating…" : "Create Draft Proposal"}
                </button>

                {loadedRequestId ? (
                  <span className="text-[11px] text-zinc-500">
                    Loaded requestId: <span className="font-semibold">{loadedRequestId}</span>
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Proposal settings + actions */}
              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Draft Controls</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Build options using a form (no JSON). Save Draft to persist. Submit to send to approvers.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openCreateOption}
                        disabled={!canEditDraft || busy !== null}
                        className="rounded-2xl bg-[#00477f] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#003767] disabled:opacity-60"
                      >
                        + Add Option
                      </button>

                      <button
                        type="button"
                        onClick={() => saveDraftOptions(options)}
                        disabled={!canEditDraft || busy !== null}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {busy === "saveDraft" ? "Saving…" : "Save Draft"}
                      </button>

                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit || busy !== null}
                        className="rounded-2xl bg-[#d06549] px-4 py-2 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-60"
                      >
                        {busy === "submit" ? "Submitting…" : "Submit to Approvers"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Currency">
                      <Input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        disabled={!canEditDraft || busy !== null}
                        placeholder="INR"
                      />
                    </Field>

                    <Field label="Request ID" hint="Read-only">
                      <Input value={loadedRequestId} readOnly />
                    </Field>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] text-slate-500">Primary Total (Option-1)</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {fmtMoney(option1Total, currency)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Options: {options.length}
                        {options.length > 1 ? (
                          <>
                            {" "}
                            · Sum (all):{" "}
                            <span className="font-semibold">{fmtMoney(optionsSumTotal, currency)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {!canEditDraft ? (
                    <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] text-amber-800">
                      Draft is locked because status is <b>{proposalStatus || "—"}</b>. You can edit only in{" "}
                      <b>DRAFT</b>.
                    </div>
                  ) : null}
                </div>

                {/* Options list */}
                <div className="p-5">
                  {options.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      No options yet. Click <b>+ Add Option</b> and build proposal like ApprovalNew (flight/hotel/etc.).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {options
                        .slice()
                        .sort((a, b) => Number(a.optionNo) - Number(b.optionNo))
                        .map((o) => (
                          <div key={o.optionNo} className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                            <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">
                                    Option {o.optionNo}: {o.title || "—"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    {o.vendor ? (
                                      <>
                                        Vendor: <b>{o.vendor}</b> ·{" "}
                                      </>
                                    ) : null}
                                    {o.validityTill ? (
                                      <>
                                        Valid till: <b>{String(o.validityTill).slice(0, 10)}</b> ·{" "}
                                      </>
                                    ) : null}
                                    Items: <b>{Array.isArray(o.lineItems) ? o.lineItems.length : 0}</b>
                                    {Array.isArray(o.attachments) && o.attachments.length ? (
                                      <>
                                        {" "}
                                        · PDFs: <b>{o.attachments.length}</b>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                                    <div className="text-[10px] text-slate-200">Total</div>
                                    <div className="text-sm font-semibold">
                                      {fmtMoney(o.totalAmount ?? computeOptionTotal(o), o.currency || currency)}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => openEditOption(o)}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteOption(o.optionNo)}
                                    disabled={!canEditDraft || busy !== null}
                                    className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="p-4">
                              {o.notes ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                                    Itinerary / Detailed Text
                                  </div>
                                  {o.notes}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500">
                                  Tip: Add itinerary text inside Option Editor → “Itinerary / Detailed Text”.
                                </div>
                              )}

                              {/* Line items */}
                              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                                <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600">
                                  <div className="col-span-6">Item</div>
                                  <div className="col-span-2 text-right">Qty</div>
                                  <div className="col-span-2 text-right">Unit</div>
                                  <div className="col-span-2 text-right">Total</div>
                                </div>

                                {(o.lineItems || []).map((li, idx) => (
                                  <div
                                    key={idx}
                                    className="grid grid-cols-12 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-700"
                                  >
                                    <div className="col-span-6">
                                      <div className="font-semibold text-slate-900">{li.title || "—"}</div>
                                      <div className="text-[10px] text-slate-500">{li.category || "SERVICE"}</div>
                                      {li.notes ? (
                                        <div className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap">
                                          {li.notes}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="col-span-2 text-right">{li.qty}</div>
                                    <div className="col-span-2 text-right">
                                      {fmtMoney(li.unitPrice, li.currency || o.currency || currency)}
                                    </div>
                                    <div className="col-span-2 text-right font-semibold">
                                      {fmtMoney(li.totalPrice, li.currency || o.currency || currency)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Attachments */}
                              <div className="mt-3">
                                <div className="text-xs font-semibold text-slate-800">Option Attachments</div>
                                {!o.attachments || o.attachments.length === 0 ? (
                                  <div className="mt-1 text-[11px] text-slate-500">No attachments.</div>
                                ) : (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {o.attachments.map((u, idx) => (
                                      <button
                                        key={`${o.optionNo}-${idx}`}
                                        type="button"
                                        onClick={() => openProposalAttachment(u)}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                                      >
                                        ⬇ Open PDF {idx + 1}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>

              {/* decisions */}
              <section className="rounded-3xl border border-zinc-100 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Proposal decision
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">L2 / L0 approval from Admin panel</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      Allowed when status is <span className="font-semibold">SUBMITTED</span>.
                    </div>
                  </div>

                  <div
                    className={cx(
                      "rounded-2xl px-3 py-2 text-[11px]",
                      canDecide ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {canDecide ? "Ready to decide" : "Not in SUBMITTED state"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Role
                    </div>
                    <select
                      value={decisionRole}
                      onChange={(e) => setDecisionRole(e.target.value as any)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                      disabled={!canDecide || busy !== null}
                    >
                      <option value="L2">L2</option>
                      <option value="L0">L0</option>
                    </select>
                  </div>

                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Decision
                    </div>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value as any)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                      disabled={!canDecide || busy !== null}
                    >
                      <option value="APPROVED">APPROVED</option>
                      <option value="DECLINED">DECLINED</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Note (optional)
                    </div>
                    <input
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                      placeholder="Decision remark for audit trail"
                      disabled={!canDecide || busy !== null}
                    />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDecide}
                    disabled={!canDecide || busy !== null}
                    className="rounded-full bg-[#00477f] px-5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767] disabled:opacity-60"
                  >
                    {busy === "decide" ? "Saving…" : "Apply Decision"}
                  </button>
                </div>
              </section>

              {/* booking */}
              <section className="rounded-3xl border border-zinc-100 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Booking execution
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">Start → Done / Cancel</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">
                      Allowed when proposal is <span className="font-semibold">APPROVED</span>.
                    </div>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {bookingStatus}
                  </span>
                </div>

                {!canBooking ? (
                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] text-zinc-600">
                    Booking actions are locked until proposal status is{" "}
                    <span className="font-semibold">APPROVED</span>.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="md:col-span-3">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Note (optional)
                        </div>
                        <input
                          value={bookingNote}
                          onChange={(e) => setBookingNote(e.target.value)}
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                          placeholder="Admin booking context (ticket issued, voucher shared, etc.)"
                          disabled={busy !== null}
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Booking Amount (customer)
                        </div>
                        <input
                          value={bookingAmount}
                          onChange={(e) => setBookingAmount(e.target.value)}
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                          placeholder="e.g. 12000"
                          inputMode="decimal"
                          disabled={!canBookingDone || busy !== null}
                        />
                      </div>

                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Actual Booking Price (vendor)
                        </div>
                        <input
                          value={actualBookingPrice}
                          onChange={(e) => setActualBookingPrice(e.target.value)}
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                          placeholder="e.g. 9800"
                          inputMode="decimal"
                          disabled={!canBookingDone || busy !== null}
                        />
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          PDF attachment (booking)
                        </div>

                        <label
                          className={cx(
                            "mt-2 flex items-center justify-between rounded-2xl border border-dashed bg-white px-3 py-2 text-[11px] text-zinc-700",
                            canUploadBookingPdf && busy === null
                              ? "cursor-pointer border-zinc-300 hover:border-sky-400"
                              : "cursor-not-allowed border-zinc-200 opacity-60"
                          )}
                        >
                          <span className="truncate">
                            {bookingPdf ? bookingPdf.name : "Choose booking/invoice PDF"}
                          </span>
                          <span className="ml-3 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white">
                            Browse
                          </span>
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => setBookingPdf(e.target.files?.[0] || null)}
                            disabled={!canUploadBookingPdf || busy !== null}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleUploadBookingPdf}
                          disabled={!canUploadBookingPdf || busy !== null || !bookingPdf}
                          className="mt-2 w-full rounded-full bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                          {busy === "uploadBookingPdf" ? "Uploading…" : "Upload PDF"}
                        </button>

                        <div className="mt-2 text-[10px] text-zinc-500">
                          Upload enabled when booking is{" "}
                          <span className="font-semibold">IN_PROGRESS</span> or{" "}
                          <span className="font-semibold">DONE</span>.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleBookingStart}
                        disabled={!canBookingStart || busy !== null}
                        className="rounded-full bg-sky-50 px-4 py-2 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                        title={!canBookingStart ? "Start is allowed only when booking is NOT_STARTED" : ""}
                      >
                        {busy === "bookingStart" ? "Saving…" : "Start"}
                      </button>

                      <button
                        type="button"
                        onClick={handleBookingDone}
                        disabled={!canBookingDone || busy !== null}
                        className="rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        title={!canBookingDone ? "Done is allowed only when booking is IN_PROGRESS" : ""}
                      >
                        {busy === "bookingDone" ? "Saving…" : "Done"}
                      </button>

                      <button
                        type="button"
                        onClick={handleBookingCancel}
                        disabled={!canBookingCancel || busy !== null}
                        className="rounded-full bg-rose-500 px-4 py-2 text-[11px] font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        {busy === "bookingCancel" ? "Saving…" : "Cancel"}
                      </button>
                    </div>

                    {bookingAttachments.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Booking Attachments
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {bookingAttachments.map((u, idx) => (
                            <button
                              key={`${idx}-${u}`}
                              type="button"
                              onClick={() => openProposalAttachment(u)}
                              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50"
                            >
                              ⬇ Open PDF {idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Raw payload preview */}
              <section className="rounded-3xl border border-zinc-100 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Raw payload preview
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Request: <span className="font-semibold">{loadedRequestId || "—"}</span>
                  </div>
                </div>

                <pre className="mt-2 max-h-[420px] overflow-auto rounded-2xl bg-zinc-950 p-3 text-[11px] text-zinc-100">
{(() => {
  try {
    return JSON.stringify(proposal, null, 2);
  } catch {
    return String(proposal);
  }
})()}
                </pre>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ---------------- Option Drawer ---------------- */}
      <DrawerShell
        open={optDrawerOpen}
        onClose={closeOptDrawer}
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Option Editor</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">
              {editingOptNo != null ? `Option ${editingOptNo}` : "New Option"}
            </span>
            <span className="rounded-full bg-[#00477f]/10 px-3 py-1 text-[11px] text-[#00477f] ring-1 ring-[#00477f]/20">
              {String(optService).toUpperCase()}
            </span>
          </div>
        }
        subtitle="Write itinerary text, add line items, and upload PDFs for this option."
      >
        <div className="space-y-4">
          {/* Service selector */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-900">Service Type</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Choose a type → we show a friendly form (like ApprovalNew). This stores structured meta + readable itinerary text.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {SERVICE_TYPES.map((s) => (
                  <Chip
                    key={s.key}
                    active={optService === s.key}
                    onClick={() => {
                      userTouchedTitleRef.current = false;

                      // ✅ reset cross-service fields
                      setOptVendor("");
                      setOptValidityTill("");
                      setOptNotes("");
                      setOptUploadFiles([]);

                      setOptService(s.key);
                      const meta = buildDefaultMeta(s.key);
                      setOptMeta(meta);
                      setOptTitle(buildOptionTitle(s.key, meta));
                      setOptLineItems([buildDefaultLineItem(s.key, meta, currency)]);
                    }}
                  >
                    <span className="mr-1">{s.emoji}</span> {s.label}
                  </Chip>
                ))}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{SERVICE_TYPES.find((x) => x.key === optService)?.label}:</span>{" "}
                {SERVICE_TYPES.find((x) => x.key === optService)?.hint}
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Title">
                  <Input
                    value={optTitle}
                    onChange={(e) => {
                      userTouchedTitleRef.current = true;
                      setOptTitle(e.target.value);
                    }}
                    placeholder="Option title"
                  />
                </Field>

                <Field label="Vendor (optional)">
                  <Input value={optVendor} onChange={(e) => setOptVendor(e.target.value)} placeholder="e.g., XYZ Travels" />
                </Field>

                <Field label="Validity (optional)">
                  <Input
                    type="date"
                    min={todayISO()}
                    value={optValidityTill}
                    onChange={(e) => setOptValidityTill(e.target.value)}
                  />
                </Field>
              </div>

              {/* Flight form */}
              {optService === "flight" ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Flight Details</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Trip Type">
                      <Select value={optMeta.tripType || "oneway"} onChange={(e) => setOptMetaField("tripType", e.target.value)}>
                        <option value="oneway">One Way</option>
                        <option value="roundtrip">Round Trip</option>
                        <option value="multicity">Multi City</option>
                      </Select>
                    </Field>

                    <Field label="Cabin Class">
                      <Select value={optMeta.cabinClass || "Economy"} onChange={(e) => setOptMetaField("cabinClass", e.target.value)}>
                        <option>Economy</option>
                        <option>Premium Economy</option>
                        <option>Business</option>
                        <option>First</option>
                      </Select>
                    </Field>

                    <Field label="Preferred Airline (optional)">
                      <Input
                        value={optMeta.preferredAirline || ""}
                        onChange={(e) => setOptMetaField("preferredAirline", e.target.value)}
                        placeholder="Air India / IndiGo"
                      />
                    </Field>

                    <Field label="Origin" hint="Airport / City code">
                      <AirportAutocomplete
                        value={optMeta.origin || ""}
                        onSelect={(a) => {
                          setOptMetaField("origin", a.iata);
                          setOptMetaField("originMeta", a);
                        }}
                        placeholder="From (e.g., DEL / Delhi)"
                      />
                    </Field>

                    <Field label="Destination" hint="Airport / City code">
                      <AirportAutocomplete
                        value={optMeta.destination || ""}
                        onSelect={(a) => {
                          setOptMetaField("destination", a.iata);
                          setOptMetaField("destinationMeta", a);
                        }}
                        placeholder="To (e.g., BOM / Mumbai)"
                      />
                    </Field>

                    <Field label="Departure Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={optMeta.departDate || ""}
                        onChange={(e) => setOptMetaField("departDate", e.target.value)}
                      />
                    </Field>

                    {String(optMeta.tripType || "").toLowerCase() === "roundtrip" ? (
                      <Field label="Return Date">
                        <Input
                          type="date"
                          min={todayISO()}
                          value={optMeta.returnDate || ""}
                          onChange={(e) => setOptMetaField("returnDate", e.target.value)}
                        />
                      </Field>
                    ) : (
                      <div />
                    )}

                    <Field label="Adults">
                      <Input
                        type="number"
                        min={1}
                        value={optMeta.adults ?? 1}
                        onChange={(e) => setOptMetaField("adults", safeInt(e.target.value, 1))}
                      />
                    </Field>

                    <Field label="Children">
                      <Input
                        type="number"
                        min={0}
                        value={optMeta.children ?? 0}
                        onChange={(e) => setOptMetaField("children", safeInt(e.target.value, 0))}
                      />
                    </Field>

                    <Field label="Infants">
                      <Input
                        type="number"
                        min={0}
                        value={optMeta.infants ?? 0}
                        onChange={(e) => setOptMetaField("infants", safeInt(e.target.value, 0))}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {/* Hotel form */}
              {optService === "hotel" ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Hotel Details</div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="City / Hotel Search" hint="Type city/hotel → select">
                      <HotelSearchModal
                        value={ensureStr(optMeta.city)}
                        onChangeText={(text) => {
                          setOptMetaField("city", text);
                          if (optMeta?.hotel?.placeId) setOptMetaField("hotel", null);
                        }}
                        onSelectHotel={(h: HotelPick) => {
                          const provisional = {
                            placeId: h.id,
                            name: h.name,
                            address: h.formattedAddress,
                            lat: null,
                            lng: null,
                            phone: "",
                            website: "",
                            rating: h.rating ?? null,
                            googleMapsUrl: "",
                            photoUrl: h.photoUrl || "",
                            addressComponents: Array.isArray(h.addressComponents) ? h.addressComponents : [],
                          };
                          setOptMetaField("hotel", provisional);
                        }}
                      />
                    </Field>

                    <Field label="Check-in">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={optMeta.checkIn || ""}
                        onChange={(e) => setOptMetaField("checkIn", e.target.value)}
                      />
                    </Field>

                    <Field label="Check-out">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={optMeta.checkOut || ""}
                        onChange={(e) => setOptMetaField("checkOut", e.target.value)}
                      />
                    </Field>

                    <Field label="Rooms">
                      <Input
                        type="number"
                        min={1}
                        value={optMeta.rooms ?? 1}
                        onChange={(e) => setOptMetaField("rooms", safeInt(e.target.value, 1))}
                      />
                    </Field>

                    <Field label="Meal Plan">
                      <Select value={optMeta.mealPlan || "Breakfast"} onChange={(e) => setOptMetaField("mealPlan", e.target.value)}>
                        <option>Breakfast</option>
                        <option>Half Board</option>
                        <option>Full Board</option>
                        <option>No Meals</option>
                      </Select>
                    </Field>

                    <Field label="Room Type">
                      <Select value={optMeta.roomType || "Standard"} onChange={(e) => setOptMetaField("roomType", e.target.value)}>
                        <option>Standard</option>
                        <option>Deluxe</option>
                        <option>Executive</option>
                        <option>Suite</option>
                      </Select>
                    </Field>
                  </div>
                </div>
              ) : null}

              {/* Itinerary text */}
              <div className="mt-4">
                <Field label="Itinerary / Detailed Text (recommended)" hint="Day-wise plan, inclusions/exclusions, notes">
                  <Textarea
                    rows={7}
                    value={optNotes}
                    onChange={(e) => setOptNotes(e.target.value)}
                    placeholder={`Day 1: ...
Day 2: ...
Inclusions: ...
Exclusions: ...`}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Line Items</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  These make up the total. You can keep items simple and write everything in itinerary text.
                </div>
              </div>

              <button
                type="button"
                onClick={addLineItem}
                className="rounded-full bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white hover:bg-black"
              >
                + Add Item
              </button>
            </div>

            <div className="p-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600">
                  <div className="col-span-5">Title</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {optLineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-3 py-3 items-start">
                    <div className="col-span-5">
                      <Input
                        value={li.title || ""}
                        onChange={(e) => patchLineItem(idx, { title: e.target.value })}
                        placeholder="Flight / Hotel / Service"
                      />
                      <div className="mt-2">
                        <Input
                          value={li.notes || ""}
                          onChange={(e) => patchLineItem(idx, { notes: e.target.value })}
                          placeholder="Small note (optional)"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Input
                        value={li.category || ""}
                        onChange={(e) => patchLineItem(idx, { category: e.target.value })}
                        placeholder="TRAVEL"
                      />
                    </div>

                    <div className="col-span-1">
                      <Input
                        type="number"
                        min={0}
                        value={li.qty ?? 0}
                        onChange={(e) => patchLineItem(idx, { qty: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        value={li.unitPrice ?? 0}
                        onChange={(e) => patchLineItem(idx, { unitPrice: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <div className="text-sm font-semibold text-slate-900 mt-2">
                        {fmtMoney(li.totalPrice ?? computeLineTotal(li), li.currency || currency)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="mt-2 inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Tip: Keep items minimal and write full detail in itinerary text.
                </div>
                <div className="rounded-2xl bg-slate-900 px-3 py-2 text-right text-white">
                  <div className="text-[10px] text-slate-200">Option Total (auto)</div>
                  <div className="text-sm font-semibold">{fmtMoney(optTotal, currency)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* PDFs (option) */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="text-sm font-semibold text-slate-900">PDF Attachments</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Upload quote PDFs for this option. (Save option first → then upload.)
              </div>
            </div>

            <div className="p-4">
              <label className="flex items-center justify-between rounded-2xl border border-dashed bg-white px-3 py-2 text-[11px] text-slate-700 border-slate-300">
                <span className="truncate">
                  {optUploadFiles.length
                    ? optUploadFiles.length === 1
                      ? optUploadFiles[0].name
                      : `${optUploadFiles.length} files selected`
                    : "Choose PDF(s)"}
                </span>
                <span className="ml-3 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white">
                  Browse
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => setOptUploadFiles(Array.from(e.target.files || []))}
                />
              </label>

              <button
                type="button"
                onClick={uploadPdfForEditingOption}
                disabled={optUploadBusy || !optUploadFiles.length || !canEditDraft}
                className="mt-2 w-full rounded-full bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {optUploadBusy ? "Uploading…" : "Upload PDF(s)"}
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeOptDrawer}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveOptionToDraft}
              className="flex-1 rounded-2xl bg-[#00477f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#003767]"
            >
              {editingOptNo != null ? "Save Option" : "Add Option"}
            </button>
          </div>
        </div>
      </DrawerShell>
    </div>
  );
}
