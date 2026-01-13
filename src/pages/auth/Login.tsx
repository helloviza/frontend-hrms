import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api, { setAccessToken } from "../../lib/api";

// Official Brand Logo
const BRAND_LOGO = "https://plumtrips-assets.s3.amazonaws.com/email/plumtrips-email-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle login sequence
   * Optimized for custom fetch wrapper in api.ts
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Authenticate 
      // Note: Your api.ts 'post' returns the JSON body directly, not an axios {data} object.
      const resData = await api.post("/auth/login", { email, password });

      // 2. Validate Token
      if (!resData?.accessToken) {
        throw new Error("No access token received from server");
      }

      // 3. Store Session using your api.ts helper
      // This updates in-memory token and localStorage keys ('jwt' and 'hrms_accessToken')
      setAccessToken(resData.accessToken);

      // 4. Set User Identity
      let me = resData.user;

      // Fallback: If backend didn't send user object in login response, fetch it
      if (!me?._id) {
        try {
          // api.get also returns the body directly
          me = await api.get("/auth/me");
        } catch (fetchUserErr: any) {
          throw new Error("Login successful, but unable to verify user profile.");
        }
      }

      // 5. Update AuthContext and redirect
      setUser(me);
      navigate("/"); 

    } catch (err: any) {
      console.error("Login Error:", err);
      // Your api.ts 'readErrorText' helper already parses backend error/message fields
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#020203] overflow-hidden font-sans">
      
      {/* --- AI BACKGROUND EFFECTS --- */}
      {/* Animated Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      
      {/* Subtle Tech Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54 48L54 60L48 60L48 48L54 48ZM0 48L0 60L6 60L6 48L0 48ZM54 0L54 12L48 12L48 0L54 0ZM0 0L0 12L6 12L6 0L0 0Z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")` }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-[420px] mx-4 rounded-[32px] bg-white/[0.02] backdrop-blur-3xl border border-white/10 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-white/20"
      >
        {/* --- HEADER / LOGO --- */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="relative group mb-6">
            {/* Soft glow behind the logo */}
            <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full group-hover:bg-indigo-500/40 transition-all duration-700" />
            <img 
              src={BRAND_LOGO} 
              alt="PlumTrips Logo" 
              className="relative h-12 w-auto drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">
            AI-Powered Talent Management
          </p>
        </div>

        {/* --- ERROR FEEDBACK --- */}
        {error && (
          <div className="mb-6 text-[13px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* --- INPUTS --- */}
        <div className="space-y-6">
          <div className="group">
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 ml-1 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
              Corporate Email
            </label>
            <input
              type="email"
              placeholder="admin@plumtrips.com"
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/[0.07] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="group">
            <label className="block text-[10px] font-bold text-zinc-500 mb-2 ml-1 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
              Security Key
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/[0.07] transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {/* --- ACTION BUTTON --- */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-10 rounded-2xl py-4 bg-white text-[#020203] font-black text-xs uppercase tracking-[0.15em] transition-all duration-300 hover:bg-indigo-50 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            "Enter Portal"
          )}
        </button>

        {/* --- FOOTER LINKS --- */}
        <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center px-2">
          <Link to="/forgot" className="text-zinc-500 text-[11px] hover:text-white transition-colors">
            Reset access
          </Link>
          <Link to="/register" className="text-indigo-400 text-[11px] font-bold hover:text-indigo-300 transition-colors underline underline-offset-4 decoration-indigo-500/30">
            Join Platform
          </Link>
        </div>
      </form>

      {/* --- SYSTEM FOOTER --- */}
      <div className="absolute bottom-8 flex items-center gap-4 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] select-none">
        <span>PlumTrips Secure</span>
        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        <span>Nodes: Active</span>
      </div>
    </div>
  );
}