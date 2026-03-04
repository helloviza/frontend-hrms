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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/plumtrips-logo.png" alt="PlumTrips" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-slate-800">Sign in to your account</h1>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-[#00477f] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#003a6b] disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-center text-sm text-slate-500">
            <a href="/forgot" className="text-[#00477f] hover:underline">Forgot password?</a>
          </p>
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">© 2026 PlumTrips</p>
      </div>
    </div>
  );
}
