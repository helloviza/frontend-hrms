import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SBTFlight, T } from "../../components/sbt/FlightResultCard";
import BookingProgressBar from "../../components/sbt/BookingProgressBar";
import PriceSummary from "../../components/sbt/PriceSummary";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface PassengerState {
  flight: SBTFlight;
  traceId: string;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  cabin: number;
  fareQuoteResult?: any;
  priceChanged?: boolean;
  newFare?: number | null;
}

interface PassengerForm {
  title: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  nationality: string;
  passportNo: string;
  passportExpiry: string;
  email: string;
  phone: string;
  paxType: "adult" | "child" | "infant";
  isLead: boolean;
}

const TITLES_ADULT = ["Mr", "Mrs", "Ms", "Dr"];
const TITLES_CHILD = ["Master", "Miss"];

const NATIONALITIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "USA" },
  { code: "GB", name: "UK" },
  { code: "AE", name: "UAE" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "OTHER", name: "Other" },
];

/* ── Styles using T tokens ─────────────────────────────────────────────── */
const s = {
  card: {
    background: T.cardBg,
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 16,
    padding: "20px 24px",
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: T.inkMid,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10,
    fontSize: 13,
    color: T.ink,
    background: T.surface,
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%",
    padding: "9px 12px",
    border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10,
    fontSize: 13,
    color: T.ink,
    background: T.surface,
    outline: "none",
    boxSizing: "border-box" as const,
    appearance: "none" as const,
  },
  row: {
    display: "grid",
    gap: 12,
  } as React.CSSProperties,
};

function buildEmptyPassengers(pax: PassengerState["pax"]): PassengerForm[] {
  const list: PassengerForm[] = [];
  for (let i = 0; i < pax.adults; i++) {
    list.push({
      title: "Mr", firstName: "", lastName: "", dob: "", gender: "Male",
      nationality: "IN", passportNo: "", passportExpiry: "",
      email: "", phone: "",
      paxType: "adult", isLead: i === 0,
    });
  }
  for (let i = 0; i < pax.children; i++) {
    list.push({
      title: "Master", firstName: "", lastName: "", dob: "", gender: "Male",
      nationality: "IN", passportNo: "", passportExpiry: "",
      email: "", phone: "",
      paxType: "child", isLead: false,
    });
  }
  for (let i = 0; i < pax.infants; i++) {
    list.push({
      title: "Master", firstName: "", lastName: "", dob: "", gender: "Male",
      nationality: "IN", passportNo: "", passportExpiry: "",
      email: "", phone: "",
      paxType: "infant", isLead: false,
    });
  }
  return list;
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SBTPassengers() {
  const { state } = useLocation() as { state: PassengerState | null };
  const navigate = useNavigate();

  const sbtRequest = (state as any)?.sbtRequest;
  const [passengers, setPassengers] = useState<PassengerForm[]>(() => {
    if (!state) return [];
    // Pre-fill from SBT request passenger details if available (L2 booking on behalf)
    if (sbtRequest?.passengerDetails?.length) {
      return sbtRequest.passengerDetails.map((pax: any, i: number) => ({
        title: pax.gender === "Female" ? "Ms" : "Mr",
        firstName: pax.firstName || "",
        lastName: pax.lastName || "",
        dob: pax.dateOfBirth || "",
        gender: pax.gender || "Male",
        nationality: pax.nationality || "IN",
        passportNo: pax.passportNumber || "",
        passportExpiry: pax.passportExpiry || "",
        email: i === 0 ? (sbtRequest.contactDetails?.email || "") : "",
        phone: i === 0 ? (sbtRequest.contactDetails?.phone || "") : "",
        paxType: "adult" as const,
        isLead: i === 0,
      }));
    }
    return buildEmptyPassengers(state.pax);
  });
  const [error, setError] = useState("");
  const [showBanner, setShowBanner] = useState(true);
  const [passportOpen, setPassportOpen] = useState<Record<number, boolean>>({});

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.inkMid, marginBottom: 16 }}>No flight selected.</p>
          <button onClick={() => navigate("/sbt/flights")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10,
              padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Flights
          </button>
        </div>
      </div>
    );
  }

  const { flight, pax, origin, dest, fareQuoteResult, priceChanged, newFare } = state;
  const isInternational = (state as any)?.flight?.IsInternational ?? false;

  const fqFare = fareQuoteResult?.Fare;
  const baseFare = Number(fqFare?.BaseFare ?? flight.Fare?.BaseFare ?? 0);
  const taxes = Number(fqFare?.Tax ?? flight.Fare?.Tax ?? 0);
  const totalFare = Number((fqFare?.PublishedFare ?? flight.Fare?.PublishedFare ?? (baseFare + taxes)) || 0);

  function updatePax(idx: number, field: keyof PassengerForm, value: string) {
    setPassengers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function validate(): string {
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.firstName.trim()) return `Passenger ${i + 1}: First name is required`;
      if (!p.lastName.trim()) return `Passenger ${i + 1}: Last name is required`;
      const dobRequired = p.paxType === "infant" || isInternational;
      if (dobRequired && !p.dob) return `Passenger ${i + 1}: Date of birth is required`;
      if (p.isLead) {
        if (!p.email.trim()) return "Lead passenger: Email is required";
        if (!p.phone.trim()) return "Lead passenger: Phone number is required";
      }
    }
    return "";
  }

  function handleContinue() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");

    const lead = passengers.find(p => p.isLead);
    navigate("/sbt/flights/book/seats", {
      state: {
        ...state,
        passengers,
        contactInfo: { email: lead?.email ?? "", phone: lead?.phone ?? "" },
      },
    });
  }

  // Count per type for labelling
  const adultCount: Record<number, number> = {};
  const childCount: Record<number, number> = {};
  const infantCount: Record<number, number> = {};

  function paxLabel(p: PassengerForm, idx: number): string {
    if (p.paxType === "adult") {
      adultCount[idx] = (adultCount[idx - 1] ?? 0) + (idx === 0 || passengers[idx - 1]?.paxType !== "adult" ? 1 : (adultCount[idx - 1] ?? 0) + 1);
    }
    const sameType = passengers.filter((x, j) => j <= idx && x.paxType === p.paxType).length;
    const typeLabel = p.paxType === "adult" ? "Adult" : p.paxType === "child" ? "Child" : "Infant";
    return `Passenger ${idx + 1} — ${typeLabel} ${sameType}`;
  }

  return (
    <div style={{ minHeight: "100vh", background: T.canvas }}>
      <BookingProgressBar currentStep="passengers" />

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "32px 24px", gap: 28 }}>
        {/* Left: Form */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Back button */}
          <button onClick={() => navigate("/sbt/flights/book/fare-validation", { state })} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 16,
            fontSize: 12, fontWeight: 600, color: T.inkMid,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          {/* Price changed banner */}
          {priceChanged && showBanner && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: `${T.amber}15`, border: `1px solid ${T.amber}40`,
              borderRadius: 12, padding: "10px 16px", marginBottom: 20,
            }}>
              <span style={{ fontSize: 13, color: T.ink }}>
                Fare updated: ₹{Number(flight.Fare?.PublishedFare ?? 0).toLocaleString("en-IN")} → ₹{(newFare ?? totalFare).toLocaleString("en-IN")}. You accepted this price.
              </span>
              <button onClick={() => setShowBanner(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, color: T.inkMid, padding: "0 4px", lineHeight: 1,
              }}>
                ×
              </button>
            </div>
          )}

          {/* Passenger cards */}
          {passengers.map((p, i) => {
            const titles = p.paxType === "adult" ? TITLES_ADULT : TITLES_CHILD;
            const isPassportOpen = passportOpen[i] ?? false;

            return (
              <div key={i} style={s.card}>
                {/* Header */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: T.ink,
                  marginBottom: 16, paddingBottom: 8,
                  borderBottom: `1px solid ${T.cardBorder}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {paxLabel(p, i)}
                  {p.isLead && (
                    <span style={{
                      fontSize: 10, background: `${T.gold}20`, color: T.gold,
                      padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    }}>
                      Lead Passenger
                    </span>
                  )}
                </div>

                {/* Row 1: Title + Names */}
                <div style={{ ...s.row, gridTemplateColumns: "120px 1fr 1fr", marginBottom: 12 }}>
                  <div>
                    <label style={s.label}>Title</label>
                    <select style={s.select} value={p.title}
                      onChange={e => updatePax(i, "title", e.target.value)}>
                      {titles.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>First Name *</label>
                    <input style={s.input} placeholder="As on ID"
                      value={p.firstName} onChange={e => updatePax(i, "firstName", e.target.value)} />
                  </div>
                  <div>
                    <label style={s.label}>Last Name *</label>
                    <input style={s.input} placeholder="As on ID"
                      value={p.lastName} onChange={e => updatePax(i, "lastName", e.target.value)} />
                  </div>
                </div>

                {/* Row 2: DOB + Gender + Nationality */}
                <div style={{ ...s.row, gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 12 }}>
                  <div>
                    <label style={s.label}>Date of Birth {(p.paxType === "infant" || isInternational) ? "*" : "(optional)"}</label>
                    <input style={s.input} type="date" value={p.dob}
                      onChange={e => updatePax(i, "dob", e.target.value)} />
                  </div>
                  <div>
                    <label style={s.label}>Gender</label>
                    <select style={s.select} value={p.gender}
                      onChange={e => updatePax(i, "gender", e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Nationality</label>
                    <select style={s.select} value={p.nationality}
                      onChange={e => updatePax(i, "nationality", e.target.value)}>
                      {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Lead pax: Email + Phone */}
                {p.isLead && (
                  <div style={{ ...s.row, gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Email *</label>
                      <input style={s.input} type="email" placeholder="you@email.com"
                        value={p.email} onChange={e => updatePax(i, "email", e.target.value)} />
                    </div>
                    <div>
                      <label style={s.label}>Phone *</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                        <span style={{
                          padding: "9px 10px", background: T.surface,
                          border: `1.5px solid ${T.cardBorder}`, borderRight: "none",
                          borderRadius: "10px 0 0 10px", fontSize: 13, color: T.inkMid,
                          whiteSpace: "nowrap",
                        }}>
                          +91
                        </span>
                        <input
                          style={{ ...s.input, borderRadius: "0 10px 10px 0" }}
                          type="tel" placeholder="9876543210"
                          value={p.phone} onChange={e => updatePax(i, "phone", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Passport section (collapsible) */}
                <div style={{ marginTop: 4 }}>
                  <button
                    onClick={() => setPassportOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600, color: T.inkMid,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isPassportOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    Passport Details (Optional)
                  </button>

                  {isPassportOpen && (
                    <div style={{ ...s.row, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                      <div>
                        <label style={s.label}>Passport Number</label>
                        <input style={s.input} placeholder="A1234567"
                          value={p.passportNo} onChange={e => updatePax(i, "passportNo", e.target.value)} />
                      </div>
                      <div>
                        <label style={s.label}>Passport Expiry</label>
                        <input style={s.input} type="month" placeholder="MM/YYYY"
                          value={p.passportExpiry} onChange={e => updatePax(i, "passportExpiry", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div style={{
              background: `${T.rose}15`, border: `1px solid ${T.rose}40`,
              borderRadius: 10, padding: "10px 16px", marginBottom: 16,
              color: T.rose, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            style={{
              width: "100%",
              padding: "14px 0",
              background: T.obsidian,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              letterSpacing: "0.5px",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.gold, e.currentTarget.style.color = T.obsidian)}
            onMouseLeave={e => (e.currentTarget.style.background = T.obsidian, e.currentTarget.style.color = "#fff")}
          >
            Continue to Seats →
          </button>
        </div>

        {/* Right: PriceSummary */}
        <PriceSummary
          flight={flight}
          origin={origin}
          dest={dest}
          pax={pax}
          baseFare={baseFare}
          taxes={taxes}
          totalFare={totalFare}
          confirmedFare={priceChanged ? newFare : null}
        />
      </div>
    </div>
  );
}
