import { useState, useEffect } from "react";
import { Plane, ChevronRight, Zap, ArrowRight } from "lucide-react";

interface FlightProps {
  data: any;
  reply?: any;
  onNextStep?: (step: string) => void;
}

const STATUS_CFG: Record<string, { label: string; color: string; glow: string; pulse: boolean }> = {
  "Departed":  { label: "Airborne",  color: "#60a5fa", glow: "#3b82f6", pulse: true  },
  "Landed":    { label: "Landed",    color: "#34d399", glow: "#10b981", pulse: false },
  "On Time":   { label: "On Time",   color: "#34d399", glow: "#10b981", pulse: true  },
  "Scheduled": { label: "Scheduled", color: "#a78bfa", glow: "#8b5cf6", pulse: true  },
  "Delayed":   { label: "Delayed",   color: "#fbbf24", glow: "#f59e0b", pulse: true  },
  "Cancelled": { label: "Cancelled", color: "#f87171", glow: "#ef4444", pulse: false },
  "Boarding":  { label: "Boarding",  color: "#c084fc", glow: "#a855f7", pulse: true  },
  "Diverted":  { label: "Diverted",  color: "#fb923c", glow: "#f97316", pulse: true  },
};

export default function FlightStatusCard({ data, reply, onNextStep }: FlightProps) {
  const [imgError, setImgError] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const plutoInsights: string[] = reply?.plutoInsights || [];
  const nextSteps: string[]     = reply?.nextSteps || [];
  const tip: string             = reply?.flightStatus?.tip || "";

  // ── Error state ──
  if (!data || !data.flight) {
    return (
      <div style={S.errCard}>
        <Plane size={22} color="#6366f1" />
        <p style={S.errMsg}>{data?.message || data?.error || "Flight data unavailable."}</p>
        {data?.links && (
          <div style={S.errLinks}>
            {data.links.flightaware && <a href={data.links.flightaware} target="_blank" rel="noopener noreferrer" style={S.errBtn}>FlightAware ↗</a>}
            {data.links.flightradar && <a href={data.links.flightradar} target="_blank" rel="noopener noreferrer" style={{...S.errBtn, background: "#27272a"}}>Radar24 ↗</a>}
          </div>
        )}
      </div>
    );
  }

  const { flight, departure, arrival, flight_status, airline } = data;
  const sc = STATUS_CFG[flight_status] || { label: flight_status || "Unknown", color: "#a1a1aa", glow: "#71717a", pulse: false };

  const airlineIata = airline?.iata || flight?.iata?.replace(/\d+/g, "") || "";
  const logoUrl     = `https://images.kiwi.com/airlines/64/${airlineIata}.png`;

  const fmt = (ts: string | null): string => {
    if (!ts) return "--:--";
    if (/^\d{1,2}:\d{2}$/.test((ts || "").trim())) return ts.trim();
    try { const d = new Date(ts); return isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return "--:--"; }
  };
  const fmtDate = (ts: string | null): string => {
    if (!ts) return "";
    try { const d = new Date(ts); return isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { day: "numeric", month: "short" }); }
    catch { return ""; }
  };

  const depTime  = fmt(departure?.actual || departure?.scheduled);
  const arrTime  = fmt(arrival?.estimated || arrival?.scheduled);
  const depDate  = fmtDate(departure?.actual || departure?.scheduled);
  const arrDate  = fmtDate(arrival?.estimated || arrival?.scheduled);
  const depCode  = (departure?.iata && departure.iata !== "—") ? departure.iata : "???";
  const arrCode  = (arrival?.iata && arrival.iata !== "—")     ? arrival.iata   : "???";
  const progress = typeof data.progress_percent === "number" ? data.progress_percent : null;
  const airlineName = airline?.name || reply?.flightStatus?.airline || "Unknown Airline";

  return (
    <div style={{ ...S.card, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.45s ease, transform 0.45s ease" }}>

      {/* ═══════════════════════════════════════
          HERO — dark cinematic panel
      ═══════════════════════════════════════ */}
      <div style={S.hero}>
        {/* Subtle noise texture overlay */}
        <div style={S.heroNoise} />

        {/* Top bar: airline + status */}
        <div style={S.heroTop}>
          <div style={S.airlineChip}>
            <div style={S.logoWrap}>
              {!imgError
                ? <img src={logoUrl} alt={airlineName} style={S.logo} onError={() => setImgError(true)} />
                : <Plane size={14} color="#a78bfa" />
              }
            </div>
            <div>
              <p style={S.airlineName}>{airlineName}</p>
              <p style={S.flightCode}>{flight?.iata || "N/A"}</p>
            </div>
          </div>

          {/* Live status badge */}
          <div style={{ ...S.statusBadge, borderColor: `${sc.glow}40`, background: `${sc.glow}18` }}>
            <span style={{
              ...S.statusDot,
              background: sc.color,
              boxShadow: sc.pulse ? `0 0 0 0 ${sc.glow}` : "none",
              animation: sc.pulse ? "ripple 1.8s ease-out infinite" : "none",
            }} />
            <span style={{ ...S.statusText, color: sc.color }}>{sc.label}</span>
          </div>
        </div>

        {/* ── BIG ROUTE ── */}
        <div style={S.routeRow}>
          {/* Origin */}
          <div style={S.endpoint}>
            <p style={S.bigIata}>{depCode}</p>
            <p style={S.cityName}>{departure?.city || departure?.airport || "Origin"}</p>
          </div>

          {/* Center: plane arc */}
          <div style={S.arcWrap}>
            <svg width="72" height="36" viewBox="0 0 72 36" fill="none" style={{ overflow: "visible" }}>
              <path d="M4 32 Q36 4 68 32" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
              <circle cx="36" cy="14" r="3" fill={sc.color} style={{ filter: `drop-shadow(0 0 4px ${sc.glow})` }} />
            </svg>
            <div style={S.planeWrap}>
              <Plane size={16} color={sc.color} style={{ filter: `drop-shadow(0 0 6px ${sc.glow})` }} />
            </div>
          </div>

          {/* Destination */}
          <div style={{ ...S.endpoint, alignItems: "flex-end" }}>
            <p style={S.bigIata}>{arrCode}</p>
            <p style={{ ...S.cityName, textAlign: "right" }}>{arrival?.city || arrival?.airport || "Destination"}</p>
          </div>
        </div>

        {/* ── Times row ── */}
        <div style={S.timesRow}>
          <div style={S.timeBlock}>
            <p style={S.timeVal}>{depTime}</p>
            <p style={S.timeMeta}>
              {depDate && <span>{depDate}</span>}
              {departure?.actual && <span style={{ color: "#34d399", marginLeft: 6, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em" }}>ACTUAL</span>}
            </p>
            <p style={S.gateInfo}>
              {departure?.terminal !== "N/A" ? `Terminal ${departure?.terminal}` : "Terminal —"}&nbsp;&nbsp;·&nbsp;&nbsp;Gate {departure?.gate || "TBD"}
            </p>
          </div>

          <div style={{ ...S.timeBlock, alignItems: "flex-end", textAlign: "right" as const }}>
            <p style={S.timeVal}>{arrTime}</p>
            <p style={S.timeMeta}>
              {arrDate && <span>{arrDate}</span>}
              {arrival?.estimated && <span style={{ color: "#fbbf24", marginLeft: 6, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em" }}>EST</span>}
            </p>
            <p style={S.gateInfo}>
              {arrival?.terminal !== "N/A" ? `Terminal ${arrival?.terminal}` : "Terminal —"}&nbsp;&nbsp;·&nbsp;&nbsp;Gate {arrival?.gate || "TBD"}
            </p>
          </div>
        </div>

        {/* ── Progress bar (airborne) ── */}
        {progress !== null && progress > 0 && (
          <div style={S.progressWrap}>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${progress}%`, background: `linear-gradient(90deg, ${sc.glow}, ${sc.color})` }} />
            </div>
            <p style={{ ...S.progressPct, color: sc.color }}>{progress}%</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          BODY — light panel
      ═══════════════════════════════════════ */}
      <div style={S.body}>

        {/* ── Pluto Tip ── */}
        {tip && (
          <div style={S.tipBox}>
            <Zap size={12} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={S.tipText}>{tip}</p>
          </div>
        )}

        {/* ── Pluto Insights ── */}
        {plutoInsights.length > 0 && (
          <div style={S.section}>
            <p style={S.sectionLabel}>
              <span style={S.labelDot} />
              PLUTO INSIGHTS
            </p>
            {plutoInsights.map((ins, i) => (
              <div key={i} style={S.insightRow}>
                <span style={S.insightLine} />
                <p style={S.insightText}>{ins}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Next Steps ── */}
        {nextSteps.length > 0 && (
          <div style={{ ...S.section, borderTop: "1px solid #f4f4f5", paddingTop: 18 }}>
            <p style={S.sectionLabel}>
              <span style={S.labelDot} />
              NEXT STEPS
            </p>
            {nextSteps.map((step, i) => (
              <button
                key={i}
                style={S.stepBtn}
                onClick={() => onNextStep?.(step)}
                onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: "#f4f4f5", borderColor: "#d4d4d8" }); }}
                onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: "#fafafa", borderColor: "#ebebeb" }); }}
              >
                <span style={S.stepText}>{step}</span>
                <ArrowRight size={13} color="#a1a1aa" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes ripple {
          0%   { box-shadow: 0 0 0 0 ${sc.glow}60; }
          70%  { box-shadow: 0 0 0 7px ${sc.glow}00; }
          100% { box-shadow: 0 0 0 0 ${sc.glow}00; }
        }
      `}</style>
    </div>
  );
}

/* ═══════ STYLE TOKENS ═══════ */
const S: Record<string, React.CSSProperties> = {
  card: {
    margin: "16px 0",
    borderRadius: "22px",
    overflow: "hidden",
    border: "1px solid #e4e4e7",
    boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },

  /* ── Hero (dark) ── */
  hero: {
    position: "relative",
    background: "linear-gradient(155deg, #0f0f11 0%, #18181b 60%, #1a1025 100%)",
    padding: "22px 24px 20px",
    overflow: "hidden",
  },
  heroNoise: {
    position: "absolute", inset: 0,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
    opacity: 0.6, pointerEvents: "none",
  },
  heroTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "20px", position: "relative",
  },
  airlineChip: {
    display: "flex", alignItems: "center", gap: "10px",
  },
  logoWrap: {
    width: "36px", height: "36px", borderRadius: "10px",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    flexShrink: 0,
  },
  logo: { width: "28px", height: "28px", objectFit: "contain" },
  airlineName: {
    fontSize: "13px", fontWeight: 700, color: "#f4f4f5", margin: 0, lineHeight: 1.2,
  },
  flightCode: {
    fontSize: "10px", fontWeight: 600, color: "#71717a", margin: 0, marginTop: "2px",
    letterSpacing: "0.08em",
  },
  statusBadge: {
    display: "flex", alignItems: "center", gap: "7px",
    padding: "6px 13px", borderRadius: "100px", border: "1px solid",
  },
  statusDot: {
    width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
  },
  statusText: {
    fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const,
  },

  /* ── Route ── */
  routeRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "8px", marginBottom: "20px", position: "relative",
  },
  endpoint: {
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
    flex: 1,
  },
  bigIata: {
    fontSize: "52px", fontWeight: 900, color: "#ffffff",
    letterSpacing: "-0.04em", lineHeight: 1, margin: 0,
    fontVariantNumeric: "tabular-nums",
    textShadow: "0 2px 20px rgba(255,255,255,0.1)",
  },
  cityName: {
    fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.65)",
    margin: "4px 0 0", letterSpacing: "0.08em", textTransform: "uppercase" as const,
    maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
  },
  arcWrap: {
    display: "flex", flexDirection: "column" as const, alignItems: "center",
    gap: "4px", flex: "0 0 80px",
  },
  planeWrap: {
    display: "flex", alignItems: "center", justifyContent: "center",
  },

  /* ── Times ── */
  timesRow: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px",
    position: "relative",
  },
  timeBlock: {
    display: "flex", flexDirection: "column" as const, alignItems: "flex-start",
  },
  timeVal: {
    fontSize: "26px", fontWeight: 800, color: "#ffffff",
    letterSpacing: "-0.03em", margin: 0,
    fontVariantNumeric: "tabular-nums",
  },
  timeMeta: {
    fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.55)",
    margin: "3px 0 0", display: "flex", alignItems: "center",
  },
  gateInfo: {
    fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.40)",
    marginTop: "5px", letterSpacing: "0.02em",
  },

  /* ── Progress ── */
  progressWrap: {
    display: "flex", alignItems: "center", gap: "10px",
    marginTop: "16px",
  },
  progressTrack: {
    flex: 1, height: "3px", background: "rgba(255,255,255,0.08)",
    borderRadius: "3px", overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: "3px",
    transition: "width 1.2s ease",
  },
  progressPct: {
    fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em",
    flexShrink: 0,
  },

  /* ── Body (light) ── */
  body: {
    background: "#ffffff",
    padding: "0",
  },
  tipBox: {
    display: "flex", alignItems: "flex-start", gap: "10px",
    margin: "20px 24px 0",
    padding: "13px 16px",
    background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(99,102,241,0.04) 100%)",
    borderRadius: "14px",
    border: "1px solid rgba(124,58,237,0.12)",
  },
  tipText: {
    fontSize: "12px", fontWeight: 500, color: "#4c1d95",
    lineHeight: 1.65, margin: 0,
  },
  section: {
    padding: "18px 24px",
  },
  sectionLabel: {
    display: "flex", alignItems: "center", gap: "8px",
    fontSize: "9px", fontWeight: 900, color: "#a1a1aa",
    letterSpacing: "0.14em", textTransform: "uppercase" as const,
    margin: "0 0 12px",
  },
  labelDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
    flexShrink: 0, display: "inline-block",
  },
  insightRow: {
    display: "flex", alignItems: "flex-start", gap: "12px",
    marginBottom: "8px",
  },
  insightLine: {
    width: "2px", minHeight: "14px", flexShrink: 0,
    background: "linear-gradient(180deg, #7c3aed, transparent)",
    borderRadius: "2px", marginTop: "4px",
    alignSelf: "stretch",
  },
  insightText: {
    fontSize: "12px", fontWeight: 500, color: "#52525b",
    lineHeight: 1.7, margin: 0,
  },
  stepBtn: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "12px", padding: "12px 14px", borderRadius: "12px",
    border: "1px solid #ebebeb", background: "#fafafa",
    cursor: "pointer", width: "100%", textAlign: "left" as const,
    marginBottom: "6px", transition: "all 0.15s ease",
  },
  stepText: {
    fontSize: "12px", fontWeight: 600, color: "#3f3f46", lineHeight: 1.45,
  },

  /* ── Error ── */
  errCard: {
    margin: "16px 0", padding: "28px 24px",
    background: "#fafafa", border: "1px solid #e4e4e7",
    borderRadius: "22px", display: "flex", flexDirection: "column" as const,
    alignItems: "center", gap: "12px", textAlign: "center" as const,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  errMsg: {
    fontSize: "13px", fontWeight: 600, color: "#71717a", margin: 0, maxWidth: "260px", lineHeight: 1.55,
  },
  errLinks: { display: "flex", gap: "8px", flexWrap: "wrap" as const, justifyContent: "center" },
  errBtn: {
    fontSize: "11px", fontWeight: 800, padding: "8px 16px",
    borderRadius: "10px", background: "#6366f1", color: "#fff",
    textDecoration: "none", letterSpacing: "0.04em",
  },
};