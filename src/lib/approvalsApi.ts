// apps/frontend/src/lib/approvalsApi.ts
import api, { API_BASE } from "./api";

/* ───────────────────────── Types ───────────────────────── */

export type ApprovalCartItem = {
  type: string; // "flight" | "hotel" | "visa" | ...
  title?: string; // readable label
  description?: string;
  qty?: number;
  price?: number; // INR
  meta?: any; // service-specific payload (dates, pax, city, etc.)
};

export type ApprovalHistoryItem = {
  action: string;
  at?: string;
  by: string;
  comment?: string;
  userName?: string;
  userEmail?: string;
};

export type ApprovalAttachment = {
  kind?: string; // "admin_pdf" | etc
  url?: string; // public URL
  path?: string; // "/uploads/approvals/.."
  filename?: string;
  mime?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  [key: string]: any;
};

export type ApprovalRequest = {
  _id: string;
  ticketId?: string;

  // workflow
  status: "pending" | "approved" | "declined" | "on_hold";
  adminState?: "pending" | "assigned" | "done" | "on_hold" | "cancelled";

  // actors
  frontlinerId: string;
  managerId: string;

  // payload
  cartItems: ApprovalCartItem[];
  comments?: string;

  // display (backend may attach)
  frontlinerName?: string;
  frontlinerEmail?: string;
  managerName?: string;
  managerEmail?: string;
  approvedByName?: string;
  approvedByEmail?: string;

  history?: ApprovalHistoryItem[];

  // customer / workspace
  customerId?: string;
  customerName?: string;

  // metadata bag used in AdminApprovalQueue etc.
  meta?: {
    customerWorkspaceId?: string;
    ccLeaders?: string[];
    revoked?: boolean;
    adminAssigned?: {
      agentType?: "human" | "ai" | string;
      agentName?: string;
      at?: string;
      [key: string]: any;
    };
    attachments?: ApprovalAttachment[];
    [key: string]: any;
  };

  createdAt: string;
  updatedAt: string;

  [key: string]: any;
};

export type SubmitApprovalRequestBody = {
  customerId: string;
  cartItems: ApprovalCartItem[];
  comments?: string;

  // legacy/back-compat
  customerCode?: string;
  customerEmail?: string;
};

export type UpdateApprovalRequestBody = {
  cartItems: ApprovalCartItem[];
  comments?: string;
};

/* ───────────────────────── L1: Requester APIs ───────────────────────── */

export async function submitApprovalRequest(body: SubmitApprovalRequestBody) {
  return api.post<{ request: ApprovalRequest; message?: string }>(
    "/approvals/requests",
    body
  );
}

export async function getMyApprovalRequests() {
  return api.get<{ rows: ApprovalRequest[] }>("/approvals/requests/mine");
}

export async function getApprovalRequest(reqId: string) {
  return api.get<{ request: ApprovalRequest }>(
    `/approvals/requests/${encodeURIComponent(reqId)}`
  );
}

export async function updateApprovalRequest(
  reqId: string,
  body: UpdateApprovalRequestBody
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/requests/${encodeURIComponent(reqId)}`,
    body
  );
}

export async function revokeApprovalRequest(
  reqId: string,
  body?: { comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/requests/${encodeURIComponent(reqId)}/revoke`,
    body || {}
  );
}

export async function resubmitRequest(
  reqId: string,
  body: { cartItems: ApprovalCartItem[]; comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/requests/${encodeURIComponent(reqId)}/resubmit`,
    body
  );
}

/* ───────────────────────── L2: Approver / Inbox APIs ───────────────────────── */

export async function getApproverInbox() {
  return api.get<{ rows: ApprovalRequest[] }>("/approvals/requests/inbox");
}

export type ApproverAction = "approved" | "declined" | "on_hold";

export async function approverAction(
  reqId: string,
  body: { action: ApproverAction; comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/requests/${encodeURIComponent(reqId)}/action`,
    body
  );
}

/* ───────────────────────── Admin Queue APIs ───────────────────────── */

export async function getAdminApprovedQueue(opts?: {
  includeClosed?: boolean;
  adminState?: string; // "pending" | "assigned" | "on_hold" | "done" | "cancelled"
  q?: string;
}) {
  const qs = new URLSearchParams();

  if (opts?.includeClosed) qs.set("includeClosed", "1");
  if (opts?.adminState && opts.adminState !== "all")
    qs.set("adminState", opts.adminState);
  if (opts?.q && opts.q.trim()) qs.set("q", opts.q.trim());

  const suffix = qs.toString();
  const url = `/approvals/admin/approved${suffix ? `?${suffix}` : ""}`;

  return api.get<{ rows: ApprovalRequest[] }>(url);
}

export async function getAdminPendingQueue() {
  return api.get<{ rows: ApprovalRequest[] }>("/approvals/admin/pending");
}

export async function getAdminDoneQueue() {
  return api.get<{ rows: ApprovalRequest[] }>("/approvals/admin/done");
}

export async function getAdminRejectedQueue() {
  return api.get<{ rows: ApprovalRequest[] }>("/approvals/admin/rejected");
}

export async function adminAssignApproval(
  reqId: string,
  body: { agentType?: "human" | "ai"; agentName?: string; comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/admin/${encodeURIComponent(reqId)}/assign`,
    body
  );
}

export async function adminMarkDone(reqId: string, body?: { comment?: string }) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/admin/${encodeURIComponent(reqId)}/done`,
    body || {}
  );
}

export async function adminPutOnHold(
  reqId: string,
  body?: { comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/admin/${encodeURIComponent(reqId)}/on-hold`,
    body || {}
  );
}

export async function adminCancelApproval(
  reqId: string,
  body?: { comment?: string }
) {
  return api.put<{ request: ApprovalRequest; message?: string }>(
    `/approvals/admin/${encodeURIComponent(reqId)}/cancel`,
    body || {}
  );
}

export const adminAssign = adminAssignApproval;
export const adminOnHold = adminPutOnHold;
export const adminCancel = adminCancelApproval;

/* ───────────────────────── Admin: Attachment Upload ───────────────────────── */

export type UploadApprovalAttachmentResponse = {
  ok: boolean;
  url?: string;
  attachmentUrl?: string;
  fileUrl?: string;
  path?: string;
  filename?: string;
  [key: string]: any;
};

export async function uploadApprovalAttachment(reqId: string, file: File) {
  if (!file) throw new Error("No file selected");

  const form = new FormData();
  form.append("file", file); // MUST match multer.single("file")

  return api.postForm<UploadApprovalAttachmentResponse>(
    `/approvals/admin/${encodeURIComponent(reqId)}/attachment`,
    form
  );
}

/* ───────────────────────── Email-based Actions (no login) ───────────────────────── */

async function readError(res: Response): Promise<string> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j: any = await res.json();
      return j?.error || j?.message || JSON.stringify(j);
    }
    const t = await res.text();
    if (!t) return `Request failed: ${res.status}`;
    // If backend accidentally returns JSON as text, make it nicer
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

/**
 * IMPORTANT:
 * - This is a PUBLIC endpoint (no login), and we keep credentials omitted.
 * - Now supports: approved | declined | on_hold
 */
export type EmailAction = "approved" | "declined" | "on_hold";

export async function consumeEmailActionToken(body: {
  token: string;
  action: EmailAction;
  comment?: string;
}) {
  const res = await fetch(`${API_BASE}/approvals/email/consume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    // no login required; keep cookies off to avoid any cross-site cookie surprises
    credentials: "omit",
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await readError(res));

  return (await res.json()) as {
    ok: boolean;
    request?: ApprovalRequest;
    message?: string;
  };
}
