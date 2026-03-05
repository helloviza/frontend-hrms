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
      { label: "My Workspace", to: "/profile/customer", description: "Your company's travel desk and booking overview" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "Analyse your company's travel spend and patterns" },
      { label: "Company & Billing", to: "/customer/company", description: "Manage company details, billing and invoices" },
      { label: "Contacts & Approvals", to: "/customer/contacts", description: "Manage travel approvers and approval workflows" },
      { label: "Agreements", to: "/customer/agreements", description: "View and manage your corporate travel agreements" },
      { label: "Security", to: "/customer/security", description: "Manage access, passwords and security settings" },
      { label: "Org Chart", to: "/orgchart", description: "Your company's organisational structure" },
      { label: "Policies", to: "/policies", description: "Company travel policies and guidelines" },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    gate: (u) => isCustomer(u) || isApprover(u),
    items: [
      { label: "New Request", to: "/customer/approvals/new", description: "Raise a new travel request for approval" },
      { label: "My Requests", to: "/customer/approvals/mine", description: "Track status of your submitted travel requests" },
      { label: "Approver Inbox", to: "/customer/approvals/inbox", description: "Review and approve pending travel requests" },
    ],
  },
  {
    id: "atelier",
    label: "Vendor",
    gate: isVendor,
    items: [
      { label: "My Vendor Profile", to: "/profile/vendor", description: "Manage your vendor profile and service offerings" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "View booking volumes and revenue analytics" },
      { label: "Org Chart", to: "/orgchart", description: "Your organisation's reporting structure" },
      { label: "Policies", to: "/policies", description: "Service agreements and operational policies" },
    ],
  },
  {
    id: "me",
    label: "My Space",
    gate: isStaff,
    items: [
      { label: "My Profile", to: "/profile/me", description: "Manage your personal details, photo and contact info" },
      { label: "Travel Analytics", to: TRAVEL_DASH, description: "View your booking history and spend patterns" },
      { label: "Punch", to: "/attendance/punch", description: "Record your daily attendance check-in and check-out" },
      { label: "Attendance Reports", to: "/attendance/reports", description: "View your monthly attendance summary and history" },
      { label: "Apply Leave", to: "/leaves/apply", description: "Submit a new leave request for approval" },
      { label: "My Leaves", to: "/leaves/my", description: "Track your leave balance and request history" },
      { label: "Holidays", to: "/holidays", description: "View company holidays and the annual calendar" },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    gate: isStaff,
    items: [
      { label: "Book Flights", to: "/sbt/flights", description: "Search and self-book flights via TBO" },
    ],
  },
  {
    id: "people",
    label: "People",
    gate: (u) => isStaff(u) && staffHas(["Manager", "HR", "Admin", "SuperAdmin"])(u),
    items: [
      { label: "Manager Dashboard", to: "/dashboard/manager", description: "Overview of your team's attendance and leave status" },
      {
        label: "Team Profiles",
        to: "/profile/team",
        description: "View and manage profiles of your direct reports",
        gate: staffHas(["Manager", "HR", "Admin", "SuperAdmin"]),
      },
      {
        label: "Vendor Profiles",
        to: "/profile/vendors",
        description: "Access vendor details, documents and service history",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
      {
        label: "Business Profiles",
        to: "/profile/businesses",
        description: "View corporate client profiles and onboarding documents",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding",
    gate: (u) => isStaff(u) && staffHas(["HR", "Admin", "SuperAdmin"])(u),
    items: [
      { label: "Onboarding Cockpit", to: "/vendors/onboard", description: "Send invitations and track new joinee onboarding" },
      { label: "Pipeline", to: "/vendors/pipeline", description: "Monitor all active onboarding applications and their status" },
      { label: "Master Data", to: "/vendors/master-data", description: "Manage service categories, routes and reference data" },
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
        description: "Full HR dashboard with headcount, leaves and reports",
        gate: staffHas(["HR", "Admin", "SuperAdmin"]),
      },
      { label: "Org Chart", to: "/orgchart", description: "Visual map of your company's reporting structure" },
      { label: "Policies", to: "/policies", description: "Access and manage company HR policies and documents" },
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
        description: "Create new user accounts and assign roles",
      },
    ],
  },
  {
    id: "admin",
    label: "Administrative",
    gate: (u) => isStaff(u) && staffHas(["Admin", "SuperAdmin"])(u),
    items: [
      { label: "Admin Analytics", to: "/admin/analytics", description: "Company-wide travel spend and booking analytics" },
      { label: "Admin Reports", to: "/admin/reports", description: "Download detailed reports for payroll, attendance and leaves" },
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
      <div className="bg-white border-b border-slate-100 shadow-lg shadow-slate-200/80">
        <div className="w-full h-px bg-slate-100" />
        <div className="grid grid-cols-3 gap-x-2 gap-y-0 max-w-3xl mx-auto py-4 px-8">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="group/link block px-4 py-3 rounded-xl hover:bg-[#00477f]/5 transition-colors duration-150 cursor-pointer"
            >
              <div className="border-l-2 border-transparent group-hover/link:border-[#00477f] pl-3 transition-all duration-150">
                <div className="text-[13px] text-slate-800 font-medium group-hover/link:text-[#00477f]">{item.label}</div>
                {item.description && (
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.description}</div>
                )}
              </div>
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
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden xl:flex items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00477f] to-[#0066b3] text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-white shadow-md cursor-pointer select-none uppercase">
                {(user as any)?.name?.charAt(0) || (user as any)?.email?.charAt(0) || "U"}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="hidden lg:flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-full transition-all duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
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
