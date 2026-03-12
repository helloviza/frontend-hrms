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
import ResetPassword from "./pages/auth/ResetPassword";
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

// ✅ NEW: Customer proposals inbox
import CustomerProposalsInbox from "./pages/customer/approvals/CustomerProposalsInbox";

// ✅ Public deep-link for email approvals (no login)
import EmailApprovalAction from "./pages/public/EmailApprovalAction";

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
import {
  isVendor,
  isCustomer,
  isApprover,
  isStaffAdmin,
  hasAnyRole,
  canAccessUserCreation,
  truthy,
  AnyUser,
} from "./lib/rbac";

// ✅ Proposals (admin)
import AdminProposalByRequest from "./pages/admin/proposals/AdminProposalByRequest";

// ✅ Voucher Extractor pages
import VoucherExtract from "./pages/customer/vouchers/VoucherExtract";
import AdminVouchers from "./pages/admin/vouchers/AdminVouchers";

// ✅ Copilot (Dedicated Page)
import CopilotPage from "./pages/copilot/CopilotPage";

// ✅ AI Concierge (Travel / Holidays / MICE / Events)
import ConciergePage from "./pages/concierge/ConciergePage";

import Splash from "./pages/Splash";

// ✅ SBT — Self Booking Tool
import SBTFlightSearch from "./pages/sbt/SBTFlightSearch";
import SBTFlightBook from "./pages/sbt/SBTFlightBook";
import SBTFareValidation from "./pages/sbt/SBTFareValidation";
import SBTPassengers from "./pages/sbt/SBTPassengers";
import SBTSeats from "./pages/sbt/SBTSeats";
import SBTExtras from "./pages/sbt/SBTExtras";
import SBTReview from "./pages/sbt/SBTReview";
import SBTConfirmed from "./pages/sbt/SBTConfirmed";
import SBTBookings from "./pages/sbt/SBTBookings";
import SBTHotelSearch from "./pages/sbt/SBTHotelSearch";
// SBTHotelBook removed — old step-wizard replaced by Detail→Guests→Review→Confirmed flow
import SBTHotelDetail from "./pages/sbt/SBTHotelDetail";
import SBTHotelGuests from "./pages/sbt/SBTHotelGuests";
import SBTHotelReview from "./pages/sbt/SBTHotelReview";
import SBTHotelConfirmed from "./pages/sbt/SBTHotelConfirmed";
import SBTHotelBookings from "./pages/sbt/SBTHotelBookings";

// ✅ SBT Two-Tier Flow (L1 Requestor + L2 Booker)
import SBTRequestForm from "./pages/sbt/SBTRequestForm";
import SBTMyRequests from "./pages/sbt/SBTMyRequests";
import SBTInbox from "./pages/sbt/SBTInbox";

// ✅ SBT Admin — Offer Manager
import SBTOfferManager from "./pages/admin/SBTOfferManager";

// ✅ Admin Billing Console
import AdminBilling from "./pages/admin/AdminBilling";

// ✅ Workspace Permissions
const WorkspacePermissions = React.lazy(() => import("./pages/workspace/WorkspacePermissions"));

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

/** Gate: Customers only (Option A: also allow staff admins) */
function CustomerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (isVendor(user as AnyUser)) return <Navigate to="/profile/vendor" replace />;

  // ✅ Option A: Admin/HR can access customer approvals pages too
  const ok = isCustomer(user as AnyUser) || isStaffAdmin(user as AnyUser);
  if (!ok) return <Navigate to="/profile/me" replace />;

  return <>{children}</>;
}

/** Gate: SBT access — sbtEnabled OR Admin/HR bypass */
function SBTGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdminOrHR = hasAnyRole(user as AnyUser, ["Admin", "SuperAdmin", "HR"]);
  if (!isAdminOrHR && !(user as any)?.sbtEnabled) {
    return <Navigate to="/dashboard/employee" replace />;
  }
  return <>{children}</>;
}

/** Gate: SBT L1 Requestor access — sbtRole L1 or BOTH */
function SBTL1Guard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user as any)?.sbtRole;
  if (role !== "L1" && role !== "BOTH") {
    return <Navigate to="/sbt/flights" replace />;
  }
  return <>{children}</>;
}

/** Gate: SBT L2 Booker access — sbtRole L2 or BOTH */
function SBTL2Guard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user as any)?.sbtRole;
  const isWL = hasAnyRole(user as AnyUser, ["WorkspaceLeader"]);
  if (role !== "L2" && role !== "BOTH" && !isWL) {
    return <Navigate to="/sbt/flights" replace />;
  }
  return <>{children}</>;
}

/** Gate: Block sbtEnabled users from approval request flow (they book directly via SBT) */
function ApprovalGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if ((user as any)?.sbtEnabled === true) {
    return <Navigate to="/sbt/flights" replace />;
  }
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
  { path: "/reset-password", element: <ResetPassword /> },

  { path: "/onboarding/:token", element: <PublicOnboarding /> },
  { path: "/onboarding/:token/flow", element: <PublicFlow /> },

  { path: "/ob/:token", element: <PublicOnboarding /> },
  { path: "/invite/:token", element: <PublicOnboarding /> },

  /**
   * ✅ Public email approval deep link (no login)
   */
  { path: "/approval/email", element: <EmailApprovalAction /> },

  /* ================= SPLASH (PROTECTED, NO APP SHELL) ================= */
  {
    path: "/splash",
    element: (
      <Protected>
        <Splash />
      </Protected>
    ),
  },

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
      
      {
  path: "concierge",
  element: (
    <Protected>
      <ConciergePage />
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

      /* -------- ✅ Voucher Extractor (Customer + staff admin via CustomerOnly) -------- */
      {
        path: "customer/vouchers/extract",
        element: (
          <Protected>
            <CustomerOnly>
              <VoucherExtract />
            </CustomerOnly>
          </Protected>
        ),
      },

      /* -------- ✅ Customer Approval Flow (Option A allows staff admins too) -------- */
      {
        path: "customer/approvals/new",
        element: (
          <Protected>
            <CustomerOnly>
              <ApprovalGuard>
                <ApprovalNew />
              </ApprovalGuard>
            </CustomerOnly>
          </Protected>
        ),
      },
      {
        path: "customer/approvals/mine",
        element: (
          <Protected>
            <CustomerOnly>
              <ApprovalGuard>
                <ApprovalMine />
              </ApprovalGuard>
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

      /* ✅ NEW: Customer proposals inbox (customer/staff admin via CustomerOnly) */
      {
        path: "customer/approvals/proposals",
        element: (
          <Protected>
            <CustomerOnly>
              <CustomerProposalsInbox />
            </CustomerOnly>
          </Protected>
        ),
      },

      /* -------- ✅ Booking History -------- */
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

      /* -------- Org Chart & Policies -------- */
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

      /* -------- ✅ Admin Vouchers -------- */
      {
        path: "admin/vouchers",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminVouchers />
          </Protected>
        ),
      },

      /* -------- ✅ Admin Proposals -------- */
      {
        path: "admin/proposals/by-request",
        element: (
          <Protected roles={["Admin", "SuperAdmin", "HR"]}>
            <AdminProposalByRequest />
          </Protected>
        ),
      },

      /* -------- ✅ SBT — Self Booking Tool -------- */
      {
        path: "sbt/flights",
        element: (
          <Protected>
            <SBTGuard>
              <SBTFlightSearch />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book",
        element: (
          <Protected>
            <SBTGuard>
              <SBTFlightBook />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/fare-validation",
        element: (
          <Protected>
            <SBTGuard>
              <SBTFareValidation />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/passengers",
        element: (
          <Protected>
            <SBTGuard>
              <SBTPassengers />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/seats",
        element: (
          <Protected>
            <SBTGuard>
              <SBTSeats />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/extras",
        element: (
          <Protected>
            <SBTGuard>
              <SBTExtras />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/review",
        element: (
          <Protected>
            <SBTGuard>
              <SBTReview />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/book/confirmed",
        element: (
          <Protected>
            <SBTGuard>
              <SBTConfirmed />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/flights/bookings",
        element: (
          <Protected>
            <SBTGuard>
              <SBTBookings />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelSearch />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels/detail",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelDetail />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels/book/guests",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelGuests />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels/book/review",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelReview />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels/book/confirmed",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelConfirmed />
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/hotels/bookings",
        element: (
          <Protected>
            <SBTGuard>
              <SBTHotelBookings />
            </SBTGuard>
          </Protected>
        ),
      },

      /* -------- ✅ SBT Two-Tier Flow (L1 + L2) -------- */
      {
        path: "sbt/request",
        element: (
          <Protected>
            <SBTGuard>
              <SBTL1Guard>
                <SBTRequestForm />
              </SBTL1Guard>
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/my-requests",
        element: (
          <Protected>
            <SBTGuard>
              <SBTL1Guard>
                <SBTMyRequests />
              </SBTL1Guard>
            </SBTGuard>
          </Protected>
        ),
      },
      {
        path: "sbt/inbox",
        element: (
          <Protected>
            <SBTGuard>
              <SBTL2Guard>
                <SBTInbox />
              </SBTL2Guard>
            </SBTGuard>
          </Protected>
        ),
      },

      /* -------- ✅ SBT Admin — Ticket Offer Manager -------- */
      {
        path: "admin/sbt/offers",
        element: (
          <Protected roles={["Admin", "SuperAdmin"]}>
            <SBTOfferManager />
          </Protected>
        ),
      },

      /* -------- ✅ Workspace Permissions -------- */
      {
        path: "workspace/permissions",
        element: (
          <Protected>
            <React.Suspense fallback={<div className="p-8 text-center text-gray-400">Loading…</div>}>
              <WorkspacePermissions />
            </React.Suspense>
          </Protected>
        ),
      },

      /* -------- ✅ Billing (Admin full access / SBT users scoped to own company) -------- */
      {
        path: "admin/billing",
        element: (
          <Protected>
            <AdminBilling />
          </Protected>
        ),
      },

      /* -------- ✅ User Creation -------- */
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
