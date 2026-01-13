// apps/frontend/src/App.tsx
import React, { useMemo } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import { useAuth } from "./context/AuthContext";

type AnyUser = {
  roles?: string[];
  role?: string;
  hrmsAccessRole?: string;
  hrmsAccessLevel?: string;
  userType?: string;
  accountType?: string;

  // vendor/customer flags/ids (backend may vary)
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

  // approver-ish
  approverId?: string;
  approver_id?: string;
  isApprover?: boolean;
  is_approver?: boolean;
  approvalRole?: string;

  [key: string]: any;
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

  // include extra aliases because backend payload varies a lot
  return hasAnyRole(user, ["CUSTOMER", "BUSINESS", "CLIENT", "CORPORATE", "COMPANY", "ORG", "ORGANIZATION"]);
}

function isApprover(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (user.approverId || user.approver_id || truthy(user.isApprover) || truthy(user.is_approver))
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
      "REQUESTER", // some builds attach requester/approver role tokens
    ].includes(r),
  );
}

function isAdmin(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  return hasAnyRole(user, ["ADMIN", "SUPERADMIN", "SUPER_ADMIN", "HR", "HR_ADMIN"]);
}

/**
 * Booking History should be visible to:
 * - Admin/HR/L0/L1/L2 (staff viewers)
 * - Customer (workspace leader / business users)
 * Never to Vendor
 *
 * NOTE: Backend booking-history route typically allows L0/L1/L2/HR/Admin,
 * and in our updated backend we also allow CUSTOMER/BUSINESS scoped view.
 */
function canSeeBookingHistory(user: AnyUser | null | undefined): boolean {
  if (!user) return false;
  if (isVendor(user)) return false;

  // staff viewers
  if (hasAnyRole(user, ["ADMIN", "SUPERADMIN", "SUPER_ADMIN", "HR", "HR_ADMIN", "L0", "L1", "L2"])) {
    return true;
  }

  // customer viewers (scoped)
  if (isCustomer(user)) return true;

  return false;
}

function pillClass(isActive: boolean) {
  return (
    "text-sm px-3 py-1 rounded-full border transition " +
    (isActive
      ? "bg-zinc-900 text-white border-zinc-900"
      : "bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400")
  );
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname || "/";

  // App.tsx only renders under "/" (protected shell).
  // Public routes (/login, /register, /forgot) are outside App in router.tsx.
  const hideShell = false;

  const fullBleedRoutes = ["/profile/customer", "/profile/vendor", "/dashboard/travel-spend"];
  const isFullBleed = fullBleedRoutes.some((p) => path.startsWith(p));
  const hideFooter = hideShell || isFullBleed;

  // Show approvals bar for Customer OR Approver OR Admin, never for Vendor
  const showApprovalsBar = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return isCustomer(user as AnyUser) || isApprover(user as AnyUser) || isAdmin(user as AnyUser);
  }, [hideShell, user]);

  // Show Admin Queue link only if admin-ish
  const showAdminApprovalsLink = useMemo(() => {
    if (hideShell) return false;
    return isAdmin(user as AnyUser);
  }, [hideShell, user]);

  // ✅ Booking History link — independent of approvals bar
  // (Because Booking History is useful even if approvals bar is hidden in future.)
  const showBookingHistoryLink = useMemo(() => {
    if (hideShell) return false;
    return canSeeBookingHistory(user as AnyUser);
  }, [hideShell, user]);

  // Optional: hide customer approvals links if user is not customer
  const showCustomerApprovalLinks = useMemo(() => {
    if (hideShell) return false;
    if (isVendor(user as AnyUser)) return false;
    return isCustomer(user as AnyUser) || isAdmin(user as AnyUser) || isApprover(user as AnyUser);
  }, [hideShell, user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-50">
      <Header />

      {/* Approvals quick-nav */}
      {showApprovalsBar && (
        <div className="w-full border-b border-zinc-200 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
            <span className="text-sm font-semibold text-zinc-700">Approvals</span>

            {showCustomerApprovalLinks && (
              <>
                <NavLink to="/customer/approvals/new" className={({ isActive }) => pillClass(isActive)}>
                  Raise Request
                </NavLink>

                <NavLink to="/customer/approvals/mine" className={({ isActive }) => pillClass(isActive)}>
                  My Requests
                </NavLink>

                <NavLink to="/customer/approvals/inbox" className={({ isActive }) => pillClass(isActive)}>
                  Approver Inbox (L2)
                </NavLink>
              </>
            )}

            {showBookingHistoryLink && (
              <NavLink to="/booking-history" className={({ isActive }) => pillClass(isActive)}>
                Booking History
              </NavLink>
            )}

            {showAdminApprovalsLink && (
              <NavLink to="/admin/approvals" className={({ isActive }) => pillClass(isActive)}>
                Admin Queue
              </NavLink>
            )}
          </div>
        </div>
      )}

      <main
        className={
          hideShell
            ? "py-0 max-w-none bg-white"
            : isFullBleed
              ? "py-0 max-w-none px-0"
              : "mx-auto max-w-7xl px-4 py-8"
        }
      >
        <Outlet />
      </main>

      {!hideFooter && <Footer />}
    </div>
  );
}
