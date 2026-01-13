// apps/frontend/src/components/RequireAuth.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type RequireAuthProps = {
  children: React.ReactNode;
  allowed?: string[]; // optional allowed roles (e.g., ["ADMIN"])
};

export default function RequireAuth({ children, allowed }: RequireAuthProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Checking access…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Normalize case for safety
  const userRoles = (user.roles || []).map((r) => r.toUpperCase());
  const allowedRoles = (allowed || []).map((r) => r.toUpperCase());

  // If an allowed list is provided, enforce it
  if (allowedRoles.length > 0 && !userRoles.some((r) => allowedRoles.includes(r))) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-6">
        <h1 className="text-2xl font-bold text-ink mb-2">No access</h1>
        <p className="text-gray-600">
          Your account doesn’t have permission to view this page.
        </p>
      </div>
    );
  }

  // ✅ Otherwise, render children
  return <>{children}</>;
}
