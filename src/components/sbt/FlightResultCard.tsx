import { useState } from "react";

// Design tokens — Obsidian Atlas (matches ConciergePage)
export const T = {
  canvas:   "#FAFAF7",
  obsidian: "#1A1A2E",
  ink:      "#2D2D44",
  inkMid:   "#6B6B8A",
  inkFaint: "#9B9BB0",
  gold:     "#C9A96E",
  goldDim:  "#A07840",
  emerald:  "#10B981",
  rose:     "#F43F5E",
  amber:    "#F59E0B",
  cardBg:   "#FFFFFF",
  cardBorder: "#E8E8F0",
  surface:  "#F4F4F8",
};

/* ── MiniFareRule (cancellation / reissue info) ─────────────────────────── */
export interface MiniFareRule {
  JourneyPoints?: string;
  Type?: string;      // "Cancellation" | "Reissue"
  From?: string;
  To?: string;
  Unit?: string;      // "Hours"
  Details?: string;
  OnlineRefundAllowed?: boolean;
}

/* ── TBO Fare breakdown per pax type ────────────────────────────────────── */
export interface SBTFareBreakdown {
  BaseFare?: number;
  Tax?: number;
  YQTax?: number;
  AdditionalTxnFeeOfrd?: number;
  AdditionalTxnFeePub?: number;
  PGCharge?: number;
  SupplierReissueCharges?: number;
  Currency?: string;
  PaxType?: number;
  PassengerCount?: number;
  TaxBreakUp?: Array<{ key: string; value: number }>;
}

/* ── TBO Segment ────────────────────────────────────────────────────────── */
export interface SBTSegment {
  Baggage?: string;
  CabinBaggage?: string;
  CabinClass?: number;
  Duration?: number;
  GroundTime?: number;
  Mile?: number;
  StopOver?: boolean;
  StopPoint?: string;
  StopPointArrivalTime?: string;
  StopPointDepartureTime?: string;
  NoOfSeatAvailable?: number;
  SupplierFareClass?: string | null;
  Remark?: string | null;
  FlightInfoIndex?: string;
  FareClassification?: { Type?: string };
  Airline: {
    AirlineCode: string;
    AirlineName: string;
    FlightNumber: string;
    FareClass?: string;
    OperatingCarrier?: string;
  };
  Origin: {
    DepTime: string;
    Airport: {
      AirportCode: string;
      AirportName?: string;
      Terminal?: string;
      CityCode?: string;
      CityName?: string;
      CountryCode?: string;
      CountryName?: string;
    };
  };
  Destination: {
    ArrTime: string;
    Airport: {
      AirportCode: string;
      AirportName?: string;
      Terminal?: string;
      CityCode?: string;
      CityName?: string;
      CountryCode?: string;
      CountryName?: string;
    };
  };
  [key: string]: unknown;
}

/* ── Main SBTFlight result ──────────────────────────────────────────────── */
export interface SBTFlight {
  ResultIndex: string;
  IsLCC: boolean;
  NonRefundable: boolean;
  Fare: {
    BaseFare: number; Tax: number;
    TotalFare: number; PublishedFare: number;
    OfferedFare?: number;
    Currency: string;
    PGCharge?: number;
    TotalBaggageCharges?: number;
    TotalMealCharges?: number;
    TotalSeatCharges?: number;
    TotalSpecialServiceCharges?: number;
    TaxBreakup?: Array<{ key: string; value: number }>;
  };
  FareBreakdown?: SBTFareBreakdown[];
  Segments: SBTSegment[][];

  // Passport & PAN requirements
  IsPanRequiredAtBook?: boolean;
  IsPanRequiredAtTicket?: boolean;
  IsPassportRequiredAtBook?: boolean;
  IsPassportRequiredAtTicket?: boolean;
  IsPassportFullDetailRequiredAtBook?: boolean;

  // GST
  GSTAllowed?: boolean;
  IsGSTMandatory?: boolean;

  // Name format hints
  FirstNameFormat?: string | null;
  LastNameFormat?: string | null;

  // Seat/booking rules
  IsBookableIfSeatNotAvailable?: boolean;
  IsHoldAllowedWithSSR?: boolean;
  IsHoldMandatoryWithSSR?: boolean;

  // Fare type
  ResultFareType?: string;

  // Airline identifiers
  ValidatingAirline?: string;
  AirlineCode?: string;

  // Fare classification
  FareClassification?: { Color?: string; Type?: string };

  // International search combination
  SearchCombinationType?: number;

  // Transit visa
  IsTransitVisaRequired?: boolean;

  // Mini fare rules
  MiniFareRules?: MiniFareRule[][];
}

interface Props {
  flight: SBTFlight;
  selected: boolean;
  onSelect: (f: SBTFlight) => void;
  adultsCount?: number;
  mode?: "sbt" | "concierge"; // sbt=book via TBO, concierge=show bookUrl
  bookUrl?: string;
  darkMode?: boolean;
}

export function AirlineLogo({ code, size = "md", darkMode = false }: { code: string; size?: "sm"|"md"|"lg"; darkMode?: boolean }) {
  const [err, setErr] = useState(false);
  const dim = size === "sm" ? 24 : size === "lg" ? 48 : 32;
  const cdnUrl = `https://pics.avs.io/${dim * 2}/${dim * 2}/${code}.png`;

  if (err) return (
    <div style={{
      width: dim, height: dim, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize: dim < 30 ? 9 : 11,
      fontWeight:700, color:T.gold, flexShrink:0,
      letterSpacing:"0.5px"
    }}>
      {code}
    </div>
  );

  return (
    <img
      src={cdnUrl}
      alt={code}
      style={{
        width: dim, height: dim,
        objectFit: "contain",
        flexShrink: 0,
        imageRendering: "auto",
        background: darkMode ? "rgba(255,255,255,0.9)" : "transparent",
        borderRadius: darkMode ? 6 : 0,
        padding: darkMode ? 3 : 0,
      }}
      onError={() => setErr(true)}
    />
  );
}

export function formatTime(dt: string): string {
  if (!dt || dt === "—" || dt === "--") return "--:--";

  const s = dt.trim();

  // Already HH:MM (24h)
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":");
    return `${String(parseInt(h)).padStart(2, "0")}:${m}`;
  }

  // "8:35 AM" / "10:00 PM" / "08:35 am" — SerpAPI and TBO locale strings
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // "2026-03-20 08:35" — space-separated datetime (no T separator)
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }

  // ISO datetime string
  const d = new Date(dt);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  // Last resort — take first 5 chars
  return s.slice(0, 5);
}

export function formatDur(m: number | string | undefined | null) {
  if (m == null) return "–";
  if (typeof m === "string") return m || "–";
  return `${Math.floor(m/60)}h ${m%60}m`;
}

export function formatDateShort(dt: string): string {
  if (!dt || dt === "—" || dt === "--") return "";
  // Time-only strings — no date info
  if (/^\d{1,2}:\d{2}(\s*(AM|PM))?$/i.test(dt.trim())) return "";

  // "2026-03-20 08:35" — space-separated datetime (no T separator)
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(dt)) {
    const d = new Date(dt.replace(" ", "T"));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }
  }

  const d = new Date(dt);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  return "";
}

export default function FlightResultCard({ flight, selected, onSelect, adultsCount = 1, mode = "sbt", bookUrl, darkMode = false }: Props) {
  const seg = flight.Segments[0][0];
  const price = flight.Fare.PublishedFare || flight.Fare.TotalFare;
  const stops = flight.Segments[0].length - 1;

  function handleClick() {
    if (mode === "concierge" && bookUrl && !selected) {
      window.open(bookUrl, "_blank");
    } else {
      onSelect(flight);
    }
  }

  const unselectedBg = darkMode ? "#1A1F35" : T.cardBg;
  const unselectedBorder = darkMode ? "rgba(255,255,255,0.08)" : T.cardBorder;

  // Text colors: adapt for dark mode unselected state (dark bg needs light text)
  const textMain    = selected ? "#fff"                   : (darkMode ? "rgba(255,255,255,0.95)" : T.ink);
  const textAccent  = selected ? T.gold                   : (darkMode ? T.gold                   : T.inkMid);
  const textSub     = selected ? "rgba(255,255,255,0.5)"  : (darkMode ? "rgba(255,255,255,0.5)"  : T.inkFaint);
  const textFaint   = selected ? "rgba(255,255,255,0.4)"  : (darkMode ? "rgba(255,255,255,0.35)" : T.inkFaint);
  const textPrice   = selected ? T.gold                   : (darkMode ? T.gold                   : T.obsidian);
  const lineColor   = selected ? "rgba(255,255,255,0.2)"  : (darkMode ? "rgba(255,255,255,0.12)" : T.cardBorder);

  return (
    <div onClick={handleClick}
      style={{
        background: selected ? T.obsidian : unselectedBg,
        border: `1.5px solid ${selected ? T.gold : unselectedBorder}`,
        borderRadius: 16,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: selected ? `0 4px 20px ${T.gold}20` : "0 1px 4px rgba(0,0,0,0.06)",
        marginBottom: 8,
        overflow: "visible",
        minWidth: 0,
      }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {/* Airline */}
        <div style={{ display:"flex", alignItems:"center", gap:10, width:140, flexShrink:0 }}>
          <AirlineLogo code={seg.Airline.AirlineCode} darkMode={darkMode} />
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:12, fontWeight:700, color: textMain,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", margin:0 }}>
              {seg.Airline.AirlineName}
            </p>
            <p style={{ fontSize:11, color: textSub, margin:0 }}>
              {seg.Airline.FlightNumber}
            </p>
            {flight.IsLCC && (
              <span style={{ fontSize:9, background:`${T.gold}20`, color:T.gold,
                padding:"1px 6px", borderRadius:20, fontWeight:600 }}>LCC</span>
            )}
          </div>
        </div>

        {/* Times + route */}
        <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:20, fontWeight:800, color: textMain, margin:0, lineHeight:1 }}>
              {formatTime(seg.Origin.DepTime)}
            </p>
            <p style={{ fontSize:11, fontWeight:600, color: textAccent, margin:0 }}>
              {seg.Origin.Airport.AirportCode}
            </p>
            <p style={{ fontSize:10, color: textFaint, margin:0 }}>
              {formatDateShort(seg.Origin.DepTime)}
            </p>
          </div>

          <div style={{ flex:1, textAlign:"center", padding:"0 8px" }}>
            <p style={{ fontSize:10, color: textSub, margin:"0 0 4px" }}>
              {formatDur(seg.Duration)}
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ flex:1, height:1, background: lineColor }}></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={textSub}>
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
              <div style={{ flex:1, height:1, background: lineColor }}></div>
            </div>
            <p style={{ fontSize:10, margin:"4px 0 0", fontWeight:600,
              color: stops === 0 ? T.emerald : T.amber }}>
              {stops === 0 ? "Non-stop" : `${stops} stop`}
            </p>
          </div>

          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:20, fontWeight:800, color: textMain, margin:0, lineHeight:1 }}>
              {formatTime(seg.Destination.ArrTime)}
            </p>
            <p style={{ fontSize:11, fontWeight:600, color: textAccent, margin:0 }}>
              {seg.Destination.Airport.AirportCode}
            </p>
            <p style={{ fontSize:10, color: textFaint, margin:0 }}>
              {formatDateShort(seg.Destination.ArrTime)}
            </p>
          </div>
        </div>

        {/* Baggage + tags */}
        <div style={{ width:70, textAlign:"center", flexShrink:0 }}>
          <p style={{ fontSize:10, color: textSub, margin:"0 0 2px" }}>
            ✈ {seg.Baggage}
          </p>
          {typeof seg.SeatsAvailable === "number" && seg.SeatsAvailable <= 5 && (
            <span style={{ fontSize:9, background:`${T.amber}20`, color:T.amber,
              padding:"1px 6px", borderRadius:20, fontWeight:600, display:"block", marginBottom:2 }}>
              {seg.SeatsAvailable as number} left!
            </span>
          )}
          {flight.NonRefundable
            ? <span style={{ fontSize:9, background:`${T.rose}15`, color:T.rose,
                padding:"1px 6px", borderRadius:20, fontWeight:600, display:"block" }}>Non-refund</span>
            : <span style={{ fontSize:9, background:`${T.emerald}15`, color:T.emerald,
                padding:"1px 6px", borderRadius:20, fontWeight:600, display:"block" }}>Refundable</span>
          }
        </div>

        {/* Price + CTA */}
        <div style={{ width:140, textAlign:"right", flexShrink:0 }}>
          <p style={{ fontSize:22, fontWeight:800, color: textPrice, margin:0, lineHeight:1 }}>
            ₹{price.toLocaleString("en-IN")}
          </p>
          <p style={{ fontSize:10, color: textFaint, margin:"2px 0 8px" }}>
            per person
          </p>
          <div style={{
            background: selected ? T.gold : T.obsidian,
            color: selected ? T.obsidian : "#fff",
            fontSize:11, fontWeight:700,
            padding:"6px 14px", borderRadius:20,
            display:"inline-block",
            letterSpacing:"0.5px",
          }}>
            {selected ? "✓ SELECTED" : mode === "concierge" ? "VIEW →" : "SELECT →"}
          </div>
        </div>
      </div>
    </div>
  );
}
