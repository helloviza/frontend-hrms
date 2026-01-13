// apps/frontend/src/components/layout/Header.tsx
import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasAnyRole, Role } from "../../lib/rbac";

/** Lux labels */
const LABEL = {
  EMPLOYEE: "Specialist",
  MANAGER: "Manager",
  HR: "People Strategist",
  ADMIN: "System Steward",
  SUPERADMIN: "Platform Governor",
  VENDOR: "Service Atelier",
  CUSTOMER: "Workspace Leader", // L0 Steward Leader
  APPROVER: "Approver", // L2
  REQUESTER: "Crew Member", // L1 Requestor
};

function norm(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");
}

function truthy(v: any) {
  return v === true || v === 1 || v === "1" || v === "true";
}

/**
 * Detect account kind beyond roles:
 */
function detectUserKind(user: any): "VENDOR" | "CUSTOMER" | "STAFF" | "UNKNOWN" {
  if (!user) return "UNKNOWN";

  // Vendor signals
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

  // Customer/Business signals
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

  // String fields from auth payloads
  const candidates: any[] = [
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
        x.includes("ORG"),
    )
  ) {
    return "CUSTOMER";
  }

  return "STAFF";
}

function isApprover(user: any): boolean {
  if (!user) return false;

  if (user.approverId || user.approver_id || truthy(user.isApprover) || truthy(user.is_approver)) {
    return true;
  }

  const roles: string[] = [];
  if (Array.isArray(user?.roles)) roles.push(...user.roles);
  if (user?.role) roles.push(user.role);
  if (user?.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user?.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  if (user?.approvalRole) roles.push(user.approvalRole);

  const upper = roles.map(norm);

  return upper.some((r) =>
    [
      "APPROVER",
      "TRAVELAPPROVER",
      "FINANCEAPPROVER",
      "BILLINGAPPROVER",
      "COSTCENTERAPPROVER",
      "MANAGERAPPROVER",
    ].includes(r),
  );
}

/** ✅ The agreed gate */
function canAccessUserCreation(user: any): boolean {
  if (!user) return false;

  const kind = detectUserKind(user);

  const roles: string[] = [];
  if (Array.isArray(user?.roles)) roles.push(...user.roles);
  if (user?.role) roles.push(user.role);
  if (user?.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user?.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  const upper = roles.map(norm);

  const approver = isApprover(user) || upper.includes("APPROVER");
  const isLeader =
    upper.includes("WORKSPACELEADER") ||
    upper.includes("WORKSPACE_LEADER") ||
    // fallback: pure CUSTOMER with no REQUESTER/APPROVER we treat as L0:
    (detectUserKind(user) === "CUSTOMER" &&
      upper.includes("CUSTOMER") &&
      !upper.includes("REQUESTER") &&
      !upper.includes("APPROVER"));
  const isRequester = upper.includes("REQUESTER");

  // Never for vendors
  if (kind === "VENDOR") return false;

  // Staff privileged: HR/Admin/SuperAdmin
  if (kind === "STAFF" && hasAnyRole(user as any, ["HR", "Admin", "SuperAdmin"])) {
    return true;
  }

  // Customer workspace users:
  if (kind === "CUSTOMER") {
    // L2 approver can create users
    if (approver) return true;

    // L0 Workspace Leader can create users
    if (isLeader) return true;

    // L1 Requester should NOT see User Creation
    if (isRequester) return false;

    // Any other weird combo → safe default: no access
    return false;
  }

  // Approver staff (if any non-customer approver we detect)
  if (approver) return true;

  return false;
}

/** Header pill label */
function deriveRoleLabel(user: any): string {
  if (!user) return LABEL.EMPLOYEE;

  const kind = detectUserKind(user);

  const roles: string[] = [];
  if (Array.isArray(user?.roles)) roles.push(...user.roles);
  if (user?.role) roles.push(user.role);
  if (user?.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user?.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  const upper = roles.map(norm);

  // Vendor always gets vendor label
  if (kind === "VENDOR") return LABEL.VENDOR;

  const approver = isApprover(user) || upper.includes("APPROVER");
  const isRequester = upper.includes("REQUESTER");
  const isLeader =
    upper.includes("WORKSPACELEADER") ||
    upper.includes("WORKSPACE_LEADER") ||
    (kind === "CUSTOMER" &&
      upper.includes("CUSTOMER") &&
      !upper.includes("REQUESTER") &&
      !upper.includes("APPROVER"));

  // Customer-side labels: L0 / L1 / L2
  if (kind === "CUSTOMER") {
    if (approver) return LABEL.APPROVER; // L2
    if (isLeader) return LABEL.CUSTOMER; // L0
    if (isRequester) return LABEL.REQUESTER; // L1
    // Fallback: treat as leader if nothing else is tagged
    return LABEL.CUSTOMER;
  }

  // Staff labels
  if (upper.some((r) => r.includes("SUPERADMIN") || r.includes("SUPER_ADMIN"))) return LABEL.SUPERADMIN;
  if (upper.some((r) => r.includes("ADMIN"))) return LABEL.ADMIN;
  if (upper.some((r) => r.includes("HRADMIN") || r === "HR" || r.includes("HR"))) return LABEL.HR;
  if (upper.some((r) => r.includes("MANAGER"))) return LABEL.MANAGER;

  // Default for all other staff
  return LABEL.EMPLOYEE;
}

/* -------------------------------------------------------------------------- */
/* Nav model                                                                  */
/* -------------------------------------------------------------------------- */

type Gate = (user: any) => boolean;

type NavItem = {
  label: string;
  to: string;
  description?: string;
  gate?: Gate;
};

type NavGroup = {
  id: string;
  label: string;
  gate: Gate;
  items: NavItem[];
};

const isStaff: Gate = (u) => detectUserKind(u) === "STAFF";
const isVendor: Gate = (u) => detectUserKind(u) === "VENDOR";
const isCustomer: Gate = (u) => detectUserKind(u) === "CUSTOMER";

const staffHas =
  (roles: Role[]): Gate =>
  (u) =>
    hasAnyRole(u as any, roles);

// Routes
const TRAVEL_DASH = "/dashboard/travel-spend";
const ADMIN_USERS = "/admin/users";

const NAV_GROUPS: NavGroup[] = [
  // ✅ Customer Workspace nav
  {
    id: "workspace",
    label: "Workspace",
    gate: isCustomer,
    items: [
      { label: "My Workspace", to: "/profile/customer", description: "Your dashboard, travellers & company context" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "Spend, services, exports & trends" },
      { label: "Company & Billing", to: "/customer/company", description: "Company profile, GST, billing preferences" },
      { label: "Contacts & Approvals", to: "/customer/contacts", description: "Approvers, travellers & permissions" },
      { label: "Agreements", to: "/customer/agreements", description: "MSA, SLAs and service terms" },
      { label: "Security", to: "/customer/security", description: "Password, sessions & access rules" },
      { label: "Org Chart", to: "/orgchart", description: "View reporting structure" },
      { label: "Policies", to: "/policies", description: "Company policy library" },
    ],
  },

  // ✅ Approvals nav for customers
  {
    id: "approvals",
    label: "Approvals",
    gate: (u) => isCustomer(u) || isApprover(u),
    items: [
      { label: "New Request", to: "/customer/approvals/new", description: "Create a new travel approval request" },
      { label: "My Requests", to: "/customer/approvals/mine", description: "Track status & history" },
      { label: "Approver Inbox", to: "/customer/approvals/inbox", description: "Approve / decline requests" },
    ],
  },

  // ✅ Vendor nav
  {
    id: "atelier",
    label: "Service Atelier",
    gate: isVendor,
    items: [
      { label: "My Vendor Profile", to: "/profile/vendor", description: "Your service details, docs & compliance" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "Service-wise volume & spend insights" },
      { label: "Org Chart", to: "/orgchart", description: "View reporting structure" },
      { label: "Policies", to: "/policies", description: "Company policy library" },
    ],
  },

  // ✅ Staff nav
  {
    id: "me",
    label: "My Realm & Moment",
    gate: isStaff,
    items: [
      { label: "My Profile", to: "/profile/me", description: "Personal details, documents & preferences" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "Dashboard with filters & exports" },
      { label: "Punch", to: "/attendance/punch", description: "Start / stop workday and view live status" },
      { label: "Attendance Reports", to: "/attendance/reports", description: "History of in/out and regularisation" },
      { label: "Apply Leave", to: "/leaves/apply", description: "Apply for leave or work-from-home" },
      { label: "My Leaves", to: "/leaves/my", description: "Track approvals and balances" },
      { label: "Holidays", to: "/holidays", description: "Company holiday calendar" },
    ],
  },

  {
    id: "people",
    label: "Luxe Workforce Stewardship",
    gate: (u) => isStaff(u) && staffHas(["Manager", "HR", "Admin", "SuperAdmin"])(u),
    items: [
      { label: "Manager Dashboard", to: "/dashboard/manager", description: "Team overview, approvals & alerts" },
      {
        label: "Team Profiles",
        to: "/profile/team",
        description: "Full employee master data",
        gate: staffHas(["Manager", "HR", "Admin", "SuperAdmin"]),
      },
      {
        label: "Vendor Profiles",
        to: "/profile/vendors",
        description: "HRMS view of onboarded vendors",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
      {
        label: "Business Profiles",
        to: "/profile/businesses",
        description: "Client / business accounts directory",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
    ],
  },

  {
    id: "onboarding",
    label: "Onboardings Management",
    gate: (u) => isStaff(u) && staffHas(["HR", "Admin", "SuperAdmin"])(u),
    items: [
      { label: "Onboarding Cockpit", to: "/vendors/onboard", description: "Launch and track onboarding links" },
      { label: "Pipeline", to: "/vendors/pipeline", description: "Active onboarding pipeline & statuses" },
      { label: "Master Data", to: "/vendors/master-data", description: "Approved vendor master records" },
    ],
  },

  {
    id: "hrops",
    label: "HR Operations",
    gate: (u) => isStaff(u),
    items: [
      {
        label: "HR/Admin Workspace",
        to: "/dashboard/hr-admin",
        description: "HR cockpit with HR Copilot & insights",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
      { label: "Org Chart", to: "/orgchart", description: "Visual reporting structure" },
      { label: "Policies", to: "/policies", description: "HR & company policy library" },
    ],
  },

  // ✅ Access group visible to HR/Admin/SuperAdmin + WorkspaceLeader + Approver
  {
    id: "access",
    label: "Access",
    gate: (u) => canAccessUserCreation(u),
    items: [
      {
        label: "User Creation",
        to: ADMIN_USERS,
        description: "Create users & manage access",
      },
    ],
  },

  {
    id: "admin",
    label: "Administrative",
    gate: (u) => isStaff(u) && staffHas(["Admin", "SuperAdmin"])(u),
    items: [
      { label: "Admin Analytics", to: "/admin/analytics", description: "Headcount, leaves, attendance analytics" },
      { label: "Admin Reports", to: "/admin/reports", description: "Exportable HR & compliance reports" },
    ],
  },
];

function GroupTrigger({
  group,
  isActive,
  onOpen,
}: {
  group: NavGroup;
  isActive: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onOpen}
      onFocus={onOpen}
      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        isActive ? "bg-black text-white shadow-sm" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      <span>{group.label}</span>
      <span className={`text-[9px] transition-transform ${isActive ? "rotate-180" : ""}`}>▾</span>
    </button>
  );
}

function GroupPanel({
  group,
  onClose,
  user,
}: {
  group: NavGroup;
  onClose: () => void;
  user: any;
}) {
  const visibleItems = group.items.filter((it) => (it.gate ? it.gate(user) : true));
  if (!visibleItems.length) return null;

  return (
    <div
      className="absolute left-1/2 top-full z-30 mt-0 w-[560px] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white/95 p-3 shadow-xl shadow-black/5 backdrop-blur"
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-2 gap-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col rounded-2xl px-3 py-2 text-left text-xs transition ${
                isActive ? "bg-zinc-900 text-white" : "bg-zinc-50 hover:bg-zinc-100"
              }`
            }
          >
            <span className="text-[11px] font-semibold">{item.label}</span>
            {item.description && (
              <span className="mt-0.5 text-[10px] text-zinc-500">{item.description}</span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile Insights strip (visible on /profile/*)                              */
/* -------------------------------------------------------------------------- */

function ProfileInsightsStrip({
  kind,
  onOpenAnalytics,
}: {
  kind: "VENDOR" | "CUSTOMER" | "STAFF" | "UNKNOWN";
  onOpenAnalytics: () => void;
}) {
  const subtitle =
    kind === "CUSTOMER"
      ? "Track services, spend, travellers & downloads — built like an analytics suite."
      : kind === "VENDOR"
        ? "See service-wise activity & exports with clean, PowerBI-style filters."
        : "Monitor spend trends, services mix and export reports in CSV/Excel.";

  return (
    <div className="border-t border-zinc-200 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-col gap-2 rounded-3xl border border-zinc-200 bg-gradient-to-r from-[#00477f]/10 via-white to-[#d06549]/10 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-9 w-9 rounded-2xl bg-gradient-to-br from-[#00477f] to-emerald-400 shadow-sm" />
            <div>
              <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">INSIGHTS</div>
              <div className="text-sm font-semibold text-zinc-900">Travel Analytics Dashboard</div>
              <div className="mt-0.5 text-[11px] text-zinc-600">{subtitle}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenAnalytics}
              className="rounded-full bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-zinc-800"
            >
              Open Analytics
            </button>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-[11px] text-zinc-700">
              CSV / Excel Export • Date Range • Service Filters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const kind = detectUserKind(user as any);
  const roleLabel = useMemo(() => deriveRoleLabel(user as any), [user]);

  const displayEmail =
    (user as any)?.officialEmail ||
    (user as any)?.email ||
    (user as any)?.profile?.email ||
    (user as any)?.sub ||
    "";

  // Hide shell on auth + public flow routes
  const showShell = ![
    "/login",
    "/register",
    "/forgot",
    "/onboarding",
    "/invite",
    "/ob",
    "/approval/email",
  ].some((p) => location.pathname.startsWith(p));
  if (!showShell) return null;

  const logoSrc = "/assets/logo.png";

  const canOpenCopilot =
    kind === "STAFF" && hasAnyRole(user as any, ["HR", "Admin", "SuperAdmin"]);
  const copilotTarget =
    kind === "CUSTOMER" ? "/profile/customer" : kind === "VENDOR" ? "/profile/vendor" : "/dashboard/hr-admin";

  const groups = NAV_GROUPS.filter((g) => g.gate(user as any));
  const isProfileRoute = location.pathname.startsWith("/profile");

  const showUserCreation = canAccessUserCreation(user as any);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3">
          <div className="relative flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-2xl bg-white shadow-sm shadow-black/10">
              <img src={logoSrc} alt="Plumtrips HRMS" className="h-full w-full rounded-2xl object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight">
                Plumtrips <span className="text-zinc-500">HRMS</span>
              </span>
              <span className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                AI-ASSISTED WORKFORCE CONSOLE
              </span>
            </div>
          </div>
        </button>

        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(copilotTarget)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm ${
              canOpenCopilot
                ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
            }`}
            title={canOpenCopilot ? "Open HR Copilot" : "Open your dashboard"}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 text-[11px] text-white">
              ⚡
            </span>
            <span>{canOpenCopilot ? "Ask HR Copilot" : "Open Dashboard"}</span>
          </button>

          {/* Quick Access: Travel Analytics (always visible) */}
          <button
            type="button"
            onClick={() => navigate(TRAVEL_DASH)}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            title="Open Travel Analytics"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#00477f] to-[#d06549] text-[11px] text-white">
              ⌁
            </span>
            <span>Travel Analytics</span>
          </button>

          {/* ✅ Quick Access: User Creation (HR/Admin/SuperAdmin + WorkspaceLeader + Approver) */}
          {showUserCreation && (
            <button
              type="button"
              onClick={() => navigate(ADMIN_USERS)}
              className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 md:inline-flex"
              title="User Creation"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[11px] text-white">
                +
              </span>
              <span>User Creation</span>
            </button>
          )}

          <div className="relative hidden flex-1 items-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50/80 pl-3 pr-4 text-xs text-zinc-600 shadow-inner sm:flex">
            <span className="mr-2 text-[10px] text-zinc-400">⌕</span>
            <input
              type="text"
              placeholder="Ask anything about leaves, attendance, policies or your team…"
              className="h-8 flex-1 bg-transparent text-[11px] outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => navigate("/dashboard/hr-admin")}
              className="ml-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-800 disabled:opacity-60"
              disabled={!canOpenCopilot}
              title={!canOpenCopilot ? "Available for staff HR/Admin only" : "Open Copilot"}
            >
              Open Copilot ↗
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {roleLabel}
          </span>

          {displayEmail && (
            <span className="hidden rounded-full bg-zinc-50 px-3 py-1 text-[11px] text-zinc-700 sm:inline">
              {displayEmail}
            </span>
          )}

          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Visible on Profile */}
      {isProfileRoute && (
        <ProfileInsightsStrip kind={kind} onOpenAnalytics={() => navigate(TRAVEL_DASH)} />
      )}

      {/* Dropdown nav */}
      <div className="mx-auto max-w-7xl px-4 pb-3">
        <nav
          className="relative flex items-center justify-center gap-4"
          onMouseLeave={() => setOpenGroupId(null)}
        >
          {groups.map((group) => {
            const isActive = openGroupId === group.id;
            return (
              <div key={group.id} className="relative">
                <GroupTrigger
                  group={group}
                  isActive={isActive}
                  onOpen={() => setOpenGroupId(group.id)}
                />
                {isActive && (
                  <GroupPanel
                    group={group}
                    user={user as any}
                    onClose={() => setOpenGroupId(null)}
                  />
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
