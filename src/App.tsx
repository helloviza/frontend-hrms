// apps/frontend/src/App.tsx
import React, { useMemo } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";

import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import { useAuth } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AnyUser = {
  roles?: string[];
  role?: string;
  hrmsAccessRole?: string;
  hrmsAccessLevel?: string;
  userType?: string;
  accountType?: string;

  vendorId?: string;
  vendor_id?: string;
  vendorProfileId?: string;
  vendorProfile?: any;
  vendor?: any;
  isVendor?: boolean;
  is_vendor?: boolean;

  businessId?: string;
  business_id?: string;
  customerId?: string;
  customer_id?: string;
  business?: any;
  customer?: any;
  isCustomer?: boolean;
  is_customer?: boolean;
  isBusiness?: boolean;
  is_business?: boolean;

  approverId?: string;
  approver_id?: string;
  isApprover?: boolean;
  is_approver?: boolean;
  approvalRole?: string;

  [key: string]: any;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
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

function hasAnyRole(user: AnyUser | null | undefined, roles: string[]): boolean {
  const userRoles = collectRoles(user);
  const wanted = roles.map(norm);
  return userRoles.some((r) => wanted.includes(r));
}

function isVendor(user: AnyUser | null | undefined): boolean {
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
  return hasAnyRole(user, ["VENDOR"]);
}

function isCustomer(user: AnyUser | null | undefined): boolean {
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
  return hasAnyRole(user, [
    "CUSTOMER",
    "BUSINESS",
    "CLIENT",
    "CORPORATE",
    "COMPANY",
    "ORG",
    "ORGANIZATION",
  ]);
}

function isApprover(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (
    user.approverId ||
    user.approver_id ||
    truthy(user.isApprover) ||
    truthy(user.is_approver)
  )
    return true;

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

function isAdmin(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  return hasAnyRole(user, ["ADMIN", "SUPERADMIN", "SUPER_ADMIN"]);
}

function isStaffAdmin(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  return hasAnyRole(user, [
    "ADMIN",
    "SUPERADMIN",
    "SUPER_ADMIN",
    "HR",
    "HR_ADMIN",
    "OPS",
    "OPS_ADMIN",
  ]);
}

function canSeeBookingHistory(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (isVendor(user)) return false;

  if (
    hasAnyRole(user, [
      "ADMIN",
      "SUPERADMIN",
      "SUPER_ADMIN",
      "HR",
      "HR_ADMIN",
      "L0",
      "L1",
      "L2",
    ])
  ) {
    return true;
  }

  if (isCustomer(user)) return true;
  return false;
}

function pillClass(isActive: boolean) {
  return (
    "text-sm px-3 py-1 rounded-full border transition " +
    (isActive
      ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
      : "bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50")
  );
}

/* -------------------------------------------------------------------------- */
/* App Shell                                                                  */
/* -------------------------------------------------------------------------- */

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname || "/";

  // Check if we are in the Pluto Concierge to hide the global shell
  const isConcierge = path.startsWith("/concierge");

  // Logic to hide Shell components
  const hideShell = isConcierge;

  const fullBleedRoutes = [
    "/profile/customer",
    "/profile/vendor",
    "/dashboard/travel-spend",
  ];
  const isFullBleed = fullBleedRoutes.some((p) => path.startsWith(p));
  const hideFooter = hideShell || isFullBleed;

  const showApprovalsBar = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return (
      isCustomer(user as AnyUser) ||
      isApprover(user as AnyUser) ||
      isAdmin(user as AnyUser)
    );
  }, [hideShell, user]);

  const showAdminLinks = useMemo(() => {
    if (hideShell) return false;
    return isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  const showBookingHistoryLink = useMemo(() => {
    if (hideShell) return false;
    return canSeeBookingHistory(user as AnyUser);
  }, [hideShell, user]);

  const showCustomerApprovalLinks = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return isCustomer(user as AnyUser) || isStaffAdmin(user as AnyUser);
  }, [hideShell, user]);

  // Find this block in App.tsx and update it:
const showCustomerProposalsLink = useMemo(() => {
  if (hideShell) return false;
  if (isVendor(user as AnyUser)) return false;

  // Ensure L0, L1, L2 are treated as "Customer" or authorized here
  const hasProposalRole = hasAnyRole(user as AnyUser, ["L0", "L1", "L2", "CUSTOMER"]);
  
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

  // ✅ Voucher pages (as requested): Admin / SuperAdmin ONLY
  const showVoucherLinksAdminOnly = useMemo(() => {
    if (hideShell) return false;
    return isAdmin(user as AnyUser);
  }, [hideShell, user]);

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* 1. Global Header (Hidden in Concierge) */}
      {/* FIX: Wrapped Header in a relative z-50 container so dropdowns float above the sub-nav */}
      {!hideShell && (
        <div className="relative z-50">
          <Header />
        </div>
      )}

      {/* 2. Global Approvals Bar (Hidden in Concierge) */}
      {/* Reduced z-40 to z-30 here to guarantee it stays below the Header */}
      {showApprovalsBar && (
        <div className="w-full border-b border-zinc-200 bg-white/70 backdrop-blur-md sticky top-0 z-30">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest mr-2">
              System
            </span>

            {showPlutoLink && (
              <NavLink to="/concierge" className={({ isActive }) => pillClass(isActive)}>
                ✨ Plan with Pluto.ai
              </NavLink>
            )}

            <div className="h-4 w-px bg-zinc-200 mx-1" />

            {showCustomerApprovalLinks && (
              <>
                <NavLink
                  to="/customer/approvals/new"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  Raise Request
                </NavLink>

                <NavLink
                  to="/customer/approvals/mine"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  My Requests
                </NavLink>

                <NavLink
                  to="/customer/approvals/inbox"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  Approver Inbox
                </NavLink>

                {/* ✅ ADD THIS LINK BELOW */}
    {showCustomerProposalsLink && (
      <NavLink to="/customer/approvals/proposals" className={({ isActive }) => pillClass(isActive)}>
        Proposals
      </NavLink>
    )}
              </>
            )}

            {/* ✅ Voucher Extractor + Admin Vouchers (Admin/SuperAdmin only) */}
            {showVoucherLinksAdminOnly && (
              <>
                <NavLink
                  to="/customer/vouchers/extract"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  Voucher Extract
                </NavLink>

                <NavLink
                  to="/admin/vouchers"
                  className={({ isActive }) => pillClass(isActive)}
                >
                  Admin Vouchers
                </NavLink>
              </>
            )}

            {showBookingHistoryLink && (
              <NavLink to="/booking-history" className={({ isActive }) => pillClass(isActive)}>
                History
              </NavLink>
            )}

            {showAdminLinks && (
              <NavLink to="/admin/approvals" className={({ isActive }) => pillClass(isActive)}>
                Admin Queue
              </NavLink>
            )}
          </div>
        </div>
      )}

      {/* 3. Main Outlet */}
      <main
        className={
          hideShell
            ? "h-screen w-screen overflow-hidden bg-white" // Full bleed for Concierge
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