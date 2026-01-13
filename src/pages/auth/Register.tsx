// apps/frontend/src/pages/auth/Register.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../lib/api";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      await api.post("/auth/register", { email, password });
      setOk("Account created. You can sign in now.");
      setTimeout(() => nav("/login"), 700);
    } catch (e: any) {
      setErr(e?.message ?? "Registration failed");
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
        <h1 className="text-2xl font-extrabold text-ink mb-4">Create account</h1>
        {ok && <div className="mb-3 text-sm text-green-700">{ok}</div>}
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
        <label className="block text-sm text-ink/70">Email</label>
        <input
          className="w-full mt-1 mb-3 rounded-xl border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <label className="block text-sm text-ink/70">Password</label>
        <input
          className="w-full mt-1 mb-4 rounded-xl border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        <button
          className="w-full rounded-xl py-3 bg-ink text-white font-semibold disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Creating…" : "Register"}
        </button>
        <div className="mt-4 text-sm text-ink/70">
          Already have an account?{" "}
          <Link to="/login" className="text-ink hover:underline">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
