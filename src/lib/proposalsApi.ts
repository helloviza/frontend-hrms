// apps/frontend/src/lib/proposalsApi.ts
import api, { API_BASE } from "./api";

/* ───────────────────────── Types (aligned to current backend) ───────────────────────── */

export type ProposalStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED";

export type ApprovalDecision = "PENDING" | "APPROVED" | "DECLINED";

export type BookingStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "CANCELLED";

/** ✅ Customer-facing actions for proposal response */
export type CustomerProposalAction = "accept" | "reject" | "needs_changes";

export type ProposalLineItem = {
  itemIndex: number;
  category: string;
  title: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  notes?: string;
  dispositionCode?: string;
  dispositionLabel?: string;
  [key: string]: any;
};

export type ProposalOption = {
  optionNo: number;
  title: string;
  vendor?: string;

  /**
   * ✅ Backend may return Date (mongoose) OR ISO string (serialized) OR null.
   * Keep this union so Admin builder can save Date while UI can read string.
   */
  validityTill?: string | Date | null;

  currency: string;
  totalAmount: number;
  notes?: string;
  lineItems: ProposalLineItem[];
  attachments: string[]; // backend stores URLs
  [key: string]: any;
};

export type ProposalHistoryEntry = {
  action: string;
  at?: string;
  byEmail?: string;
  byName?: string;
  note?: string;
  [key: string]: any;
};

/**
 * ✅ Injected summary from backend enrichment
 * - proposals.ts attaches _requestCode and _requestSummary for list UIs
 */
export type ProposalRequestSummary = {
  requestId: string;
  requestCode: string;

  type?: string;
  title?: string;
  routeLabel?: string;

  requesterEmail?: string;
  requesterName?: string;
  managerEmail?: string;
  managerName?: string;

  departDate?: string;
  returnDate?: string;

  travellerCount?: number;
  travellerNames?: string[];

  priority?: string;
  needBy?: string;
  travelScope?: string;

  [key: string]: any;
};

export type ProposalDoc = {
  _id: string;
  requestId: string;

  version?: number;
  status: ProposalStatus;

  currency?: string;

  /**
   * ✅ IMPORTANT:
   * Backend contract: totalAmount represents Option-1 total (customer-facing).
   */
  totalAmount?: number;

  options?: ProposalOption[];

  approvals?: {
    l2?: {
      decision?: ApprovalDecision;
      at?: string;
      byEmail?: string;
      byName?: string;
      comment?: string;
    };
    l0?: {
      decision?: ApprovalDecision;
      at?: string;
      byEmail?: string;
      byName?: string;
      comment?: string;
    };
    [key: string]: any;
  };

  booking?: {
    status?: BookingStatus;
    attachments?: string[];
    bookingAmount?: number;
    actualBookingPrice?: number;
    doneAt?: string | null;
    doneByEmail?: string;
    doneByName?: string;
    note?: string;
    [key: string]: any;
  };

  history?: ProposalHistoryEntry[];

  // customer intent recorded on proposal (optional if older docs)
  customer?: {
    action?: CustomerProposalAction | null;
    note?: string;
    at?: string | null;
    byEmail?: string;
    byName?: string;
    [key: string]: any;
  };

  createdAt?: string;
  updatedAt?: string;

  // ✅ injected by backend inbox/read
  _myRoles?: Array<"L2" | "L0">;
  _isOwner?: boolean;

  // ✅ injected by backend inbox/mine enrichment (non-blocking typing gap fix)
  _requestCode?: string;
  _requestSummary?: ProposalRequestSummary;
  _isSelfApproval?: boolean;

  [key: string]: any;
};

/** Backend returns scope for /mine: tells UI if this is user or workspace-L0 lens */
export type MyProposalsScope = "USER" | "WORKSPACE_L0";

/* ───────────────────────── Error helper ───────────────────────── */

async function readError(res: Response): Promise<string> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j: any = await res.json();
      return j?.error || j?.message || JSON.stringify(j);
    }
    const t = await res.text();
    if (!t) return `Request failed: ${res.status}`;
    try {
      const j = JSON.parse(t);
      return (j as any)?.error || (j as any)?.message || t;
    } catch {
      return t;
    }
  } catch {
    return `Request failed: ${res.status}`;
  }
}

/* ───────────────────────── Attachment URL helpers (aligned to backend) ───────────────────────── */

function normalizeToProtectedDownloadUrl(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return s;

  // already the canonical protected endpoint
  if (s.includes("/api/proposals/attachments/download?path=")) {
    try {
      const u = new URL(s, window.location.origin);
      return u.pathname + u.search;
    } catch {
      return s;
    }
  }

  // legacy: /uploads/proposals/<id>/<file>
  const uploadsMarker = "/uploads/";
  const idx = s.indexOf(uploadsMarker);
  if (idx >= 0) {
    const after = s.slice(idx + uploadsMarker.length).replace(/\\/g, "/");
    if (after.startsWith("proposals/")) {
      return `/api/proposals/attachments/download?path=${encodeURIComponent(after)}`;
    }
  }

  // absolute URL -> try to parse and convert to protected endpoint
  try {
    const u = new URL(s, window.location.origin);
    const p = u.pathname.replace(/\\/g, "/");
    const marker = "/proposals/";
    const j = p.indexOf(marker);
    if (j >= 0) {
      const after = "proposals/" + p.slice(j + marker.length);
      return `/api/proposals/attachments/download?path=${encodeURIComponent(after)}`;
    }
  } catch {
    // ignore
  }

  // fallback: return as-is
  return s;
}

/** Open PDF in a new tab using protected download endpoint */
export function openProposalAttachment(url: string) {
  if (!url) return;
  const path = normalizeToProtectedDownloadUrl(url);
  const base = String(API_BASE || "").replace(/\/+$/, "");
const p = String(path || "");
const full =
  p.startsWith("http")
    ? p
    : base && p.startsWith("/api/")
      ? `${base.replace(/\/api$/, "")}${p}` // prevents /api/api
      : `${base}${p.startsWith("/") ? "" : "/"}${p}`;
  window.open(full, "_blank", "noopener,noreferrer");
}

/** Download blob (useful for custom download UI) */
export async function downloadProposalAttachmentFromUrl(url: string) {
  const path = normalizeToProtectedDownloadUrl(url);
  const base = String(API_BASE || "").replace(/\/+$/, "");
const p = String(path || "");
const full =
  p.startsWith("http")
    ? p
    : base && p.startsWith("/api/")
      ? `${base.replace(/\/api$/, "")}${p}` // prevents /api/api
      : `${base}${p.startsWith("/") ? "" : "/"}${p}`;

  const res = await fetch(full, { method: "GET", credentials: "include" });
  if (!res.ok) throw new Error(await readError(res));
  return res.blob();
}

/* ───────────────────────── Core Proposal APIs ───────────────────────── */

/** ✅ GET /api/proposals/inbox (L2/L0: pending decisions) */
export async function getProposalInbox() {
  return api.get<{ ok: boolean; items: ProposalDoc[] }>(`/proposals/inbox`);
}

/**
 * ✅ GET /api/proposals/mine
 * Used by CustomerProposalsInbox:
 * - USER scope: owner + L2 mapped
 * - WORKSPACE_L0 scope: whole company/workspace
 */
export async function getMyProposals() {
  return api.get<{
    ok: boolean;
    items: ProposalDoc[];
    scope?: MyProposalsScope;
  }>(`/proposals/mine`);
}

/** GET /api/proposals/by-request/:requestId (staff-only in backend) */
export async function getProposalByRequest(requestId: string) {
  return api.get<{ ok: boolean; proposal: ProposalDoc | null }>(
    `/proposals/by-request/${encodeURIComponent(requestId)}`
  );
}

/** GET /api/proposals/:id (viewer guard: staff OR assigned L2/L0 OR request-owner) */
export async function getProposalById(proposalId: string) {
  return api.get<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}`
  );
}

/** ✅ POST /api/proposals/:id/action  { action, note? } (owner only; staff can for support) */
export async function customerProposalAction(
  proposalId: string,
  body: { action: CustomerProposalAction; note?: string }
) {
  if (!proposalId) throw new Error("proposalId is required");
  if (!body?.action) throw new Error("action is required");

  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/action`,
    {
      action: body.action,
      note: body.note?.trim() ? body.note.trim() : undefined,
    }
  );
}

/** GET /api/proposals/queue (staff-only) */
export async function getProposalQueue(
  filters?: Partial<{
    status: ProposalStatus;
    l2: ApprovalDecision;
    l0: ApprovalDecision;
    bookingStatus: BookingStatus;
  }>
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.l2) params.set("l2", filters.l2);
  if (filters?.l0) params.set("l0", filters.l0);
  if (filters?.bookingStatus) params.set("bookingStatus", filters.bookingStatus);

  const qs = params.toString();
  return api.get<{ ok: boolean; items: ProposalDoc[] }>(
    `/proposals/queue${qs ? `?${qs}` : ""}`
  );
}

/** POST /api/proposals/by-request/:requestId/draft (staff-only) */
export async function createDraftProposalByRequest(
  requestId: string,
  body?: { currency?: string }
) {
  return api.post<{ ok: boolean; proposal: ProposalDoc; created?: boolean }>(
    `/proposals/by-request/${encodeURIComponent(requestId)}/draft`,
    body || {}
  );
}

/** PUT /api/proposals/:id (staff-only) */
export async function updateProposal(
  proposalId: string,
  body: Partial<{
    currency: string;
    options: ProposalOption[];
    totalAmount: number;
    note: string;
  }>
) {
  return api.put<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}`,
    body
  );
}

/** POST /api/proposals/:id/submit (staff-only) */
export async function submitProposal(
  proposalId: string,
  body?: { note?: string }
) {
  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/submit`,
    body || {}
  );
}

/** POST /api/proposals/:id/decide (assigned L2/L0 OR staff) */
export async function decideProposal(
  proposalId: string,
  body: {
    decision: "APPROVED" | "DECLINED";
    role: "L2" | "L0";
    note?: string;
    comment?: string;
  }
) {
  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/decide`,
    body
  );
}

/* ───────────────────────── Booking execution (staff-only) ───────────────────────── */

export async function startBookingFromProposal(proposalId: string, body?: { note?: string }) {
  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/booking/start`,
    body || {}
  );
}

export async function markBookingDoneFromProposal(
  proposalId: string,
  body: { bookingAmount: number; actualBookingPrice: number; note?: string }
) {
  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/booking/done`,
    body
  );
}

export async function cancelBookingFromProposal(proposalId: string, body?: { note?: string }) {
  return api.post<{ ok: boolean; proposal: ProposalDoc }>(
    `/proposals/${encodeURIComponent(proposalId)}/booking/cancel`,
    body || {}
  );
}

/* ───────────────────────── Attachments (PDF) ─────────────────────────
 * NOTE:
 * - Download: viewer-guarded (owner / assigned approver / staff)
 * - Upload: staff-only
 */

export type UploadProposalAttachmentResponse = {
  ok: boolean;

  // legacy single-upload responses:
  url?: string;

  // new multi-upload responses:
  added?: string[];
  attachments?: string[];

  [key: string]: any;
};

function assertPdfFiles(files: File[]) {
  const bad = files.find((f) => f.type !== "application/pdf");
  if (bad) throw new Error("Only PDF files are allowed");
}

/**
 * ✅ NEW (preferred): multi upload in ONE request
 * POST /api/proposals/:id/options/:optionNo/attachments
 * FormData: files[]
 */
export async function uploadProposalOptionAttachments(
  proposalId: string,
  optionNo: number,
  files: File[]
) {
  if (!proposalId) throw new Error("proposalId is required");
  if (!Number.isFinite(optionNo) || optionNo <= 0) throw new Error("optionNo is invalid");
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) throw new Error("No files selected");

  assertPdfFiles(list);

  const form = new FormData();
  for (const f of list) form.append("files", f);

  // ✅ new endpoint
  return api.postForm<UploadProposalAttachmentResponse>(
    `/proposals/${encodeURIComponent(proposalId)}/options/${encodeURIComponent(String(optionNo))}/attachments`,
    form
  );
}

/**
 * ✅ Backward compatible single upload helper
 * - Tries NEW multi endpoint first (with [file])
 * - Falls back to LEGACY single endpoint if new route fails
 */
export async function uploadProposalOptionAttachment(
  proposalId: string,
  optionNo: number,
  file: File
) {
  if (!proposalId) throw new Error("proposalId is required");
  if (!Number.isFinite(optionNo) || optionNo <= 0) throw new Error("optionNo is invalid");
  if (!file) throw new Error("No file selected");

  if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed");

  // 1) prefer new endpoint
  try {
    return await uploadProposalOptionAttachments(proposalId, optionNo, [file]);
  } catch (e: any) {
    // 2) legacy fallback
    const form = new FormData();
    form.append("file", file);

    return api.postForm<UploadProposalAttachmentResponse>(
      `/proposals/${encodeURIComponent(proposalId)}/options/${encodeURIComponent(String(optionNo))}/attachment`,
      form
    );
  }
}

/**
 * Booking attachment (kept as single file because your current backend route is single)
 * POST /api/proposals/:id/booking/attachment
 */
export async function uploadProposalBookingAttachment(proposalId: string, file: File) {
  if (!proposalId) throw new Error("proposalId is required");
  if (!file) throw new Error("No file selected");
  if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed");

  const form = new FormData();
  form.append("file", file);

  return api.postForm<UploadProposalAttachmentResponse>(
    `/proposals/${encodeURIComponent(proposalId)}/booking/attachment`,
    form
  );
}
