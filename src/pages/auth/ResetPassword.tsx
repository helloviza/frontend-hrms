// apps/frontend/src/pages/auth/ResetPassword.tsx
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-[#f7f8ff] p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white/80 backdrop-blur border p-6 shadow text-center">
          <p className="text-sm text-red-500 mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot" className="text-ink font-semibold hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-[#f7f8ff] p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white/80 backdrop-blur border p-6 shadow"
      >
        <h1 className="text-2xl font-extrabold text-ink mb-4">Set new password</h1>

        {done ? (
          <p className="text-sm text-green-600">
            Password updated! Redirecting to sign in…
          </p>
        ) : (
          <>
            <label className="block text-sm text-ink/70">New password</label>
            <input
              className="w-full mt-1 mb-4 rounded-xl border px-3 py-2"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />

            <label className="block text-sm text-ink/70">Confirm password</label>
            <input
              className="w-full mt-1 mb-4 rounded-xl border px-3 py-2"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />

            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

            <button
              className="w-full rounded-xl py-3 bg-ink text-white font-semibold disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Saving…" : "Set password"}
            </button>
          </>
        )}

        <div className="mt-4 text-sm">
          <Link to="/login" className="text-ink/70 hover:text-ink">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
