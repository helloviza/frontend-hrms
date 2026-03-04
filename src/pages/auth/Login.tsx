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
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#00477f] via-[#005a9e] to-[#003560] flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-white/50 text-lg font-light tracking-wide">Helloviza</span>
            <span className="text-white/25 text-base">X</span>
            <span className="text-white text-lg font-semibold tracking-wide">Plumtrips</span>
          </div>
          <p className="text-white/35 text-[11px] mt-1 tracking-widest uppercase">Technology by Pluto.ai</p>
        </div>
        <div>
          <h1 className="text-white text-4xl font-semibold leading-tight">
            Orchestrate People.<br />Streamline Operations.<br />Elevate Every Journey.
          </h1>
          <p className="text-white/60 text-sm mt-4">
            A sophisticated platform designed for travel companies to manage teams, workflows, and travel experiences with clarity and precision.
          </p>
        </div>
        <div>
          <p className="text-white/25 text-[10px] uppercase tracking-[0.2em] mb-3">Recognised & Backed By</p>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span className="text-white/70 text-[11px] font-medium">NVIDIA Inception</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              <span className="text-white/70 text-[11px] font-medium">Google for Startups</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
              <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              <span className="text-white/70 text-[11px] font-medium">DPIIT Recognised</span>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-6">© 2026 Plumtrips</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          <span className="text-[#00477f] text-xl font-bold">Plumtrips</span>
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
