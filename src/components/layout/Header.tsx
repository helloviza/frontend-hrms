// apps/frontend/src/components/layout/Header.tsx
import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasAnyRole, Role } from "../../lib/rbac";

/* -------------------------------------------------------------------------- */
/* Role label map                                                              */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Utility helpers                                                             */
/* -------------------------------------------------------------------------- */

function norm(v: any): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");
}

function truthy(v: any) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function detectUserKind(user: any): "VENDOR" | "CUSTOMER" | "STAFF" | "UNKNOWN" {
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
    (detectUserKind(user) === "CUSTOMER" &&
      upper.includes("CUSTOMER") &&
      !upper.includes("REQUESTER") &&
      !upper.includes("APPROVER"));
  const isRequester = upper.includes("REQUESTER");

  if (kind === "VENDOR") return false;

  if (kind === "STAFF" && hasAnyRole(user as any, ["HR", "Admin", "SuperAdmin"])) {
    return true;
  }

  if (kind === "CUSTOMER") {
    if (approver) return true;
    if (isLeader) return true;
    if (isRequester) return false;
    return false;
  }

  if (approver) return true;

  return false;
}

function deriveRoleLabel(user: any): string {
  if (!user) return LABEL.EMPLOYEE;

  const kind = detectUserKind(user);

  const roles: string[] = [];
  if (Array.isArray(user?.roles)) roles.push(...user.roles);
  if (user?.role) roles.push(user.role);
  if (user?.hrmsAccessRole) roles.push(user.hrmsAccessRole);
  if (user?.hrmsAccessLevel) roles.push(user.hrmsAccessLevel);
  const upper = roles.map(norm);

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

  if (kind === "CUSTOMER") {
    if (approver) return LABEL.APPROVER;
    if (isLeader) return LABEL.CUSTOMER;
    if (isRequester) return LABEL.REQUESTER;
    return LABEL.CUSTOMER;
  }

  if (upper.some((r) => r.includes("SUPERADMIN") || r.includes("SUPER_ADMIN"))) return LABEL.SUPERADMIN;
  if (upper.some((r) => r.includes("ADMIN"))) return LABEL.ADMIN;
  if (upper.some((r) => r.includes("HRADMIN") || r === "HR" || r.includes("HR"))) return LABEL.HR;
  if (upper.some((r) => r.includes("MANAGER"))) return LABEL.MANAGER;

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

const TRAVEL_DASH = "/dashboard/travel-spend";
const ADMIN_USERS = "/admin/users";

const NAV_GROUPS: NavGroup[] = [
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
  {
    id: "atelier",
    label: "Vendor",
    gate: isVendor,
    items: [
      { label: "My Vendor Profile", to: "/profile/vendor", description: "Your service details, docs & compliance" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "Service-wise volume & spend insights" },
      { label: "Org Chart", to: "/orgchart", description: "View reporting structure" },
      { label: "Policies", to: "/policies", description: "Company policy library" },
    ],
  },
  {
    id: "me",
    label: "My Space",
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
    label: "People",
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
    label: "Onboarding",
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

/* -------------------------------------------------------------------------- */
/* Desktop dropdown panel                                                      */
/* -------------------------------------------------------------------------- */

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
      className="absolute left-1/2 top-full z-30 pt-2 w-56 -translate-x-1/2"
      onMouseLeave={onClose}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-48">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `block px-4 py-2 text-sm transition ${
                isActive
                  ? "bg-slate-50 text-[#00477f] font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-[#00477f]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const kind = detectUserKind(user as any);
  const roleLabel = useMemo(() => deriveRoleLabel(user as any), [user]);

  const displayEmail =
    (user as any)?.officialEmail ||
    (user as any)?.email ||
    (user as any)?.profile?.email ||
    (user as any)?.sub ||
    "";

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

  const groups = NAV_GROUPS.filter((g) => g.gate(user as any));

  return (
    <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img src="/assets/logo.png" alt="PlumTrips" className="h-7 w-auto" />
            <span className="font-bold text-[#00477f] text-lg">PlumTrips</span>
          </div>

          {/* Desktop nav */}
          <nav
            className="hidden lg:flex items-center gap-1"
            onMouseLeave={() => setOpenGroupId(null)}
          >
            {groups.map((group) => {
              const isOpen = openGroupId === group.id;
              return (
                <div key={group.id} className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setOpenGroupId(group.id)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isOpen
                        ? "bg-slate-50 text-[#00477f]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#00477f]"
                    }`}
                  >
                    {group.label}
                    <span className={`text-[9px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {isOpen && (
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

          {/* Right side: user info + sign out + hamburger */}
          <div className="flex items-center gap-4">
            <div className="hidden xl:flex flex-col items-end">
              <span className="text-xs font-medium text-slate-400">{roleLabel}</span>
              <span className="text-sm text-slate-500">{displayEmail}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="hidden lg:block text-sm text-red-500 hover:text-red-700 transition font-medium"
            >
              Sign Out
            </button>
            {/* Hamburger — mobile only */}
            <button
              type="button"
              className="lg:hidden text-slate-600 text-2xl leading-none"
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed top-0 left-0 h-full w-64 bg-white z-50 p-4 shadow-xl overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-[#00477f]">PlumTrips</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-slate-500 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 border-b border-slate-100 pb-4">
            <p className="text-xs text-slate-400">{roleLabel}</p>
            <p className="text-sm text-slate-600 truncate">{displayEmail}</p>
          </div>

          <nav className="flex flex-col gap-4">
            {groups.map((group) => {
              const visibleItems = group.items.filter((it) => (it.gate ? it.gate(user as any) : true));
              if (!visibleItems.length) return null;
              return (
                <div key={group.id}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 px-3">
                    {group.label}
                  </p>
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-100 text-[#00477f]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-[#00477f]"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => { logout(); setMobileOpen(false); }}
            className="mt-6 w-full text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg py-2 transition"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
