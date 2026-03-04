import { useState, useEffect, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api, { setAccessToken } from "../../lib/api";

export default function Login() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) setTimeout(() => passwordRef.current?.focus(), 100);
  }, [step]);

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email."); return; }
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    setUserName(name);
    setStep(2);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) { setError("Please enter your password."); return; }
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
    <div className="min-h-screen bg-white flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Plumtrips" className="h-7" onError={e => (e.currentTarget.style.display = "none")} />
          <span className="text-[#00477f] text-lg font-semibold">Plumtrips</span>
        </div>
        <span className="text-xs text-slate-400">Powered by Pluto.ai</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">

        {/* Step 1 headline */}
        {step === 1 && (
          <div className="text-center mb-12 max-w-xl">
            <h1 className="text-[2.5rem] font-bold text-slate-900 leading-tight tracking-tight">
              Orchestrate People.<br />
              Streamline Operations.<br />
              <span style={{ background: "linear-gradient(90deg,#00477f,#0066b3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Elevate Every Journey.
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-4 leading-relaxed max-w-md mx-auto">
              A sophisticated platform designed for travel companies to manage teams, workflows, and travel experiences with clarity and precision.
            </p>
          </div>
        )}

        {/* Step 2 welcome */}
        {step === 2 && (
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#00477f] text-white text-xl font-semibold flex items-center justify-center mx-auto mb-4">
              {userName.charAt(0)}
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Welcome back, {userName.split(" ")[0]}</h2>
            <button
              onClick={() => { setStep(1); setPassword(""); setError(""); }}
              className="text-sm text-slate-400 hover:text-[#00477f] mt-1 flex items-center gap-1 mx-auto transition-colors"
            >
              <span>{email}</span>
              <span className="text-xs underline">Change</span>
            </button>
          </div>
        )}

        {/* Form */}
        <div className="w-full max-w-sm">
          {step === 1 ? (
            <form onSubmit={handleEmailSubmit}>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  autoFocus
                  className="w-full px-5 py-4 pr-14 rounded-2xl border border-slate-200
                    focus:outline-none focus:ring-2 focus:ring-[#00477f]/15 focus:border-[#00477f]
                    text-sm text-slate-900 placeholder:text-slate-400
                    shadow-sm transition-all bg-white"
                />
                <button type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2
                    w-9 h-9 rounded-xl bg-[#00477f] hover:bg-[#003d6e]
                    flex items-center justify-center transition-colors shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-3">
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f] text-sm text-slate-900 placeholder:text-slate-400 transition-all"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00477f] hover:bg-[#003d6e] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <div className="text-center">
                <a href="/forgot" className="text-sm text-[#00477f] hover:underline">
                  Forgot password?
                </a>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bottom trust bar */}
      <div className="pb-8 flex flex-col items-center gap-5">

        {/* Logo row */}
        <div className="flex items-center gap-6 opacity-30 hover:opacity-50 transition-opacity">
          {/* NVIDIA */}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-600"></div>
            <span className="text-[12px] font-bold text-slate-600 tracking-tight">NVIDIA</span>
            <span className="text-[9px] text-slate-400 font-medium">INCEPTION</span>
          </div>
          <div className="w-px h-5 bg-slate-200"></div>
          {/* Google */}
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-bold" style={{
              background: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>Google</span>
            <span className="text-[9px] text-slate-400 font-medium">FOR STARTUPS</span>
          </div>
          <div className="w-px h-5 bg-slate-200"></div>
          {/* Startup India */}
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              <div className="w-2 h-3 rounded-sm bg-orange-500"></div>
              <div className="w-2 h-3 rounded-sm bg-white border border-slate-200"></div>
              <div className="w-2 h-3 rounded-sm bg-green-600"></div>
            </div>
            <span className="text-[12px] font-bold text-slate-600 tracking-tight">Startup India</span>
            <span className="text-[9px] text-slate-400">· DPIIT</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-300">© 2026 Plumtrips. All rights reserved.</p>
      </div>

    </div>
  );
}
