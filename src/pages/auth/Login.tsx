import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api, { setAccessToken } from "../../lib/api";

const BRAND_LOGO = "https://plumtrips-assets.s3.amazonaws.com/email/plumtrips-email-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState("SYSTEMS_READY");

  // --- AI NEURAL CANVAS ANIMATION ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    const particleCount = 60;
    const connectionDistance = 150;

    class Particle {
      x: number; y: number; vx: number; vy: number; size: number;
      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas!.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.vy *= -1;
      }
      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(59, 130, 246, 0.5)";
        ctx!.fill();
      }
    }

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${1 - distance / connectionDistance - 0.5})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(animate);
    };

    window.addEventListener("resize", init);
    init();
    animate();
    return () => window.removeEventListener("resize", init);
  }, []);

  // System Status Cycle
  useEffect(() => {
    const statuses = ["ENCRYPTING_SESSION", "NODES_ACTIVE", "AI_CORE_ONLINE", "ANALYZING_BIOMETRICS", "STABILIZING_QUBITS"];
    const interval = setInterval(() => {
      setSystemStatus(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      setError(err.message || "Access Denied");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#020617] overflow-hidden font-mono selection:bg-blue-500/30">
      
      {/* --- LAYER 1: DYNAMIC NEURAL CANVAS --- */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-0 pointer-events-none opacity-60"
      />

      {/* --- LAYER 2: SYSTEM LOGS --- */}
      <div className="absolute left-10 top-0 bottom-0 w-[200px] opacity-10 pointer-events-none hidden lg:block overflow-hidden z-0">
        <div className="animate-data-stream text-[8px] text-blue-400 space-y-2 whitespace-nowrap">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i}>0x{Math.random().toString(16).substr(2, 8).toUpperCase()} FETCH_READY</div>
          ))}
        </div>
      </div>

      {/* --- MAIN LOGIN CORE --- */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-[460px] mx-4 rounded-[3rem] bg-[#020617]/70 backdrop-blur-3xl border border-white/5 p-12 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden group transition-all duration-700 hover:border-blue-500/20"
      >
        <div className={`absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent z-20 pointer-events-none ${loading ? 'animate-scan-fast' : 'opacity-0'}`} />
        
        <div className="mb-14 text-center">
          <div className="inline-flex relative mb-6">
            <div className="absolute inset-[-15px] bg-blue-600/10 blur-2xl rounded-full animate-pulse" />
            <img src={BRAND_LOGO} alt="PlumTrips" className="relative h-12 w-auto brightness-125" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-[0.5em] proper opacity-90">Plum_ORBIT</h1>
          <p className="text-[9px] text-zinc-600 uppercase tracking-[0.4em] mt-3 italic">Establish Secure Neural Link</p>
        </div>

        <div className="space-y-10">
          <div className="relative group/field">
            <label className="block text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-3 ml-1 group-focus-within/field:text-blue-400 transition-colors">User_ID</label>
            <div className="relative">
              <input
                type="email"
                placeholder="ID_STRING"
                className="w-full bg-transparent border-b border-white/10 px-1 py-3 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-blue-500 transition-all font-mono"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-blue-400 group-focus-within/field:w-full transition-all duration-500 shadow-[0_0_15px_#3b82f6]" />
            </div>
          </div>

          <div className="relative group/field">
            <label className="block text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-3 ml-1 group-focus-within/field:text-blue-400 transition-colors">Access_Hash</label>
            <div className="relative">
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-transparent border-b border-white/10 px-1 py-3 text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-blue-500 transition-all tracking-[0.4em]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-blue-400 group-focus-within/field:w-full transition-all duration-500 shadow-[0_0_15px_#3b82f6]" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relative w-full mt-14 py-5 group/btn overflow-hidden rounded-sm transition-all active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-white transition-colors duration-500 group-hover/btn:bg-blue-400" />
          <span className="relative z-10 flex items-center justify-center gap-4 text-black font-black text-[10px] uppercase tracking-[0.4em]">
            {loading ? "Decrypting_Identity..." : "Establish_Link"}
          </span>
        </button>

     </form>

      {/* --- TELEMETRY FOOTER --- */}
      <div className="absolute bottom-10 inset-x-0 flex flex-col items-center">
        <div className="flex items-center gap-4 text-[8px] text-zinc-600 font-bold tracking-[0.3em] bg-black/40 px-6 py-2 rounded-full border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            {systemStatus}
          </div>
          <div className="h-2 w-[1px] bg-zinc-800" />
          <div className="animate-pulse">LATENCY: {Math.floor(Math.random() * 10 + 5)}MS</div>
        </div>
      </div>

      <style>{`
        @keyframes scan-fast {
          0% { top: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes data-stream {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}