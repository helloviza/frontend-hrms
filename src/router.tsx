// apps/frontend/src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

// Auth / context
import { useAuth } from "./context/AuthContext";

// Public pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Forgot from "./pages/auth/Forgot";
import PublicOnboarding from "./pages/onboarding/Public";
import PublicFlow from "./pages/onboarding/PublicFlow";



// Protected pages
import MyProfile from "./pages/profile/MyProfile";
import EmployeeDash from "./pages/dashboard/Employee";
import ManagerDash from "./pages/dashboard/Manager";
import HrAdminDash from "./pages/dashboard/HrAdmin";

// ✅ PowerBI-style Dashboard (Google Sheet CSV)
import TravelSpendDashboard from "./pages/dashboard/TravelSpendDashboard";

import Punch from "./pages/attendance/Punch";
import AttReports from "./pages/attendance/Reports";

import LeaveApply from "./pages/leaves/Apply";
import MyLeaves from "./pages/leaves/MyLeaves";
import TeamApprovals from "./pages/leaves/TeamApprovals";
import AdminLeaveAllocation from "./pages/leaves/AdminLeaveAllocation";

// Profiles / lists
import TeamProfiles from "./pages/profile/TeamProfiles";

// HRMS master views for vendors & business customers
import VendorProfiles from "./pages/profile/VendorProfiles";
import BusinessProfiles from "./pages/profile/BusinessProfiles";

// Self-service-style profile views
import MyProfileVendor from "./pages/profile/MyProfileVendor";
import MyProfileCustomer from "./pages/profile/MyProfileCustomer";

// ✅ Customer dedicated pages (Workspace Leader)
import CustomerCompanyBilling from "./pages/customer/CustomerCompanyBilling";
import CustomerContactsApprovers from "./pages/customer/CustomerContactsApprovers";
import CustomerAgreements from "./pages/customer/CustomerAgreements";
import CustomerSecurity from "./pages/customer/CustomerSecurity";

// ✅ Approval Flow (Customer-only)
import ApprovalNew from "./pages/customer/approvals/ApprovalNew";
import ApprovalMine from "./pages/customer/approvals/ApprovalMine";
import ApproverInbox from "./pages/customer/approvals/ApproverInbox";

// ✅ Public deep-link for email approvals (no login)
import EmailApprovalAction from "./pages/public/EmailApprovalAction";

// ✅ Optional: if you keep a dedicated page in /pages/approvals,
// you can render it from EmailApprovalAction; router does NOT need to import it.
// import ApprovalEmail from "./pages/approvals/ApprovalEmail";

import VendorsOnboard from "./pages/vendors/Onboard";
import VendorsPipeline from "./pages/vendors/Pipeline";
import MasterData from "./pages/vendors/MasterData";

import Holidays from "./pages/holidays/Holidays";
import AdminHolidayManagement from "./pages/holidays/AdminHolidayManagement";

import OrgChart from "./pages/hr/OrgChart";
import Policies from "./pages/hr/Policies";

import AdminAnalytics from "./pages/admin/Analytics";
import AdminReports from "./pages/admin/Reports";

// ✅ Admin approvals queue (manager-approved → ticketing/admin ops)
import AdminApprovalQueue from "./pages/admin/approvals/AdminApprovalQueue";

// ✅ User creation module
import UserCreation from "./pages/admin/UserCreation";

// ✅ Booking History (L0/L1/L2/HR/Admin) — mounted as /booking-history
import BookingHistory from "./pages/approvals/BookingHistory";

import Protected from "./router/Protected";

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

type AnyUser = {
  roles?: string[];
  hrmsAccessRole?: string;
  role?: string;
  hrmsAccessLevel?: string;
  userType?: string;
  accountType?: string;

  // optional vendor/customer flags/ids (backend may vary)
  vendorId?: string;
  vendor_id?: string;
  vendorProfileId?: string;
  vendorProfile?: any;
  vendor?: any;

  businessId?: string;
  business_id?: string;
  customerId?: string;
  customer_id?: string;
  business?: any;
  customer?: any;

  isVendor?: boolean;
  is_vendor?: boolean;
  isCustomer?: boolean;
  is_customer?: boolean;
  isBusiness?: boolean;
  is_business?: boolean;

  // approver-ish signals (backend may vary)
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

  if (user.hrmsAccessRole) out.push(user.hrmsAccessRole);
  if (user.role) out.push(user.role);

  // optional type-ish fields
  if (user.userType) out.push(user.userType);
  if (user.accountType) out.push(user.accountType);
  if (user.hrmsAccessLevel) out.push(user.hrmsAccessLevel);

  // approver role field if present
  if (user.approvalRole) out.push(user.approvalRole);

  return out.map(norm).filter(Boolean);
}

function hasAnyRole(user: AnyUser | null | undefined, roles: string[]): boolean {
  const userRoles = collectRoles(user);
  const wanted = roles.map(norm);
  return userRoles.some((r) => wanted.includes(r));
}

/**
 * Detect "Vendor" even if roles are wrong
 */
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

/**
 * Detect "Customer/Business" even if roles are wrong
 */
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
    "ORGANIZATION",
    "ORG",
  ]);
}

/**
 * Detect Approver (works for Staff or Customer approvers)
 */
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
    ].includes(r),
  );
}

/**
 * ✅ Who can access User Creation:
 * HR / Admin / SuperAdmin + Workspace Leader (Customer) + Approver
 *
 * NOTE: We intentionally treat any "Customer persona" as eligible to SEE the page,
 * because backend will still enforce fine-grained rules (Requester blocked, etc.).
 */
function canAccessUserCreation(user: AnyUser | null | undefined): boolean {
  if (!user) return false;

  // Block vendors always
  if (isVendor(user)) return false;

  // Staff privileged
  if (hasAnyRole(user, ["HR", "ADMIN", "SUPERADMIN", "SUPER_ADMIN"])) return true;

  // Customer + Approver should see it
  if (isCustomer(user)) return true;
  if (isApprover(user)) return true;

  return false;
}

/* -------------------------------------------------------------------------- */
/* Route selectors                                                            */
/* -------------------------------------------------------------------------- */

function HomeIndexRoute() {
  const { user } = useAuth();

  // Persona landing
  if (isVendor(user as AnyUser)) return <MyProfileVendor />;
  if (isCustomer(user as AnyUser)) return <MyProfileCustomer />;

  return <MyProfile />;
}

function ProfileMeRoute() {
  const { user } = useAuth();

  if (isVendor(user as AnyUser)) return <Navigate to="/profile/vendor" replace />;
  if (isCustomer(user as AnyUser)) return <Navigate to="/profile/customer" replace />;

  return <MyProfile />;
}

function ProfileCustomerRoute() {
  const { user } = useAuth();

  if (isVendor(user as AnyUser)) return <Navigate to="/profile/vendor" replace />;
  if (!isCustomer(user as AnyUser)) return <Navigate to="/profile/me" replace />;

  return <MyProfileCustomer />;
}

function ProfileVendorRoute() {
  const { user } = useAuth();

  if (isCustomer(user as AnyUser)) return <Navigate to="/profile/customer" replace />;
  if (!isVendor(user as AnyUser)) return <Navigate to="/profile/me" replace />;

  return <MyProfileVendor />;
}

/** Gate: Customers only */
function CustomerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (isVendor(user as AnyUser)) return <Navigate to="/profile/vendor" replace />;
  if (!isCustomer(user as AnyUser)) return <Navigate to="/profile/me" replace />;
  return <>{children}</>;
}

/** ✅ Gate: User creation allowed (HR/Admin/SuperAdmin + Customer + Approver) */
function UserCreationOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (isVendor(user as AnyUser)) return <Navigate to="/profile/vendor" replace />;
  if (!canAccessUserCreation(user as AnyUser)) return <Navigate to="/profile/me" replace />;

  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/* Router                                                                     */
/* -------------------------------------------------------------------------- */

const router = createBrowserRouter([
  /* ================= PUBLIC ROUTES ================= */
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot", element: <Forgot /> },

  { path: "/onboarding/:token", element: <PublicOnboarding /> },
  { path: "/onboarding/:token/flow", element: <PublicFlow /> },

  { path: "/ob/:token", element: <PublicOnboarding /> },
  { path: "/invite/:token", element: <PublicOnboarding /> },

  /**
   * ✅ Public email approval deep link (no login)
   * IMPORTANT:
   * - This path MUST match what backend emails generate (FRONTEND_PUBLIC_URL + EMAIL_APPROVAL_PATH).
   * - This page should call POST /api/approvals/email/consume (backend).
   */
  { path: "/approval/email", element: <EmailApprovalAction /> },

  /* ================= APP SHELL (PROTECTED) ================= */
  {
    path: "/",
    element: <App />,
    children: [
      /* -------- Default Home / Index -------- */
      {
        index: true,
        element: (
          <Protected>
            <HomeIndexRoute />
          </Protected>
        ),
      },

      /* -------- Dashboards -------- */
      {
        path: "dashboard/employee",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <EmployeeDash />
          </Protected>
        ),
      },
      {
        path: "dashboard/manager",
        element: (
          <Protected roles={["Manager", "HR", "Admin"]}>
            <ManagerDash />
          </Protected>
        ),
      },
      {
        path: "dashboard/hr-admin",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <HrAdminDash />
          </Protected>
        ),
      },

      /* -------- ✅ PowerBI-style Travel Spend Dashboard -------- */
      {
        path: "dashboard/travel-spend",
        element: (
          <Protected>
            <TravelSpendDashboard />
          </Protected>
        ),
      },

      /* -------- Attendance -------- */
      {
        path: "attendance/punch",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <Punch />
          </Protected>
        ),
      },
      {
        path: "attendance/reports",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <AttReports />
          </Protected>
        ),
      },

      /* -------- Leaves -------- */
      {
        path: "leaves/apply",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <LeaveApply />
          </Protected>
        ),
      },
      {
        path: "leaves/my",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <MyLeaves />
          </Protected>
        ),
      },
      {
        path: "leaves/team",
        element: (
          <Protected roles={["Manager", "HR", "Admin"]}>
            <TeamApprovals />
          </Protected>
        ),
      },
      {
        path: "leaves/admin/allocation",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminLeaveAllocation />
          </Protected>
        ),
      },

      /* -------- Profiles -------- */
      {
        path: "profile",
        element: (
          <Protected>
            <Navigate to="/profile/me" replace />
          </Protected>
        ),
      },
      {
        path: "profile/me",
        element: (
          <Protected>
            <ProfileMeRoute />
          </Protected>
        ),
      },
      {
        path: "profile/team",
        element: (
          <Protected roles={["Manager", "HR", "Admin"]}>
            <TeamProfiles />
          </Protected>
        ),
      },
      {
        path: "profile/vendor",
        element: (
          <Protected>
            <ProfileVendorRoute />
          </Protected>
        ),
      },
      {
        path: "profile/customer",
        element: (
          <Protected>
            <ProfileCustomerRoute />
          </Protected>
        ),
      },

      /* -------- HR master views -------- */
      {
        path: "profile/vendors",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <VendorProfiles />
          </Protected>
        ),
      },
      {
        path: "profile/businesses",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <BusinessProfiles />
          </Protected>
        ),
      },

      /* -------- ✅ Customer Dedicated Pages (Customer-only) -------- */
      {
        path: "customer/company",
        element: (
          <Protected>
            <CustomerOnly>
              <CustomerCompanyBilling />
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/contacts",
        element: (
          <Protected>
            <CustomerOnly>
              <CustomerContactsApprovers />
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/agreements",
        element: (
          <Protected>
            <CustomerOnly>
              <CustomerAgreements />
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/security",
        element: (
          <Protected>
            <CustomerOnly>
              <CustomerSecurity />
            </CustomerOnly>
          </Protected>
        ),
      },

      /* -------- ✅ Customer Approval Flow (Customer-only) -------- */
      {
        path: "customer/approvals/new",
        element: (
          <Protected>
            <CustomerOnly>
              <ApprovalNew />
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/approvals/mine",
        element: (
          <Protected>
            <CustomerOnly>
              <ApprovalMine />
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/approvals/inbox",
        element: (
          <Protected>
            <CustomerOnly>
              <ApproverInbox />
            </CustomerOnly>
          </Protected>
        ),
      },

      /* -------- ✅ Booking History (L0/L1/L2/HR/Admin) -------- */
      {
        path: "booking-history",
        element: (
          <Protected>
            <BookingHistory />
          </Protected>
        ),
      },

      /* -------- Vendors module -------- */
      {
        path: "vendors/onboard",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <VendorsOnboard />
          </Protected>
        ),
      },
      {
        path: "vendors/pipeline",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <VendorsPipeline />
          </Protected>
        ),
      },
      {
        path: "vendors/master-data",
        element: (
          <Protected roles={["HR", "Admin"]}>
            <MasterData />
          </Protected>
        ),
      },

      /* -------- Holidays -------- */
      {
        path: "holidays",
        element: (
          <Protected roles={["Employee", "Manager", "HR", "Admin"]}>
            <Holidays />
          </Protected>
        ),
      },
      {
        path: "holidays/admin",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminHolidayManagement />
          </Protected>
        ),
      },

      /* -------- Org Chart & Policies (Auth-only for ALL personas) -------- */
      {
        path: "orgchart",
        element: (
          <Protected>
            <OrgChart />
          </Protected>
        ),
      },
      {
        path: "policies",
        element: (
          <Protected>
            <Policies />
          </Protected>
        ),
      },

      /* -------- Admin analytics & reports -------- */
      {
        path: "admin/analytics",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminAnalytics />
          </Protected>
        ),
      },
      {
        path: "admin/approvals",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminApprovalQueue />
          </Protected>
        ),
      },
      {
        path: "admin/reports",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminReports />
          </Protected>
        ),
      },

      /* -------- ✅ User Creation (HR/Admin/SuperAdmin + Customer + Approver) -------- */
      {
        path: "admin/users",
        element: (
          <Protected>
            <UserCreationOnly>
              <UserCreation />
            </UserCreationOnly>
          </Protected>
        ),
      },
    ],
  },

  /* ================= CATCH-ALL ================= */
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default router;
