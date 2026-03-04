// src/pages/admin/approvals/AdminApprovalQueue.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import type { ProposalStatus, BookingStatus } from "../../../lib/proposalsApi";
import {
  getAdminApprovedQueue,
  adminAssign,
  adminOnHold,
  adminUnderProcess,
  adminMarkDone,
  adminCancel,
  type ApprovalRequest,
  uploadApprovalAttachment,
} from "../../../lib/approvalsApi";

// ✅ Shared renderer (full meta for each item)
import {
  ApprovalItemsDetail,
  type CartItem,
} from "../../customer/components/approvals/ApprovalItemDetails";

/* ───────────────────────── helpers / styling ───────────────────────── */

type ServiceKind =
  | "flight"
  | "hotel"
  | "visa"
  | "cab"
  | "rail"
  | "holiday"
  | "mice"
  | "other";

type ReasonMode = "hold" | "underProcess" | "done" | "cancel";
type ActionKind = "assign" | ReasonMode;

type ReasonOption = { code: string; label: string };
type ReasonConfig = {
  done: ReasonOption[];
  hold: ReasonOption[];
  underProcess: ReasonOption[];
  cancel: ReasonOption[];
};

/** Generic "other" reasons – reused for Rail / Holiday / MICE / Other */
const OTHER_REASON_CONFIG: ReasonConfig = {
  done: [
    { code: "SERVICE_DELIVERED", label: "Service delivered / closed" },
    { code: "REQUEST_FULFILLED", label: "Request fulfilled as per scope" },
  ],
  hold: [
    { code: "INTERNAL_APPROVAL", label: "Internal approval pending" },
    { code: "VENDOR_NEGOTIATION", label: "Vendor negotiation in progress" },
  ],
  underProcess: [
    { code: "WORK_IN_PROGRESS", label: "Work in progress" },
    { code: "COORDINATION_IN_PROGRESS", label: "Coordination with stakeholders" },
  ],
  cancel: [
    { code: "REQUEST_WITHDRAWN", label: "Request withdrawn by requester" },
    { code: "SCOPE_CHANGED", label: "Scope changed – new request required" },
  ],
};

const SERVICE_REASON_CONFIG: Record<ServiceKind, ReasonConfig> = {
  flight: {
    done: [
      { code: "TICKET_ISSUED", label: "Ticket issued & shared" },
      { code: "REISSUE_DONE", label: "Reissue / rebooking completed" },
      { code: "FARE_PROTECTED", label: "Fare protected & confirmed" },
    ],
    hold: [
      {
        code: "WAITING_TRAVELLER_CONFIRM",
        label: "Waiting for traveller confirmation",
      },
      { code: "WAITING_MANAGER_APPROVAL", label: "Awaiting internal approval" },
      { code: "PAYMENT_CLEARANCE", label: "Payment clearance in progress" },
    ],
    underProcess: [
      { code: "QUEUE_WITH_AIRLINE", label: "In queue with airline / GDS" },
      { code: "PNR_GENERATED", label: "PNR generated, ticketing in progress" },
      {
        code: "SCHEDULE_CHANGE_REVIEW",
        label: "Schedule change review in progress",
      },
    ],
    cancel: [
      { code: "TRAVELLER_CANCELLED", label: "Cancelled by traveller" },
      {
        code: "POLICY_NON_COMPLIANT",
        label: "Not compliant with travel policy",
      },
      { code: "FARE_EXPIRED", label: "Fare expired / seats not available" },
      { code: "PAYMENT_FAILED", label: "Payment failure" },
    ],
  },
  hotel: {
    done: [
      { code: "CONFIRMED", label: "Hotel confirmed & voucher shared" },
      { code: "UPGRADE_CONFIRMED", label: "Room upgrade confirmed" },
      { code: "DATE_CHANGE_DONE", label: "Date change processed" },
    ],
    hold: [
      { code: "RATE_NEGOTIATION", label: "Rate negotiation with property" },
      {
        code: "ROOM_ON_REQUEST",
        label: "Room on request – awaiting confirmation",
      },
      { code: "PAYMENT_PENDING", label: "Payment / credit approval pending" },
    ],
    underProcess: [
      { code: "BLOCKING_IN_PROGRESS", label: "Blocking rooms in progress" },
      { code: "SPECIAL_REQUESTS", label: "Special requests being coordinated" },
      { code: "GROUP_IN_PROGRESS", label: "Group booking in progress" },
    ],
    cancel: [
      { code: "TRAVELLER_CANCELLED", label: "Cancelled by traveller" },
      { code: "NO_AVAILABILITY", label: "No availability at requested property" },
      { code: "RATE_REJECTED", label: "Rate not approved by customer" },
    ],
  },
  visa: {
    done: [
      { code: "APPLICATION_SUBMITTED", label: "Visa application submitted" },
      { code: "VISA_APPROVED", label: "Visa approved & copy shared" },
      {
        code: "BIOMETRIC_COMPLETED",
        label: "Biometric appointment completed",
      },
    ],
    hold: [
      { code: "DOCUMENTS_PENDING", label: "Documents pending from traveller" },
      { code: "APPOINTMENT_SLOTS", label: "Waiting for appointment slots" },
      { code: "PAYMENT_PENDING", label: "Visa fee payment pending" },
    ],
    underProcess: [
      {
        code: "UNDER_EMBASSY_REVIEW",
        label: "Under embassy / consulate review",
      },
      { code: "APPLICATION_UNDER_PROCESS", label: "Application under process" },
      {
        code: "ADDITIONAL_DOCS_REVIEW",
        label: "Additional documents under review",
      },
    ],
    cancel: [
      { code: "TRAVELLER_CANCELLED", label: "Traveller cancelled travel" },
      { code: "REFUSED_BY_EMBASSY", label: "Refused / withdrawn by embassy" },
      { code: "DOCUMENTS_NOT_COMPLIANT", label: "Documents not compliant" },
    ],
  },
  cab: {
    done: [
      { code: "BOOKING_CONFIRMED", label: "Cab booking confirmed" },
      { code: "DRIVER_ASSIGNED", label: "Driver assigned & details shared" },
    ],
    hold: [
      { code: "VEHICLE_AVAILABILITY", label: "Checking vehicle availability" },
      { code: "ROUTE_CLARIFICATION", label: "Route / timing clarification" },
    ],
    underProcess: [
      { code: "COORDINATION_IN_PROGRESS", label: "Vendor coordination in progress" },
    ],
    cancel: [
      { code: "TRAVELLER_CANCELLED", label: "Traveller cancelled requirement" },
      { code: "NO_VEHICLE", label: "No vehicle availability in requested band" },
    ],
  },
  rail: OTHER_REASON_CONFIG,
  holiday: OTHER_REASON_CONFIG,
  mice: OTHER_REASON_CONFIG,
  other: OTHER_REASON_CONFIG,
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatInr(num: number | null | undefined) {
  const v = Number(num || 0);
  if (!Number.isFinite(v)) return "₹0";
  return `₹${v.toLocaleString("en-IN")}`;
}

function formatInrIntl(n: any): string {
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

function getId(r: any): string {
  return String(r?._id || r?.id || r?.requestId || "");
}

function getCartItems(req: any): any[] {
  const a = req?.cartItems;
  if (Array.isArray(a)) return a;
  const b = req?.items;
  if (Array.isArray(b)) return b;
  const c = req?.cart?.items;
  if (Array.isArray(c)) return c;
  const d = req?.cart?.cartItems;
  if (Array.isArray(d)) return d;
  return [];
}

function shortReqCode(r: any) {
  if (r?.ticketId) return String(r.ticketId);
  const id = getId(r);
  return `REQ-${String(id).slice(-6).toUpperCase()}`;
}

function isFlightLike(item: any): boolean {
  const t = String(item?.type || item?.service || item?.category || "").toLowerCase();
  return t.includes("flight") || t.includes("air");
}

function getServiceKind(req: any): ServiceKind {
  const items = getCartItems(req);
  const primary = (items.find(isFlightLike) || items[0] || {}) as any;

  const t = String(primary?.type || primary?.service || primary?.category || "").toLowerCase();

  if (t.includes("flight") || t.includes("air")) return "flight";
  if (t.includes("hotel") || t.includes("stay")) return "hotel";
  if (t.includes("visa")) return "visa";
  if (t.includes("cab") || t.includes("taxi") || t.includes("transfer")) return "cab";
  if (t.includes("train") || t.includes("rail")) return "rail";
  if (t.includes("holiday") || t.includes("package")) return "holiday";
  if (t.includes("mice") || t.includes("event") || t.includes("conference")) return "mice";
  return "other";
}

function getServiceLabel(kind: ServiceKind) {
  if (kind === "flight") return "Flight";
  if (kind === "hotel") return "Hotel";
  if (kind === "visa") return "Visa";
  if (kind === "cab") return "Cab / Transfers";
  if (kind === "rail") return "Rail / Train";
  if (kind === "holiday") return "Holiday / Package";
  if (kind === "mice") return "MICE / Events";
  return "Other service";
}

/** Find best meta payload inside an item */
function pickMeta(primary: any) {
  return primary?.meta || primary?.details || primary?.data || primary?.payload || {};
}

function pickSegment(req: any) {
  const items = getCartItems(req);

  // ✅ Prefer FLIGHT-like item as "primary" when present
  const primary = (items.find(isFlightLike) || items[0] || {}) as any;
  const meta: any = pickMeta(primary);

  const origin =
    meta?.origin ||
    meta?.from ||
    meta?.source ||
    meta?.src ||
    meta?.fromCity ||
    meta?.fromAirport ||
    meta?.pickup ||
    meta?.pickupCity;

  const destination =
    meta?.destination ||
    meta?.to ||
    meta?.target ||
    meta?.dst ||
    meta?.toCity ||
    meta?.toAirport ||
    meta?.drop ||
    meta?.dropCity;

  const countryFrom = meta?.nationality || meta?.fromCountry;
  const countryTo = meta?.country || meta?.toCountry || meta?.destinationCountry;

  const seg =
    origin && destination
      ? `${origin} → ${destination}`
      : countryFrom && countryTo
        ? `${countryFrom} → ${countryTo}`
        : primary?.title || primary?.type || primary?.service || "Travel request";

  return { seg, origin, destination, meta, primary, items };
}

/** Copilot-ish signal */
function getAiSignal(request: any) {
  const cartItems = getCartItems(request);
  const total = cartItems.reduce(
    (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
    0
  );
  const note = String(request?.comments || request?.note || request?.remark || "").toLowerCase();

  if (total > 200000) {
    return {
      label: "High-value trip",
      toneClass:
        "bg-amber-50 text-amber-800 ring-1 ring-amber-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
    };
  }
  if (note.includes("urgent") || note.includes("today") || note.includes("tomorrow")) {
    return {
      label: "Time-sensitive",
      toneClass:
        "bg-rose-50 text-rose-700 ring-1 ring-rose-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
    };
  }
  if (note.includes("client") || note.includes("meeting") || note.includes("business")) {
    return {
      label: "Client-facing",
      toneClass:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
    };
  }
  return {
    label: "Looks routine",
    toneClass:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shadow-[0_0_0_1px_rgba(248,250,252,0.9)]",
  };
}

function badge(status: string) {
  const s = String(status || "").toLowerCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";
  if (s === "approved") return `${base} bg-emerald-50 text-emerald-700 border-emerald-100`;
  if (s === "declined") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (s === "on_hold") return `${base} bg-amber-50 text-amber-800 border-amber-100`;
  return `${base} bg-zinc-50 text-zinc-700 border-zinc-200`;
}

function adminBadge(state?: string | null) {
  const s = String(state || "").toLowerCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";
  if (s === "pending") return `${base} bg-amber-50 text-amber-800 border-amber-100`;
  if (s === "assigned") return `${base} bg-sky-50 text-sky-700 border-sky-100`;
  if (s === "done") return `${base} bg-emerald-50 text-emerald-700 border-emerald-100`;
  if (s === "on_hold") return `${base} bg-rose-50 text-rose-700 border-rose-100`;
  if (s === "cancelled") return `${base} bg-zinc-50 text-zinc-600 border-zinc-200`;
  return `${base} bg-zinc-50 text-zinc-600 border-zinc-200`;
}

/* ───────────────────────── Proposal status chips (Admin Queue) ───────────────────────── */

type ProposalLens = {
  proposalId?: string;
  status?: ProposalStatus | null;
  bookingStatus?: BookingStatus | null;
  version?: number;
  updatedAt?: string;
};

function getProposalLens(r: any): ProposalLens | null {
  const p = (r as any)?._proposal || (r as any)?.proposal || null;
  if (!p) return null;

  const bookingStatus =
    (p?.bookingStatus as BookingStatus) ||
    (p?.booking?.status as BookingStatus) ||
    null;

  return {
    proposalId: String(p?.proposalId || p?._id || p?.id || ""),
    status: (p?.status as ProposalStatus) || null,
    bookingStatus,
    version: typeof p?.version === "number" ? p.version : undefined,
    updatedAt: p?.updatedAt ? String(p.updatedAt) : undefined,
  };
}


function proposalBadge(status?: ProposalStatus | null) {
  const s = String(status || "").toUpperCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";

  if (s === "APPROVED") return `${base} bg-emerald-50 text-emerald-700 border-emerald-100`;
  if (s === "DECLINED") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (s === "SUBMITTED") return `${base} bg-sky-50 text-sky-800 border-sky-100`;
  if (s === "DRAFT") return `${base} bg-amber-50 text-amber-800 border-amber-100`;
  if (s === "EXPIRED") return `${base} bg-zinc-50 text-zinc-600 border-zinc-200`;

  // unknown / missing
  return `${base} bg-zinc-50 text-zinc-700 border-zinc-200`;
}

function proposalLabel(status?: ProposalStatus | null) {
  const s = String(status || "").toUpperCase();
  if (s === "DRAFT") return "PROPOSAL: PENDING";
  if (s === "SUBMITTED") return "PROPOSAL: SUBMITTED";
  if (s === "APPROVED") return "PROPOSAL: APPROVED";
  if (s === "DECLINED") return "PROPOSAL: REJECTED";
  if (s === "EXPIRED") return "PROPOSAL: EXPIRED";
  return "PROPOSAL: UNKNOWN";
}

function bookingBadge(status?: BookingStatus | null) {
  const s = String(status || "").toUpperCase();
  const base = "px-2 py-1 rounded-full text-[10px] border";

  if (s === "DONE") return `${base} bg-emerald-50 text-emerald-700 border-emerald-100`;
  if (s === "IN_PROGRESS") return `${base} bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100`;
  if (s === "CANCELLED") return `${base} bg-zinc-50 text-zinc-600 border-zinc-200`;
  if (s === "NOT_STARTED") return `${base} bg-zinc-50 text-zinc-700 border-zinc-200`;

  return `${base} bg-zinc-50 text-zinc-700 border-zinc-200`;
}

function bookingLabel(status?: BookingStatus | null) {
  const s = String(status || "").toUpperCase();
  if (s === "DONE") return "BOOKING: DONE";
  if (s === "IN_PROGRESS") return "BOOKING: IN PROGRESS";
  if (s === "CANCELLED") return "BOOKING: CANCELLED";
  if (s === "NOT_STARTED") return "BOOKING: NOT STARTED";
  return "BOOKING: —";
}

/* ───────────────────────── admin comment parsing + protected attachment ───────────────────────── */

function safeNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function extractFilenameFromUrl(url: string) {
  try {
    const u = new URL(url, window.location.origin);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    return last;
  } catch {
    const parts = String(url || "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
}

function makeProtectedAttachmentUrl(raw: string) {
  const s = String(raw || "");
  if (!s) return s;

  // already protected route
  if (s.startsWith("/api/approvals/attachments/") && s.includes("/download")) return s;

  const file = extractFilenameFromUrl(s);
  if (!file) return s;

  return `/api/approvals/attachments/${encodeURIComponent(file)}/download`;
}

type ParsedItemReason = { itemIndex: number; reasonCode: string };

function parseAdminComment(raw: any): {
  isAdmin: boolean;
  mode?: string;
  service?: string;
  reason?: string;
  itemReasons?: ParsedItemReason[];
  bookingAmount?: number | null;
  actualPrice?: number | null;
  note?: string;
  attachmentUrl?: string;
  raw: string;
} {
  const text = String(raw || "");
  const isAdmin = /\[ADMIN\]/i.test(text);

  const mode = (text.match(/\[MODE:([^\]]+)\]/i)?.[1] || "").trim();
  const service = (text.match(/\[SERVICE:([^\]]+)\]/i)?.[1] || "").trim();
  const reason = (text.match(/\[REASON:([^\]]+)\]/i)?.[1] || "").trim();

  const bookingAmount = safeNum(text.match(/\[BOOKING_AMOUNT:([^\]]+)\]/i)?.[1] || null);
  const actualPrice = safeNum(text.match(/\[ACTUAL_PRICE:([^\]]+)\]/i)?.[1] || null);

  const itemReasons: ParsedItemReason[] = [];
  const re = /\[ITEM_(\d+)_REASON:([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const idx = Number(m[1]);
    const code = String(m[2] || "").trim();
    if (Number.isFinite(idx) && idx > 0 && code) {
      itemReasons.push({ itemIndex: idx, reasonCode: code });
    }
  }

  let rest = text.replace(/^\s*(?:\[[^\]]+\]\s*)+/g, "").trim();

  let attachmentUrl = "";
  const m1 = rest.match(/Attachment:\s*(https?:\/\/\S+|\S+\/uploads\/\S+)/i);
  if (m1?.[1]) attachmentUrl = String(m1[1]).trim();

  if (!attachmentUrl) {
    const m2 = rest.match(/(https?:\/\/\S+?\.pdf)/i);
    if (m2?.[1]) attachmentUrl = String(m2[1]).trim();
  }

  if (attachmentUrl) {
    rest = rest
      .replace(
        new RegExp(
          `Attachment:\\s*${attachmentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "i"
        ),
        ""
      )
      .trim();
    rest = rest.replace(/—\s*Attachment:.*$/i, "").trim();
  }

  const note = rest.replace(/\s+—\s+/g, " — ").trim();

  return {
    isAdmin,
    mode: mode || undefined,
    service: service || undefined,
    reason: reason || undefined,
    itemReasons: itemReasons.length ? itemReasons : undefined,
    bookingAmount,
    actualPrice,
    note: note || undefined,
    attachmentUrl: attachmentUrl || undefined,
    raw: text,
  };
}

/** Encode reason + service + mode into a single admin comment string (PLUS booking fields) */
function buildAdminComment(opts: {
  mode: ReasonMode | "assign";
  serviceKind: ServiceKind;
  reason?: ReasonOption | null;
  itemReasons?: Array<{ itemIndex: number; reason: ReasonOption }>;
  note?: string;
  docUrl?: string;
  bookingAmount?: number | null;
  actualBookingPrice?: number | null;
  itemTitles?: string[];
}) {
  const {
    mode,
    serviceKind,
    reason,
    itemReasons,
    note,
    docUrl,
    bookingAmount,
    actualBookingPrice,
    itemTitles,
  } = opts;

  const parts: string[] = [];

  parts.push(`[ADMIN]`);
  parts.push(`[MODE:${mode.toUpperCase()}]`);
  parts.push(`[SERVICE:${serviceKind.toUpperCase()}]`);

  const hasMulti = Array.isArray(itemReasons) && itemReasons.length > 0;

  if (hasMulti) parts.push(`[REASON:MULTI]`);
  else if (reason) parts.push(`[REASON:${reason.code}]`);

  if (Number.isFinite(Number(bookingAmount))) parts.push(`[BOOKING_AMOUNT:${Number(bookingAmount)}]`);
  if (Number.isFinite(Number(actualBookingPrice)))
    parts.push(`[ACTUAL_PRICE:${Number(actualBookingPrice)}]`);

  if (hasMulti) {
    for (const ir of itemReasons!) {
      parts.push(`[ITEM_${ir.itemIndex}_REASON:${ir.reason.code}]`);
    }
  }

  let rest = "";

  if (hasMulti) {
    const lines = itemReasons!
      .slice()
      .sort((a, b) => a.itemIndex - b.itemIndex)
      .map((ir) => {
        const title = itemTitles?.[ir.itemIndex - 1] ? ` • ${itemTitles?.[ir.itemIndex - 1]}` : "";
        return `(${ir.itemIndex}) ${ir.reason.label}${title}`;
      });
    rest += `Items: ${lines.join(" | ")}`;
  } else if (reason) {
    rest += `${reason.label}`;
  }

  if (note && note.trim()) rest += (rest ? " — " : "") + note.trim();
  if (docUrl && docUrl.trim()) rest += (rest ? " — " : "") + `Attachment: ${docUrl.trim()}`;

  if (rest) parts.push(rest);
  return parts.join(" ");
}

/* ───────────────────────── Export helpers (CSV + Excel) ───────────────────────── */

function csvEscape(v: any) {
  const s = String(v ?? "");
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
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

function pickLatestAdminHistory(req: any) {
  const hist = Array.isArray(req?.history) ? req.history : Array.isArray(req?.audit) ? req.audit : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const raw = hist[i]?.comment || hist[i]?.message || "";
    if (/\[ADMIN\]/i.test(String(raw))) return hist[i];
  }
  return hist.length ? hist[hist.length - 1] : undefined; // fallback
}

function pickBookingFieldsFromRequest(r: any): { bookingAmount: number | null; actual: number | null } {
  const directBooking = safeNum(r?.bookingAmount ?? r?.meta?.bookingAmount ?? null);
  const directActual = safeNum(r?.actualBookingPrice ?? r?.meta?.actualBookingPrice ?? null);

  const latestAdmin = pickLatestAdminHistory(r);
  const parsed = parseAdminComment(latestAdmin?.comment || latestAdmin?.message || "");
  const bookingAmount = directBooking ?? parsed.bookingAmount ?? null;
  const actual = directActual ?? parsed.actualPrice ?? null;
  return { bookingAmount, actual };
}

function formatItemReasonsForExport(parsed: ReturnType<typeof parseAdminComment>) {
  const items = parsed.itemReasons || [];
  if (!items.length) return "";
  return items
    .slice()
    .sort((a, b) => a.itemIndex - b.itemIndex)
    .map((x) => `${x.itemIndex}:${x.reasonCode}`)
    .join(" | ");
}

function exportQueueCsv(rows: any[]) {
  if (!rows.length) return;

  const headers = [
    "RequestCode",
    "Status",
    "AdminState",
    "Service",
    "Items",
    "EstimateINR",
    "BookingAmount",
    "ActualBookingPrice",
    "Segment",
    "CustomerName",
    "RequesterName",
    "RequesterEmail",
    "ManagerName",
    "ManagerEmail",
    "CreatedAt",
    "UpdatedAt",
    "LatestMode",
    "LatestService",
    "LatestReason",
    "LatestItemReasons",
    "LatestNote",
    "LatestAttachmentUrl",
    "LatestCommentRaw",
  ];

  const lines: string[] = [];
  lines.push(headers.join(","));

  for (const r of rows) {
    const items = getCartItems(r);
    const total = items.reduce(
      (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
      0
    );

    const { seg } = pickSegment(r);

    const latest = pickLatestAdminHistory(r);
    const parsed = parseAdminComment(latest?.comment || latest?.message || "");

    const { bookingAmount, actual } = pickBookingFieldsFromRequest(r);

    const rawAttachment = parsed.attachmentUrl || "";
    const attachmentProtected = rawAttachment ? makeProtectedAttachmentUrl(rawAttachment) : "";

    const row = [
      shortReqCode(r),
      String(r?.status || ""),
      String(r?.adminState || ""),
      getServiceLabel(getServiceKind(r)),
      String(items.length),
      String(total),
      bookingAmount ?? "",
      actual ?? "",
      String(seg),
      String(r?.customerName || r?.customerId || "Workspace"),
      String(r?.frontlinerName || r?.requesterName || ""),
      String(r?.frontlinerEmail || r?.requesterEmail || ""),
      String(r?.managerName || r?.approverName || ""),
      String(r?.managerEmail || r?.approverEmail || ""),
      toLocal(r?.createdAt),
      toLocal(r?.updatedAt),
      parsed.mode || "",
      parsed.service || "",
      parsed.reason || "",
      formatItemReasonsForExport(parsed),
      parsed.note || "",
      attachmentProtected,
      parsed.raw || "",
    ].map(csvEscape);

    lines.push(row.join(","));
  }

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-approvals-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function exportQueueXlsx(rows: any[]) {
  if (!rows.length) return;

  const wb = XLSX.utils.book_new();

  const summary = rows.map((r: any) => {
    const items = getCartItems(r);
    const total = items.reduce(
      (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
      0
    );

    const { seg } = pickSegment(r);

    const latest = pickLatestAdminHistory(r);
    const parsed = parseAdminComment(latest?.comment || latest?.message || "");
    const { bookingAmount, actual } = pickBookingFieldsFromRequest(r);

    const rawAttachment = parsed.attachmentUrl || "";
    const attachmentProtected = rawAttachment ? makeProtectedAttachmentUrl(rawAttachment) : "";

    return {
      RequestCode: shortReqCode(r),
      Status: r?.status || "",
      AdminState: r?.adminState || "",
      Service: getServiceLabel(getServiceKind(r)),
      Segment: seg,
      CustomerName: r?.customerName || r?.customerId || "Workspace",
      RequesterName: r?.frontlinerName || r?.requesterName || "",
      RequesterEmail: r?.frontlinerEmail || r?.requesterEmail || "",
      ManagerName: r?.managerName || r?.approverName || "",
      ManagerEmail: r?.managerEmail || r?.approverEmail || "",
      ItemsCount: items.length,
      EstimateINR: total,
      BookingAmount: bookingAmount ?? "",
      ActualBookingPrice: actual ?? "",
      CreatedAt: toLocal(r?.createdAt || ""),
      UpdatedAt: toLocal(r?.updatedAt || ""),
      LatestMode: parsed.mode || "",
      LatestService: parsed.service || "",
      LatestReason: parsed.reason || "",
      LatestItemReasons: formatItemReasonsForExport(parsed),
      LatestNote: parsed.note || "",
      LatestAttachmentUrl: attachmentProtected,
      LatestCommentRaw: parsed.raw || "",
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  const itemsSheet: any[] = [];
  rows.forEach((r: any) => {
    const items = getCartItems(r);
    const reqCode = shortReqCode(r);
    items.forEach((it: any, idx: number) => {
      itemsSheet.push({
        RequestCode: reqCode,
        ItemNo: idx + 1,
        ItemTitle: it?.title || "",
        ItemType: it?.type || it?.service || "",
        Qty: Number(it?.qty || 1),
        PriceINR: Number(it?.price || 0),
        LineTotalINR: Number(it?.price || 0) * Number(it?.qty || 1),
        Notes: it?.description || it?.notes || "",
      });
    });
  });

  const ws2 = XLSX.utils.json_to_sheet(itemsSheet);
  XLSX.utils.book_append_sheet(wb, ws2, "Items");

  const historySheet: any[] = [];
  rows.forEach((r: any) => {
    const hist = Array.isArray(r?.history) ? r.history : Array.isArray(r?.audit) ? r.audit : [];
    const reqCode = shortReqCode(r);

    hist.forEach((h: any, idx: number) => {
      const parsed = parseAdminComment(h?.comment || h?.message || "");
      const rawAttachment = parsed.attachmentUrl || "";
      const attachmentProtected = rawAttachment ? makeProtectedAttachmentUrl(rawAttachment) : "";

      historySheet.push({
        RequestCode: reqCode,
        Row: idx + 1,
        Action: h?.action || h?.type || "",
        At: toLocal(h?.at || h?.ts || h?.date || h?.createdAt || ""),
        By: h?.by || h?.userEmail || h?.actorEmail || "",
        Mode: parsed.mode || "",
        Service: parsed.service || "",
        Reason: parsed.reason || "",
        ItemReasons: formatItemReasonsForExport(parsed),
        Note: parsed.note || (h?.comment || h?.message || ""),
        AttachmentUrl: attachmentProtected,
        BookingAmount: parsed.bookingAmount ?? "",
        ActualBookingPrice: parsed.actualPrice ?? "",
        RawComment: parsed.raw || "",
      });
    });
  });

  const ws3 = XLSX.utils.json_to_sheet(historySheet);
  XLSX.utils.book_append_sheet(wb, ws3, "History");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = `admin-approvals-${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBlob(blob, filename);
}

/* ───────────────────────── Details hydration (KEY FIX) ───────────────────────── */

async function safeReadJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, raw: txt };
  }
}

async function tryFetchAny(urls: string[]) {
  let lastErr: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (!res.ok) {
        lastErr = new Error(`GET ${url} → ${res.status}`);
        (lastErr as any).status = res.status;
        continue;
      }
      const data = await safeReadJson(res);
      const row = (data as any)?.row || (data as any)?.request || (data as any)?.data || data;
      return row;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Failed to fetch details");
}

/**
 * Hydrate request details when queue response is "thin"
 */
async function hydrateRequestDetails(thin: any) {
  const id = getId(thin);
  if (!id) return thin;

  const hasItems = getCartItems(thin).length > 0;
  const hasHistory = Array.isArray(thin?.history) && thin.history.length > 0;
  const segPick = pickSegment(thin);
  const hasMeta = Boolean(segPick?.meta && Object.keys(segPick.meta).length > 0);

  if (hasItems && (hasHistory || hasMeta)) return thin;

  const candidates = [
    `/api/approvals/admin/${id}`,
    `/api/approvals/admin/requests/${id}`,
    `/api/approvals/admin/details/${id}`,
    `/api/approvals/${id}`,
    `/api/approvals/requests/${id}`,
    `/api/approvals/details/${id}`,
  ];

  const full = await tryFetchAny(candidates);
  return { ...thin, ...full };
}

/* ───────────────────────── Action dialog ───────────────────────── */

function AdminActionDialog({
  open,
  onClose,
  mode,
  request,
  onCompleted,
}: {
  open: boolean;
  mode: ActionKind;
  request: ApprovalRequest;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [agentType, setAgentType] = useState<"human" | "ai">("human");
  const [agentName, setAgentName] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");

  const [usePerItemReasons, setUsePerItemReasons] = useState(false);
  const [perItemReasonCodes, setPerItemReasonCodes] = useState<Record<number, string>>({}); // 1-based

  const [bookingAmount, setBookingAmount] = useState<string>("");
  const [actualBookingPrice, setActualBookingPrice] = useState<string>("");

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ stable dependency key for resets
  const reqId = useMemo(() => getId(request as any), [request]);

  useEffect(() => {
    if (open) {
      setErr(null);
      setNote("");
      setReasonCode("");
      setAgentType("human");
      setAgentName("");
      setAttachmentFile(null);
      setAttachmentLabel("");
      setBookingAmount("");
      setActualBookingPrice("");

      setUsePerItemReasons(false);
      setPerItemReasonCodes({});
    }
  }, [open, mode, reqId]);

  if (!open) return null;

  const serviceKind = getServiceKind(request as any);
  const reasonConfig = SERVICE_REASON_CONFIG[serviceKind];
  const reasonOptions = mode === "assign" ? [] : reasonConfig[mode as ReasonMode] || [];
  const isReasonRequired = mode !== "assign";

  const items = getCartItems(request as any);
  const itemTitles = items.map((it: any) =>
    String(it?.title || it?.name || it?.serviceName || it?.type || "Item")
  );

  const titleMap: Record<ActionKind, string> = {
    assign: "Assign request",
    hold: "Put request on admin hold",
    underProcess: "Mark as under process",
    done: "Mark request processed",
    cancel: "Cancel request",
  };

  const primaryLabelMap: Record<ActionKind, string> = {
    assign: "Assign",
    hold: "Set on hold",
    underProcess: "Mark under process",
    done: "Mark processed",
    cancel: "Cancel request",
  };

  function parseMoneyInput(v: string) {
    const cleaned = v.replace(/[^\d.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function setItemReason(itemIndex: number, code: string) {
    setPerItemReasonCodes((prev) => {
      const next = { ...prev };
      if (!code) delete next[itemIndex];
      else next[itemIndex] = code;
      return next;
    });
  }

  async function handleSubmit() {
    try {
      setErr(null);
      setBusy(true);

      const id = reqId;

      if (mode === "assign") {
        if (!agentName.trim()) {
          setErr("Please enter an agent name.");
          setBusy(false);
          return;
        }
        await adminAssign(id, {
          agentType,
          agentName: agentName.trim(),
          comment: note.trim() || undefined,
        });
      } else {
        const hasMulti = usePerItemReasons && items.length > 1;
        const pickedMulti =
          hasMulti &&
          Object.entries(perItemReasonCodes)
            .map(([k, v]) => ({ itemIndex: Number(k), code: String(v) }))
            .filter((x) => Number.isFinite(x.itemIndex) && x.itemIndex > 0 && x.code);

        if (hasMulti) {
          if (!pickedMulti || pickedMulti.length === 0) {
            setErr("Please select at least one item reason (per-item).");
            setBusy(false);
            return;
          }
        } else {
          const reason = reasonOptions.find((r) => r.code === reasonCode) || null;
          if (isReasonRequired && !reason) {
            setErr("Please select a reason.");
            setBusy(false);
            return;
          }
        }

        const bookingAmountNum = mode === "done" ? parseMoneyInput(bookingAmount) : null;
        const actualPriceNum = mode === "done" ? parseMoneyInput(actualBookingPrice) : null;

        if (mode === "done") {
          if (bookingAmount && bookingAmountNum === null) {
            setErr("Booking Amount must be a valid number.");
            setBusy(false);
            return;
          }
          if (actualBookingPrice && actualPriceNum === null) {
            setErr("Actual Booking Price must be a valid number.");
            setBusy(false);
            return;
          }
        }

        let attachmentUrl: string | undefined;
        if (mode === "done" && attachmentFile) {
          const uploadRes = await uploadApprovalAttachment(id, attachmentFile);
          attachmentUrl =
            (uploadRes as any)?.url ||
            (uploadRes as any)?.attachmentUrl ||
            (uploadRes as any)?.fileUrl ||
            (uploadRes as any)?.path;
        }

        const baseReason = reasonOptions.find((r) => r.code === reasonCode) || null;

        const multiReasons =
          hasMulti && pickedMulti
            ? pickedMulti
                .map((x) => {
                  const r = reasonOptions.find((o) => o.code === x.code);
                  return r ? { itemIndex: x.itemIndex, reason: r } : null;
                })
                .filter(Boolean) as Array<{ itemIndex: number; reason: ReasonOption }>
            : undefined;

        const comment = buildAdminComment({
          mode: mode as ReasonMode,
          serviceKind,
          reason: hasMulti ? null : baseReason,
          itemReasons: multiReasons,
          note,
          docUrl: attachmentUrl,
          bookingAmount: bookingAmountNum,
          actualBookingPrice: actualPriceNum,
          itemTitles,
        });

        if (mode === "hold") await adminOnHold(id, { comment });
        else if (mode === "underProcess") await adminUnderProcess(id, { comment });
        else if (mode === "done") {
          const payload: any = { comment };
          await adminMarkDone(id, payload);
        } else if (mode === "cancel") await adminCancel(id, { comment });
      }

      onCompleted();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to update request");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachmentFile(null);
      setAttachmentLabel("");
      return;
    }
    if (file.type !== "application/pdf") {
      setErr("Please upload a PDF file only.");
      setAttachmentFile(null);
      setAttachmentLabel("");
      return;
    }
    setErr(null);
    setAttachmentFile(file);
    setAttachmentLabel(file.name);
  }

  const showPerItemToggle = mode !== "assign" && items.length > 1 && reasonOptions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Admin action · {shortReqCode(request as any)}
            </div>
            <h2 className="mt-1 text-sm font-semibold text-zinc-900">{titleMap[mode]}</h2>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {getServiceLabel(getServiceKind(request as any))} ·{" "}
              {(request as any)?.customerName || "Workspace"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-[11px]">
          {/* assign */}
          {mode === "assign" && (
            <>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Assign to
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentType("human")}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                      agentType === "human"
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    Human agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentType("ai")}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                      agentType === "ai"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    Bot / AI queue
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Agent / queue name
                </div>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:bg-white"
                  placeholder="e.g. Ticketing Team – Domestic, Visa Desk, AI Queue"
                />
              </div>
            </>
          )}

          {/* reasons */}
          {mode !== "assign" && (
            <>
              {showPerItemToggle && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Reason mode
                      </div>
                      <div className="mt-0.5 text-[11px] text-zinc-700">
                        Use per-item reasons when a request has multiple services/items.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={usePerItemReasons}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setUsePerItemReasons(on);
                        if (!on) setPerItemReasonCodes({});
                      }}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              )}

              {!usePerItemReasons && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Reason ({getServiceLabel(serviceKind)})
                  </div>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">Select a reason</option>
                    {reasonOptions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {usePerItemReasons && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Per-item reasons
                  </div>
                  <div className="mt-2 space-y-2">
                    {items.map((_: any, idx: number) => {
                      const itemIndex = idx + 1;
                      const title = itemTitles[idx] || `Item ${itemIndex}`;
                      const current = perItemReasonCodes[itemIndex] || "";
                      return (
                        <div key={itemIndex} className="rounded-2xl bg-zinc-50 px-3 py-2">
                          <div className="text-[10px] font-semibold text-zinc-700">
                            {itemIndex}. {title}
                          </div>
                          <select
                            value={current}
                            onChange={(e) => setItemReason(itemIndex, e.target.value)}
                            className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
                          >
                            <option value="">Select reason for this item</option>
                            {reasonOptions.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-[10px] text-zinc-500">
                    Tip: You can select reasons only for the items that changed; leave others blank.
                  </div>
                </div>
              )}

              {mode === "done" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Booking Amount
                      </div>
                      <input
                        value={bookingAmount}
                        onChange={(e) => setBookingAmount(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:bg-white"
                        placeholder="e.g. 12000"
                        inputMode="decimal"
                      />
                      <div className="mt-1 text-[10px] text-zinc-500">
                        Customer-facing booking amount.
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Actual Booking Price
                      </div>
                      <input
                        value={actualBookingPrice}
                        onChange={(e) => setActualBookingPrice(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:bg-white"
                        placeholder="e.g. 9800"
                        inputMode="decimal"
                      />
                      <div className="mt-1 text-[10px] text-zinc-500">
                        Admin-only (cost/vendor).
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Attach PDF (upload)
                    </div>
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700 hover:border-sky-400 hover:bg-zinc-50/80">
                      <span className="truncate">
                        {attachmentLabel || "Choose booking document / invoice PDF"}
                      </span>
                      <span className="ml-3 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white">
                        Browse
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      PDF will be stored in history and will be downloadable via protected link.
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Internal note (optional)
            </div>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] outline-none focus:border-sky-400 focus:bg-white"
              placeholder="Add any extra context for audit trail."
            />
          </div>

          {err && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {err}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="rounded-full bg-[#00477f] px-5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767] disabled:opacity-60"
          >
            {busy ? "Saving…" : primaryLabelMap[mode]}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Details drawer ───────────────────────── */

function MaskedMoney({ value, adminReveal }: { value: number | null; adminReveal?: boolean }) {
  const [show, setShow] = useState(false);

  if (value === null || value === undefined) return <span className="text-zinc-500">—</span>;
  if (!adminReveal) return <span className="text-zinc-500">—</span>;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold text-zinc-900">{show ? formatInr(value) : "₹XXXXXX"}</span>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50"
        title={show ? "Hide" : "View"}
      >
        {show ? "🙈" : "👁"}
      </button>
    </span>
  );
}

function AdminRequestDetailsDrawer({ request, onClose }: { request: any; onClose: () => void }) {
  const { seg, meta, items } = pickSegment(request);
  const serviceKind = getServiceKind(request);
  const total = items.reduce(
    (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
    0
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const createdAt = request?.createdAt || request?.submittedAt || request?.created_at;
  const updatedAt = request?.updatedAt || request?.updated_at;

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

  const history = Array.isArray(request?.history)
    ? request.history
    : Array.isArray(request?.audit)
      ? request.audit
      : [];

  const latest = pickLatestAdminHistory(request);
  const parsedLatest = parseAdminComment(latest?.comment || latest?.message || "");

  const { bookingAmount, actual: actualPrice } = pickBookingFieldsFromRequest(request);

  const attachmentProtected = parsedLatest.attachmentUrl
    ? makeProtectedAttachmentUrl(parsedLatest.attachmentUrl)
    : "";

  const itemsAsCartItems: CartItem[] = (Array.isArray(items) ? items : []).map((it: any) => ({
    type: it?.type || it?.service || it?.category || "other",
    title: it?.title || it?.name || it?.serviceName || it?.type || "Item",
    description: it?.description || it?.notes || "",
    qty: Number(it?.qty || 1),
    price: Number(it?.price || 0),
    meta: (it?.meta || it?.details || it?.data || it?.payload || {}) as Record<string, any>,
  }));

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        // close only if clicking the backdrop, not inside the drawer
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Drawer panel */}
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-[28px] bg-gradient-to-b from-white via-[#f4f5ff] to-[#fff7f1] shadow-2xl">
        {/* Header (NON-SCROLL) */}
        <div className="shrink-0 border-b border-zinc-100 bg-gradient-to-r from-white via-[#f4f5ff] to-[#fff7f1] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Pluto Copilot · Admin view
              </div>

              <div className="mt-1 flex items-center gap-2">
                <div className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                  {shortReqCode(request)}
                </div>

                <span className={badge(String(request?.status || ""))}>
                  {String(request?.status || "").toUpperCase()}
                </span>

                <span className={adminBadge(String(request?.adminState || "pending"))}>
                  ADMIN: {String(request?.adminState || "pending").toUpperCase()}
                </span>
              </div>

              {(createdAtStr || updatedAtStr) && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  {createdAtStr && <>Raised on {createdAtStr}</>}
                  {createdAtStr && updatedAtStr && " • "}
                  {updatedAtStr && <>Last update {updatedAtStr}</>}
                </div>
              )}

              <div className="mt-1 text-[11px] text-zinc-500">
                {getServiceLabel(serviceKind)} ·{" "}
                {String(request?.customerName || request?.customerId || "Workspace")}
              </div>
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
            <div className="mt-3 inline-flex items-center gap-2 text-[11px]">
              <div
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${ai.toneClass}`}
              >
                <span className="text-[10px]">◎</span>
                <span>{ai.label}</span>
              </div>
            </div>
          )}
        </div>

        {/* Scroll area (ONLY THIS SCROLLS) */}
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-zinc-900 [scrollbar-gutter:stable]"
          style={{ WebkitOverflowScrolling: "touch" }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Trip / service summary
                </div>

                <div className="mt-1 text-sm font-semibold">{seg}</div>

                <div className="mt-0.5 text-[11px] text-zinc-500">
                  Workspace: {String(request?.customerName || request?.customerId || "Workspace")}
                </div>

                <div className="mt-0.5 text-[11px] text-zinc-500">
                  Raised by:{" "}
                  {String(
                    request?.frontlinerName ||
                      request?.requesterName ||
                      request?.createdByName ||
                      "User"
                  )}{" "}
                  (
                  {String(
                    request?.frontlinerEmail ||
                      request?.requesterEmail ||
                      request?.createdByEmail ||
                      "—"
                  )}
                  )
                </div>

                <div className="mt-0.5 text-[11px] text-zinc-500">
                  Manager:{" "}
                  {String(
                    request?.managerName ||
                      request?.approverName ||
                      request?.manager?.name ||
                      "Approver"
                  )}{" "}
                  (
                  {String(
                    request?.managerEmail ||
                      request?.approverEmail ||
                      request?.manager?.email ||
                      "—"
                  )}
                  )
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-[11px]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Booking Amount
                    </div>
                    <div className="mt-1 font-semibold text-zinc-900">
                      {bookingAmount !== null ? formatInr(bookingAmount) : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-[11px]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Actual Booking Price
                    </div>
                    <div className="mt-1">
                      <MaskedMoney value={actualPrice} adminReveal />
                    </div>
                  </div>
                </div>

                {attachmentProtected && (
                  <div className="mt-3">
                    <a
                      href={attachmentProtected}
                      className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                    >
                      ⬇ Download Admin PDF
                    </a>
                    <div className="mt-1 text-[10px] text-zinc-500">Protected download route.</div>
                  </div>
                )}

                {meta && Object.keys(meta).length > 0 && (
                  <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Meta snapshot
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {Object.entries(meta)
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="font-semibold text-zinc-600">{k}:</span>{" "}
                            <span className="text-zinc-800">{String(v)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-zinc-900 px-3 py-2 text-right text-white shadow-sm">
                <div className="text-[10px] text-zinc-200/80">Estimate</div>
                <div className="text-sm font-semibold">{formatInr(total)}</div>
                <div className="text-[10px] text-zinc-200/80">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-950 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Itinerary
              </div>
              <div className="text-[10px] text-white/60">
                {itemsAsCartItems.length} item{itemsAsCartItems.length !== 1 ? "s" : ""} •{" "}
                {formatInr(total)}
              </div>
            </div>

            <ApprovalItemsDetail items={itemsAsCartItems} />
          </section>

          {/* Activity history */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Activity history
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">
                  {Array.isArray(history) ? history.length : 0} event
                  {(history?.length || 0) !== 1 ? "s" : ""}
                </div>
              </div>

              <div className="text-[10px] text-zinc-500">
                Tip: Admin-tagged events show structured chips.
              </div>
            </div>

            {!Array.isArray(history) || history.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] text-zinc-600">
                No history events found for this request.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {history
                  .slice()
                  .reverse()
                  .map((h: any, idx: number) => {
                    const raw = String(h?.comment || h?.message || h?.note || "");
                    const parsed = parseAdminComment(raw);

                    const when =
                      h?.at || h?.ts || h?.date || h?.createdAt || h?.updatedAt || "";
                    const whenStr = when ? toLocal(when) : "";

                    const actionLabel = String(h?.action || h?.type || "").toUpperCase();

                    const by =
                      String(
                        h?.by || h?.userEmail || h?.actorEmail || h?.actor || h?.user || ""
                      ).trim() ||
                      String(h?.name || h?.userName || "").trim() ||
                      "—";

                    const attachment = parsed?.attachmentUrl
                      ? makeProtectedAttachmentUrl(parsed.attachmentUrl)
                      : "";

                    const isAdmin = Boolean(parsed?.isAdmin);
                    const chipBase =
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border";
                    const adminChip = `${chipBase} border-zinc-900 bg-zinc-900 text-white`;
                    const userChip = `${chipBase} border-zinc-200 bg-zinc-50 text-zinc-700`;

                    const modeChip = parsed?.mode
                      ? `${chipBase} border-sky-100 bg-sky-50 text-sky-800`
                      : "";
                    const reasonChip = parsed?.reason
                      ? `${chipBase} border-amber-100 bg-amber-50 text-amber-800`
                      : "";
                    const actionChip = actionLabel
                      ? `${chipBase} border-emerald-100 bg-emerald-50 text-emerald-700`
                      : "";

                    return (
                      <div
                        key={`${idx}-${String(h?.id || h?._id || "")}`}
                        className="rounded-2xl border border-zinc-200 bg-white px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={isAdmin ? adminChip : userChip}>
                              {isAdmin ? "ADMIN" : "SYSTEM"}
                            </span>

                            {actionLabel ? <span className={actionChip}>{actionLabel}</span> : null}

                            {parsed?.mode ? (
                              <span className={modeChip}>
                                MODE: {String(parsed.mode).toUpperCase()}
                              </span>
                            ) : null}

                            {parsed?.service ? (
                              <span className={`${chipBase} border-indigo-100 bg-indigo-50 text-indigo-800`}>
                                SERVICE: {String(parsed.service).toUpperCase()}
                              </span>
                            ) : null}

                            {parsed?.reason ? (
                              <span className={reasonChip}>REASON: {String(parsed.reason)}</span>
                            ) : null}

                            {parsed?.bookingAmount !== null && parsed?.bookingAmount !== undefined ? (
                              <span className={`${chipBase} border-zinc-200 bg-zinc-50 text-zinc-800`}>
                                BOOKING: {formatInr(parsed.bookingAmount)}
                              </span>
                            ) : null}

                            {parsed?.actualPrice !== null && parsed?.actualPrice !== undefined ? (
                              <span className={`${chipBase} border-zinc-200 bg-zinc-50 text-zinc-800`}>
                                ACTUAL: {formatInr(parsed.actualPrice)}
                              </span>
                            ) : null}
                          </div>

                          <div className="text-[10px] text-zinc-500">
                            {whenStr ? <span>{whenStr}</span> : null}
                            {whenStr ? <span className="mx-2">•</span> : null}
                            <span className="font-semibold text-zinc-700">{by}</span>
                          </div>
                        </div>

                        {Array.isArray(parsed?.itemReasons) && parsed!.itemReasons!.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {parsed!.itemReasons!
                              .slice()
                              .sort((a, b) => a.itemIndex - b.itemIndex)
                              .map((ir) => (
                                <span
                                  key={`${ir.itemIndex}-${ir.reasonCode}`}
                                  className={`${chipBase} border-fuchsia-100 bg-fuchsia-50 text-fuchsia-800`}
                                >
                                  ITEM {ir.itemIndex}: {ir.reasonCode}
                                </span>
                              ))}
                          </div>
                        ) : null}

                        <div className="mt-2 text-[11px] text-zinc-700">
                          {parsed?.note ? (
                            <span>{parsed.note}</span>
                          ) : raw ? (
                            <span className="text-zinc-600">{raw}</span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </div>

                        {attachment ? (
                          <div className="mt-2">
                            <a
                              href={attachment}
                              className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                            >
                              ⬇ Download PDF
                            </a>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── main page ───────────────────────────── */

type AdminStatusFilter = "all" | "pending" | "assigned" | "on_hold" | "done" | "cancelled";

function guessHttpStatus(err: any): number | null {
  const s = err?.status ?? err?.response?.status ?? err?.data?.status ?? err?.cause?.status ?? null;
  return typeof s === "number" ? s : null;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function TabChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
      )}
    >
      <span>{label}</span>
      <span
        className={cx(
          "rounded-full px-2 py-0.5 text-[10px]",
          active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-700"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-[28px] border border-zinc-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full">
          <div className="h-4 w-44 rounded bg-black/10" />
          <div className="mt-2 h-3 w-80 rounded bg-black/5" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-24 rounded-full bg-black/5" />
            <div className="h-6 w-20 rounded-full bg-black/5" />
            <div className="h-6 w-28 rounded-full bg-black/5" />
          </div>
        </div>
        <div className="h-9 w-40 rounded-full bg-black/5" />
      </div>
      <div className="mt-4 h-12 rounded-2xl bg-black/5" />
    </div>
  );
}

export default function AdminApprovalQueue() {
  const nav = useNavigate();

  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailReq, setDetailReq] = useState<any | null>(null);
  const [detailBusyId, setDetailBusyId] = useState<string | null>(null);
  const [detailErrById, setDetailErrById] = useState<Record<string, string>>({});

  const [action, setAction] = useState<{ kind: ActionKind; req: ApprovalRequest } | null>(null);

  // Filters
  const [range, setRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | ServiceKind>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState<AdminStatusFilter>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const includeClosed =
        adminStatusFilter === "all" ||
        adminStatusFilter === "done" ||
        adminStatusFilter === "cancelled";

      const adminState = adminStatusFilter !== "all" ? adminStatusFilter : undefined;

      const res = await getAdminApprovedQueue({
        includeClosed,
        adminState,
      });

            const list = (res as any)?.rows || [];
      list.sort((a: any, b: any) => {
        const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return tb - ta;
      });

      // ✅ Hydrate proposal per request (so Admin queue can show correct PROPOSAL state)
      const withProposals = await (async () => {
        const rowsArr = Array.isArray(list) ? list : [];
        if (!rowsArr.length) return rowsArr;

        // small concurrency limiter (avoid 200 parallel requests)
        const CONCURRENCY = 8;

        async function fetchProposalForRequest(requestId: string) {
          const url = `/api/proposals/by-request/${encodeURIComponent(requestId)}`;
          const resp = await fetch(url, { method: "GET", credentials: "include" });
          if (!resp.ok) return null;
          const data = await safeReadJson(resp as any);
          return (data as any)?.proposal || (data as any)?.data?.proposal || null;
        }

        const out = [...rowsArr];

        let i = 0;
        async function worker() {
          while (i < out.length) {
            const idx = i++;
            const r = out[idx];
            const requestId = String((r as any)?._id || (r as any)?.id || "");
            if (!requestId) continue;

            // if already present, keep it
            if ((r as any)?._proposal) continue;

            try {
              const p = await fetchProposalForRequest(requestId);
              if (p) (out[idx] as any)._proposal = p;
            } catch {
              // ignore per-row failure
            }
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
        return out;
      })();

      setRows(withProposals as any);

    } catch (e: any) {
      const status = guessHttpStatus(e);
      if (status === 401) setErr("401 Unauthorized — admin session not present.");
      else if (status === 403) setErr("Your account doesn’t have permission to view this page.");
      else setErr(e?.message || "Failed to load admin queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminStatusFilter]);

  const customers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const name = (r as any)?.customerName || (r as any)?.customerId || "Workspace";
      set.add(String(name));
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    return rows.filter((r: any) => {
      // ✅ Use activity time consistently (updatedAt preferred)
      const t = new Date(r?.updatedAt || r?.createdAt || 0).getTime();

      if (range === "7d" && now - t > 7 * DAY) return false;
      if (range === "30d" && now - t > 30 * DAY) return false;
      if (range === "90d" && now - t > 90 * DAY) return false;

      const sk = getServiceKind(r);
      if (serviceFilter !== "all" && sk !== serviceFilter) return false;

      if (adminStatusFilter !== "all") {
        const s = (String(r?.adminState || "pending").toLowerCase() || "pending") as AdminStatusFilter;
        if (s !== adminStatusFilter) return false;
      }

      const custName = r?.customerName || r?.customerId || "Workspace";
      if (customerFilter !== "all" && String(custName) !== customerFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const { seg } = pickSegment(r);

        const haystack = [
          shortReqCode(r),
          seg,
          custName,
          r?.frontlinerName,
          r?.frontlinerEmail,
          r?.requesterName,
          r?.requesterEmail,
          r?.managerName,
          r?.managerEmail,
          r?.approverName,
          r?.approverEmail,
          r?.comments,
          r?.note,
          ...((Array.isArray(r?.history) ? r.history : []) as any[]).map((h) => h?.comment || ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, range, serviceFilter, customerFilter, adminStatusFilter, search]);

  const kpis = useMemo(() => {
    const list = filteredRows as any[];
    const totalValue = list.reduce((sum, r) => {
      const items = getCartItems(r);
      const total = items.reduce(
        (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
        0
      );
      return sum + total;
    }, 0);

    const attention = list.filter((r) => {
      const ai = getAiSignal(r);
      return ai?.label === "High-value trip" || ai?.label === "Time-sensitive";
    }).length;

    const byState = {
      pending: list.filter((r) => String(r?.adminState || "pending").toLowerCase() === "pending").length,
      assigned: list.filter((r) => String(r?.adminState || "").toLowerCase() === "assigned").length,
      on_hold: list.filter((r) => String(r?.adminState || "").toLowerCase() === "on_hold").length,
      done: list.filter((r) => String(r?.adminState || "").toLowerCase() === "done").length,
      cancelled: list.filter((r) => String(r?.adminState || "").toLowerCase() === "cancelled").length,
    };

    return {
      totalTickets: list.length,
      totalValue,
      attention,
      byState,
    };
  }, [filteredRows]);

  function openAction(kind: ActionKind, req: ApprovalRequest) {
    setAction({ kind, req });
  }

  async function openDetails(thin: any) {
    const id = getId(thin);
    setDetailBusyId(id);

    setDetailErrById((p) => {
      const n = { ...p };
      delete n[id]; // clear previous error for this id
      return n;
    });

    try {
      const full = await hydrateRequestDetails(thin);
      setDetailReq(full);
    } catch (e: any) {
      setDetailReq(thin);
      setDetailErrById((p) => ({ ...p, [id]: e?.message || "Failed to hydrate full details" }));
    } finally {
      setDetailBusyId(null);
    }
  }

  function invoiceStub(actionLabel: "Add to Invoice Table" | "Generate Invoice", req: any) {
    const reqCode = shortReqCode(req);
    const customer = String(req?.customerName || req?.customerId || "Workspace");
    alert(
      `${actionLabel}\n\nRequest: ${reqCode}\nCustomer/Workspace: ${customer}\n\nComing soon — this will create/append invoices per-customer (never mixed across clients).`
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 xl:max-w-7xl">
      <div className="rounded-[36px] bg-gradient-to-b from-[#f6f7ff] via-white to-[#fff7f1] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        {/* Sticky AI command header */}
        <div className="sticky top-0 z-20 rounded-t-[36px] border-b border-black/5 bg-white/70 backdrop-blur-xl">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white shadow-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px]">
                    ◎
                  </span>
                  <span>Pluto Copilot · Admin Console</span>
                </div>
                <h1 className="mt-2 text-xl font-semibold text-zinc-900">Approved Requests</h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Fast triage → assign → process → close. Built for AI-assisted teams.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportQueueCsv(filteredRows as any)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  ⬇ CSV
                </button>

                <button
                  type="button"
                  onClick={() => exportQueueXlsx(filteredRows as any)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  ⬇ Excel
                </button>

                <button
                  type="button"
                  onClick={() => load()}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-black"
                >
                  ↻ Refresh
                </button>

                <button
                  type="button"
                  onClick={() => nav("/admin/analytics")}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  ← Admin Home
                </button>
              </div>
            </div>

            {/* Tabs with counts */}
            <div className="mt-4 flex flex-wrap gap-2">
              <TabChip
                active={adminStatusFilter === "all"}
                label="All"
                count={kpis.totalTickets}
                onClick={() => setAdminStatusFilter("all")}
              />
              <TabChip
                active={adminStatusFilter === "pending"}
                label="New"
                count={kpis.byState.pending}
                onClick={() => setAdminStatusFilter("pending")}
              />
              <TabChip
                active={adminStatusFilter === "assigned"}
                label="Assigned"
                count={kpis.byState.assigned}
                onClick={() => setAdminStatusFilter("assigned")}
              />
              <TabChip
                active={adminStatusFilter === "on_hold"}
                label="On hold"
                count={kpis.byState.on_hold}
                onClick={() => setAdminStatusFilter("on_hold")}
              />
              <TabChip
                active={adminStatusFilter === "done"}
                label="Processed"
                count={kpis.byState.done}
                onClick={() => setAdminStatusFilter("done")}
              />
              <TabChip
                active={adminStatusFilter === "cancelled"}
                label="Cancelled"
                count={kpis.byState.cancelled}
                onClick={() => setAdminStatusFilter("cancelled")}
              />
            </div>

            {/* AI KPI row */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard label="Visible tickets" value={`${kpis.totalTickets}`} hint="After filters" />
              <StatCard label="Total value" value={`${formatInrIntl(kpis.totalValue)}`} hint="Estimate from items" />
              <StatCard label="Needs attention" value={`${kpis.attention}`} hint="High value / time-sensitive" />
            </div>

            {/* Filters row */}
            <div className="mt-4 grid grid-cols-1 gap-3 text-[11px] text-zinc-700 md:grid-cols-5">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Date range
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    ["all", "All"],
                    ["7d", "7d"],
                    ["30d", "30d"],
                    ["90d", "90d"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRange(v as any)}
                      className={cx(
                        "rounded-full border px-3 py-1",
                        range === v
                          ? "border-sky-500 bg-sky-50 text-sky-800"
                          : "border-zinc-200 bg-white text-zinc-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Service
                </div>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value as "all" | ServiceKind)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                >
                  <option value="all">All</option>
                  <option value="flight">Flights</option>
                  <option value="hotel">Hotels</option>
                  <option value="visa">Visas</option>
                  <option value="cab">Cabs / Transfers</option>
                  <option value="rail">Rail / Train</option>
                  <option value="holiday">Holidays / Packages</option>
                  <option value="mice">MICE / Events</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Workspace
                </div>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-sky-400"
                >
                  <option value="all">All</option>
                  {customers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Search
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                  <span className="text-zinc-400">⌘</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent text-[11px] outline-none"
                    placeholder="Route, requester, workspace, comment…"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Clear
                    </button>
                  ) : null}
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

        {/* Body */}
        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : filteredRows.length ? (
            <div className="space-y-3">
              {filteredRows.map((r: any) => {
                const rowId = getId(r);
                const detailBusy = detailBusyId === rowId;

                const items = getCartItems(r);
                const total = items.reduce(
                  (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
                  0
                );
                const { seg } = pickSegment(r);

                const updatedAtStr = r?.updatedAt
                  ? new Date(r.updatedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "";
                const createdAtStr = r?.createdAt
                  ? new Date(r.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "";

                const ai = getAiSignal(r);
                const serviceKind = getServiceKind(r);
                const customerName = String(r?.customerName || r?.customerId || "Workspace");

                return (
                  <div
                    key={getId(r)}
                    className="rounded-[28px] border border-zinc-100 bg-white px-4 py-4 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white">
                            {shortReqCode(r)}
                          </div>

                          <span className={badge(String(r?.status || ""))}>
                            {String(r?.status || "").toUpperCase()}
                          </span>
                          <span className={adminBadge(String(r?.adminState || "pending"))}>
                            ADMIN: {String(r?.adminState || "pending").toUpperCase()}
                          </span>

                          {(() => {
  const p = getProposalLens(r);

  // If backend hasn't enriched yet → clear signal
  if (!p || !p.proposalId) {
    return (
      <span className={proposalBadge(null)}>
        PROPOSAL: NO PROPOSAL
      </span>
    );
  }

  return (
    <>
      <span className={proposalBadge(p.status)}>{proposalLabel(p.status)}</span>
      {p.bookingStatus ? (
        <span className={bookingBadge(p.bookingStatus)}>{bookingLabel(p.bookingStatus)}</span>
      ) : null}
    </>
  );
})()}


                          <span className="text-[11px] text-zinc-500">
                            {getServiceLabel(serviceKind)} • {items.length} items •{" "}
                            {formatInrIntl(total)}
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

                        <div className="mt-2 text-sm font-semibold text-zinc-900">{seg}</div>

                        <div className="mt-1 text-[11px] text-zinc-500">
                          <span className="font-semibold text-zinc-700">{customerName}</span>
                          {" • "}Raised by {String(r?.frontlinerName || r?.requesterName || "User")} (
                          {String(r?.frontlinerEmail || r?.requesterEmail || "—")})
                          {" • "}Manager: {String(r?.managerName || r?.approverName || "Approver")}
                        </div>

                        <div className="mt-0.5 text-[11px] text-zinc-500">
                          Created: {createdAtStr || "—"} • Last update: {updatedAtStr || "—"}
                        </div>

                        {(r?.comments || r?.note) && (
                          <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                            <span className="mr-1 font-semibold text-zinc-500">
                              Requester note:
                            </span>
                            {String(r?.comments || r?.note)}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 md:min-w-[300px]">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => invoiceStub("Add to Invoice Table", r)}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
                          >
                            ➕ Add to Invoice
                          </button>

                          <button
                            type="button"
                            onClick={() => invoiceStub("Generate Invoice", r)}
                            className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-black"
                          >
                            🧾 Generate
                          </button>

                      <button
  type="button"
  onClick={() => {
    const requestId = String((r as any)?._id || "");
    nav(`/admin/proposals/by-request?requestId=${encodeURIComponent(requestId)}`, {
      state: { showProposalTab: true }, // ✅ unlock Proposal tab in App.tsx header
    });
  }}
  className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
>
  {(() => {
    const p = getProposalLens(r);
    return p?.proposalId ? "📄 Open Proposal" : "➕ Create Proposal";
  })()}
</button>

                          <button
                            type="button"
                            onClick={() => openDetails(r)}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                            disabled={detailBusy}
                          >
                            {detailBusy ? "Opening…" : "View details"}
                          </button>
                        </div>

                        <div className="mt-1 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openAction("assign", r)}
                            className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-800 shadow-sm hover:bg-sky-100"
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction("hold", r)}
                            className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                          >
                            Hold
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction("underProcess", r)}
                            className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"
                          >
                            In progress
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction("done", r)}
                            className="rounded-full bg-lime-50 px-3 py-1.5 text-[11px] font-semibold text-lime-800 shadow-sm hover:bg-lime-100"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction("cancel", r)}
                            className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-600"
                          >
                            Cancel
                          </button>
                        </div>

                        {detailErrById[rowId] && (
                          <div className="mt-1 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                            {detailErrById[rowId]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-8 text-sm text-zinc-600">
              No manager-approved requests are waiting in the admin queue for the selected filters.
            </div>
          )}
        </div>
      </div>

      {detailReq && <AdminRequestDetailsDrawer request={detailReq} onClose={() => setDetailReq(null)} />}

      {action && (
        <AdminActionDialog
          open={Boolean(action)}
          mode={action.kind}
          request={action.req}
          onClose={() => setAction(null)}
          onCompleted={load}
        />
      )}
    </div>
  );
}
