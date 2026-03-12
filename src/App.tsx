// apps/frontend/src/App.tsx
import React, { useMemo } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";

import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import { useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  Sparkles,
  PlusCircle,
  ClipboardList,
  Inbox,
  FileText,
  Receipt,
  BookMarked,
  History,
  ListChecks,
  ShieldCheck,
  Send,
  FolderOpen,
} from "lucide-react";
import {
  isVendor,
  isCustomer,
  isApprover,
  isStaffAdmin,
  hasAnyRole,
  truthy,
  AnyUser,
  detectUserKind,
} from "./lib/rbac";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isAdmin(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  return hasAnyRole(user, ["Admin", "SuperAdmin"]);
}

function canSeeBookingHistory(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (isVendor(user)) return false;

  if (hasAnyRole(user, ["Admin", "SuperAdmin", "HR", "L0", "L1", "L2"])) {
    return true;
  }

  if (isCustomer(user)) return true;
  return false;
}

const pillClass = (active: boolean) =>
  [
    "flex items-center gap-1",
    "text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors duration-150",
    "whitespace-nowrap flex-shrink-0 cursor-pointer",
    active
      ? "bg-[#00477f] text-white"
      : "text-gray-600 hover:bg-gray-100",
  ].join(" ");

/* -------------------------------------------------------------------------- */
/* App Shell                                                                  */
/* -------------------------------------------------------------------------- */

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname || "/";

  const isConcierge = path.startsWith("/concierge");

  // SBTFlightBook/SBTHotelBook own their full viewport — same treatment as Concierge.
  // They render their own dark 60px header, so global shell must be completely hidden.
  const isSBTBook =
    path === "/sbt/flights/book" ||
    path.startsWith("/sbt/flights/book/") ||
    path === "/sbt/hotels/book";

  // SBTFlightSearch/SBTHotelSearch keep the global top-bar but lose approvals bar + footer.
  const isSBTSearch =
    path === "/sbt/flights" || path.startsWith("/sbt/flights?") ||
    path === "/sbt/hotels"  || path.startsWith("/sbt/hotels?");

  // Catch-all for any future /sbt/ sub-paths
  const isSBTOther = !isSBTBook && !isSBTSearch && path.startsWith("/sbt/");
  const isSBT = isSBTSearch || isSBTOther;

  const hideShell = isConcierge || isSBTBook;

  const fullBleedRoutes = [
    "/profile/customer",
    "/profile/vendor",
    "/dashboard/travel-spend",
  ];
  const isFullBleed = fullBleedRoutes.some((p) => path.startsWith(p)) || isSBT;
  const hideFooter = hideShell || isFullBleed;

  const showApprovalsBar = useMemo(() => {
    if (hideShell) return false;
    if (isSBT) return false;
    if (isVendor(user as AnyUser)) return false;
    return (
      isCustomer(user as AnyUser) ||
      isApprover(user as AnyUser) ||
      isAdmin(user as AnyUser)
    );
  }, [hideShell, isSBT, user]);

  const showAdminLinks = useMemo(() => {
    if (hideShell) return false;
    return isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  const showBookingHistoryLink = useMemo(() => {
    if (hideShell) return false;
    if ((user as any)?.sbtEnabled === true) return false;
    return canSeeBookingHistory(user as AnyUser);
  }, [hideShell, user]);

  const showCustomerApprovalLinks = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    if ((user as any)?.sbtEnabled === true) return false;
    return isCustomer(user as AnyUser) || isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  const showApproverInboxLink = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return isApprover(user as AnyUser) || hasAnyRole(user as AnyUser, ["Admin", "SuperAdmin", "HR"]);
  }, [hideShell, user]);

  // Find this block in App.tsx and update it:
const showCustomerProposalsLink = useMemo(() => {
  if (hideShell) return false;
  if (isVendor(user as AnyUser)) return false;

  // Ensure L0, L1, L2 are treated as "Customer" or authorized here
  const hasProposalRole = hasAnyRole(user as AnyUser, ["L0", "L1", "L2", "Customer"]);
  
  // Allow if they have the role OR if they are a staff admin 
  // (since staff admins can access CustomerOnly routes in router.tsx)
  return hasProposalRole || isStaffAdmin(user as AnyUser);
}, [hideShell, user]);

  const showAdminProposalsLink = useMemo(() => {
    if (hideShell) return false;
    if (!isStaffAdmin(user as AnyUser)) return false;
    return path.startsWith("/admin/proposals");
  }, [hideShell, user, path]);

  const showCustomerVoucherExtractorLink = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return isCustomer(user as AnyUser) || isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  const showAdminVouchersLink = useMemo(() => {
    if (hideShell) return false;
    return isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  const showBillingLink = useMemo(() => {
    if (hideShell) return false;
    return (user as any)?.sbtEnabled === true || hasAnyRole(user as AnyUser, ["Admin", "SuperAdmin", "HR"]);
  }, [hideShell, user]);

  // ✨ Plan with Pluto.ai — visible to everyone
  const showPlutoLink = useMemo(() => {
    if (hideShell) return false;
    return true;
  }, [hideShell]);

  // 🤖 Copilot — Admin / SuperAdmin ONLY
  const showCopilotLink = useMemo(() => {
    if (hideShell) return false;
    return isAdmin(user as AnyUser);
  }, [hideShell, user]);

  // ✅ SBT Two-Tier Flow chips
  const showSBTL1Chips = useMemo(() => {
    if (hideShell) return false;
    const role = (user as any)?.sbtRole;
    return role === "L1" || role === "BOTH";
  }, [hideShell, user]);

  const showSBTL2Chip = useMemo(() => {
    if (hideShell) return false;
    const role = (user as any)?.sbtRole;
    if (role === "L2" || role === "BOTH") return true;
    // Workspace Leader is implicit L2
    return hasAnyRole(user as AnyUser, ["WorkspaceLeader"]);
  }, [hideShell, user]);

  // ✅ Workspace Permissions: Admin/HR/SuperAdmin + WORKSPACE_LEADER
  const showPermissionsLink = useMemo(() => {
    if (hideShell) return false;
    if (hasAnyRole(user as AnyUser, ["Admin", "SuperAdmin", "HR"])) return true;
    if (detectUserKind(user as AnyUser) === "CUSTOMER") {
      const roles = (Array.isArray((user as any)?.roles) ? (user as any).roles : [(user as any)?.role])
        .map((r: any) => String(r || "").toUpperCase().replace(/[\s\-_]/g, ""));
      return roles.some((r: string) => r === "WORKSPACELEADER" || r === "WORKSPACE_LEADER");
    }
    return false;
  }, [hideShell, user]);

  // ✅ Voucher pages (as requested): Admin / SuperAdmin ONLY
  const showVoucherLinksAdminOnly = useMemo(() => {
    if (hideShell) return false;
    return isAdmin(user as AnyUser);
  }, [hideShell, user]);

  return (
    <ErrorBoundary>
    <div className={`min-h-screen bg-zinc-50 font-sans selection:bg-indigo-100 selection:text-indigo-900${!hideShell ? " pt-12" : ""}`}>

      {/* 1. Global Header (Hidden in Concierge) */}
      {!hideShell && <Header />}

      {/* 2. Global Approvals Bar (Hidden in Concierge) */}
      {showApprovalsBar && (
        <div className="w-full bg-white sticky top-12 z-30 border-b-2 border-slate-100 overflow-hidden">
          <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide w-full">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mr-1 whitespace-nowrap flex-shrink-0 border-r border-slate-200 pr-2">
              ⚙ Control
            </span>

            {showPlutoLink && (
              <NavLink
                to="/concierge"
                className={({ isActive }) => pillClass(isActive)}
              >
                <Sparkles size={12} className="flex-shrink-0" />
                Plan with Pluto.ai
              </NavLink>
            )}

            <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0 opacity-60" />

            {showCustomerApprovalLinks && (
              <>
                <NavLink
                  to="/customer/approvals/new"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  <PlusCircle size={12} className="flex-shrink-0" />
                  Raise Request
                </NavLink>

                <NavLink
                  to="/customer/approvals/mine"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  <ClipboardList size={12} className="flex-shrink-0" />
                  My Requests
                </NavLink>

                {showCustomerProposalsLink && (
                  <NavLink to="/customer/approvals/proposals" className={({ isActive }) => pillClass(isActive)}>
                    <FileText size={12} className="flex-shrink-0" />
                    Proposals
                  </NavLink>
                )}
              </>
            )}

            {showApproverInboxLink && (
              <NavLink
                to="/customer/approvals/inbox"
                className={({ isActive }) => pillClass(isActive)}
              >
                <Inbox size={12} className="flex-shrink-0" />
                Approver Inbox
              </NavLink>
            )}

            {showVoucherLinksAdminOnly && (
              <>
                <NavLink
                  to="/customer/vouchers/extract"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  <Receipt size={12} className="flex-shrink-0" />
                  Voucher Extract
                </NavLink>

                <NavLink
                  to="/admin/vouchers"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  <BookMarked size={12} className="flex-shrink-0" />
                  Admin Vouchers
                </NavLink>
              </>
            )}

            {showBookingHistoryLink && (
              <NavLink to="/booking-history" className={({ isActive }) => pillClass(isActive)}>
                <History size={12} className="flex-shrink-0" />
                History
              </NavLink>
            )}

            {showAdminLinks && (
              <NavLink to="/admin/approvals" className={({ isActive }) => pillClass(isActive)}>
                <ListChecks size={12} className="flex-shrink-0" />
                Admin Queue
              </NavLink>
            )}

            {showBillingLink && (
              <NavLink to="/admin/billing" className={({ isActive }) => pillClass(isActive)}>
                <Receipt size={12} className="flex-shrink-0" />
                Billing
              </NavLink>
            )}

            {showPermissionsLink && (
              <NavLink to="/workspace/permissions" className={({ isActive }) => pillClass(isActive)}>
                <ShieldCheck size={12} className="flex-shrink-0" />
                Permissions
              </NavLink>
            )}

            {showSBTL1Chips && (
              <>
                <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0 opacity-60" />
                <NavLink to="/sbt/request" className={({ isActive }) => pillClass(isActive)}>
                  <Send size={12} className="flex-shrink-0" />
                  Raise Request
                </NavLink>
                <NavLink to="/sbt/my-requests" className={({ isActive }) => pillClass(isActive)}>
                  <FolderOpen size={12} className="flex-shrink-0" />
                  My Requests
                </NavLink>
              </>
            )}

            {showSBTL2Chip && (
              <NavLink to="/sbt/inbox" className={({ isActive }) => pillClass(isActive)}>
                <Inbox size={12} className="flex-shrink-0" />
                Booking Inbox
              </NavLink>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Outlet */}
      <main
        className={
          hideShell
            ? (isConcierge ? "h-screen w-screen overflow-hidden" : "w-screen min-h-screen") // Concierge: full bleed locked; SBT Book: scrollable
            : isFullBleed
              ? "py-0 max-w-none px-0 min-h-[calc(100vh-140px)]"
              : "mx-auto max-w-7xl px-4 py-8 min-h-[calc(100vh-140px)]"
        }
      >
        <Outlet />
      </main>

      {/* 4. Global Footer (Hidden in Concierge) */}
      {!hideFooter && <Footer />}
    </div>
    </ErrorBoundary>
  );
}