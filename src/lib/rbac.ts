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

function norm(v: any): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
}

function toRole(raw: any): Role {
  const r = norm(raw);

  // ───────── Super Admin variants ─────────
  if (
    r === "superadmin" ||
    r === "superadministrator" ||
    r === "superadminuser" ||
    r === "super_admin" ||
    r === "globalcoordinator" ||
    r === "platformgovernor"
  ) {
    return "SuperAdmin";
  }

  // ───────── Admin variants ─────────
  if (
    r === "admin" ||
    r === "administrator" ||
    r === "systemconcierge" ||
    r === "systemsteward"
  ) {
    return "Admin";
  }

  // ───────── HR variants ─────────
  if (
    r === "hr" ||
    r === "hradmin" ||
    r === "hr_admin" ||
    r === "humanresources" ||
    r === "humanresourcesadmin" ||
    r === "peopleops" ||
    r === "peopleoperations" ||
    r === "peoplestrategist"
  ) {
    return "HR";
  }

  // ───────── Manager variants ─────────
  if (r === "manager" || r === "mgr") return "Manager";

  // ───────── Approval chain roles ─────────
  if (r === "l0") return "L0";
  if (r === "l1") return "L1";
  if (r === "l2") return "L2";

  if (r === "approver") return "Approver";
  if (r === "requester") return "Requester";

  // Workspace leader variants
  if (
    r === "workspaceleader" ||
    r === "workspace_leader" ||
    r === "workspacel0" ||
    r === "workspaceowner"
  ) {
    return "WorkspaceLeader";
  }

  // ───────── Account type roles ─────────
  if (r === "vendor" || r === "serviceatelier" || r === "serviceconnoisseur") {
    return "Vendor";
  }

  // "Customer" / "Business" should behave like customer-side
  if (
    r === "customer" ||
    r === "business" ||
    r === "workspaceleadercustomer" ||
    r === "workspace" ||
    r === "workspaceleaderbusiness"
  ) {
    return "Customer";
  }

  // Common employee-ish variants
  if (r === "employee" || r === "staff" || r === "specialist") return "Employee";

  // Everything else -> Employee
  return "Employee";
}

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
