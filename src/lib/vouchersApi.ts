// apps/frontend/src/lib/vouchersApi.ts
import api from "./api";

export type VoucherType = "hotel" | "flight";

export type VoucherExtractionStatus = "PROCESSING" | "SUCCESS" | "FAILED";

/** Base S3 pointer saved by backend (bucket+key are source of truth) */
export type S3ObjectRef = {
  bucket: string;
  key: string;
  url: string; // optional "console/public-ish" url stored at upload time (not a signed url)
};

/** Rendered PDF pointer (same structure as S3ObjectRef), optional */
export type RenderedS3Ref = S3ObjectRef | undefined;

export type VoucherExtractionRow = {
  _id: string;
  customerId: string;
  createdBy: string;
  docType: VoucherType;
  status: VoucherExtractionStatus;
  error?: string | null;

  /** Original upload stored in S3 */
  s3: S3ObjectRef;

  /** Regenerated PDF stored in S3 (optional; exists after render succeeds) */
  renderedS3?: S3ObjectRef;

  /** Render tracking */
  renderedAt?: string | null;
  renderedBy?: string | null;
  renderedRevision?: number;
  renderedTemplateVersion?: string;
  renderError?: string | null;

  file: { originalName: string; mime: string; size: number };

  extractedJson?: any;
  rawModelResponse?: any;

  correctedBy?: string | null;
  correctedAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ExtractVoucherResponse = {
  id: string;
  status: VoucherExtractionStatus;
  docType: VoucherType;

  /** original upload */
  s3: S3ObjectRef;

  /** regenerated pdf (if auto-render succeeded) */
  renderedS3?: S3ObjectRef | null;
  renderedAt?: string | null;
  renderedRevision?: number;
  renderedTemplateVersion?: string;
  renderError?: string | null;

  extractedJson?: any;

  createdAt: string;
  correlationId?: string;
  debug?: any;

  warnings?: string[];
};

export type SignedOpenUrlResponse = {
  url: string;
  expiresIn: number;
};

export type RenderVoucherResponse = {
  id: string;
  renderedS3: S3ObjectRef;
  renderedAt?: string | null;
  renderedRevision?: number;
  renderedTemplateVersion?: string;
  renderError?: string | null;
};

export async function extractVoucher(opts: {
  file: File;
  voucherType: VoucherType;
  customLogoUrl?: string;
  portalHint?: string; // improves extraction accuracy
}) {
  const fd = new FormData();
  fd.append("file", opts.file);
  fd.append("voucherType", opts.voucherType);
  if (opts.customLogoUrl) fd.append("customLogoUrl", opts.customLogoUrl);
  if (opts.portalHint) fd.append("portalHint", opts.portalHint);

  return api.postForm<ExtractVoucherResponse>("/vouchers/extract", fd);
}

export async function getMyVouchers() {
  return api.get<VoucherExtractionRow[]>("/vouchers/my");
}

export async function adminGetAllVouchers() {
  return api.get<VoucherExtractionRow[]>("/vouchers");
}

export async function getVoucherById(id: string) {
  return api.get<VoucherExtractionRow>(`/vouchers/${id}`);
}

/**
 * Signed URL for UPLOADED ORIGINAL voucher file.
 * Backend: GET /api/vouchers/:id/open
 */
export async function getVoucherOpenUrl(id: string) {
  return api.get<SignedOpenUrlResponse>(`/vouchers/${id}/open`);
}

/**
 * Signed URL for REGENERATED voucher PDF.
 * Backend: GET /api/vouchers/:id/open-rendered
 */
export async function getVoucherOpenRenderedUrl(id: string) {
  return api.get<SignedOpenUrlResponse>(`/vouchers/${id}/open-rendered`);
}

/**
 * Admin: patch voucher record (typically extractedJson correction).
 * Backend: PATCH /api/vouchers/:id
 */
export async function adminPatchVoucher(id: string, patch: any) {
  return api.patch<VoucherExtractionRow>(`/vouchers/${id}`, patch);
}

/**
 * Force re-render (Owner + Admin)
 * Backend: POST /api/vouchers/:id/render
 */
export async function adminRenderVoucher(id: string) {
  return api.post<RenderVoucherResponse>(`/vouchers/${id}/render`, {});
}