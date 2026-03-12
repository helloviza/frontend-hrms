import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { T, AirlineLogo, formatTime, formatDateShort } from "../../components/sbt/FlightResultCard";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Booking {
  _id: string;
  pnr: string;
  bookingId: string;
  ticketId: string;
  status: "CONFIRMED" | "CANCELLED" | "PENDING";
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
  contactEmail: string;
  contactPhone: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpayAmount?: number;
  paymentStatus?: "pending" | "paid" | "failed";
  paymentTimestamp?: string;
  bookedAt?: string;
  cancelledAt?: string;
  createdAt: string;
}

interface OfferConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  bgColor: string;
}

const CABIN_MAP: Record<number, string> = { 1: "All", 2: "Economy", 3: "Prem Economy", 4: "Business", 5: "Prem Business", 6: "First" };

type DisplayStatus = "CONFIRMED" | "FAILED" | "PENDING" | "CANCELLED";

function getDisplayStatus(b: Booking): DisplayStatus {
  if (b.status === "CANCELLED") return "CANCELLED";
  if (b.paymentStatus === "failed") return "FAILED";
  if (b.paymentStatus === "paid" && b.status === "CONFIRMED") return "CONFIRMED";
  if (b.paymentStatus === "paid" && b.status === "PENDING") return "PENDING";
  // No paymentStatus yet (pre-Razorpay bookings) — trust status field
  if (b.status === "CONFIRMED") return "CONFIRMED";
  if (b.status === "PENDING") return "PENDING";
  return "FAILED";
}

const STATUS_BADGE: Record<DisplayStatus, { bg: string; color: string }> = {
  CONFIRMED: { bg: "#D1FAE5", color: "#065F46" },
  FAILED:    { bg: "#FEE2E2", color: "#991B1B" },
  PENDING:   { bg: "#FEF3C7", color: "#92400E" },
  CANCELLED: { bg: "#F3F4F6", color: "#6B7280" },
};

type TabFilter = "ALL" | "CONFIRMED" | "FAILED" | "CANCELLED";

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function SBTBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TabFilter>("ALL");
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { fetchBookings(); }, []);

  async function fetchBookings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/sbt/flights/bookings");
      setBookings(res.bookings ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(id);
    try {
      await api.post(`/sbt/flights/bookings/${id}/cancel`, {});
      await fetchBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(null);
    }
  }

  async function handleDownloadTicket(b: Booking) {
    const tab = window.open("", "_blank");
    if (!tab) { alert("Please allow popups for this site to download tickets."); return; }
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

      const html = generateTicketHTML(b, offerData, logoBase64);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab.close();
      console.error("Ticket generation failed:", err);
      alert("Could not generate ticket. Please try again.");
    }
  }

  const filtered = filter === "ALL"
    ? bookings
    : bookings.filter((b) => getDisplayStatus(b) === filter);

  function tabCount(key: TabFilter): number {
    if (key === "ALL") return bookings.length;
    return bookings.filter((b) => getDisplayStatus(b) === key).length;
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "FAILED", label: "Failed" },
    { key: "CANCELLED", label: "Cancelled" },
  ];

  const hasActions = (ds: DisplayStatus) => ds !== "CANCELLED";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>Flight Bookings</h1>
          <p style={{ fontSize: 13, color: T.inkMid, margin: "4px 0 0" }}>
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={() => navigate("/sbt/flights")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: T.gold, color: T.obsidian, fontSize: 13, fontWeight: 700,
            padding: "10px 22px", borderRadius: 10, border: "none", cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          Book New Flight
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {tabs.map((t) => {
          const active = filter === t.key;
          const count = tabCount(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "none", transition: "all 0.15s",
                background: active ? T.gold : "transparent",
                color: active ? "#fff" : T.inkMid,
              }}
            >
              {t.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                background: active ? "rgba(255,255,255,0.25)" : T.surface,
                color: active ? "#fff" : T.inkFaint,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Loading skeletons ── */}
      {loading && (
        <>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          <style>{`@keyframes skel-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </>
      )}

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 12, padding: "14px 18px", marginBottom: 16,
        }}>
          <p style={{ color: "#991B1B", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.inkFaint}
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ display: "block", margin: "0 auto 16px" }}>
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: "0 0 6px" }}>
            No {filter === "ALL" ? "" : filter.toLowerCase() + " "}bookings
          </p>
          <p style={{ fontSize: 13, color: T.inkMid, margin: "0 0 20px" }}>
            {filter === "ALL" ? "Your flight bookings will appear here" : "Your confirmed bookings will appear here"}
          </p>
          {filter === "ALL" && (
            <button
              onClick={() => navigate("/sbt/flights")}
              style={{
                background: T.gold, color: T.obsidian, border: "none", borderRadius: 10,
                padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13,
              }}
            >
              Book a Flight
            </button>
          )}
        </div>
      )}

      {/* ── Booking cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.map((b) => {
          const ds = getDisplayStatus(b);
          const badge = STATUS_BADGE[ds];
          const dur = formatDuration(b.departureTime, b.arrivalTime);
          const bookedDate = formatBookedDate(b.bookedAt || b.createdAt);
          const curr = b.currency === "INR" ? "\u20B9" : b.currency;
          return (
            <div
              key={b._id}
              style={{
                background: "#fff", border: "1px solid #E5E7EB",
                borderRadius: 12, padding: 16,
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Row 1: Airline + badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AirlineLogo code={b.airlineCode} size="sm" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                    {b.airlineName}{" \u00B7 "}{b.flightNumber}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px",
                  borderRadius: 20, background: badge.bg, color: badge.color,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {ds}
                </span>
              </div>

              {/* Row 2: Route */}
              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ minWidth: 64 }}>
                  <p style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1 }}>{formatTime(b.departureTime)}</p>
                  <p style={{ fontSize: 13, color: T.inkMid, margin: "2px 0 0" }}>{b.origin.code}</p>
                  <p style={{ fontSize: 12, color: T.inkFaint, margin: 0 }}>{formatDateShort(b.departureTime)}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "6px 12px 0" }}>
                  {dur && <p style={{ fontSize: 11, color: T.inkFaint, margin: "0 0 4px" }}>{dur}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #D1D5DB" }} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={T.inkFaint} style={{ flexShrink: 0 }}>
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
                    <div style={{ flex: 1, height: 0, borderTop: "1.5px dashed #D1D5DB" }} />
                  </div>
                  <p style={{ fontSize: 11, color: T.inkFaint, margin: "4px 0 0" }}>Non-stop</p>
                </div>
                <div style={{ minWidth: 64, textAlign: "right" }}>
                  <p style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1 }}>{formatTime(b.arrivalTime)}</p>
                  <p style={{ fontSize: 13, color: T.inkMid, margin: "2px 0 0" }}>{b.destination.code}</p>
                  <p style={{ fontSize: 12, color: T.inkFaint, margin: 0 }}>{formatDateShort(b.arrivalTime)}</p>
                </div>
              </div>

              {/* Row 3: Meta info with dividers */}
              <div style={{
                display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap",
                padding: "12px 0", borderTop: "1px solid #F3F4F6",
              }}>
                {ds !== "FAILED" && (
                  <>
                    <MetaItem label="PNR" value={b.pnr} highlight />
                    <MetaDivider />
                    <MetaItem label="Booking ID" value={b.bookingId} />
                    <MetaDivider />
                  </>
                )}
                <MetaItem label={ds === "FAILED" ? "Attempted" : "Booked"} value={bookedDate} />
                <MetaDivider />
                <MetaItem label={ds === "FAILED" ? "Amount" : "Total"} value={`${curr}${b.totalFare.toLocaleString("en-IN")}`} bold />
              </div>

              {/* Row 4: Actions (only if there are actions) */}
              {hasActions(ds) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {ds === "CONFIRMED" && (
                    <>
                      <button onClick={() => handleDownloadTicket(b)} style={btnStyle(T.gold, T.obsidian)}>
                        {"\u2193 Download Ticket"}
                      </button>
                      <button
                        onClick={() => handleCancel(b._id)}
                        disabled={cancelling === b._id}
                        style={{
                          ...btnOutline(T.rose),
                          opacity: cancelling === b._id ? 0.5 : 1,
                          cursor: cancelling === b._id ? "not-allowed" : "pointer",
                        }}
                      >
                        {cancelling === b._id ? "Cancelling..." : "Cancel"}
                      </button>
                    </>
                  )}

                  {ds === "FAILED" && b.paymentStatus === "failed" && (
                    <button onClick={() => navigate("/sbt/flights")} style={btnStyle(T.obsidian, "#fff")}>
                      {"\u2190 Retry Booking"}
                    </button>
                  )}

                  {ds === "FAILED" && b.paymentStatus === "paid" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: T.inkMid }}>
                        Payment collected{" \u00B7 "}Ref: {b.razorpayPaymentId || "\u2014"}
                      </span>
                      <button onClick={() => alert("Please contact support@plumtrips.com for assistance.")} style={btnOutline(T.amber)}>
                        Contact Support
                      </button>
                    </div>
                  )}

                  {ds === "PENDING" && (
                    <button onClick={() => alert("Please contact support@plumtrips.com for assistance.")} style={btnOutline(T.amber)}>
                      Contact Support
                    </button>
                  )}
                </div>
              )}

              {/* Cancelled date (no action row) */}
              {ds === "CANCELLED" && b.cancelledAt && (
                <p style={{ fontSize: 12, color: T.inkFaint, margin: "10px 0 0", textAlign: "right" }}>
                  Cancelled on {formatBookedDate(b.cancelledAt)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

function MetaItem({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div style={{ padding: "0 12px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: highlight ? T.gold : T.ink, margin: 0, letterSpacing: highlight ? "0.05em" : undefined }}>{value}</p>
    </div>
  );
}

function MetaDivider() {
  return <div style={{ width: 1, height: 28, background: "#E5E7EB", flexShrink: 0 }} />;
}

function SkeletonCard() {
  const bar = (w: string | number, h = 12) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: "#E5E7EB", animation: "skel-pulse 1.5s ease-in-out infinite" }} />
  );
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {bar(28, 28)}
          {bar(140)}
        </div>
        {bar(72, 22)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>{bar(48, 24)}{bar(32, 10)}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{bar("60%", 1)}</div>
        <div style={{ textAlign: "right" }}>{bar(48, 24)}{bar(32, 10)}</div>
      </div>
      <div style={{ display: "flex", gap: 16, borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
        {bar(80)}{bar(80)}{bar(100)}{bar(60)}
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    height: 36, padding: "0 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: "pointer", background: bg, border: "none", color, display: "inline-flex", alignItems: "center",
  };
}

function btnOutline(color: string): React.CSSProperties {
  return {
    height: 36, padding: "0 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", background: "none", border: `1px solid ${color}`, color, display: "inline-flex", alignItems: "center",
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function formatBookedDate(dt: string): string {
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return dt; }
}

function formatDuration(dep: string, arr: string): string {
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

function fareLineHtml(label: string, value: number, curr: string): string {
  return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">
    <span>${label}</span>
    <span>${curr}${value.toLocaleString("en-IN")}</span>
  </div>`;
}

/* ── Ticket HTML generator (8-section layout) ──────────────────────────────── */

function generateTicketHTML(b: Booking, offer?: OfferConfig | null, logoBase64?: string): string {
  const cabinLabel = CABIN_MAP[b.cabin] ?? "Economy";
  const curr = b.currency === "INR" ? "\u20B9" : b.currency;
  const depDate = fmtDate(b.departureTime);
  const arrDate = fmtDate(b.arrivalTime);
  const depTime = fmtTime(b.departureTime);
  const arrTime = fmtTime(b.arrivalTime);
  const duration = formatDuration(b.departureTime, b.arrivalTime);
  const bookedOn = fmtDateShort(b.bookedAt || b.createdAt);
  const isNonRefundable = b.isLCC;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(b.pnr)}`;
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
        <img src="${qrUrl}" width="72" height="72" alt="QR" />
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
