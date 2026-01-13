// apps/frontend/src/pages/admin/approvals/AdminApprovalQueue.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  getAdminApprovedQueue,
  adminAssign,
  adminOnHold,
  adminMarkDone,
  adminCancel,
  type ApprovalRequest,
  uploadApprovalAttachment,
} from "../../../lib/approvalsApi";

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
      { code: "WAITING_TRAVELLER_CONFIRM", label: "Waiting for traveller confirmation" },
      { code: "WAITING_MANAGER_APPROVAL", label: "Awaiting internal approval" },
      { code: "PAYMENT_CLEARANCE", label: "Payment clearance in progress" },
    ],
    underProcess: [
      { code: "QUEUE_WITH_AIRLINE", label: "In queue with airline / GDS" },
      { code: "PNR_GENERATED", label: "PNR generated, ticketing in progress" },
      { code: "SCHEDULE_CHANGE_REVIEW", label: "Schedule change review in progress" },
    ],
    cancel: [
      { code: "TRAVELLER_CANCELLED", label: "Cancelled by traveller" },
      { code: "POLICY_NON_COMPLIANT", label: "Not compliant with travel policy" },
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
      { code: "ROOM_ON_REQUEST", label: "Room on request – awaiting confirmation" },
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
      { code: "BIOMETRIC_COMPLETED", label: "Biometric appointment completed" },
    ],
    hold: [
      { code: "DOCUMENTS_PENDING", label: "Documents pending from traveller" },
      { code: "APPOINTMENT_SLOTS", label: "Waiting for appointment slots" },
      { code: "PAYMENT_PENDING", label: "Visa fee payment pending" },
    ],
    underProcess: [
      { code: "UNDER_EMBASSY_REVIEW", label: "Under embassy / consulate review" },
      { code: "APPLICATION_UNDER_PROCESS", label: "Application under process" },
      { code: "ADDITIONAL_DOCS_REVIEW", label: "Additional documents under review" },
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
    underProcess: [{ code: "COORDINATION_IN_PROGRESS", label: "Vendor coordination in progress" }],
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

function formatInr(num: number | null | undefined) {
  const v = Number(num || 0);
  if (!Number.isFinite(v)) return "₹0";
  return `₹${v.toLocaleString("en-IN")}`;
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

function getServiceKind(req: any): ServiceKind {
  const first = getCartItems(req)[0] as any;
  const t = String(first?.type || first?.service || first?.category || "").toLowerCase();

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
  const primary = items[0] || {};
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

  // Visa / Holiday often doesn't have origin/destination
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
    0,
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

/* ───────────────────────── admin comment parsing + protected attachment ───────────────────────── */

function safeNum(v: any): number | null {
  const n = Number(v);
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
  const file = extractFilenameFromUrl(raw);
  if (!file) return raw;
  return `/api/approvals/attachments/${encodeURIComponent(file)}/download`;
}

function parseAdminComment(raw: any): {
  isAdmin: boolean;
  mode?: string;
  service?: string;
  reason?: string;
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

  // strip all leading [....] tokens
  let rest = text.replace(/^\s*(?:\[[^\]]+\]\s*)+/g, "").trim();

  // attachment
  let attachmentUrl = "";
  const m1 = rest.match(/Attachment:\s*(https?:\/\/\S+|\S+\/uploads\/\S+)/i);
  if (m1?.[1]) attachmentUrl = String(m1[1]).trim();

  // also detect any http url ending in pdf if not found
  if (!attachmentUrl) {
    const m2 = rest.match(/(https?:\/\/\S+?\.pdf)/i);
    if (m2?.[1]) attachmentUrl = String(m2[1]).trim();
  }

  // remove attachment part from note
  if (attachmentUrl) {
    rest = rest.replace(new RegExp(`Attachment:\\s*${attachmentUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "").trim();
    rest = rest.replace(/—\s*Attachment:.*$/i, "").trim();
  }

  // normalize separators
  const note = rest.replace(/\s+—\s+/g, " — ").trim();

  return {
    isAdmin,
    mode: mode || undefined,
    service: service || undefined,
    reason: reason || undefined,
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
  note?: string;
  docUrl?: string;
  bookingAmount?: number | null;
  actualBookingPrice?: number | null;
}) {
  const { mode, serviceKind, reason, note, docUrl, bookingAmount, actualBookingPrice } = opts;
  const parts: string[] = [];

  parts.push(`[ADMIN]`);
  parts.push(`[MODE:${mode.toUpperCase()}]`);
  parts.push(`[SERVICE:${serviceKind.toUpperCase()}]`);
  if (reason) parts.push(`[REASON:${reason.code}]`);

  // IMPORTANT: store as tokens for export + parsing; backend will strip for non-admin history
  if (Number.isFinite(Number(bookingAmount))) parts.push(`[BOOKING_AMOUNT:${Number(bookingAmount)}]`);
  if (Number.isFinite(Number(actualBookingPrice))) parts.push(`[ACTUAL_PRICE:${Number(actualBookingPrice)}]`);

  let rest = "";
  if (reason) rest += `${reason.label}`;
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

function pickLatestHistory(req: any) {
  const hist = Array.isArray(req?.history) ? req.history : Array.isArray(req?.audit) ? req.audit : [];
  return hist.length ? hist[hist.length - 1] : undefined;
}

function pickBookingFieldsFromRequest(r: any): { bookingAmount: number | null; actual: number | null } {
  // If backend already returns fields in future, this will just work.
  const directBooking = safeNum(r?.bookingAmount ?? r?.meta?.bookingAmount ?? null);
  const directActual = safeNum(r?.actualBookingPrice ?? r?.meta?.actualBookingPrice ?? null);

  const latest = pickLatestHistory(r);
  const parsed = parseAdminComment(latest?.comment || "");
  const bookingAmount = directBooking ?? parsed.bookingAmount ?? null;
  const actual = directActual ?? parsed.actualPrice ?? null;
  return { bookingAmount, actual };
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
    // latest admin split
    "LatestMode",
    "LatestService",
    "LatestReason",
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
      0,
    );

    const { seg } = pickSegment(r);

    const latest = pickLatestHistory(r);
    const parsed = parseAdminComment(latest?.comment || "");

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
      parsed.note || "",
      attachmentProtected,
      parsed.raw || "",
    ].map(csvEscape);

    lines.push(row.join(","));
  }

  // ✅ UTF-8 BOM so Excel reads Unicode correctly (→, —, ₹, etc.)
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

  // Sheet 1: Summary (one row per request)
  const summary = rows.map((r: any) => {
    const items = getCartItems(r);
    const total = items.reduce(
      (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
      0,
    );

    const { seg } = pickSegment(r);

    const latest = pickLatestHistory(r);
    const parsed = parseAdminComment(latest?.comment || "");
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
      LatestNote: parsed.note || "",
      LatestAttachmentUrl: attachmentProtected,
      LatestCommentRaw: parsed.raw || "",
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  // Sheet 2: Items (one row per item)
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

  // Sheet 3: History (one row per history entry) — split admin comment
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

  // Use Blob download (more reliable than XLSX.writeFile in some builds)
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
  const hasMeta = Boolean(pickSegment(thin)?.meta && Object.keys(pickSegment(thin).meta).length > 0);

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

  const [bookingAmount, setBookingAmount] = useState<string>("");
  const [actualBookingPrice, setActualBookingPrice] = useState<string>("");

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, getId(request as any)]);

  if (!open) return null;

  const serviceKind = getServiceKind(request as any);
  const reasonConfig = SERVICE_REASON_CONFIG[serviceKind];
  const reasonOptions = mode === "assign" ? [] : reasonConfig[mode as ReasonMode] || [];
  const isReasonRequired = mode !== "assign";

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

  async function handleSubmit() {
    try {
      setErr(null);
      setBusy(true);

      const id = getId(request as any);

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
        const reason = reasonOptions.find((r) => r.code === reasonCode) || null;

        if (isReasonRequired && !reason) {
          setErr("Please select a reason.");
          setBusy(false);
          return;
        }

        // NEW: booking fields (Admin-only inputs)
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

        const comment = buildAdminComment({
          mode: mode as ReasonMode,
          serviceKind,
          reason,
          note,
          docUrl: attachmentUrl,
          bookingAmount: bookingAmountNum,
          actualBookingPrice: actualPriceNum,
        });

        if (mode === "hold") await adminOnHold(id, { comment });
        else if (mode === "underProcess") await adminOnHold(id, { comment });
        else if (mode === "done") {
          // avoid TS excess property checks:
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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
              {getServiceLabel(serviceKind)} · {(request as any)?.customerName || "Workspace"}
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

          {mode !== "assign" && (
            <>
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

              {mode === "done" && (
                <>
                  {/* NEW boxes */}
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
                      <div className="mt-1 text-[10px] text-zinc-500">Customer-facing booking amount.</div>
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
                      <div className="mt-1 text-[10px] text-zinc-500">Admin-only (cost/vendor).</div>
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
                      PDF will be stored in history and will be downloadable for L2/L1/L0 via protected link.
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
              placeholder="Add any extra context for audit trail (visible to requester / approver)."
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

function MaskedMoney({
  value,
  adminReveal,
}: {
  value: number | null;
  adminReveal?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (value === null || value === undefined) return <span className="text-zinc-500">—</span>;

  if (!adminReveal) {
    // non-admin: never show the number at all
    return <span className="text-zinc-500">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold text-zinc-900">
        {show ? formatInr(value) : "₹XXXXXX"}
      </span>
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

function AdminRequestDetailsDrawer({
  request,
  onClose,
}: {
  request: any;
  onClose: () => void;
}) {
  const { seg, meta, items } = pickSegment(request);
  const serviceKind = getServiceKind(request);
  const total = items.reduce(
    (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
    0,
  );

  const createdAt = request?.createdAt || request?.submittedAt || request?.created_at;
  const updatedAt = request?.updatedAt || request?.updated_at;

  const createdAtStr = createdAt
    ? new Date(String(createdAt)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const updatedAtStr = updatedAt
    ? new Date(String(updatedAt)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";

  const ai = getAiSignal(request);

  const history = Array.isArray(request?.history)
    ? request.history
    : Array.isArray(request?.audit)
      ? request.audit
      : [];

  const latest = history.length ? history[history.length - 1] : null;
  const parsedLatest = parseAdminComment(latest?.comment || "");

  const bookingAmount = parsedLatest.bookingAmount ?? null;
  const actualPrice = parsedLatest.actualPrice ?? null;

  const attachmentProtected =
    parsedLatest.attachmentUrl ? makeProtectedAttachmentUrl(parsedLatest.attachmentUrl) : "";

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/40 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-hidden rounded-l-[28px] bg-gradient-to-b from-white via-[#f4f5ff] to-[#fff7f1] shadow-2xl">
        {/* Header */}
        <div className="border-b border-zinc-100 bg-gradient-to-r from-white via-[#f4f5ff] to-[#fff7f1] px-5 py-4">
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
                {getServiceLabel(serviceKind)} · {String(request?.customerName || request?.customerId || "Workspace")}
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
              <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${ai.toneClass}`}>
                <span className="text-[10px]">◎</span>
                <span>{ai.label}</span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex h-[calc(100%-4.25rem)] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-zinc-900">
            {/* Segment / estimate */}
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
                    {String(request?.frontlinerName || request?.requesterName || request?.createdByName || "User")} (
                    {String(request?.frontlinerEmail || request?.requesterEmail || request?.createdByEmail || "—")})
                  </div>

                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    Manager:{" "}
                    {String(request?.managerName || request?.approverName || request?.manager?.name || "Approver")} (
                    {String(request?.managerEmail || request?.approverEmail || request?.manager?.email || "—")})
                  </div>

                  {/* NEW: Booking numbers (Admin drawer only) */}
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

                  {/* NEW: Attachment quick download */}
                  {attachmentProtected && (
                    <div className="mt-3">
                      <a
                        href={attachmentProtected}
                        className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                      >
                        ⬇ Download Admin PDF
                      </a>
                      <div className="mt-1 text-[10px] text-zinc-500">
                        This uses a protected download route (works for L2/L1/L0 too).
                      </div>
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

            {/* Items */}
            {items.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Items</div>
                  <div className="text-[10px] text-zinc-500">
                    {items.length} item{items.length !== 1 ? "s" : ""} • {formatInr(total)}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px]">
                      <div className="font-semibold text-zinc-900">{item?.title || item?.type || "Item"}</div>
                      <div className="text-[10px] text-zinc-600">
                        {String(item?.type || item?.service || "").toUpperCase() || "SERVICE"} • Qty {item?.qty || 1} •{" "}
                        {formatInr(item?.price)}
                      </div>
                      {(item?.description || item?.notes) && (
                        <div className="mt-0.5 text-[11px] text-zinc-800">{item?.description || item?.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Requester note */}
            {(request?.comments || request?.note || request?.remark) && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Note from requester
                </div>
                <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-800">
                  {String(request?.comments || request?.note || request?.remark)}
                </div>
              </section>
            )}

            {/* History */}
            {Array.isArray(history) && history.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Activity history
                </div>
                <ol className="mt-2 space-y-1 text-[11px] text-zinc-800">
                  {history.map((h: any, idx: number) => {
                    const ts = h?.at || h?.ts || h?.date || h?.createdAt;
                    const tsStr = ts
                      ? new Date(String(ts)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                      : "";
                    const p = parseAdminComment(h?.comment || h?.message || "");
                    const attachmentProtectedRow = p.attachmentUrl ? makeProtectedAttachmentUrl(p.attachmentUrl) : "";

                    return (
                      <li key={idx} className="flex items-start gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
                        <div className="w-full">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">
                              {String(h?.action || h?.type || "").toUpperCase()}{" "}
                              {(h?.userEmail || h?.by || h?.actorEmail) && (
                                <span className="font-normal text-zinc-500">
                                  • {String(h?.userEmail || h?.by || h?.actorEmail)}
                                </span>
                              )}
                            </div>

                            {attachmentProtectedRow && (
                              <a
                                href={attachmentProtectedRow}
                                className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
                              >
                                ⬇ PDF
                              </a>
                            )}
                          </div>

                          {tsStr && <div className="text-[10px] text-zinc-500">{tsStr}</div>}

                          {(h?.comment || h?.message) && (
                            <div className="mt-0.5 text-[11px] text-zinc-800">
                              {String(h?.comment || h?.message)}
                            </div>
                          )}

                          {/* show parsed tags for admin comment */}
                          {p.isAdmin && (p.mode || p.service || p.reason) && (
                            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                              {p.mode && (
                                <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-semibold text-white">
                                  MODE: {p.mode}
                                </span>
                              )}
                              {p.service && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800 ring-1 ring-indigo-100">
                                  SERVICE: {p.service}
                                </span>
                              )}
                              {p.reason && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100">
                                  REASON: {p.reason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Raw fallback */}
            <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Raw payload (debug)
              </summary>
              <pre className="mt-3 max-h-[260px] overflow-auto rounded-2xl bg-zinc-50 p-3 text-[11px] text-zinc-800">
{JSON.stringify(request, null, 2)}
              </pre>
            </details>
          </div>
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

export default function AdminApprovalQueue() {
  const nav = useNavigate();

  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailReq, setDetailReq] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

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
      setRows(list);
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

    return rows.filter((r: any) => {
      const created = new Date(r?.createdAt || r?.updatedAt || 0).getTime();

      if (range === "7d" && now - created > 7 * 24 * 60 * 60 * 1000) return false;
      if (range === "30d" && now - created > 30 * 24 * 60 * 60 * 1000) return false;
      if (range === "90d" && now - created > 90 * 24 * 60 * 60 * 1000) return false;

      const serviceKind = getServiceKind(r);
      if (serviceFilter !== "all" && serviceKind !== serviceFilter) return false;

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

  function openAction(kind: ActionKind, req: ApprovalRequest) {
    setAction({ kind, req });
  }

  async function openDetails(thin: any) {
    setDetailErr(null);
    setDetailBusy(true);
    try {
      const full = await hydrateRequestDetails(thin);
      setDetailReq(full);
    } catch (e: any) {
      setDetailReq(thin);
      setDetailErr(e?.message || "Failed to hydrate full details");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 xl:max-w-7xl">
      <div className="rounded-[32px] bg-gradient-to-b from-[#f5f7ff] via-white to-[#fff7f1] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full bg-black text-[10px] font-semibold text-white shadow-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px]">
                ☼
              </span>
              <span className="px-3">Pluto Copilot – Admin Approval Queue</span>
            </div>
            <h1 className="mt-3 text-xl font-semibold text-zinc-900">Approved Requests (Admin Queue)</h1>
            <p className="mt-1 text-xs text-zinc-500">
              All manager-approved travel requests waiting for{" "}
              <span className="font-semibold">Admin / SuperAdmin</span> action.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportQueueCsv(filteredRows as any)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ⬇ Export CSV
            </button>

            <button
              type="button"
              onClick={() => exportQueueXlsx(filteredRows as any)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ⬇ Export Excel
            </button>

            <button
              type="button"
              onClick={() => nav("/admin/analytics")}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              ← Back to Admin Home
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 gap-3 text-[11px] text-zinc-700 md:grid-cols-5">
          {/* Date range */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Date range</div>
            <div className="flex flex-wrap gap-1">
              {[
                ["all", "All"],
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
                ["90d", "Last 90 days"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRange(v as any)}
                  className={`rounded-full border px-3 py-1 ${
                    range === v ? "border-sky-500 bg-sky-50 text-sky-800" : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Service type */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Service type</div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as "all" | ServiceKind)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
            >
              <option value="all">All services</option>
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

          {/* Admin status */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Admin status</div>
            <select
              value={adminStatusFilter}
              onChange={(e) => setAdminStatusFilter(e.target.value as AdminStatusFilter)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
            >
              <option value="all">All admin states</option>
              <option value="pending">Pending / New</option>
              <option value="assigned">Assigned</option>
              <option value="on_hold">On hold</option>
              <option value="done">Processed / Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Business / workspace */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Business / Workspace
            </div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
            >
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] outline-none focus:border-sky-400"
              placeholder="Search by route, requester, customer, comment…"
            />
          </div>
        </div>

        {err && (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            Loading admin queue…
          </div>
        ) : filteredRows.length ? (
          <div className="space-y-3">
            {filteredRows.map((r: any) => {
              const items = getCartItems(r);
              const total = items.reduce(
                (s: number, i: any) => s + (Number(i?.price) || 0) * (Number(i?.qty) || 1),
                0,
              );
              const { seg } = pickSegment(r);

              const updatedAtStr = r?.updatedAt
                ? new Date(r.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "";
              const createdAtStr = r?.createdAt
                ? new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "";

              const ai = getAiSignal(r);
              const serviceKind = getServiceKind(r);

              return (
                <div
                  key={getId(r)}
                  className="rounded-[28px] border border-zinc-100 bg-white px-4 py-3 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg"
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
                        <span className="text-[11px] text-zinc-500">
                          Items {items.length} • {formatInr(total)} • {getServiceLabel(serviceKind)}
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
                        {String(r?.customerName || r?.customerId || "Workspace")} • Raised by{" "}
                        {String(r?.frontlinerName || r?.requesterName || "User")} (
                        {String(r?.frontlinerEmail || r?.requesterEmail || "—")}) • Manager:{" "}
                        {String(r?.managerName || r?.approverName || "Approver")}
                      </div>

                      <div className="mt-0.5 text-[11px] text-zinc-500">
                        Created: {createdAtStr || "—"} • Last update: {updatedAtStr || "—"}
                      </div>

                      {(r?.comments || r?.note) && (
                        <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-700">
                          <span className="mr-1 font-semibold text-zinc-500">Note from requester:</span>
                          {String(r?.comments || r?.note)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 md:min-w-[230px]">
                      <button
                        type="button"
                        onClick={() => openDetails(r)}
                        className="self-end rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                        disabled={detailBusy}
                      >
                        {detailBusy ? "Opening…" : "View full details"}
                      </button>

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
                          Admin hold
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction("underProcess", r)}
                          className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100"
                        >
                          Under process
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction("done", r)}
                          className="rounded-full bg-lime-50 px-3 py-1.5 text-[11px] font-semibold text-lime-800 shadow-sm hover:bg-lime-100"
                        >
                          Request processed
                        </button>
                        <button
                          type="button"
                          onClick={() => openAction("cancel", r)}
                          className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-600"
                        >
                          Request cancelled
                        </button>
                      </div>

                      {detailErr && (
                        <div className="mt-1 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                          {detailErr}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-100 bg-white/90 px-4 py-6 text-sm text-zinc-600">
            No manager-approved requests are waiting in the admin queue for the selected filters.
          </div>
        )}
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
