import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api, { setAccessToken } from "../../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const resData = await api.post("/auth/login", { email, password });
      if (!resData?.accessToken) throw new Error("No access token received from server");
      setAccessToken(resData.accessToken);
      let me = resData.user;
      if (!me?._id) me = await api.get("/auth/me");
      setUser(me);
      navigate("/splash", { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[#00477f] flex-col justify-between p-12">
        <span className="text-white text-2xl font-semibold">PlumTrips</span>
        <div>
          <h1 className="text-white text-4xl font-semibold leading-tight">
            Manage your team.<br />Travel smarter.
          </h1>
          <p className="text-white/60 text-sm mt-4">
            HRMS built for modern travel companies.
          </p>
        </div>
        <p className="text-white/30 text-xs">© 2026 PlumTrips</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          <span className="text-[#00477f] text-xl font-bold">PlumTrips</span>
          <h2 className="text-2xl font-semibold text-slate-900 mt-8 mb-6">Sign in</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f] text-sm text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f] text-sm text-slate-900 bg-white"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#00477f] hover:bg-[#003d6e] text-white py-2.5 rounded-lg text-sm font-medium transition-colors mt-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <a href="/forgot" className="text-sm text-[#00477f] hover:underline text-center block mt-4">
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
