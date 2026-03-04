// apps/frontend/src/lib/rbac.ts

/**
 * Canonical role definitions used by the frontend permission gates.
 *
 * IMPORTANT:
 * Backend sends many role-ish signals across:
 * - roles[] / role
 * - hrmsAccessRole / hrmsAccessLevel
 * - userType / accountType
 * - approvalRole / memberRole (customer-side)
 *
 * This file normalizes all of it into a stable Role[].
 */

export type Role =
  | "Employee"
  | "Manager"
  | "HR"
  | "Admin"
  | "SuperAdmin"
  | "Vendor"
  | "Customer"
  | "WorkspaceLeader"
  | "Approver"
  | "Requester"
  | "L0"
  | "L1"
  | "L2";

/** Loose user shape — all fields optional, matches what the backend returns */
export type AnyUser = Record<string, any>;

/* ─── Internal helpers ──────────────────────────────────────────────────────── */

/** Uppercase + strip whitespace/dashes/underscores — matches App.tsx/router.tsx/Header.tsx */
const norm = (s: unknown): string =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");

/** Coerce loosely-truthy values (boolean flags from the backend) */
export function truthy(v: unknown): boolean {
  if (!v) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function toRole(raw: any): Role {
  const r = norm(raw);

  // ───────── Super Admin variants ─────────
  if (
    r === "SUPERADMIN" ||
    r === "SUPERADMINISTRATOR" ||
    r === "SUPERADMINUSER" ||
    r === "GLOBALCOORDINATOR" ||
    r === "PLATFORMGOVERNOR"
  ) {
    return "SuperAdmin";
  }

  // ───────── Admin variants ─────────
  if (
    r === "ADMIN" ||
    r === "ADMINISTRATOR" ||
    r === "SYSTEMCONCIERGE" ||
    r === "SYSTEMSTEWARD"
  ) {
    return "Admin";
  }

  // ───────── HR variants ─────────
  if (
    r === "HR" ||
    r === "HRADMIN" ||
    r === "HUMANRESOURCES" ||
    r === "HUMANRESOURCESADMIN" ||
    r === "PEOPLEOPS" ||
    r === "PEOPLEOPERATIONS" ||
    r === "PEOPLESTRATEGIST"
  ) {
    return "HR";
  }

  // ───────── Manager variants ─────────
  if (r === "MANAGER" || r === "MGR") return "Manager";

  // ───────── Approval chain roles ─────────
  if (r === "L0") return "L0";
  if (r === "L1") return "L1";
  if (r === "L2") return "L2";

  if (r === "APPROVER") return "Approver";
  if (r === "REQUESTER") return "Requester";

  // Workspace leader variants
  if (
    r === "WORKSPACELEADER" ||
    r === "WORKSPACEL0" ||
    r === "WORKSPACEOWNER"
  ) {
    return "WorkspaceLeader";
  }

  // ───────── Account type roles ─────────
  if (r === "VENDOR" || r === "SERVICEATELIER" || r === "SERVICECONNOISSEUR") {
    return "Vendor";
  }

  if (
    r === "CUSTOMER" ||
    r === "BUSINESS" ||
    r === "WORKSPACELEADERCUSTOMER" ||
    r === "WORKSPACE" ||
    r === "WORKSPACELEADERBUSINESS"
  ) {
    return "Customer";
  }

  // Common employee-ish variants
  if (r === "EMPLOYEE" || r === "STAFF" || r === "SPECIALIST") return "Employee";

  // Everything else → Employee
  return "Employee";
}

/* ─── Existing exports (unchanged signatures) ───────────────────────────────── */

/**
 * Extract possible role strings from messy user objects.
 * Supports: roles[], role, hrmsAccessRole, hrmsAccessLevel, userType, accountType,
 *           approvalRole, memberRole, workspaceRole, customerRole, vendorRole
 */
export function extractRoleStrings(raw: unknown): string[] {
  if (!raw) return [];

  // raw can be roles array directly
  if (Array.isArray(raw)) return raw.map(String);

  // raw can be string "Admin" or "Admin,HR"
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // raw can be a user-like object
  if (typeof raw === "object") {
    const u: any = raw;
    const out: string[] = [];

    if (Array.isArray(u.roles)) out.push(...u.roles);

    // single role fields
    if (u.role) out.push(u.role);
    if (u.hrmsAccessRole) out.push(u.hrmsAccessRole);
    if (u.hrmsAccessLevel) out.push(u.hrmsAccessLevel);

    // type-ish fields used in some backends
    if (u.userType) out.push(u.userType);
    if (u.accountType) out.push(u.accountType);

    // customer-side membership/approval role signals
    if (u.approvalRole) out.push(u.approvalRole);
    if (u.memberRole) out.push(u.memberRole);
    if (u.workspaceRole) out.push(u.workspaceRole);
    if (u.customerRole) out.push(u.customerRole);
    if (u.vendorRole) out.push(u.vendorRole);

    return out.map(String).filter(Boolean);
  }

  return [];
}

/**
 * Normalize roles:
 *  - Always return an array of valid Role strings.
 *  - Case-insensitive + supports SUPER_ADMIN / HR_ADMIN / WORKSPACE_LEADER etc.
 *  - Defaults to ["Employee"] if empty.
 */
export function normalizeRoles(raw: unknown): Role[] {
  const parts = extractRoleStrings(raw);
  if (!parts.length) return ["Employee"];

  const mapped = parts.map(toRole);
  const uniq = Array.from(new Set(mapped));
  return (uniq.length ? uniq : ["Employee"]) as Role[];
}

/**
 * Check if the user has at least one of the allowed roles.
 * Safe for undefined/null user.
 */
export function hasAnyRole(user: any, allowed?: Role[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  const userRoles = normalizeRoles(user); // pass user object; extractor reads all fields
  return userRoles.some((r) => allowed.includes(r));
}

/* ─── Private helper for predicate functions ────────────────────────────────── */

/** Collect all role signals from a user object, normalized to uppercase strings */
function collectRoles(user: AnyUser | null | undefined): string[] {
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

/* ─── Persona predicates ────────────────────────────────────────────────────── */

export function isVendor(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (
    user.vendorId ||
    user.vendor_id ||
    user.vendorProfileId ||
    user.vendorProfile ||
    user.vendor?.id ||
    truthy(user.isVendor) ||
    truthy(user.is_vendor)
  ) {
    return true;
  }
  return collectRoles(user).includes("VENDOR");
}

export function isCustomer(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (
    user.businessId ||
    user.business_id ||
    user.customerId ||
    user.customer_id ||
    user.business?.id ||
    user.customer?.id ||
    truthy(user.isCustomer) ||
    truthy(user.is_customer) ||
    truthy(user.isBusiness) ||
    truthy(user.is_business)
  ) {
    return true;
  }
  const roles = collectRoles(user);
  return roles.some((r) =>
    ["CUSTOMER", "BUSINESS", "CLIENT", "CORPORATE", "COMPANY", "ORG", "ORGANIZATION"].includes(r)
  );
}

export function isApprover(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (
    user.approverId ||
    user.approver_id ||
    truthy(user.isApprover) ||
    truthy(user.is_approver)
  ) {
    return true;
  }
  const roles = collectRoles(user);
  return roles.some((r) =>
    [
      "APPROVER",
      "TRAVELAPPROVER",
      "FINANCEAPPROVER",
      "BILLINGAPPROVER",
      "COSTCENTERAPPROVER",
      "MANAGERAPPROVER",
      "REQUESTER",
    ].includes(r)
  );
}

export function isStaffAdmin(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  return collectRoles(user).some((r) =>
    ["ADMIN", "SUPERADMIN", "HR", "HRADMIN", "OPS", "OPSADMIN"].includes(r)
  );
}

/* ─── Kind detector ─────────────────────────────────────────────────────────── */

/**
 * Coarse persona bucket — used by Header nav gating and role label derivation.
 * Checks more fields than isVendor/isCustomer (includes payload.*, profile.*, etc.)
 */
export function detectUserKind(
  user: AnyUser | null | undefined
): "VENDOR" | "CUSTOMER" | "STAFF" | "UNKNOWN" {
  if (!user) return "UNKNOWN";

  if (
    user.vendorId ||
    user.vendor_id ||
    user.vendorProfileId ||
    user.vendorProfile ||
    user.vendor?.id ||
    truthy(user.isVendor) ||
    truthy(user.is_vendor)
  ) {
    return "VENDOR";
  }

  if (
    user.businessId ||
    user.business_id ||
    user.customerId ||
    user.customer_id ||
    user.clientId ||
    user.client_id ||
    user.companyId ||
    user.company_id ||
    user.businessProfileId ||
    user.businessProfile ||
    user.business?.id ||
    user.customer?.id ||
    truthy(user.isBusiness) ||
    truthy(user.is_business) ||
    truthy(user.isCustomer) ||
    truthy(user.is_customer)
  ) {
    return "CUSTOMER";
  }

  const candidates: unknown[] = [
    user.userType,
    user.type,
    user.profileType,
    user.entityType,
    user.kind,
    user.accountType,
    user.category,
    user.profile?.userType,
    user.profile?.type,
    user.profile?.profileType,
    user.payload?.type,
    user.payload?.userType,
    user.payload?.profileType,
  ];

  const c = candidates.map(norm).filter(Boolean);

  if (c.some((x) => x.includes("VENDOR") || x.includes("SUPPLIER") || x.includes("PARTNER"))) {
    return "VENDOR";
  }

  if (
    c.some(
      (x) =>
        x.includes("CUSTOMER") ||
        x.includes("BUSINESS") ||
        x.includes("BUSINESSUSER") ||
        x.includes("CLIENT") ||
        x.includes("CORPORATE") ||
        x.includes("COMPANY") ||
        x.includes("ORGANIZATION") ||
        x.includes("ORG")
    )
  ) {
    return "CUSTOMER";
  }

  return "STAFF";
}

/* ─── Role label ────────────────────────────────────────────────────────────── */

const LABEL = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR: "HR",
  ADMIN: "Admin",
  SUPERADMIN: "Super Admin",
  VENDOR: "Vendor",
  CUSTOMER: "Workspace Leader",
  APPROVER: "Approver",
  REQUESTER: "Crew Member",
};

/** Human-readable role label for the current user (used by Header) */
export function deriveRoleLabel(user: AnyUser | null | undefined): string {
  if (!user) return LABEL.EMPLOYEE;

  const kind = detectUserKind(user);

  const roles: string[] = [];
  if (Array.isArray(user.roles)) roles.push(...user.roles);
  if (user.role) roles.push(user.role);
  if (user.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  const upper = roles.map(norm);

  if (kind === "VENDOR") return LABEL.VENDOR;

  const approver = isApprover(user) || upper.includes("APPROVER");
  const isRequester = upper.includes("REQUESTER");
  const isLeader =
    upper.includes("WORKSPACELEADER") ||
    (kind === "CUSTOMER" &&
      upper.includes("CUSTOMER") &&
      !upper.includes("REQUESTER") &&
      !upper.includes("APPROVER"));

  if (kind === "CUSTOMER") {
    if (approver) return LABEL.APPROVER;
    if (isLeader) return LABEL.CUSTOMER;
    if (isRequester) return LABEL.REQUESTER;
    return LABEL.CUSTOMER;
  }

  if (upper.some((r) => r.includes("SUPERADMIN"))) return LABEL.SUPERADMIN;
  if (upper.some((r) => r.includes("ADMIN"))) return LABEL.ADMIN;
  if (upper.some((r) => r.includes("HRADMIN") || r === "HR" || r.includes("HR"))) return LABEL.HR;
  if (upper.some((r) => r.includes("MANAGER"))) return LABEL.MANAGER;

  return LABEL.EMPLOYEE;
}

/* ─── Composite access checks ───────────────────────────────────────────────── */

/** Who can access User Creation: HR/Admin/SuperAdmin + Workspace Leader + Approver */
export function canAccessUserCreation(user: AnyUser | null | undefined): boolean {
  if (!user) return false;

  const kind = detectUserKind(user);

  const roles: string[] = [];
  if (Array.isArray(user.roles)) roles.push(...user.roles);
  if (user.role) roles.push(user.role);
  if (user.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  const upper = roles.map(norm);

  const approver = isApprover(user) || upper.includes("APPROVER");
  const isLeader =
    upper.includes("WORKSPACELEADER") ||
    (detectUserKind(user) === "CUSTOMER" &&
      upper.includes("CUSTOMER") &&
      !upper.includes("REQUESTER") &&
      !upper.includes("APPROVER"));
  const isRequester = upper.includes("REQUESTER");

  if (kind === "VENDOR") return false;

  if (kind === "STAFF" && hasAnyRole(user, ["HR", "Admin", "SuperAdmin"])) return true;

  if (kind === "CUSTOMER") {
    if (approver) return true;
    if (isLeader) return true;
    if (isRequester) return false;
    return false;
  }

  if (approver) return true;

  return false;
}
