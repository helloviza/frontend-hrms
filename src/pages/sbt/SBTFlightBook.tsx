import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { AirlineLogo, SBTFlight, T, formatTime, formatDur } from "../../components/sbt/FlightResultCard";

/* ── TBO Passenger shape ─────────────────────────────────────────────── */
interface TBOPassenger {
  Title: string;
  FirstName: string;
  LastName: string;
  PaxType: number; // 1=Adult, 2=Child, 3=Infant
  DateOfBirth: string; // "DD/MM/YYYY"
  Gender: number; // 1=Male, 2=Female
  PassportNo: string;
  PassportExpiry: string; // "MM/YYYY"
  Nationality: string;
  AddressLine1: string;
  City: string;
  CountryCode: string;
  CountryName: string;
  ContactNo: string;
  Email: string;
  IsLeadPax: boolean;
  FFAirlineCode?: string;
  FFNumber?: string;
  GSTCompanyAddress?: string;
  GSTCompanyContactNumber?: string;
  GSTCompanyName?: string;
  GSTNumber?: string;
  GSTCompanyEmail?: string;
}

/* ── Booking state passed from SBTFlightSearch via navigate() ─────────── */
interface BookState {
  flight: SBTFlight;
  traceId: string;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  cabin: number;
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
const TITLES_ADULT = ["Mr", "Mrs", "Miss", "Ms", "Dr"];
const TITLES_CHILD = ["Master", "Miss"];
const COUNTRIES = [
  { code: "IN", name: "India" }, { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" }, { code: "AE", name: "UAE" },
  { code: "SG", name: "Singapore" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "CA", name: "Canada" }, { code: "JP", name: "Japan" },
];

function emptyPax(type: number, isLead: boolean): TBOPassenger {
  return {
    Title: type === 1 ? "Mr" : "Master",
    FirstName: "", LastName: "",
    PaxType: type,
    DateOfBirth: "", Gender: 1,
    PassportNo: "", PassportExpiry: "",
    Nationality: "IN",
    AddressLine1: "", City: "",
    CountryCode: "IN", CountryName: "India",
    ContactNo: "", Email: "",
    IsLeadPax: isLead,
  };
}

function buildPassengers(pax: BookState["pax"]): TBOPassenger[] {
  const list: TBOPassenger[] = [];
  for (let i = 0; i < pax.adults; i++) list.push(emptyPax(1, i === 0));
  for (let i = 0; i < pax.children; i++) list.push(emptyPax(2, false));
  for (let i = 0; i < pax.infants; i++) list.push(emptyPax(3, false));
  return list;
}

function paxLabel(type: number, idx: number): string {
  if (type === 1) return `Adult ${idx + 1}`;
  if (type === 2) return `Child ${idx + 1}`;
  return `Infant ${idx + 1}`;
}

/* ── Inline styles using T tokens ─────────────────────────────────────── */
const s = {
  page: {
    height: "100vh", overflowY: "auto" as const, background: T.canvas, fontFamily: "inherit",
  } as React.CSSProperties,
  header: {
    background: T.obsidian, borderBottom: `1px solid rgba(255,255,255,0.08)`,
    padding: "0 24px", height: 60, display: "flex", alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  container: {
    maxWidth: 900, margin: "0 auto", padding: "32px 16px 80px",
  } as React.CSSProperties,
  card: {
    background: "#fff", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 16, padding: "20px 24px", marginBottom: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: T.ink,
    marginBottom: 16, paddingBottom: 8,
    borderBottom: `1px solid ${T.cardBorder}`,
  } as React.CSSProperties,
  label: {
    fontSize: 11, fontWeight: 600, color: T.inkMid,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    display: "block", marginBottom: 4,
  },
  input: {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10, fontSize: 13, color: T.ink,
    background: T.surface, outline: "none", boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  },
  select: {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10, fontSize: 13, color: T.ink,
    background: T.surface, outline: "none", boxSizing: "border-box" as const,
    appearance: "none" as const,
  },
  row: {
    display: "grid", gap: 12,
  } as React.CSSProperties,
  stepDot: (active: boolean, done: boolean) => ({
    width: 32, height: 32, borderRadius: "50%",
    background: done ? T.emerald : active ? T.gold : T.surface,
    border: `2px solid ${done ? T.emerald : active ? T.gold : T.cardBorder}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700,
    color: done ? "#fff" : active ? T.obsidian : T.inkFaint,
    flexShrink: 0,
  } as React.CSSProperties),
};

/* ══════════════════════════════════════════════════════════════════════ */
export default function SBTFlightBook() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as BookState | null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [passengers, setPassengers] = useState<TBOPassenger[]>(
    state ? buildPassengers(state.pax) : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Fare quote state (step 2)
  const [fareQuoteResult, setFareQuoteResult] = useState<any>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [newFare, setNewFare] = useState<number>(0);
  const [priceAccepted, setPriceAccepted] = useState(false);

  // Fare rules state (step 3)
  const [fareRules, setFareRules] = useState<any>(null);
  const [fareRulesLoading, setFareRulesLoading] = useState(false);
  const [fareRulesOpen, setFareRulesOpen] = useState(false);

  /* Guard — no state means direct URL access */
  if (!state) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  const { flight, traceId, origin, dest, pax } = state;
  const seg = flight.Segments[0][0];
  const totalFare = (flight.Fare.PublishedFare || flight.Fare.TotalFare) * pax.adults;

  /* ── Load fare quote when entering step 2 ──────────────────────── */
  async function loadFareQuote() {
    setFareLoading(true);
    setError("");
    try {
      const response = await api.post("/sbt/flights/farequote", {
        TraceId: traceId,
        ResultIndex: flight.ResultIndex,
      });
      setFareQuoteResult(response);
      if (response?.Response?.IsPriceChanged === true) {
        setPriceChanged(true);
        const fqFare = response?.Response?.Results?.Fare;
        setNewFare((fqFare?.PublishedFare || fqFare?.TotalFare || 0) * pax.adults);
      }
    } catch (err: any) {
      setError(err.message || "Fare quote failed.");
    } finally {
      setFareLoading(false);
    }
  }

  async function loadFareRules() {
    if (fareRules) return;
    setFareRulesLoading(true);
    try {
      const result = await api.post("/sbt/flights/farerule", {
        TraceId: traceId,
        ResultIndex: fareQuoteResult?.Response?.Results?.ResultIndex || flight.ResultIndex,
      });
      setFareRules(result?.Response?.FareRules || []);
    } catch {
      setFareRules([]);
    } finally {
      setFareRulesLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (step === 2) loadFareQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ── Passenger field update ───────────────────────────────────────── */
  function updatePax(idx: number, field: keyof TBOPassenger, value: string | number | boolean) {
    setPassengers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "CountryCode") {
        const c = COUNTRIES.find(x => x.code === value);
        if (c) next[idx].CountryName = c.name;
      }
      return next;
    });
  }

  /* ── Validation ───────────────────────────────────────────────────── */
  function validate(): string {
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.FirstName.trim()) return `Passenger ${i + 1}: First name required`;
      if (!p.LastName.trim()) return `Passenger ${i + 1}: Last name required`;
      if (!p.ContactNo.trim() && p.IsLeadPax) return "Lead passenger: Phone required";
      if (!p.Email.trim() && p.IsLeadPax) return "Lead passenger: Email required";
    }
    return "";
  }

  /* ── Submit booking (LCC vs Non-LCC) ───────────────────────────── */
  async function confirmBooking() {
    setLoading(true);
    setError("");
    try {
      const endPayload = {
        TraceId: traceId,
        ResultIndex: fareQuoteResult?.Response?.Results?.ResultIndex || flight.ResultIndex,
        Passengers: passengers,
        IsPriceChangeAccepted: priceChanged && priceAccepted,
      };

      if (flight.IsLCC) {
        // LCC: go straight to Ticket (no Book step)
        const result = await api.post("/sbt/flights/ticket-lcc", endPayload);
        setBookingResult(result);
        setStep(4);
      } else {
        // Non-LCC: Book first to hold PNR, then Ticket
        const bookResult = await api.post("/sbt/flights/book", endPayload);
        const bookResponse = bookResult?.Response?.Response;
        if (!bookResponse?.BookingId) throw new Error(bookResult?.Response?.Error?.ErrorMessage || "Booking failed");

        const ticketResult = await api.post("/sbt/flights/ticket", {
          TraceId: traceId,
          PNR: bookResponse.PNR,
          BookingId: bookResponse.BookingId,
          Passengers: passengers,
          IsPriceChangeAccepted: priceChanged && priceAccepted,
        });
        setBookingResult(ticketResult);
        setStep(4);
      }
    } catch (err: any) {
      setError(err.message || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step bar ─────────────────────────────────────────────────────── */
  const STEPS = ["Passenger Details", "Fare Confirmation", "Review & Confirm", "Booking Confirmed"];

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/sbt/flights")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)",
              cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>
            ←
          </button>
          <AirlineLogo code={seg.Airline.AirlineCode} darkMode size="sm" />
          <div>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>
              {origin.city} → {dest.city}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: 0 }}>
              {seg.Airline.FlightNumber} · {formatTime(seg.Origin.DepTime)} → {formatTime(seg.Destination.ArrTime)}
              · {formatDur(seg.Duration)}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: T.gold, fontSize: 18, fontWeight: 800, margin: 0 }}>
            ₹{totalFare.toLocaleString("en-IN")}
          </p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, margin: 0 }}>
            {pax.adults + pax.children + pax.infants} passenger{pax.adults + pax.children + pax.infants > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div style={s.container}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "initial" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={s.stepDot(active, done)}>
                    {done ? "✓" : n}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600,
                    color: active ? T.gold : done ? T.emerald : T.inkFaint,
                    whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? T.emerald : T.cardBorder,
                    margin: "0 8px", marginBottom: 16 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Passenger Details ── */}
        {step === 1 && (
          <>
            {passengers.map((p, i) => (
              <div key={i} style={s.card}>
                <p style={s.sectionTitle}>
                  {paxLabel(p.PaxType, passengers.filter(x => x.PaxType === p.PaxType).indexOf(p))}
                  {p.IsLeadPax && (
                    <span style={{ marginLeft: 8, fontSize: 10, background: `${T.gold}20`,
                      color: T.gold, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                      Lead Passenger
                    </span>
                  )}
                </p>

                {/* Row 1: Title + Names */}
                <div style={{ ...s.row, gridTemplateColumns: "120px 1fr 1fr", marginBottom: 12 }}>
                  <div>
                    <label style={s.label}>Title</label>
                    <select style={s.select} value={p.Title}
                      onChange={e => updatePax(i, "Title", e.target.value)}>
                      {(p.PaxType === 1 ? TITLES_ADULT : TITLES_CHILD).map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>First Name</label>
                    <input style={s.input} placeholder="As on passport"
                      value={p.FirstName} onChange={e => updatePax(i, "FirstName", e.target.value)} />
                  </div>
                  <div>
                    <label style={s.label}>Last Name</label>
                    <input style={s.input} placeholder="As on passport"
                      value={p.LastName} onChange={e => updatePax(i, "LastName", e.target.value)} />
                  </div>
                </div>

                {/* Row 2: DOB + Gender */}
                <div style={{ ...s.row, gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
                  <div>
                    <label style={s.label}>Date of Birth</label>
                    <input style={s.input} type="date"
                      value={p.DateOfBirth ? p.DateOfBirth.split("/").reverse().join("-") : ""}
                      onChange={e => {
                        const [y, m, d] = e.target.value.split("-");
                        updatePax(i, "DateOfBirth", `${d}/${m}/${y}`);
                      }} />
                  </div>
                  <div>
                    <label style={s.label}>Gender</label>
                    <select style={s.select} value={p.Gender}
                      onChange={e => updatePax(i, "Gender", +e.target.value)}>
                      <option value={1}>Male</option>
                      <option value={2}>Female</option>
                    </select>
                  </div>
                </div>

                {/* Lead pax contact */}
                {p.IsLeadPax && (
                  <div style={{ ...s.row, gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
                    <div>
                      <label style={s.label}>Phone</label>
                      <input style={s.input} placeholder="+91 9876543210"
                        value={p.ContactNo} onChange={e => updatePax(i, "ContactNo", e.target.value)} />
                    </div>
                    <div>
                      <label style={s.label}>Email</label>
                      <input style={s.input} type="email" placeholder="you@email.com"
                        value={p.Email} onChange={e => updatePax(i, "Email", e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Passport */}
                <div style={{ ...s.row, gridTemplateColumns: "1fr 140px 1fr", marginBottom: 12 }}>
                  <div>
                    <label style={s.label}>Passport No. <span style={{ color: T.inkFaint, fontWeight: 400 }}>(optional)</span></label>
                    <input style={s.input} placeholder="A1234567"
                      value={p.PassportNo} onChange={e => updatePax(i, "PassportNo", e.target.value)} />
                  </div>
                  <div>
                    <label style={s.label}>Expiry (MM/YYYY)</label>
                    <input style={s.input} placeholder="12/2028"
                      value={p.PassportExpiry} onChange={e => updatePax(i, "PassportExpiry", e.target.value)} />
                  </div>
                  <div>
                    <label style={s.label}>Nationality</label>
                    <select style={s.select} value={p.CountryCode}
                      onChange={e => updatePax(i, "CountryCode", e.target.value)}>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <div style={{ background: `${T.rose}15`, border: `1px solid ${T.rose}40`,
                borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.rose, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { const e = validate(); if (e) { setError(e); return; } setError(""); setStep(2); }}
                style={{ background: T.obsidian, color: "#fff", border: "none", borderRadius: 12,
                  padding: "12px 32px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  letterSpacing: "0.5px" }}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Fare Confirmation ── */}
        {step === 2 && (
          <div>
            {fareLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    border: `3px solid rgba(201,169,110,0.2)`, borderTopColor: T.gold,
                    animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
                  }} />
                  <p style={{ color: T.inkMid, fontSize: 14 }}>Confirming fare with airline…</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              </div>
            ) : error ? (
              <div style={{ ...s.card, textAlign: "center", padding: "40px 24px" }}>
                <p style={{ color: T.rose, fontSize: 14, marginBottom: 16 }}>{error}</p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={() => { setError(""); loadFareQuote(); }}
                    style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10,
                      padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    Retry
                  </button>
                  <button onClick={() => navigate("/sbt/flights")}
                    style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 10,
                      padding: "10px 24px", fontWeight: 600, cursor: "pointer", fontSize: 13, color: T.inkMid }}>
                    Go Back
                  </button>
                </div>
              </div>
            ) : priceChanged ? (
              <div style={{ ...s.card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%",
                  background: `${T.amber}15`, border: `2px solid ${T.amber}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, margin: "0 auto 16px" }}>
                  ⚠
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: "0 0 8px" }}>
                  Fare has changed
                </h3>
                <p style={{ fontSize: 13, color: T.inkMid, margin: "0 0 24px" }}>
                  The fare for this flight has changed since your search.
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", margin: "0 0 4px" }}>Original</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: T.inkFaint, margin: 0, textDecoration: "line-through" }}>
                      ₹{totalFare.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span style={{ fontSize: 20, color: T.inkFaint }}>→</span>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.amber, textTransform: "uppercase", margin: "0 0 4px" }}>New Fare</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: T.amber, margin: 0 }}>
                      ₹{newFare.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    onClick={() => { setPriceAccepted(true); setStep(3); }}
                    style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 12,
                      padding: "12px 32px", fontWeight: 800, fontSize: 14, cursor: "pointer",
                      boxShadow: `0 4px 16px ${T.gold}40` }}>
                    Accept New Fare
                  </button>
                  <button onClick={() => navigate("/sbt/flights")}
                    style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                      padding: "12px 24px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>
                    Go Back
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Fare confirmed — price unchanged */}
                <div style={s.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%",
                      background: `${T.emerald}15`, border: `2px solid ${T.emerald}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, flexShrink: 0 }}>
                      ✓
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.emerald, margin: 0 }}>Fare confirmed</p>
                      <p style={{ fontSize: 12, color: T.inkMid, margin: 0 }}>Price unchanged since your search</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px",
                    background: T.surface, borderRadius: 12 }}>
                    <AirlineLogo code={seg.Airline.AirlineCode} size="sm" />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                        {seg.Airline.AirlineName} · {seg.Airline.FlightNumber}
                      </p>
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: 0 }}>
                        {formatTime(seg.Origin.DepTime)} → {formatTime(seg.Destination.ArrTime)} · {formatDur(seg.Duration)}
                        {flight.IsLCC && <span style={{ marginLeft: 6, fontSize: 10, background: `${T.amber}20`,
                          color: T.amber, padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>LCC</span>}
                      </p>
                    </div>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.gold, margin: 0 }}>
                      ₹{totalFare.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => setStep(1)}
                    style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                      padding: "12px 24px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button onClick={() => setStep(3)}
                    style={{ background: T.obsidian, color: "#fff", border: "none", borderRadius: 12,
                      padding: "12px 32px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                      letterSpacing: "0.5px" }}>
                    Continue to Review →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Review & Confirm ── */}
        {step === 3 && (
          <>
            {/* Flight summary card */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Flight Details</p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <AirlineLogo code={seg.Airline.AirlineCode} size="lg" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: "0 0 2px" }}>
                    {seg.Airline.AirlineName} · {seg.Airline.FlightNumber}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>
                        {formatTime(seg.Origin.DepTime)}
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.gold, margin: 0 }}>
                        {seg.Origin.Airport.AirportCode}
                      </p>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: "0 0 4px" }}>
                        {formatDur(seg.Duration)}
                      </p>
                      <div style={{ height: 1, background: T.cardBorder, position: "relative" }}>
                        <span style={{ position: "absolute", left: "50%", top: -8, transform: "translateX(-50%)",
                          fontSize: 14 }}>✈</span>
                      </div>
                      <p style={{ fontSize: 10, color: T.emerald, fontWeight: 600, margin: "6px 0 0" }}>
                        {flight.Segments[0].length === 1 ? "Non-stop" : `${flight.Segments[0].length - 1} stop`}
                      </p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>
                        {formatTime(seg.Destination.ArrTime)}
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.gold, margin: 0 }}>
                        {seg.Destination.Airport.AirportCode}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Passengers summary */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Passengers ({passengers.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {passengers.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: T.surface, borderRadius: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                        {p.Title} {p.FirstName} {p.LastName}
                      </p>
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: 0 }}>
                        {p.PaxType === 1 ? "Adult" : p.PaxType === 2 ? "Child" : "Infant"}
                        {p.IsLeadPax ? " · Lead Passenger" : ""}
                        {p.ContactNo ? ` · ${p.ContactNo}` : ""}
                      </p>
                    </div>
                    {p.PassportNo && (
                      <span style={{ fontSize: 11, color: T.inkMid }}>🛂 {p.PassportNo}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fare summary */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Fare Breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: T.inkMid }}>Base Fare × {pax.adults}</span>
                  <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>
                    ₹{(flight.Fare.BaseFare * pax.adults).toLocaleString("en-IN")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: T.inkMid }}>Taxes & Fees</span>
                  <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>
                    ₹{(flight.Fare.Tax * pax.adults).toLocaleString("en-IN")}
                  </span>
                </div>
                <div style={{ height: 1, background: T.cardBorder, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>
                    ₹{(priceChanged && priceAccepted ? newFare : totalFare).toLocaleString("en-IN")}
                  </span>
                </div>
                {priceChanged && priceAccepted && (
                  <p style={{ fontSize: 11, color: T.amber, margin: "4px 0 0", fontWeight: 600 }}>
                    ⚠ Price changed from ₹{totalFare.toLocaleString("en-IN")} — you accepted the new fare
                  </p>
                )}
                <p style={{ fontSize: 11, color: T.inkFaint, margin: "4px 0 0" }}>
                  {flight.NonRefundable ? "⚠ Non-refundable fare" : "✓ Refundable fare"}
                  {flight.IsLCC ? " · LCC (direct ticketing)" : " · GDS (Book + Ticket)"}
                </p>
              </div>
            </div>

            {/* Cancellation & Date Change Policy */}
            <div style={{ ...s.card, padding: "14px 20px" }}>
              <button
                onClick={() => { setFareRulesOpen(v => !v); if (!fareRulesOpen) loadFareRules(); }}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between",
                  alignItems: "center", background: "none", border: "none",
                  cursor: "pointer", padding: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                  Cancellation & Date Change Policy
                </span>
                <span style={{ fontSize: 12, color: T.inkFaint }}>{fareRulesOpen ? "Hide" : "Show"}</span>
              </button>

              {fareRulesOpen && (
                <div style={{ marginTop: 14 }}>
                  {fareRulesLoading ? (
                    <p style={{ fontSize: 13, color: T.inkMid }}>Loading fare rules...</p>
                  ) : !fareRules?.length ? (
                    <p style={{ fontSize: 13, color: T.inkMid }}>Fare rules not available for this flight.</p>
                  ) : (
                    fareRules.map((rule: any, i: number) => (
                      <div key={i} style={{ marginBottom: 12, paddingBottom: 12,
                        borderBottom: i < fareRules.length - 1 ? `1px solid ${T.cardBorder}` : "none" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.inkMid,
                          textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                          {rule.Origin} &rarr; {rule.Destination}
                        </p>
                        <p style={{ fontSize: 12, color: T.ink, lineHeight: 1.7, margin: 0,
                          whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                          {rule.FareRuleDetail || "No details available."}
                        </p>
                      </div>
                    ))
                  )}
                  <p style={{ fontSize: 10, color: T.inkFaint, margin: "10px 0 0", lineHeight: 1.5 }}>
                    Fees are indicative per pax per sector. GST + RAF + applicable charges extra.
                    For domestic: submit requests 2hrs before airline deadline.
                    For international: 4hrs before airline deadline.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: `${T.rose}15`, border: `1px solid ${T.rose}40`,
                borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.rose, fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setStep(2)}
                style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                  padding: "12px 24px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>
                ← Back
              </button>
              <button onClick={confirmBooking} disabled={loading}
                style={{ background: loading ? T.inkFaint : T.gold, color: T.obsidian, border: "none",
                  borderRadius: 12, padding: "12px 36px", fontWeight: 800, fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.5px",
                  boxShadow: `0 4px 16px ${T.gold}40` }}>
                {loading ? "Processing…" : "Confirm & Book →"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 4: Booking Confirmed ── */}
        {step === 4 && (
          <div style={{ ...s.card, textAlign: "center", padding: "48px 32px" }}>
            {/* Success icon */}
            <div style={{ width: 72, height: 72, borderRadius: "50%",
              background: `${T.emerald}15`, border: `2px solid ${T.emerald}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, margin: "0 auto 20px" }}>
              ✓
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: "0 0 8px" }}>
              Booking Confirmed!
            </h2>
            <p style={{ fontSize: 14, color: T.inkMid, margin: "0 0 28px" }}>
              Your flight from {origin.city} to {dest.city} has been booked successfully.
            </p>

            {/* Booking reference */}
            {bookingResult && (
              <div style={{ background: T.surface, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 14, padding: "16px 24px", marginBottom: 28, display: "inline-block",
                minWidth: 260 }}>
                {bookingResult?.Response?.Response?.BookingId && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint,
                      textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>
                      Booking ID
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.obsidian, margin: 0,
                      letterSpacing: "0.05em" }}>
                      {bookingResult.Response.Response.BookingId}
                    </p>
                  </div>
                )}
                {bookingResult?.Response?.Response?.PNR && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint,
                      textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>
                      PNR
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.gold, margin: 0,
                      letterSpacing: "0.08em" }}>
                      {bookingResult.Response.Response.PNR}
                    </p>
                  </div>
                )}
                {bookingResult?.Response?.Response?.TicketId && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint,
                      textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>
                      Ticket ID
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: 0,
                      letterSpacing: "0.05em" }}>
                      {bookingResult.Response.Response.TicketId}
                    </p>
                  </div>
                )}
                {!bookingResult?.Response?.Response?.BookingId && !bookingResult?.Response?.Response?.PNR && (
                  <p style={{ fontSize: 13, color: T.inkMid, margin: 0 }}>
                    Booking reference received.
                  </p>
                )}
              </div>
            )}

            {/* Flight summary pill */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              marginBottom: 32 }}>
              <AirlineLogo code={seg.Airline.AirlineCode} size="sm" />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                {seg.Airline.FlightNumber}
              </span>
              <span style={{ fontSize: 13, color: T.inkMid }}>
                {formatTime(seg.Origin.DepTime)} → {formatTime(seg.Destination.ArrTime)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>
                ₹{(priceChanged && priceAccepted ? newFare : totalFare).toLocaleString("en-IN")}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => navigate("/booking-history")}
                style={{ background: T.obsidian, color: "#fff", border: "none", borderRadius: 12,
                  padding: "12px 28px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                View Bookings
              </button>
              <button onClick={() => navigate("/sbt/flights")}
                style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
                  padding: "12px 28px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>
                Search Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
