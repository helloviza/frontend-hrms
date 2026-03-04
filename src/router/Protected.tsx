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
      <div className="flex h-screen items-center justify-center text-zinc-500">
        Checking access…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // ✅ If roles are NOT specified, allow any authenticated user
  const requiresRoles = Array.isArray(roles) && roles.length > 0;
  const ok = requiresRoles ? hasAnyRole(user, roles) : true;

  if (!ok) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h2 className="mb-2 text-xl font-semibold text-zinc-900">No access</h2>
        <p className="text-sm text-zinc-600">
          Your account doesn’t have permission to view this page.
        </p>
      </div>
    );
  }

  return children;
}
