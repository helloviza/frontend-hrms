import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* -------------------------------------------------------------------------- */
/* Helper Functions                                                           */
/* -------------------------------------------------------------------------- */
function norm(v: any): string {
  return String(v ?? "").trim().toUpperCase().replace(/[\s\-_]/g, "");
}

function hasRole(user: any, roles: string[]) {
  const all: string[] = [];
  if (Array.isArray(user?.roles)) all.push(...user.roles);
  if (user?.role) all.push(user.role);
  if (user?.approvalRole) all.push(user.approvalRole);
  return all.map(norm).some((r) => roles.map(norm).includes(r));
}

const isVendor = (user: any) => user?.vendorId || user?.vendor_id || user?.vendorProfile || hasRole(user, ["VENDOR"]);
const isCustomer = (user: any) => user?.customerId || user?.customer_id || user?.businessId || hasRole(user, ["CUSTOMER", "BUSINESS", "COMPANY", "ORG"]);
const isApprover = (user: any) => user?.approverId || user?.approvalRole || hasRole(user, ["APPROVER", "MANAGERAPPROVER"]);

/* -------------------------------------------------------------------------- */
/* Splash Component                                                           */
/* -------------------------------------------------------------------------- */

export default function Splash() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [text, setText] = useState("");
  const [phase, setPhase] = useState(0);

  const statuses = useMemo(() => [
    "LOG_INIT: Neural engines online...",
    "AUTH_SCAN: Verifying credentials...",
    "SYNC_CORE: Loading workspace parameters...",
    "READY: System integrity 100%"
  ], []);

  // Destination Logic
  const destination = useMemo(() => {
    if (!user) return "/login";
    if (isVendor(user)) return "/profile/vendor";
    if (isApprover(user)) return "/customer/approvals/inbox";
    if (isCustomer(user)) return "/profile/customer";
    return "/profile/me";
  }, [user]);

  // Typewriter Effect Logic
  useEffect(() => {
    let currentText = statuses[phase];
    let i = 0;
    setText(""); // Clear before typing

    const timer = setInterval(() => {
      setText(currentText.slice(0, i));
      i++;
      if (i > currentText.length) {
        clearInterval(timer);
        setTimeout(() => {
          if (phase < statuses.length - 1) setPhase(p => p + 1);
        }, 800);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [phase, statuses]);

  // Redirect Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(destination, { replace: true });
    }, 4500);
    return () => clearTimeout(timer);
  }, [destination, navigate]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#030305] overflow-hidden font-mono">
      
      {/* 1. NEURAL BACKGROUND (AI Glows) */}
      <div className="absolute top-[-20%] left-[-10%] h-[70%] w-[70%] bg-blue-600/10 blur-[140px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[70%] w-[70%] bg-indigo-600/10 blur-[140px] animate-pulse delay-700" />
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 flex flex-col items-center">
        
        {/* 2. LOGO WITH SCANNING EFFECT */}
        <div className="relative mb-16 px-4">
          <img
            src="https://plumtrips-assets.s3.amazonaws.com/email/plumtrips-email-logo.png"
            alt="PlumTrips AI"
            className="h-12 w-auto opacity-90 brightness-110"
          />
          {/* Laser Scan Line */}
          <div className="absolute inset-0 h-[2px] bg-blue-400 shadow-[0_0_15px_#60a5fa] animate-[scan_2s_ease-in-out_infinite]" />
          {/* Glitch Glow */}
          <div className="absolute inset-0 bg-blue-500/10 blur-xl animate-pulse" />
        </div>

        {/* 3. AI TERMINAL CARD */}
        <div className="w-[380px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t-white/20">
          
          {/* Terminal Header */}
          <div className="flex items-center gap-1.5 mb-4 border-b border-white/5 pb-3">
            <div className="h-2 w-2 rounded-full bg-red-500/50" />
            <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
            <div className="h-2 w-2 rounded-full bg-emerald-500/50 shadow-[0_0_8px_#10b981]" />
            <span className="ml-2 text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Plum_Core_v4.0</span>
          </div>

          {/* Typewriter Output */}
          <div className="h-10">
            <div className="text-blue-400 text-[11px] leading-relaxed">
              <span className="text-zinc-600 mr-2">{">"}</span>
              {text}
              <span className="inline-block w-1.5 h-3.5 bg-blue-400 ml-1 animate-blink align-middle" />
            </div>
          </div>

          {/* 4. DATA NODES VISUALIZER */}
          <div className="mt-6 flex items-end justify-between h-8 gap-1">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-blue-500/30 rounded-t-sm animate-ai-bars" 
                style={{ 
                  height: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.05}s` 
                }} 
              />
            ))}
          </div>

          <div className="mt-4 flex justify-between items-center text-[8px] text-zinc-600 uppercase font-black tracking-widest">
            <span>Encrypted Connection</span>
            <span className="text-emerald-500/80">Active</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes ai-bars {
          0%, 100% { height: 10%; opacity: 0.3; }
          50% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}