// apps/frontend/src/router/Protected.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../lib/rbac";
import { hasAnyRole } from "../lib/rbac";

export default function Protected({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Checking access…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // ✅ Now supports SUPER_ADMIN / HR_ADMIN etc coming from backend,
  // because hasAnyRole() reads user.roles + user.role + hrmsAccessRole + userType...
  const ok = hasAnyRole(user, roles);

  if (!ok) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 text-center">
        <h2 className="text-xl font-semibold text-ink mb-2">No access</h2>
        <p className="text-sm text-zinc-600">
          Your account doesn’t have permission to view this page.
        </p>
      </div>
    );
  }

  return children;
}
