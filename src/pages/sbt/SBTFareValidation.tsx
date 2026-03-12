import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { SBTFlight, T, AirlineLogo, formatTime } from "../../components/sbt/FlightResultCard";
import BookingProgressBar from "../../components/sbt/BookingProgressBar";
import PriceSummary from "../../components/sbt/PriceSummary";

interface BookState {
  flight: SBTFlight;
  traceId: string;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  cabin: number;
}

type CheckStatus = "pending" | "running" | "done" | "error";

interface CheckItem {
  label: string;
  status: CheckStatus;
  detail?: string;
}

export default function SBTFareValidation() {
  const { state } = useLocation() as { state: BookState | null };
  const navigate = useNavigate();
  const hasRun = useRef(false);

  const [checks, setChecks] = useState<CheckItem[]>([
    { label: "Validating fare quote", status: "pending" },
    { label: "Locking fare for session", status: "pending" },
    { label: "Confirming price", status: "pending" },
  ]);
  const [progress, setProgress] = useState(0);
  const [priceChanged, setPriceChanged] = useState(false);
  const [newFare, setNewFare] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fareQuoteResult, setFareQuoteResult] = useState<any>(null);

  // Redirect if no state
  useEffect(() => {
    if (!state) navigate("/sbt/flights", { replace: true });
  }, [state, navigate]);

  // Run fare validation
  useEffect(() => {
    if (!state || hasRun.current) return;
    hasRun.current = true;
    runValidation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function runValidation() {
    if (!state) return;

    // Step 1: Validating fare quote
    updateCheck(0, "running");
    animateProgress(0, 30, 800);

    let fqData: any = null;
    try {
      const res = await api.post("/sbt/flights/farequote", {
        TraceId: state.traceId,
        ResultIndex: state.flight.ResultIndex,
      });

      // api.post returns parsed JSON directly (no .data wrapper)
      // Backend returns { Response: { Results: { Fare: ... } } }
      fqData = res?.Response?.Results ?? res;
      setFareQuoteResult(fqData);
      updateCheck(0, "done", "Fare quote validated");
    } catch (err: any) {
      updateCheck(0, "error", err?.message || "Fare quote failed");
      setError("Could not validate fare. The flight may no longer be available.");
      return;
    }

    // Step 2: Fare locked
    updateCheck(1, "running");
    animateProgress(30, 65, 700);
    updateCheck(1, "done", "Fare locked for your session");

    // Step 3: Confirming price
    updateCheck(2, "running");
    animateProgress(65, 100, 600);

    const isPriceChanged = fqData?.IsPriceChanged === true;
    const newPublishedFare = Number(fqData?.Fare?.PublishedFare ?? 0);

    if (isPriceChanged && newPublishedFare > 0) {
      setPriceChanged(true);
      setNewFare(newPublishedFare);
      updateCheck(2, "done", `Price updated to ₹${newPublishedFare.toLocaleString("en-IN")} — please review before proceeding`);
    } else {
      updateCheck(2, "done", "Price confirmed — no change");
      proceed();
    }
  }

  function proceed() {
    if (!state) return;
    const updatedFlight = fareQuoteResult
      ? { ...state.flight, Fare: fareQuoteResult.Fare ?? state.flight.Fare }
      : state.flight;

    navigate("/sbt/flights/book/passengers", {
      state: {
        ...state,
        flight: updatedFlight,
        fareQuoteResult,
        priceChanged,
        newFare,
      },
      replace: true,
    });
  }

  function updateCheck(index: number, status: CheckStatus, detail?: string) {
    setChecks(prev => prev.map((c, i) => i === index ? { ...c, status, detail } : c));
  }

  function animateProgress(from: number, to: number, durationMs: number) {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / durationMs, 1);
      setProgress(from + (to - from) * easeOut(pct));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if (!state) return null;

  const seg0 = state.flight.Segments[0]?.[0];
  const airlineCode = seg0?.Airline?.AirlineCode ?? "";

  return (
    <div style={{ minHeight: "100vh", background: T.canvas }}>
      <BookingProgressBar currentStep="fare-validation" />

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "32px 24px", gap: 28 }}>
        {/* Main content */}
        <div style={{ flex: 1 }}>
          {/* Back button */}
          <button onClick={() => navigate("/sbt/flights", { state })} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 16,
            fontSize: 12, fontWeight: 600, color: T.inkMid,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <div style={{
            background: T.cardBg, border: `1px solid ${T.cardBorder}`,
            borderRadius: 16, padding: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>
            {/* Flight being validated */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <AirlineLogo code={airlineCode} size="md" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                  {state.origin.code} → {state.dest.code}
                </div>
                <div style={{ fontSize: 11, color: T.inkMid }}>
                  {formatTime(seg0?.Origin?.DepTime ?? "")} departure
                </div>
              </div>
            </div>

            {/* Title */}
            <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 20 }}>
              Validating your fare...
            </div>

            {/* Progress bar */}
            <div style={{
              height: 6, borderRadius: 3, background: T.surface,
              marginBottom: 28, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: `linear-gradient(90deg, ${T.gold}, ${T.emerald})`,
                width: `${progress}%`,
                transition: "width 0.1s linear",
              }} />
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {checks.map((check, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Status icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: check.status === "done" ? `${T.emerald}15`
                      : check.status === "error" ? `${T.rose}15`
                      : check.status === "running" ? `${T.gold}15`
                      : T.surface,
                    transition: "all 0.3s ease",
                  }}>
                    {check.status === "done" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                    {check.status === "error" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.rose} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    )}
                    {check.status === "running" && (
                      <div style={{
                        width: 14, height: 14, border: `2px solid ${T.gold}`,
                        borderTopColor: "transparent", borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    )}
                    {check.status === "pending" && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.inkFaint }} />
                    )}
                  </div>

                  {/* Label + detail */}
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: check.status === "running" ? T.ink
                        : check.status === "done" ? T.emerald
                        : check.status === "error" ? T.rose
                        : T.inkFaint,
                      transition: "color 0.3s ease",
                    }}>
                      {check.label}
                    </div>
                    {check.detail && (
                      <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>
                        {check.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Price change alert */}
            {priceChanged && newFare != null && (
              <div style={{
                marginTop: 28, padding: 16, borderRadius: 12,
                background: `${T.amber}10`, border: `1px solid ${T.amber}30`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 6 }}>
                  Price has changed
                </div>
                <div style={{ fontSize: 12, color: T.ink, marginBottom: 12 }}>
                  The fare has been updated from{" "}
                  <span style={{ textDecoration: "line-through", color: T.inkMid }}>
                    ₹{Number(state.flight.Fare?.PublishedFare ?? 0).toLocaleString("en-IN")}
                  </span>{" "}
                  to{" "}
                  <span style={{ fontWeight: 700, color: T.gold }}>
                    ₹{newFare.toLocaleString("en-IN")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={proceed} style={{
                    padding: "8px 20px", borderRadius: 8, border: "none",
                    background: T.gold, color: "#fff", fontWeight: 700,
                    fontSize: 12, cursor: "pointer",
                  }}>
                    Accept & Continue
                  </button>
                  <button onClick={() => navigate("/sbt/flights", { replace: true })} style={{
                    padding: "8px 20px", borderRadius: 8,
                    border: `1px solid ${T.cardBorder}`, background: T.cardBg,
                    color: T.ink, fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}>
                    Search Again
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div style={{
                marginTop: 28, padding: 16, borderRadius: 12,
                background: `${T.rose}10`, border: `1px solid ${T.rose}30`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.rose, marginBottom: 6 }}>
                  Validation Failed
                </div>
                <div style={{ fontSize: 12, color: T.ink, marginBottom: 12 }}>{error}</div>
                <button onClick={() => navigate("/sbt/flights", { replace: true })} style={{
                  padding: "8px 20px", borderRadius: 8, border: "none",
                  background: T.rose, color: "#fff", fontWeight: 700,
                  fontSize: 12, cursor: "pointer",
                }}>
                  Back to Search
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <PriceSummary flight={state.flight} origin={state.origin} dest={state.dest} pax={state.pax} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

