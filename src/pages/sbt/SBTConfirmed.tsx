import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { SBTFlight, T, AirlineLogo, formatTime, formatDur, formatDateShort } from "../../components/sbt/FlightResultCard";
import BookingProgressBar from "../../components/sbt/BookingProgressBar";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface PassengerForm {
  title: string; firstName: string; lastName: string;
  dob: string; gender: string; nationality: string;
  passportNo: string; passportExpiry: string;
  email: string; phone: string;
  paxType: "adult" | "child" | "infant" | number;
  isLead: boolean;
}
interface BaggageOption { code: string; description: string; weight: string; price: number; }
interface MealOption { code: string; description: string; price: number; }

interface ConfirmedState {
  flight: SBTFlight;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  cabin: number;
  passengers: PassengerForm[];
  contactInfo: { email: string; phone: string };
  selectedSeats: Record<number, { seatCode: string; price: number }>;
  selectedBaggage: Record<number, BaggageOption>;
  selectedMeals: Record<number, MealOption>;
  extras: { seats: number; baggage: number; meals: number };
  fareQuoteResult?: any;
  priceChanged?: boolean;
  newFare?: number | null;
  bookingResult: Record<string, any>;
  pnr?: string;
  bookingId?: string;
  ticketId?: string;
}

const CABIN_MAP: Record<number, string> = { 1: "All", 2: "Economy", 3: "Prem Economy", 4: "Business", 5: "Prem Business", 6: "First" };
const paxTypeLabel = (t: number | string) =>
  t === 2 || t === "child" ? "Child" : t === 3 || t === "infant" ? "Infant" : "Adult";

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SBTConfirmed() {
  const { state } = useLocation() as { state: ConfirmedState | null };
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: '#f1f5f9', display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: '#475569', marginBottom: 16 }}>No booking information found.</p>
          <button onClick={() => navigate("/sbt/flights")}
            style={{ background: '#00477f', color: '#ffffff', border: "none", borderRadius: 10,
              padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Flights
          </button>
        </div>
      </div>
    );
  }

  const {
    flight, origin, dest, pax, cabin, passengers, contactInfo,
    selectedSeats, selectedBaggage, selectedMeals, extras,
    fareQuoteResult, priceChanged, newFare, bookingResult,
  } = state;

  const seg = flight.Segments[0][0];
  const segLast = flight.Segments[0][flight.Segments[0].length - 1];
  const stops = flight.Segments[0].length - 1;
  const fqFare = fareQuoteResult?.Fare;
  const baseFare = Number(fqFare?.BaseFare ?? flight.Fare?.BaseFare ?? 0);
  const taxes = Number(fqFare?.Tax ?? flight.Fare?.Tax ?? 0);
  const totalFare = priceChanged && newFare
    ? newFare
    : Number((fqFare?.PublishedFare ?? flight.Fare?.PublishedFare ?? (baseFare + taxes)) || 0);
  const extrasTotal = (extras?.seats ?? 0) + (extras?.baggage ?? 0) + (extras?.meals ?? 0);
  const grandTotal = totalFare + extrasTotal;

  const pnr = bookingResult?.PNR || bookingResult?.Booking?.PNR || state?.pnr || "";
  const bkId = String(bookingResult?.BookingId ?? bookingResult?.Booking?.BookingId ?? state?.bookingId ?? "");
  const tkId = bookingResult?.TicketId || bookingResult?.Passenger?.[0]?.Ticket?.TicketId || state?.ticketId || bkId || "";

  function copyPNR() {
    navigator.clipboard.writeText(pnr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function generateICS() {
    const depTime = seg.Origin.DepTime ?? "";
    const arrTime = segLast.Destination.ArrTime ?? "";
    const dtStart = toICSDate(depTime);
    const dtEnd = toICSDate(arrTime);
    const summary = `Flight ${seg.Airline.FlightNumber} ${origin.code}-${dest.code}`;
    const desc = `PNR: ${pnr}\\nBooking ID: ${bkId}\\n${seg.Airline.AirlineName}`;

    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PlumTrips//SBT//EN",
      "BEGIN:VEVENT",
      `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`, `DESCRIPTION:${desc}`,
      `LOCATION:${origin.city} to ${dest.city}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flight-${pnr}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toICSDate(dt: string): string {
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return "20260101T000000Z";
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    } catch {
      return "20260101T000000Z";
    }
  }

  async function handleDownloadTicket() {
    const tab = window.open("", "_blank");
    if (!tab) {
      alert("Please allow popups for this site to download tickets.");
      return;
    }
    try {
      let offerData: OfferConfig | null = null;
      try {
        const offerRes = await api.get("/admin/sbt/offer");
        if (offerRes?.enabled) offerData = offerRes;
      } catch { /* silent */ }

      let logoBase64 = "";
      try {
        const logoResponse = await fetch("/assets/logo.png");
        const logoBlob = await logoResponse.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      } catch { logoBase64 = ""; }

      const ticketBooking: TicketBooking = {
        pnr,
        bookingId: bkId,
        ticketId: tkId,
        status: "CONFIRMED",
        origin,
        destination: dest,
        departureTime: seg.Origin.DepTime,
        arrivalTime: segLast.Destination.ArrTime,
        airlineCode: seg.Airline.AirlineCode,
        airlineName: seg.Airline.AirlineName,
        flightNumber: seg.Airline.FlightNumber,
        cabin,
        passengers: passengers.map(p => ({
          title: p.title,
          firstName: p.firstName,
          lastName: p.lastName,
          paxType: paxTypeLabel(p.paxType).toLowerCase(),
          isLead: p.isLead,
        })),
        baseFare,
        taxes,
        extras: extrasTotal,
        totalFare: grandTotal,
        currency: fqFare?.Currency ?? "INR",
        isLCC: flight.IsLCC,
        bookedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const html = generateTicketHTML(ticketBooking, offerData, logoBase64);
      const ticketBlob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(ticketBlob);
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab.close();
      console.error("Ticket generation failed:", err);
      alert("Could not generate ticket. Please try again.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: '#f1f5f9' }}>
      <BookingProgressBar currentStep="confirmed" />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── Success Header ────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #00477f 0%, #0066aa 100%)',
          borderRadius: 20, padding: "40px 32px", textAlign: "center",
          marginBottom: 24, position: "relative", overflow: "hidden",
        }}>
          {/* Confetti particles (CSS) */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                width: 6, height: 6, borderRadius: i % 3 === 0 ? "50%" : 1,
                background: ["#C9A96E", "#00b67a", "#f59e0b", "#fff"][i % 4],
                left: `${5 + (i * 4.7) % 90}%`,
                top: `-10%`,
                opacity: 0.7,
                animation: `confetti-fall ${2 + (i % 3)}s ease-in ${(i * 0.15) % 1.5}s infinite`,
              }} />
            ))}
          </div>

          {/* Animated checkmark */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: '4px solid #ffffff',
            background: 'rgba(255,255,255,0.15)',
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", position: "relative",
            animation: "check-pop 0.5s ease-out",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" style={{
                strokeDasharray: 30, strokeDashoffset: 30,
                animation: "check-draw 0.6s ease-out 0.3s forwards",
              }} />
            </svg>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", margin: "0 0 8px", letterSpacing: '-0.02em' }}>
            Booking Confirmed!
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", fontWeight: 500, margin: 0 }}>
            Your flight from {origin.city} to {dest.city} has been booked successfully
          </p>
        </div>

        {/* ── Booking Reference ─────────────────────────────── */}
        <div style={{
          background: '#ffffff', border: '2px solid #00477f',
          borderRadius: 16, padding: "20px 28px", marginBottom: 20,
          display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center",
          justifyContent: "center", boxShadow: '0 4px 16px rgba(0,71,127,0.12)',
        }}>
          {pnr && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>PNR</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 32, fontWeight: 900, color: '#00477f', margin: 0, letterSpacing: "0.08em" }}>
                  {pnr}
                </p>
                <button onClick={copyPNR} title="Copy PNR" style={{
                  background: "none", border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center",
                }}>
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b67a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  )}
                </button>
              </div>
            </div>
          )}
          {bkId && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Booking ID</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{bkId}</p>
            </div>
          )}
          {tkId && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Ticket Number</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{tkId}</p>
            </div>
          )}
          <p style={{ width: "100%", textAlign: "center", fontSize: 11, color: '#64748b', margin: 0 }}>
            Save this reference number for check-in and support
          </p>
        </div>

        {/* ── Flight Summary ────────────────────────────────── */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AirlineLogo code={seg.Airline.AirlineCode} size="lg" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: "0 0 2px" }}>
                {seg.Airline.AirlineName} · {seg.Airline.FlightNumber}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>{formatTime(seg.Origin.DepTime)}</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#00477f', margin: 0 }}>{seg.Origin.Airport.AirportCode}</p>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{formatDateShort(seg.Origin.DepTime)}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: "0 0 3px" }}>{formatDur(seg.Duration)}</p>
                  <div style={{ height: 1, background: '#e2e8f0', position: "relative" }}>
                    <span style={{ position: "absolute", left: "50%", top: -8, transform: "translateX(-50%)", fontSize: 14 }}>✈</span>
                  </div>
                  <p style={{ fontSize: 10, color: stops ? '#f59e0b' : '#00b67a', fontWeight: 600, margin: "5px 0 0" }}>
                    {stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0 }}>{formatTime(segLast.Destination.ArrTime)}</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#00477f', margin: 0 }}>{segLast.Destination.Airport.AirportCode}</p>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>{formatDateShort(segLast.Destination.ArrTime)}</p>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#64748b', margin: "8px 0 0" }}>
                {CABIN_MAP[cabin] ?? "Economy"} · {pax.adults + pax.children + pax.infants} passenger{(pax.adults + pax.children + pax.infants) > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </Card>

        {/* ── Passengers ────────────────────────────────────── */}
        <Card>
          <SectionTitle>Passengers</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {passengers.map((p, i) => {
              const seat = selectedSeats?.[i];
              const meal = selectedMeals?.[i];
              const bag = selectedBaggage?.[i];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: '#f8fafc', borderRadius: 10,
                  border: '1px solid #e2e8f0',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b67a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      {p.title} {p.firstName} {p.lastName}
                    </span>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, marginLeft: 8 }}>
                      · {paxTypeLabel(p.paxType)}
                      {seat ? ` · Seat ${seat.seatCode}` : ""}
                      {meal ? ` · ${meal.description}` : ""}
                      {bag ? ` · ${bag.description}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Fare Summary ──────────────────────────────────── */}
        <Card>
          <SectionTitle>Fare Summary</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FareRow label="Base fare" value={baseFare} />
            <FareRow label="Taxes & fees" value={taxes} />
            {(extras?.seats ?? 0) > 0 && <FareRow label="Seat charges" value={extras.seats} />}
            {(extras?.baggage ?? 0) > 0 && <FareRow label="Baggage charges" value={extras.baggage} />}
            {(extras?.meals ?? 0) > 0 && <FareRow label="Meal charges" value={extras.meals} />}
            <div style={{ height: 1, background: '#e2e8f0', margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: '#00477f', borderRadius: 12, padding: '12px 16px', marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Total paid</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </Card>

        {/* ── Action Buttons ────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <ActionBtn primary label="Download Ticket"
            onClick={handleDownloadTicket} />
          <ActionBtn label="Email Itinerary"
            onClick={() => alert(`Itinerary sent to ${contactInfo.email}`)} />
          <ActionBtn label="Add to Calendar" onClick={generateICS} />
        </div>

        {/* ── What's Next ───────────────────────────────────── */}
        <Card>
          <SectionTitle>What's Next</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Step n={1} text={`Check your email at ${contactInfo.email} for e-ticket confirmation`} />
            <Step n={2} text="Complete web check-in 24 hours before departure on airline website" />
            <Step n={3} text="Carry a valid photo ID matching your booking name" />
            <Step n={4} text="Arrive at airport: domestic 2 hrs · international 3 hrs before" />
          </div>
        </Card>

        {/* ── Bottom Buttons ────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button onClick={() => navigate("/sbt/flights")} style={{
            flex: 1, padding: "14px 0", background: '#00477f', color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>
            Book Another Flight
          </button>
          <button onClick={() => navigate("/sbt/flights/bookings")} style={{
            flex: 1, padding: "14px 0", background: '#ffffff',
            border: '1.5px solid #00477f', borderRadius: 12,
            fontWeight: 600, fontSize: 14, color: '#00477f', cursor: "pointer",
          }}>
            View My Bookings
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes check-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(350px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff', border: '2px solid #e2e8f0',
      borderRadius: 20, padding: "20px 24px", marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 16, fontWeight: 800, color: '#0f172a',
      marginBottom: 14, paddingBottom: 8,
      borderBottom: '1px solid #e2e8f0',
      textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    }}>
      {children}
    </p>
  );
}

function FareRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>₹{value.toLocaleString("en-IN")}</span>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: '#00477f', display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: '#ffffff',
      }}>
        {n}
      </div>
      <p style={{ fontSize: 14, color: '#334155', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function ActionBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 0", borderRadius: 10,
      background: primary ? '#00477f' : '#ffffff',
      color: primary ? "#fff" : '#0f172a',
      border: primary ? "none" : '1.5px solid #e2e8f0',
      fontWeight: 600, fontSize: 12, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

/* ── Ticket generation (identical to SBTBookings.tsx) ─────────────────── */

interface OfferConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  bgColor: string;
}

interface TicketBooking {
  pnr: string;
  bookingId: string;
  ticketId: string;
  status: string;
  origin: { code: string; city: string };
  destination: { code: string; city: string };
  departureTime: string;
  arrivalTime: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  cabin: number;
  passengers: { title: string; firstName: string; lastName: string; paxType: string; isLead: boolean }[];
  baseFare: number;
  taxes: number;
  extras: number;
  totalFare: number;
  currency: string;
  isLCC: boolean;
  bookedAt?: string;
  createdAt: string;
}

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTime(dt: string): string {
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return dt; }
}

function fmtDate(dt: string): string {
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch { return dt; }
}

function fmtDateShort(dt: string): string {
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dt; }
}

function ticketFormatDuration(dep: string, arr: string): string {
  try {
    const a = new Date(dep).getTime();
    const b = new Date(arr).getTime();
    if (isNaN(a) || isNaN(b)) return "";
    const mins = Math.round((b - a) / 60000);
    if (mins <= 0) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  } catch { return ""; }
}

function cityName(iata: string): string {
  const map: Record<string, string> = {
    DEL: "Delhi", BOM: "Mumbai", BLR: "Bengaluru", MAA: "Chennai",
    CCU: "Kolkata", HYD: "Hyderabad", GOI: "Goa", AMD: "Ahmedabad",
    PNQ: "Pune", COK: "Kochi", JAI: "Jaipur", LKO: "Lucknow",
    GAU: "Guwahati", SXR: "Srinagar", IXC: "Chandigarh",
  };
  return map[iata.toUpperCase()] || iata;
}

function airportFullName(iata: string): string {
  const map: Record<string, string> = {
    DEL: "Indira Gandhi International Airport",
    BOM: "Chhatrapati Shivaji Maharaj International Airport",
    BLR: "Kempegowda International Airport",
    MAA: "Chennai International Airport",
    CCU: "Netaji Subhas Chandra Bose International Airport",
    HYD: "Rajiv Gandhi International Airport",
    GOI: "Goa International Airport",
    AMD: "Sardar Vallabhbhai Patel International Airport",
    PNQ: "Pune Airport",
    COK: "Cochin International Airport",
  };
  return map[iata.toUpperCase()] || "";
}

function generateBarcodeSVG(value: string): string {
  const bars: string[] = [];
  let x = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const w = (code % 3) + 1;
    bars.push(`<rect x="${x}" y="0" width="${w}" height="40" fill="#1A1A2E"/>`);
    x += w + 2;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="40" viewBox="0 0 ${x} 40">${bars.join("")}</svg>`;
}

function fareLineHtml(label: string, value: number, curr: string): string {
  return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">
    <span>${label}</span>
    <span>${curr}${value.toLocaleString("en-IN")}</span>
  </div>`;
}

function generateTicketHTML(b: TicketBooking, offer?: OfferConfig | null, logoBase64?: string): string {
  const cabinLabel = CABIN_MAP[b.cabin] ?? "Economy";
  const curr = b.currency === "INR" ? "\u20B9" : b.currency;
  const depDate = fmtDate(b.departureTime);
  const arrDate = fmtDate(b.arrivalTime);
  const depTime = fmtTime(b.departureTime);
  const arrTime = fmtTime(b.arrivalTime);
  const duration = ticketFormatDuration(b.departureTime, b.arrivalTime);
  const bookedOn = fmtDateShort(b.bookedAt || b.createdAt);
  const isNonRefundable = b.isLCC;
  // Inline QR-style box — external image URLs are blocked in blob: tabs
  const qrLabel = esc(b.pnr || b.bookingId || "PLUMTRIPS");
  const originCity = b.origin.city || cityName(b.origin.code);
  const destCity = b.destination.city || cityName(b.destination.code);
  const originAirport = airportFullName(b.origin.code);
  const destAirport = airportFullName(b.destination.code);

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="PlumTrips" style="height:48px;max-width:180px;object-fit:contain;" />`
    : `<div style="display:flex;align-items:center;gap:2px">
         <span style="font-size:26px;font-weight:800;color:#E86B43;font-family:Georgia,serif;letter-spacing:-1px">Plum</span>
         <span style="font-size:26px;font-weight:800;color:#004A8C;font-family:Georgia,serif;letter-spacing:-1px">trips</span>
       </div>`;

  const paxRows = (b.passengers ?? []).map((p) => {
    const pt = p?.paxType ?? "adult";
    const paxType = pt === "adult" || pt === "1" ? "Adult" : pt === "child" || pt === "2" ? "Child" : pt === "infant" || pt === "3" ? "Infant" : "Adult";
    return `<tr style="border-bottom:1px solid #F3F4F6;">
      <td style="padding:14px 16px;font-weight:600;color:#111;">${esc(p?.title ?? "")} ${esc(p?.firstName ?? "")} ${esc(p?.lastName ?? "")}</td>
      <td style="padding:14px 16px;color:#6B7280;">${paxType}</td>
      <td style="padding:14px 16px;font-family:monospace;font-size:11px;color:#6B7280;text-align:center;">${esc(b.ticketId || "\u2014")}</td>
      <td style="padding:14px 16px;font-family:monospace;font-weight:700;text-align:center;color:#374151;">&mdash;</td>
      <td style="padding:14px 16px;color:#374151;text-align:center;">15 kg</td>
      <td style="padding:14px 16px;color:#374151;text-align:center;">7 kg</td>
      <td style="padding:14px 16px;color:#374151;text-align:center;">&mdash;</td>
    </tr>`;
  }).join("");

  const barcodesHtml = (b.passengers ?? []).map((p, i) => {
    const ref = `${b.pnr}-${i + 1}`;
    return `<div style="margin-bottom:12px;">
      <p style="font-size:11px;color:#9CA3AF;margin:0 0 4px;">${esc(p?.firstName ?? "")} ${esc(p?.lastName ?? "")} &mdash; Barcode:</p>
      ${generateBarcodeSVG(ref)}
      <p style="font-size:10px;color:#9CA3AF;font-family:monospace;margin:2px 0 0;letter-spacing:0.5px;">${esc(ref)}</p>
    </div>`;
  }).join("");

  const fareItems: string[] = [];
  fareItems.push(fareLineHtml("Base Fare", b.baseFare, curr));
  if (b.taxes > 0) fareItems.push(fareLineHtml("Taxes &amp; Fees", b.taxes, curr));
  if (b.extras > 0) fareItems.push(fareLineHtml("Extras (Seats / Baggage / Meals)", b.extras, curr));

  const effectiveOffer = (offer?.enabled && offer?.title) ? offer : {
    enabled: true,
    title: `Arriving in ${destCity}?`,
    description: `Get 10% off your Airport Transfer with PlumTrips`,
    ctaText: "Book Now",
    ctaUrl: "https://plumtrips.com/transfers",
    bgColor: "#E86B43",
  };

  const offerBlock = (effectiveOffer?.enabled && effectiveOffer?.title)
    ? `<div style="background:linear-gradient(135deg, #E86B43, #F97316);color:white;border-radius:10px;padding:24px 28px;margin-bottom:24px;box-shadow:0 2px 8px rgba(232,107,67,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:flex-start;gap:16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
          <div>
            <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;">${esc(effectiveOffer.title)}</h3>
            <p style="font-size:13px;color:rgba(255,255,255,0.85);margin:0;">${esc(effectiveOffer.description)}</p>
          </div>
        </div>
        ${effectiveOffer.ctaUrl
          ? `<a href="${esc(effectiveOffer.ctaUrl)}" target="_blank" rel="noopener" style="background:white;color:#E86B43;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">${esc(effectiveOffer.ctaText || "Book Now")} &rarr;</a>`
          : `<span style="background:white;color:#E86B43;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">${esc(effectiveOffer.ctaText || "Book Now")} &rarr;</span>`
        }
      </div>
    </div>`
    : "";

  const nonRefundBadge = isNonRefundable
    ? `<span style="background:#FEE2E2;color:#B91C1C;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;">NON-REFUNDABLE</span>`
    : "";

  const policies = [
    "Please arrive at the airport at least 2 hours before departure (domestic) or 3 hours (international)",
    "Web check-in opens 48 hours before departure and closes 60 minutes before departure",
    "Valid government-issued photo ID is mandatory for all passengers",
    isNonRefundable
      ? "This booking is non-refundable. Date/time changes may incur penalties as per airline policy"
      : "Cancellation and change fees apply as per fare rules. Contact support for assistance",
    "Check-in baggage allowance as selected during booking. Excess baggage charged separately",
    "PlumTrips acts as a booking agent. Flight operations are the responsibility of the airline",
  ];
  const policiesHtml = policies.map((p) =>
    `<li style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:12px;color:#4B5563;">
      <span style="color:#004A8C;margin-top:1px;flex-shrink:0;">&#8226;</span>
      <span>${p}</span>
    </li>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>E-Ticket - ${esc(b.pnr)} | PlumTrips</title>
<style>
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#F8FAFC; color:#111; }
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;padding:40px;">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div>
      ${logoHtml}
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004A8C" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style="font-size:11px;color:#555;letter-spacing:0.05em;">Verified by PlumTrips AI Engine</span>
      </div>
    </div>
    <div style="text-align:right;">
      <p style="font-size:11px;font-weight:600;letter-spacing:0.15em;color:#004A8C;text-transform:uppercase;margin:0;">E-TICKET / BOARDING VOUCHER</p>
      <div style="display:inline-flex;align-items:center;gap:4px;background:#ECFDF5;color:#065F46;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;margin-top:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#065F46" stroke-width="2.5" style="vertical-align:middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        ${b.status || "CONFIRMED"}
      </div>
    </div>
  </div>

  <div style="background:#004A8C;color:white;padding:24px 28px;border-radius:10px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;gap:40px;">
      <div>
        <p style="font-size:11px;color:#93C5FD;margin:0 0 4px;">Booking ID</p>
        <p style="font-family:monospace;font-size:15px;font-weight:700;letter-spacing:0.05em;margin:0;">${esc(b.bookingId)}</p>
      </div>
      <div>
        <p style="font-size:11px;color:#93C5FD;margin:0 0 4px;">Issue Date</p>
        <p style="font-size:14px;margin:0;">${esc(bookedOn)}</p>
      </div>
      <div>
        <p style="font-size:11px;color:#93C5FD;margin:0 0 4px;">PNR / Record Locator</p>
        <p style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:0.15em;margin:0;">${esc(b.pnr)}</p>
      </div>
    </div>
    <div style="text-align:center;flex-shrink:0;">
      <div style="background:white;padding:8px;border-radius:6px;width:88px;height:88px;display:flex;align-items:center;justify-content:center;">
        <div style="width:72px;height:72px;background:#fff;border:2px solid #1e3a5f;display:flex;align-items:center;justify-content:center;font-size:8px;color:#1e3a5f;text-align:center;font-family:monospace;word-break:break-all;padding:4px;line-height:1.2;">
          ${qrLabel}
        </div>
      </div>
      <p style="font-size:10px;color:#93C5FD;margin:6px 0 0;">Scan to Manage Trip</p>
    </div>
  </div>

  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid #F3F4F6;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#EFF6FF;border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004A8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
        </div>
        <div>
          <p style="font-size:11px;color:#9CA3AF;margin:0;">Segment 1</p>
          <p style="font-size:14px;font-weight:600;margin:0;">${esc(b.airlineName)} <span style="color:#D1D5DB;">&#8226;</span> ${esc(b.flightNumber)}</p>
        </div>
      </div>
      <div style="text-align:right;">
        <p style="font-size:11px;color:#9CA3AF;margin:0;">Class</p>
        <p style="font-size:14px;font-weight:600;margin:0;">${esc(cabinLabel)}</p>
      </div>
    </div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div style="flex:1;">
        <p style="font-size:48px;font-weight:800;font-family:monospace;color:#004A8C;line-height:1;margin:0 0 6px;">${esc(b.origin.code)}</p>
        <p style="font-size:13px;font-weight:600;color:#111;margin:0;">${esc(originCity)}</p>
        ${originAirport ? `<p style="font-size:11px;color:#9CA3AF;margin:0 0 12px;">${esc(originAirport)}</p>` : `<p style="margin:0 0 12px;"></p>`}
        <p style="font-size:13px;color:#374151;margin:0;">${esc(depDate)}</p>
        <p style="font-size:20px;font-weight:700;margin:0;">${esc(depTime)}</p>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:0 16px;padding-top:20px;">
        <div style="width:100%;display:flex;align-items:center;">
          <div style="flex:1;border-top:2px dashed #D1D5DB;"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004A8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 8px;flex-shrink:0;"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
          <div style="flex:1;border-top:2px dashed #D1D5DB;"></div>
        </div>
        <p style="font-size:13px;font-weight:600;color:#374151;margin:8px 0 0;">${esc(duration)}</p>
        <p style="font-size:11px;color:#9CA3AF;margin:0;">Direct Flight</p>
      </div>
      <div style="flex:1;text-align:right;">
        <p style="font-size:48px;font-weight:800;font-family:monospace;color:#004A8C;line-height:1;margin:0 0 6px;">${esc(b.destination.code)}</p>
        <p style="font-size:13px;font-weight:600;color:#111;margin:0;">${esc(destCity)}</p>
        ${destAirport ? `<p style="font-size:11px;color:#9CA3AF;margin:0 0 12px;">${esc(destAirport)}</p>` : `<p style="margin:0 0 12px;"></p>`}
        <p style="font-size:13px;color:#374151;margin:0;">${esc(arrDate)}</p>
        <p style="font-size:20px;font-weight:700;margin:0;">${esc(arrTime)}</p>
      </div>
    </div>
    <div style="background:#F9FAFB;padding:8px 12px;border-radius:6px;margin-top:16px;font-size:11px;color:#6B7280;">
      ${esc(cabinLabel)} Class &#8226; ${b.isLCC ? "LCC" : "Full Service"}
    </div>
  </div>

  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#004A8C;color:white;padding:12px 20px;">
      <h2 style="font-size:12px;font-weight:600;letter-spacing:0.1em;margin:0;">PASSENGER MANIFEST &amp; BAGGAGE ALLOWANCE</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
          <th style="text-align:left;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Passenger Name</th>
          <th style="text-align:left;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Type</th>
          <th style="text-align:center;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Ticket Number</th>
          <th style="text-align:center;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Seat</th>
          <th style="text-align:center;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Check-in</th>
          <th style="text-align:center;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Cabin</th>
          <th style="text-align:center;padding:10px 16px;font-size:11px;color:#6B7280;font-weight:600;">Meal</th>
        </tr>
      </thead>
      <tbody>
        ${paxRows}
      </tbody>
    </table>
    <div style="padding:16px 20px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
      ${barcodesHtml}
    </div>
  </div>

  ${offerBlock}

  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h2 style="font-size:12px;font-weight:700;color:#004A8C;letter-spacing:0.1em;margin:0 0 16px;">FARE BREAKDOWN</h2>
    ${fareItems.join("")}
    <div style="display:flex;justify-content:space-between;padding:14px 0;font-size:16px;font-weight:700;border-top:2px solid #E5E7EB;margin-top:4px;">
      <span>Total Paid</span>
      <span style="color:#C9A96E;">${curr}${b.totalFare.toLocaleString("en-IN")}</span>
    </div>
  </div>

  <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 style="font-size:12px;font-weight:700;color:#004A8C;letter-spacing:0.1em;margin:0;">IMPORTANT TRAVEL INFORMATION</h2>
      ${nonRefundBadge}
    </div>
    <ul style="list-style:none;padding:0;margin:0;">
      ${policiesHtml}
    </ul>
  </div>

  <div style="border-top:1px solid #E5E7EB;padding-top:16px;text-align:center;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">Page 1 of 1 &#8226; Generated securely via PlumTrips API</p>
    <p style="font-size:11px;color:#9CA3AF;margin:4px 0 0;">For support: support@plumtrips.com | +91 99999 99999 | Generated on ${esc(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</p>
  </div>

</div>

<div class="no-print" style="text-align:center;margin:20px 0;">
  <button onclick="window.print()" style="background:#004A8C;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:13px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
</div>

<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
}
