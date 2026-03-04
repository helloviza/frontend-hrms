// apps/frontend/src/pages/auth/Forgot.tsx
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
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
        <h1 className="text-2xl font-extrabold text-ink mb-4">Reset password</h1>
        {sent ? (
          <p className="text-sm text-ink/70 mb-4">
            If an account exists for <b>{email}</b>, you’ll receive reset steps shortly.
          </p>
        ) : (
          <>
            <label className="block text-sm text-ink/70">Email</label>
            <input
              className="w-full mt-1 mb-4 rounded-xl border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
            {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
            <button
              className="w-full rounded-xl py-3 bg-ink text-white font-semibold disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <div className="mt-4 text-sm">
          <Link to="/login" className="text-ink/70 hover:text-ink">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
