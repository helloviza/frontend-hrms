// apps/frontend/src/components/layout/Header.tsx
import { useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  hasAnyRole,
  Role,
  AnyUser,
  truthy,
  detectUserKind,
  deriveRoleLabel,
  canAccessUserCreation,
  isApprover,
} from "../../lib/rbac";

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
/* Mega menu panel (full-width)                                               */
/* -------------------------------------------------------------------------- */

function MegaPanel({
  groups,
  openGroupId,
  user,
  onClose,
  onPanelEnter,
}: {
  groups: NavGroup[];
  openGroupId: string | null;
  user: any;
  onClose: () => void;
  onPanelEnter: () => void;
}) {
  const activeGroup = groups.find((g) => g.id === openGroupId);
  const visibleItems = activeGroup
    ? activeGroup.items.filter((it) => (it.gate ? it.gate(user) : true))
    : [];

  const isVisible = !!(openGroupId && visibleItems.length);

  return (
    <div
      className={`fixed top-11 left-0 right-0 z-40 transition-all duration-200 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
      onMouseEnter={onPanelEnter}
      onMouseLeave={onClose}
    >
      <div className="backdrop-blur-xl bg-white/90 border-b border-black/5 shadow-2xl shadow-black/10 py-6 px-16">
        <div className="flex items-start flex-wrap gap-x-8 gap-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="text-[13px] text-[#1d1d1f] hover:text-black/50 transition-colors duration-150 py-1 block"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenGroupId(null), 80);
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  return (
    <>
      {/* Fixed header bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/5 h-11 flex items-center px-8"
        onMouseLeave={scheduleClose}
      >
        <div className="relative flex items-center w-full h-full">

          {/* Logo — left */}
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img src="/assets/logo.png" alt="PlumTrips" className="h-6 w-auto" />
          </div>

          {/* Desktop nav — absolute centered */}
          <nav className="hidden lg:flex items-center gap-0 absolute left-1/2 -translate-x-1/2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onMouseEnter={() => { cancelClose(); setOpenGroupId(group.id); }}
                className="text-[12px] font-normal text-[#1d1d1f] hover:text-black/60 px-4 py-2 transition-colors duration-200 cursor-pointer"
              >
                {group.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1d1d1f] text-white text-[10px] font-medium flex items-center justify-center shrink-0">
                {(user as any)?.name?.charAt(0) || (user as any)?.email?.charAt(0) || "U"}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="hidden lg:block text-[12px] text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors"
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
      </header>

      {/* Mega menu panel */}
      <MegaPanel
        groups={groups}
        openGroupId={openGroupId}
        user={user as any}
        onClose={scheduleClose}
        onPanelEnter={cancelClose}
      />

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
    </>
  );
}
