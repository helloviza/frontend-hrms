import { Link, useNavigate } from "react-router-dom";

const STEPS = [
  { key: "fare-validation", label: "Fare Check" },
  { key: "passengers",      label: "Passengers" },
  { key: "seats",           label: "Seats" },
  { key: "extras",          label: "Extras" },
  { key: "review",          label: "Review" },
  { key: "confirmed",       label: "Confirmed" },
] as const;

interface Props {
  currentStep: string;
}

export default function BookingProgressBar({ currentStep }: Props) {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep);
  const navigate = useNavigate();

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      padding: "10px 24px",
      display: "flex", alignItems: "center", gap: 4,
    }}>
      {/* Logo + Back to Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginRight: "auto" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src="/assets/logo.png" alt="PlumTrips" style={{ height: 32, width: "auto" }} />
        </Link>
        {currentStep !== "confirmed" && (
          <button
            onClick={() => navigate("/sbt/flights")}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 13, fontWeight: 600, color: '#00477f',
              whiteSpace: "nowrap",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Search
          </button>
        )}
      </div>

      {/* Steps */}
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
            {/* Step circle + label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800,
                background: isDone ? '#00b67a' : isActive ? '#00477f' : '#f1f5f9',
                border: isDone ? 'none' : isActive ? 'none' : '2px solid #cbd5e1',
                color: isDone || isActive ? '#ffffff' : '#94a3b8',
                boxShadow: isActive ? '0 2px 8px rgba(0,71,127,0.35)' : 'none',
                transition: "all 0.3s ease",
              }}>
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  i + 1
                )}
              </div>
              <span style={{
                fontSize: 13, fontWeight: isDone ? 600 : isActive ? 800 : 500,
                color: isDone ? '#00b67a' : isActive ? '#00477f' : '#94a3b8',
                whiteSpace: "nowrap",
                transition: "all 0.3s ease",
              }}>
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < STEPS.length - 1 && (
              <div style={{
                width: 40, height: 2, marginLeft: 8, marginRight: 4,
                background: isDone ? '#00b67a' : '#e2e8f0',
                borderRadius: 1,
                transition: "background 0.3s ease",
              }} />
            )}
          </div>
        );
      })}

      {/* Right spacer to balance the logo/back area */}
      <div style={{ marginLeft: "auto", minWidth: 140 }} />
    </div>
  );
}
