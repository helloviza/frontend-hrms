//apps/frontend/src/pages/concierge/ConciergePage.tsx

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Send, Loader2, User, History, Plus, Menu,
  LogOut, Home, FilePlus, Download, CheckCircle2,
  MapPin, ArrowRight, ExternalLink, Sparkles, Star
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { jsPDF } from "jspdf";
import FlightStatusCard from "../../components/FlightStatusCard"
import rawAirports from "../../data/airports.json";

/* ─────────────────────────────────────────────
 * Design Tokens — "Obsidian Atlas"
 * Warm white canvas · Deep obsidian structure · Gold accent
 * ───────────────────────────────────────────── */
const T = {
  // Base
  canvas:      "#F9F8F5",       // warm white — not clinical
  canvasDeep:  "#F2F0EB",       // slightly deeper warm white
  obsidian:    "#0C0C0E",       // near-black sidebar
  obsidianMid: "#18181A",       // cards on dark
  obsidianSoft:"#242428",       // hover states on dark

  // Accent
  gold:        "#C9A96E",       // primary accent — premium
  goldLight:   "#E8D5B0",       // soft gold tint
  goldDeep:    "#A8844A",       // deep gold for text

  // Type
  ink:         "#1A1A1C",       // primary text
  inkMid:      "#52525B",       // secondary text
  inkSoft:     "#A1A1AA",       // tertiary / labels
  inkGhost:    "#D4D4D8",       // disabled / placeholder

  // Semantic
  emerald:     "#059669",
  emeraldSoft: "#D1FAE5",
  rose:        "#E11D48",
  roseSoft:    "#FFE4E6",
  amber:       "#D97706",
  amberSoft:   "#FEF3C7",

  // Borders
  border:      "#E8E6E0",       // warm border
  borderDeep:  "#D4D1C8",       // stronger border

  // Font stack
  display:    "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
  body:       "'DM Sans', 'Helvetica Neue', sans-serif",
  mono:       "'DM Mono', 'Fira Code', monospace",
};

/* ─────────────────────────────────────────────
 * Airport data — from airports.json
 * ───────────────────────────────────────────── */
interface AirportEntry {
  iata:        string;
  name:        string;
  city:        string;
  country:     string;
  countryCode: string;
  label:       string;
  search:      string;
}

const _raw = rawAirports as { records: any[]; byIata: Record<string,number>; byCityCode: Record<string,number[]> };

const airports: AirportEntry[] = _raw.records.map((r: any) => ({
  iata:        r.iata,
  name:        r.airport  || "",
  city:        r.city     || "",
  country:     r.country  || "",
  countryCode: r.countryCode || "",
  label:       r.label    || `${r.iata} — ${r.airport} (${r.city}, ${r.country})`,
  search:      r.search   || `${r.iata} ${r.airport} ${r.city} ${r.country}`.toLowerCase(),
}));

const getByIata = (iata: string): AirportEntry | undefined => {
  const idx = _raw.byIata[iata.toUpperCase()];
  return idx !== undefined ? airports[idx] : undefined;
};

function searchAirports(query: string, limit = 8): AirportEntry[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase().trim();

  const exact:     AirportEntry[] = [];
  const iataHit:   AirportEntry[] = [];
  const cityStart: AirportEntry[] = [];
  const contains:  AirportEntry[] = [];

  for (const a of airports) {
    const iataLower = a.iata.toLowerCase();
    const cityLower = a.city.toLowerCase();

    if (iataLower === q || cityLower === q)        { exact.push(a);     continue; }
    if (iataLower.startsWith(q))                   { iataHit.push(a);   continue; }
    if (cityLower.startsWith(q))                   { cityStart.push(a); continue; }
    if (a.search.includes(q))                      { contains.push(a);  }
  }
  return [...exact, ...iataHit, ...cityStart, ...contains].slice(0, limit);
}


/* ─────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────── */
type ChatSession        = { id: string; title: string; timestamp: number; messages: ChatMessage[]; };
type PlutoItineraryDay  = { day: number; heading: string; details: string[]; };
type PlutoHotel         = { name: string; area: string; approxPrice: string; whyGood: string; };
type ConversationContext = Record<string, any>;

type FlightListing = {
  airline:     string;
  airlineCode: string;
  flightNo:    string;
  logoUrl:     string;
  departure:   { time: string; airport: string; iata: string };
  arrival:     { time: string; airport: string; iata: string };
  duration:    string;
  stops:       number;
  stopDetail:  string;
  price:       string;
  cabin:       string;
  bookUrl:     string;
};

type FlightSearchResult = {
  origin:      { city: string; iata: string };
  destination: { city: string; iata: string };
  date:        string | null;
  isoDate?:    string;
  flights:     FlightListing[];
  cheapest:    FlightListing | null;
  fastest:     FlightListing | null;
  links: {
    googleFlights: string;
    makemytrip:    string;
    skyscanner:    string;
  };
  tipLines: string[];
};

type PlutoReplyV1 = {
  title: string;
  context: string;
  itinerary?: PlutoItineraryDay[];
  hotels?: PlutoHotel[];
  nextSteps: string[];
  plutoInsights?: string[];
  flightStatus?: any;
  flightSearch?: FlightSearchResult;
};

type ChatMessage =
  | { role: "user"; content: string; videos?: VideoItem[]; }
  | { role: "assistant"; content: PlutoReplyV1; isTyping?: boolean; flightData?: any; videoConsent?: { videoId: string; }; };

type VideoItem = {
  id: string; file: File; url: string; analysisId?: string;
  status: "uploaded" | "processing" | "analyzed" | "failed";
};

function hasPlanningIntent(text: string): boolean {
  return [
    /plan/i, /itinerary/i, /schedule/i,
    /help me/i, /create/i, /suggest/i, /recommend/i, /book/i,
    /\d+[\s-]day/i,
    /trip to/i,
    /travel to/i,
    /visit/i,
    /holiday/i, /vacation/i, /getaway/i, /offsite/i, /retreat/i,
    /business trip/i, /work trip/i, /conference/i,
    /stay in/i, /stay at/i,
    /fly to/i, /flight to/i,
    /hotel/i, /accommodation/i, /where to stay/i,
    /what to do/i, /things to do/i, /explore/i,
    /weekend/i,
    /honeymoon/i, /anniversary/i,
  ].some(rx => rx.test(text));
}

/* ─────────────────────────────────────────────
 * PDF Generator — Beautiful branded export (original)
 * ───────────────────────────────────────────── */
function generatePDF(content: PlutoReplyV1, userEmail?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210; const H = 297;
  const M = 20;

  // Cover: full-bleed dark header
  doc.setFillColor(12, 12, 14);
  doc.rect(0, 0, W, 72, "F");

  // Gold accent bar
  doc.setFillColor(201, 169, 110);
  doc.rect(0, 68, W, 4, "F");

  // Pluto.ai wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(201, 169, 110);
  doc.setCharSpace(3);
  doc.text("PLUTO.AI", M, 28);
  doc.setCharSpace(0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 110);
  doc.text("YOUR INTELLIGENT TRAVEL COMPANION", M, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(content.title, W - M * 2);
  doc.text(titleLines, M, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 110);
  const today = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Prepared for ${userEmail || "Valued Guest"}  ·  ${today}`, M, 83);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(80, 78, 72);
  const ctxLines = doc.splitTextToSize(content.context, W - M * 2);
  doc.text(ctxLines, M, 95);

  let y = 95 + ctxLines.length * 6 + 8;

  doc.setDrawColor(201, 169, 110);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 12;

  // Hotels
  if (content.hotels && content.hotels.length > 0) {
    doc.setFillColor(12, 12, 14);
    doc.rect(M, y - 4, 6, 14, "F");
    doc.setFillColor(201, 169, 110);
    doc.rect(M, y - 4, 2, 14, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(201, 169, 110);
    doc.setCharSpace(2);
    doc.text("RECOMMENDED STAYS", M + 10, y + 5);
    doc.setCharSpace(0);
    y += 18;

    content.hotels.forEach((h, idx) => {
      if (y > H - 50) { doc.addPage(); y = M; }

      doc.setFillColor(249, 248, 245);
      doc.roundedRect(M, y, W - M * 2, 34, 3, 3, "F");
      doc.setDrawColor(228, 226, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, W - M * 2, 34, 3, 3, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(228, 226, 220);
      doc.text(`${String(idx + 1).padStart(2, "0")}`, M + 5, y + 20);

      doc.setFontSize(12);
      doc.setTextColor(26, 26, 28);
      doc.text(h.name, M + 22, y + 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`${h.area}`, M + 22, y + 18);

      doc.setFillColor(201, 169, 110);
      doc.roundedRect(W - M - 30, y + 6, 28, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(h.approxPrice, W - M - 16, y + 12, { align: "center" });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 118, 112);
      const why = doc.splitTextToSize(`"${h.whyGood}"`, W - M * 2 - 28);
      doc.text(why, M + 22, y + 26);

      y += 40;
    });
    y += 6;
  }

  // Itinerary
  if (content.itinerary && content.itinerary.length > 0) {
    if (y > H - 60) { doc.addPage(); y = M; }

    doc.setFillColor(12, 12, 14);
    doc.rect(M, y - 4, 6, 14, "F");
    doc.setFillColor(201, 169, 110);
    doc.rect(M, y - 4, 2, 14, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(201, 169, 110);
    doc.setCharSpace(2);
    doc.text("DAY-BY-DAY ITINERARY", M + 10, y + 5);
    doc.setCharSpace(0);
    y += 18;

    content.itinerary.forEach(d => {
      if (y > H - 40) { doc.addPage(); y = M; }

      doc.setFillColor(12, 12, 14);
      doc.roundedRect(M, y, 16, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(201, 169, 110);
      doc.text(`DAY ${d.day}`, M + 8, y + 7, { align: "center" });

      doc.setFontSize(13);
      doc.setTextColor(26, 26, 28);
      doc.text(d.heading, M + 20, y + 7);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(82, 82, 91);
      d.details.forEach(detail => {
        if (y > H - 20) { doc.addPage(); y = M; }
        doc.setFillColor(201, 169, 110);
        doc.circle(M + 3, y + 1.5, 1, "F");
        const lines = doc.splitTextToSize(detail, W - M * 2 - 12);
        doc.text(lines, M + 8, y + 3);
        y += lines.length * 5 + 2;
      });
      y += 8;

      doc.setDrawColor(228, 226, 220);
      doc.setLineWidth(0.2);
      doc.line(M, y, W - M, y);
      y += 8;
    });
  }

  // Footer
  doc.setFillColor(12, 12, 14);
  doc.rect(0, H - 18, W, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(201, 169, 110);
  doc.setCharSpace(2);
  doc.text("PLUTO.AI", M, H - 7);
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Intelligent Travel · Confidential", W / 2, H - 7, { align: "center" });
  doc.setTextColor(80, 80, 80);
  doc.text("pluto.ai", W - M, H - 7, { align: "right" });

  doc.save(`Pluto_${content.title.replace(/\s+/g, "_").slice(0, 40)}.pdf`);
}

/* ─────────────────────────────────────────────
 * Hotel Card Component (original — untouched)
 * ───────────────────────────────────────────── */
function HotelCard({ hotel, index }: { hotel: PlutoHotel; index: number }) {
  const [hovered, setHovered] = useState(false);

  const gradients = [
    "linear-gradient(135deg, #0C0C0E 0%, #1A1A2E 50%, #16213E 100%)",
    "linear-gradient(135deg, #0C1A0C 0%, #1A3020 50%, #0D2013 100%)",
    "linear-gradient(135deg, #1A0C0C 0%, #2E1A1A 50%, #1A100D 100%)",
    "linear-gradient(135deg, #0C0C1A 0%, #1A1A3E 50%, #0D1030 100%)",
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "24px",
        overflow: "hidden",
        border: `1px solid ${hovered ? T.gold : T.border}`,
        background: "#fff",
        boxShadow: hovered
          ? `0 20px 60px rgba(201,169,110,0.15), 0 4px 16px rgba(0,0,0,0.08)`
          : `0 2px 12px rgba(0,0,0,0.06)`,
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        fontFamily: T.body,
      }}
    >
      {/* Hero gradient */}
      <div style={{
        background: gradients[index % gradients.length],
        height: "120px",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        padding: "16px 20px",
        overflow: "hidden",
      }}>
        <span style={{
          position: "absolute", top: "8px", right: "16px",
          fontSize: "72px", fontWeight: 900, color: "rgba(255,255,255,0.04)",
          fontFamily: T.display, lineHeight: 1, userSelect: "none",
        }}>
          {String(index + 1).padStart(2, "0")}
        </span>

        <div style={{
          position: "absolute", top: "16px", left: "16px",
          background: T.gold, borderRadius: "100px", padding: "4px 12px",
        }}>
          <span style={{ fontSize: "10px", fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>
            {hotel.approxPrice}
          </span>
        </div>

        <div style={{ display: "flex", gap: "2px" }}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={8} fill={T.gold} color={T.gold} />
          ))}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "20px" }}>
        <h3 style={{
          fontSize: "18px", fontWeight: 800, color: T.ink,
          margin: "0 0 4px", letterSpacing: "-0.02em", fontFamily: T.body,
        }}>
          {hotel.name}
        </h3>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "12px" }}>
          <MapPin size={10} color={T.inkSoft} />
          <span style={{ fontSize: "11px", fontWeight: 600, color: T.inkSoft, letterSpacing: "0.02em" }}>
            {hotel.area}
          </span>
        </div>

        <p style={{
          fontSize: "12px", lineHeight: 1.7, color: T.inkMid,
          margin: "0 0 16px", fontStyle: "italic",
          borderLeft: `2px solid ${T.goldLight}`, paddingLeft: "10px",
        }}>
          "{hotel.whyGood}"
        </p>

        <Link
          to="/customer/approvals/new"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", padding: "11px 0",
            background: hovered ? T.obsidian : T.canvasDeep,
            color: hovered ? T.gold : T.inkMid,
            borderRadius: "12px", fontSize: "11px", fontWeight: 800,
            letterSpacing: "0.08em", textDecoration: "none",
            transition: "all 0.2s ease",
            border: `1px solid ${hovered ? T.obsidian : T.border}`,
          }}
        >
          REQUEST BOOKING <ExternalLink size={10} />
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Itinerary Day Card — PDF itinerary style adopted into chat
 *
 * What changed vs original:
 *   BEFORE: warm canvas header bg · square obsidian number badge · CheckCircle2 green bullets
 *   AFTER:  full-width obsidian header strip · "DAY 01 | Heading" on dark (matches PDF day pill)
 *           · 6px gold filled dot bullets (exact match to PDF gold circle bullets)
 *   Card shell (white bg, rounded, border, shadow) stays identical to Obsidian Atlas design.
 * ───────────────────────────────────────────── */
function DayCard({ day }: { day: PlutoItineraryDay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? T.gold : T.border}`,
        borderRadius: "20px",
        overflow: "hidden",
        fontFamily: T.body,
        boxShadow: hovered
          ? "0 8px 32px rgba(201,169,110,0.12), 0 2px 8px rgba(0,0,0,0.06)"
          : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* ── Day header — obsidian strip, mirrors PDF "DAY 01 pill + heading" ── */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "13px 20px",
        background: T.obsidian,
        gap: "0",
      }}>
        {/* DAY 01 — gold mono, matches PDF charSpace label */}
        <span style={{
          fontSize: "9px", fontWeight: 900, color: T.gold,
          letterSpacing: "0.14em", fontFamily: T.mono,
          flexShrink: 0, marginRight: "10px",
          textTransform: "uppercase",
        }}>
          DAY {String(day.day).padStart(2, "0")}
        </span>

        {/* Thin separator — subtle gold rule */}
        <div style={{
          width: "1px", height: "14px",
          background: `${T.gold}35`,
          marginRight: "10px", flexShrink: 0,
        }} />

        {/* Heading — white on obsidian */}
        <h3 style={{
          fontSize: "13px", fontWeight: 700, color: "#FFFFFF",
          margin: 0, letterSpacing: "-0.01em", lineHeight: 1.3,
        }}>
          {day.heading}
        </h3>
      </div>

      {/* ── Details — gold dot bullets matching PDF gold circle bullets ── */}
      <div style={{ padding: "14px 20px" }}>
        {day.details.map((detail, idx) => (
          <div key={idx} style={{
            display: "flex", gap: "12px",
            marginBottom: idx < day.details.length - 1 ? "10px" : 0,
            alignItems: "flex-start",
          }}>
            {/* 6px gold dot — same visual as PDF's doc.circle gold bullet */}
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: T.gold, flexShrink: 0,
              marginTop: "6px",
            }} />
            <p style={{
              fontSize: "12px", fontWeight: 500, color: T.inkMid,
              lineHeight: 1.65, margin: 0,
            }}>
              {detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * AirportTypeahead — MMT-style airport search dropdown
 * ───────────────────────────────────────────── */
function AirportTypeahead({
  label, value, cityValue, onSelect, placeholder = "Search city or airport",
}: {
  label:       string;
  value:       string;
  cityValue:   string;
  onSelect:    (a: AirportEntry) => void;
  placeholder?: string;
}) {
  const [query,   setQuery]   = useState(cityValue || value);
  const [results, setResults] = useState<AirportEntry[]>([]);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const resolved = getByIata(value);
    setQuery(resolved ? resolved.city : (cityValue || value));
  }, [cityValue, value]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
        if (!results.find(r => r.city === query || r.iata === query.toUpperCase())) {
          setQuery(cityValue || value);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cityValue, value, query, results]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    const hits = searchAirports(q);
    setResults(hits);
    setOpen(hits.length > 0);
  };

  const handleSelect = (airport: AirportEntry) => {
    setQuery(airport.city || airport.name);
    setResults([]);
    setOpen(false);
    onSelect(airport);
  };

  const handleFocus = () => {
    setFocused(true);
    if (query.length > 0) {
      const hits = searchAirports(query);
      setResults(hits);
      setOpen(hits.length > 0);
    } else {
      const popular = ["DEL","BOM","BLR","MAA","HYD","CCU","DXB","SIN","LHR","KIX","NRT","BKK"];
      const hits = popular.map(getByIata).filter(Boolean) as AirportEntry[];
      setResults(hits.slice(0, 8));
      setOpen(true);
    }
  };

  return (
    <div ref={wrapRef} style={{
      flex: 1, display: "flex", flexDirection: "column", gap: "4px",
      padding: "12px 16px",
      background: "#fff",
      border: `1.5px solid ${focused ? T.gold : T.border}`,
      borderRadius: "14px",
      boxShadow: focused ? `0 0 0 3px ${T.goldLight}55` : "none",
      cursor: "text",
      minWidth: 0,
      position: "relative",
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      <span style={{
        fontSize: "9px", fontWeight: 900, color: T.inkSoft,
        letterSpacing: "0.12em", textTransform: "uppercase",
      }}>{label}</span>

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{
          fontSize: "26px", fontWeight: 900, color: T.ink,
          letterSpacing: "-0.02em", lineHeight: 1,
          fontFamily: T.display, flexShrink: 0,
          minWidth: "48px",
        }}>
          {value || "—"}
        </span>
        <input
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={placeholder}
          style={{
            fontSize: "12px", fontWeight: 500, color: T.inkMid,
            background: "transparent", border: "none", outline: "none",
            width: "100%", fontFamily: T.body, cursor: "text",
            padding: 0, lineHeight: 1.4,
          }}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
          }}
        />
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0, right: 0,
          background: "#fff",
          border: `1px solid ${T.border}`,
          borderRadius: "14px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.13)",
          zIndex: 200,
          overflow: "hidden",
          maxHeight: "320px",
          overflowY: "auto",
        }}>
          {results.map((airport, i) => (
            <div
              key={airport.iata}
              onMouseDown={() => handleSelect(airport)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 16px",
                borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.canvasDeep; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
            >
              <div style={{
                width: "42px", height: "32px", borderRadius: "8px",
                background: T.obsidian, display: "flex",
                alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: "11px", fontWeight: 900, color: T.gold,
                  fontFamily: T.display, letterSpacing: "0.05em",
                }}>{airport.iata}</span>
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: T.ink, margin: 0 }}>
                    {airport.city}
                  </p>
                  <span style={{
                    fontSize: "9px", fontWeight: 700, color: T.inkSoft,
                    background: T.canvasDeep, padding: "1px 6px",
                    borderRadius: "4px", letterSpacing: "0.05em",
                  }}>
                    {airport.countryCode}
                  </span>
                </div>
                <p style={{
                  fontSize: "11px", color: T.inkSoft, margin: "2px 0 0",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {airport.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * FlightSearchPanel (original — untouched)
 * ───────────────────────────────────────────── */
function FlightSearchPanel({ data, onSearch }: {
  data: FlightSearchResult;
  onSearch?: (params: any) => void;
}) {
  const [tripType,      setTripType]      = useState<"one-way"|"round-trip"|"multi-city">("one-way");
  const [originAirport, setOriginAirport] = useState<AirportEntry>(
    getByIata(data.origin.iata) ?? {
      iata: data.origin.iata, city: data.origin.city,
      name: "", country: "", countryCode: "", label: data.origin.iata, search: "",
    }
  );
  const [destAirport, setDestAirport] = useState<AirportEntry>(
    getByIata(data.destination.iata) ?? {
      iata: data.destination.iata, city: data.destination.city,
      name: "", country: "", countryCode: "", label: data.destination.iata, search: "",
    }
  );

  const origin     = originAirport.iata;
  const originCity = originAirport.city;
  const dest       = destAirport.iata;
  const destCity   = destAirport.city;

  const [depDate,    setDepDate]    = useState(data.isoDate || "");
  const [retDate,    setRetDate]    = useState("");
  const [adults,     setAdults]     = useState(1);
  const [children,   setChildren]   = useState(0);
  const [infants,    setInfants]    = useState(0);
  const [cabin,      setCabin]      = useState<"Economy"|"Premium Economy"|"Business"|"First">("Economy");
  const [paxOpen,    setPaxOpen]    = useState(false);
  const [searching,  setSearching]  = useState(false);
  const [showResults,setShowResults]= useState(data.flights && data.flights.length > 0);
  const [flights,    setFlights]    = useState<FlightListing[]>(data.flights || []);
  const [cheapest,   setCheapest]   = useState<FlightListing|null>(data.cheapest || null);
  const [fastest,    setFastest]    = useState<FlightListing|null>(data.fastest  || null);
  const [searchErr,  setSearchErr]  = useState<string|null>(null);

  const totalPax = adults + children + infants;
  const paxLabel = `${totalPax} Traveller${totalPax > 1 ? "s" : ""}, ${cabin}`;

  const CABINS: Array<"Economy"|"Premium Economy"|"Business"|"First"> =
    ["Economy", "Premium Economy", "Business", "First"];

  const swapRoutes = () => {
    const tmp = originAirport;
    setOriginAirport(destAirport);
    setDestAirport(tmp);
  };

  const handleSearch = async () => {
    if (!origin || !dest || !depDate) return;
    setSearching(true); setSearchErr(null); setShowResults(false);
    try {
      const res = await fetch("/api/v1/copilot/travel/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin:      origin.toUpperCase(),
          destination: dest.toUpperCase(),
          date:        depDate,
          adults, children, infants, cabin, tripType,
          returnDate: tripType === "round-trip" ? retDate : undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[FlightSearch] API error:", res.status, errText);
        setSearchErr(`Search failed (${res.status}). Please try again.`);
        return;
      }

      const json = await res.json();

      if (json?.flights?.length > 0) {
        setFlights(json.flights);
        setCheapest(json.cheapest);
        setFastest(json.fastest);
        setShowResults(true);
      } else {
        setSearchErr("No flights found for this route and date. Try adjusting the date or route.");
      }
    } catch (err) {
      console.error("[FlightSearch] Fetch error:", err);
      setSearchErr("Search failed — check your connection and try again.");
    } finally {
      setSearching(false);
    }
  };

  const pill: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "32px", padding: "0 14px", borderRadius: "100px",
    fontSize: "11px", fontWeight: 700, cursor: "pointer",
    transition: "all 0.18s ease", fontFamily: T.body, border: "none",
  };
  const inputBox: React.CSSProperties = {
    flex: 1, display: "flex", flexDirection: "column", gap: "4px",
    padding: "12px 16px", background: "#fff",
    border: `1px solid ${T.border}`, borderRadius: "14px",
    cursor: "text", minWidth: 0,
  };
  const inputLabel: React.CSSProperties = {
    fontSize: "9px", fontWeight: 900, color: T.inkSoft,
    letterSpacing: "0.12em", textTransform: "uppercase",
  };
  const inputValue: React.CSSProperties = {
    fontSize: "15px", fontWeight: 700, color: T.ink,
    letterSpacing: "-0.01em", lineHeight: 1.3, fontFamily: T.body,
    background: "transparent", border: "none", outline: "none",
    width: "100%", padding: 0, cursor: "text",
  };
  const inputSub: React.CSSProperties = {
    fontSize: "10px", color: T.inkMid, fontWeight: 500, marginTop: "1px",
  };

  return (
    <div style={{ marginBottom: "24px", fontFamily: T.body }}>
      <div style={{
        borderRadius: "20px", overflow: "visible",
        border: `1px solid ${T.border}`,
        boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
        background: T.canvas,
      }}>
        {/* Header strip */}
        <div style={{
          background: "linear-gradient(135deg, #0C0C0E 0%, #1C1825 100%)",
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderRadius: "19px 19px 0 0",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["one-way", "round-trip", "multi-city"] as const).map(t => (
              <button key={t} onClick={() => setTripType(t)} style={{
                ...pill,
                background: tripType === t ? T.gold : "rgba(255,255,255,0.06)",
                color: tripType === t ? "#fff" : "rgba(255,255,255,0.55)",
                border: tripType === t ? "none" : "1px solid rgba(255,255,255,0.1)",
                textTransform: "capitalize",
              }}>
                {t === "one-way" ? "One Way" : t === "round-trip" ? "Round Trip" : "Multi-City"}
              </button>
            ))}
          </div>
          <span style={{ fontSize: "9px", fontWeight: 800, color: T.gold, letterSpacing: "0.15em" }}>
            FLIGHT SEARCH
          </span>
        </div>

        {/* Search fields */}
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AirportTypeahead label="From" value={origin} cityValue={originCity} onSelect={setOriginAirport} placeholder="City, airport or code" />

            <button onClick={swapRoutes} style={{
              width: "40px", height: "40px", borderRadius: "50%",
              background: T.canvasDeep, border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0, fontSize: "18px",
              transition: "transform 0.25s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "rotate(180deg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "rotate(0deg)"; }}
            title="Swap origin and destination">
              ⇄
            </button>

            <AirportTypeahead label="To" value={dest} cityValue={destCity} onSelect={setDestAirport} placeholder="City, airport or code" />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ ...inputBox, flex: 1 }}>
              <span style={inputLabel}>Departure</span>
              <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)}
                style={{ ...inputValue, fontSize: "14px", fontFamily: T.body }} />
            </div>

            {tripType === "round-trip" && (
              <div style={{ ...inputBox, flex: 1 }}>
                <span style={inputLabel}>Return</span>
                <input type="date" value={retDate} onChange={e => setRetDate(e.target.value)}
                  style={{ ...inputValue, fontSize: "14px", fontFamily: T.body }} min={depDate} />
              </div>
            )}

            <div style={{ ...inputBox, flex: "0 0 auto", minWidth: "180px", position: "relative" }}>
              <span style={inputLabel}>Travellers & Class</span>
              <button onClick={() => setPaxOpen(o => !o)} style={{
                background: "transparent", border: "none", padding: 0,
                cursor: "pointer", textAlign: "left", fontFamily: T.body,
              }}>
                <span style={{ ...inputValue, fontSize: "13px", display: "block" }}>
                  {paxLabel}
                </span>
              </button>

              {paxOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0,
                  background: "#fff", border: `1px solid ${T.border}`,
                  borderRadius: "16px", padding: "16px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  zIndex: 100, width: "260px",
                }}>
                  {([
                    ["Adults",   "12+ years",  adults,   setAdults,   1, 9],
                    ["Children", "2–11 years", children, setChildren, 0, 9],
                    ["Infants",  "Under 2",    infants,  setInfants,  0, 4],
                  ] as [string, string, number, (val: React.SetStateAction<number>) => void, number, number][]).map(([label, sub, val, setter, min, max]) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 0", borderBottom: label !== "Infants" ? `1px solid ${T.border}` : "none",
                    }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: T.ink, margin: 0 }}>{label}</p>
                        <p style={{ fontSize: "10px", color: T.inkSoft, margin: 0 }}>{sub}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button onClick={() => setter(v => Math.max(min, v - 1))} style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          border: `1px solid ${T.border}`, background: T.canvasDeep,
                          cursor: val <= min ? "not-allowed" : "pointer",
                          fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: val <= min ? 0.35 : 1,
                        }}>−</button>
                        <span style={{ fontSize: "15px", fontWeight: 800, color: T.ink, minWidth: "16px", textAlign: "center" }}>{val}</span>
                        <button onClick={() => setter(v => Math.min(max, v + 1))} style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          border: `1px solid ${T.border}`, background: T.canvasDeep,
                          cursor: val >= max ? "not-allowed" : "pointer",
                          fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: val >= max ? 0.35 : 1,
                        }}>+</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: "12px" }}>
                    <p style={{ ...inputLabel, marginBottom: "8px", display: "block" }}>Cabin Class</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      {CABINS.map(c => (
                        <button key={c} onClick={() => setCabin(c)} style={{
                          padding: "8px 10px", borderRadius: "10px", fontSize: "11px",
                          fontWeight: 700, fontFamily: T.body, cursor: "pointer",
                          background: cabin === c ? T.obsidian : T.canvasDeep,
                          color: cabin === c ? T.gold : T.inkMid,
                          border: cabin === c ? "none" : `1px solid ${T.border}`,
                        }}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setPaxOpen(false)} style={{
                    marginTop: "14px", width: "100%", padding: "10px",
                    background: T.obsidian, color: T.gold, border: "none",
                    borderRadius: "10px", fontSize: "12px", fontWeight: 800,
                    cursor: "pointer", fontFamily: T.body,
                  }}>Done</button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={searching || !origin || !dest || !depDate}
            style={{
              width: "100%", padding: "14px",
              background: searching ? T.inkSoft : `linear-gradient(135deg, ${T.obsidian} 0%, #2A2420 100%)`,
              color: T.gold, border: `1px solid ${T.goldLight}`,
              borderRadius: "12px", fontSize: "13px", fontWeight: 900,
              cursor: searching || !origin || !dest || !depDate ? "not-allowed" : "pointer",
              fontFamily: T.body, letterSpacing: "0.08em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            {searching ? (
              <>
                <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                Searching live fares…
              </>
            ) : (
              <>✈ Search Flights — {origin} → {dest}{depDate ? `  ·  ${depDate}` : ""}</>
            )}
          </button>
        </div>
      </div>

      {searchErr && (
        <div style={{
          marginTop: "12px", padding: "14px 18px",
          background: "#FFF5F5", border: "1px solid #FECACA",
          borderRadius: "12px", fontSize: "12px", color: "#DC2626",
        }}>
          {searchErr}
        </div>
      )}

      {showResults && flights.length > 0 && (
        <div style={{
          marginTop: "12px", borderRadius: "20px", overflow: "hidden",
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #0C0C0E 0%, #1A1A2E 100%)",
            padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ fontSize: "9px", fontWeight: 900, color: T.gold, letterSpacing: "0.15em", margin: "0 0 4px" }}>
                {flights.length} FLIGHTS FOUND
              </p>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "#fff", margin: 0 }}>
                {origin} → {dest}
                {depDate && <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginLeft: "10px", fontWeight: 500 }}>{depDate}</span>}
              </p>
            </div>
            <span style={{ fontSize: "8px", background: "rgba(52,211,153,0.15)", color: "#34d399", padding: "3px 10px", borderRadius: "20px", fontWeight: 800, letterSpacing: "0.1em" }}>
              LIVE · Plumtrips Flights
            </span>
          </div>

          {(cheapest || fastest) && (
            <div style={{ display: "flex", gap: "1px", background: T.border }}>
              {cheapest && (
                <div style={{ flex: 1, padding: "12px 18px", background: T.canvas }}>
                  <p style={{ fontSize: "8px", fontWeight: 900, color: T.gold, letterSpacing: "0.15em", margin: "0 0 3px" }}>CHEAPEST</p>
                  <p style={{ fontSize: "20px", fontWeight: 900, color: T.ink, margin: 0 }}>{cheapest.price}</p>
                  <p style={{ fontSize: "10px", color: T.inkMid, margin: "2px 0 0" }}>{cheapest.airline} · {cheapest.stopDetail}</p>
                </div>
              )}
              {fastest && fastest.flightNo !== cheapest?.flightNo && (
                <div style={{ flex: 1, padding: "12px 18px", background: T.canvas }}>
                  <p style={{ fontSize: "8px", fontWeight: 900, color: "#818cf8", letterSpacing: "0.15em", margin: "0 0 3px" }}>FASTEST</p>
                  <p style={{ fontSize: "20px", fontWeight: 900, color: T.ink, margin: 0 }}>{fastest.duration}</p>
                  <p style={{ fontSize: "10px", color: T.inkMid, margin: "2px 0 0" }}>{fastest.airline} · {fastest.price}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ background: "#fff" }}>
            {flights.map((flight, idx) => (
              <a key={idx} href={flight.bookUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", padding: "14px 20px",
                  borderTop: idx > 0 ? `1px solid ${T.border}` : "none",
                  textDecoration: "none", gap: "14px", transition: "background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.canvasDeep; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
              >
                <div style={{
                  width: "38px", height: "38px", borderRadius: "10px",
                  background: T.canvasDeep, flexShrink: 0, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <img src={flight.logoUrl} alt={flight.airline}
                    style={{ width: "30px", height: "30px", objectFit: "contain" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>

                <div style={{ flex: "0 0 120px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 800, color: T.ink, margin: 0 }}>{flight.airline}</p>
                  <p style={{ fontSize: "10px", color: T.inkSoft, margin: "1px 0 0" }}>{flight.flightNo}</p>
                </div>

                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "16px", fontWeight: 800, color: T.ink, margin: 0, fontVariantNumeric: "tabular-nums" }}>{flight.departure.time}</p>
                    <p style={{ fontSize: "9px", color: T.inkSoft, margin: "1px 0 0" }}>{flight.departure.iata}</p>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                    <span style={{ fontSize: "9px", color: T.inkSoft }}>{flight.duration}</span>
                    <div style={{ width: "100%", height: "1px", background: T.borderDeep, position: "relative" }}>
                      <span style={{ position: "absolute", left: "50%", top: "-4px", transform: "translateX(-50%)", fontSize: "9px" }}>✈</span>
                    </div>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: flight.stops === 0 ? T.emerald : T.amber }}>{flight.stopDetail}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: "16px", fontWeight: 800, color: T.ink, margin: 0, fontVariantNumeric: "tabular-nums" }}>{flight.arrival.time}</p>
                    <p style={{ fontSize: "9px", color: T.inkSoft, margin: "1px 0 0" }}>{flight.arrival.iata}</p>
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: "17px", fontWeight: 900, color: T.ink, margin: 0 }}>{flight.price}</p>
                  <p style={{ fontSize: "9px", color: T.inkSoft, margin: "2px 0 4px" }}>{flight.cabin}</p>
                  <span style={{
                    display: "inline-block", padding: "4px 10px",
                    background: T.obsidian, color: T.gold,
                    borderRadius: "6px", fontSize: "9px", fontWeight: 800,
                    letterSpacing: "0.08em",
                  }}>SELECT →</span>
                </div>
              </a>
            ))}
          </div>

          {data.tipLines && data.tipLines.length > 0 && (
            <div style={{ padding: "14px 20px", background: T.canvasDeep, borderTop: `1px solid ${T.border}` }}>
              <p style={{ fontSize: "8px", fontWeight: 900, color: T.gold, letterSpacing: "0.15em", margin: "0 0 8px" }}>PLUTO TIPS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {data.tipLines.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: T.gold, fontSize: "7px", marginTop: "4px", flexShrink: 0 }}>◆</span>
                    <p style={{ fontSize: "11px", color: T.inkMid, margin: 0, lineHeight: 1.55 }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Main Page (original — untouched)
 * ───────────────────────────────────────────── */
export default function IntegratedConcierge() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [messages,             setMessages]             = useState<ChatMessage[]>([]);
  const [conversationContext,  setConversationContext]  = useState<ConversationContext | null>(null);
  const [prompt,               setPrompt]               = useState("");
  const [loading,              setLoading]              = useState(false);
  const [isSidebarOpen,        setIsSidebarOpen]        = useState(true);
  const [recentChats,          setRecentChats]          = useState<ChatSession[]>([]);
  const [videos,               setVideos]               = useState<VideoItem[]>([]);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const [activeVideoAnalysisId, setActiveVideoAnalysisId] = useState<string | null>(null);

  const THEMES = [
    { name: "Atlas", canvas: "#F9F8F5", dark: false },
    { name: "Slate", canvas: "#EEF2F7", dark: false },
    { name: "Noir",  canvas: "#18181A", dark: true  },
    { name: "Ivory", canvas: "#FAF8F0", dark: false },
  ];
  const [themeIdx, setThemeIdx] = useState(0);
  const theme      = THEMES[themeIdx];
  const isDark     = theme.dark;
  const canvas     = theme.canvas;
  const inkColor   = isDark ? "#F4F4F5" : T.ink;
  const inkMidColor = isDark ? "rgba(255,255,255,0.5)" : T.inkMid;
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : T.border;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }
      });
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("pluto_recent_chats");
    if (saved) {
      try {
        const parsed: ChatSession[] = JSON.parse(saved);
        setRecentChats(parsed.filter(c => (Date.now() - c.timestamp) < 96 * 3600 * 1000));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  const sidebarBg = isDark ? "#18181A" : (
    themeIdx === 1 ? "#1C2230" :
    themeIdx === 3 ? "#28231A" :
    "#24201A"
  );

  useEffect(() => {
    if (videos.length === 0) return;
    const interval = setInterval(async () => {
      for (const video of videos) {
        if (!video.analysisId || video.status === "analyzed" || video.status === "failed") continue;
        try {
          const res    = await fetch(`/api/v1/pluto/video/${video.analysisId}/status`, { credentials: "include" });
          const status = await res.json();
          setVideos(prev => prev.map(v => v.analysisId === video.analysisId ? { ...v, status: status.status } : v));

          if (status.status === "analyzed") {
            setVideos(prev => prev.filter(v => v.analysisId !== video.analysisId));
            setActiveVideoAnalysisId(video.analysisId!);
            const ctxRes = await fetch(`/api/v1/pluto/video/${video.analysisId}/context`, { credentials: "include" });
            const ctx    = await ctxRes.json();
            setMessages(prev => [...prev, {
              role: "assistant",
              content: {
                title: "Here's what I understood from your video",
                context: ctx?.transcript || ctx?.extractedText || "No speech or readable on-screen text was detected.",
                nextSteps: [],
              },
              videoConsent: { videoId: video.analysisId! },
            }]);
          }
        } catch (err) { console.error("Video polling failed", err); }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [videos]);

  async function submit(overridePrompt?: string) {
    const textToSubmit = overridePrompt ?? prompt;
    if ((!textToSubmit.trim() && videos.length === 0) || loading) return;
    if (videos.some(v => v.status === "failed")) { alert("Video analysis failed. Please re-upload."); return; }

    setPrompt("");
    const attachedVideos = videos;
    const newMessages: ChatMessage[] = [
      ...messages,
      ...(textToSubmit.trim() ? [{ role: "user" as const, content: textToSubmit, videos: attachedVideos.length > 0 ? attachedVideos : undefined }] : []),
    ];
    setMessages(newMessages);
    const effectiveContext = conversationContext ?? {};
    setLoading(true);

    try {
      const flightMatch = textToSubmit.match(/\b(\d?[A-Z]{1,2})[-\s]?(\d{2,4})\b/gi);
      let detectedFlightData = null;
      if (flightMatch) {
        try {
          const flightRes = await fetch(`/api/v1/flights/status?flightNumber=${flightMatch[0].replace(/\s/g, "")}`);
          const fData     = await flightRes.json();
          if (!fData.error) detectedFlightData = fData;
        } catch (err) { console.warn("Flight lookup failed", err); }
      }

      const isFlightQuery = Boolean(
        textToSubmit.match(/\b(\d?[A-Z]{1,2})[-\s]?(\d{2,4})\b/gi) &&
        /(status|flight|where|landed|delayed|on time|arrival|departure)/i.test(textToSubmit)
      );
      const isPlanning          = hasPlanningIntent(textToSubmit);
      const isFreshConversation = !effectiveContext?.id;

      if (isFreshConversation && !isPlanning && !isFlightQuery) {
        setLoading(false);
        if (!textToSubmit.trim()) return;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: { title: "Ready when you are", context: "Ask me to plan a trip, create an itinerary, or check a flight status.", nextSteps: ["Plan a trip inspired by this video", "Create an itinerary"] },
        }]);
        return;
      }

      const resolvedVideoAnalysisId = attachedVideos[0]?.analysisId || activeVideoAnalysisId || null;
      const res  = await fetch("/api/v1/copilot/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSubmit, videoAnalysisId: resolvedVideoAnalysisId, context: effectiveContext }),
      });
      setVideos([]);
      const data  = await res.json();
      const reply = data.reply as PlutoReplyV1;
      if (data.context) setConversationContext(data.context);
      setLoading(false);

      const assistantMsg: ChatMessage = { role: "assistant", content: reply, isTyping: true, flightData: detectedFlightData };
      setMessages([...newMessages, assistantMsg]);
      setTimeout(() => {
        setMessages(prev => prev.map((msg, idx) => idx === prev.length - 1 ? { ...msg, isTyping: false } : msg));
      }, 800);

      const newChat: ChatSession = {
        id: Math.random().toString(36).substr(2, 9),
        title: reply.title || textToSubmit.substring(0, 30),
        timestamp: Date.now(),
        messages: [...newMessages, { role: "assistant", content: reply, flightData: detectedFlightData }],
      };
      const updated = [newChat, ...recentChats].slice(0, 10);
      setRecentChats(updated);
      localStorage.setItem("pluto_recent_chats", JSON.stringify(updated));

    } catch (e) { console.error(e); setLoading(false); }
  }

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100%",
      overflow: "hidden", backgroundColor: canvas, transition: "background-color 0.4s ease",
      fontFamily: T.body,
    }}>

      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        try {
          const presignRes = await fetch("/api/v1/pluto/video/presign", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ fileName: file.name, contentType: file.type }) });
          const { ok, uploadUrl, s3Key } = await presignRes.json();
          if (!ok) { alert("Failed to prepare upload"); return; }
          await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
          const regRes  = await fetch("/api/v1/pluto/video/register", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ s3Key, originalFileName: file.name, contentType: file.type, durationSec: null, conversationId: null }) });
          const regData = await regRes.json();
          if (!regData.ok) { alert("Failed to register video"); return; }
          setVideos(prev => [...prev, { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), analysisId: regData.videoId, status: "processing" }]);
        } catch (err) { console.error("Upload failed:", err); alert("Video upload failed"); }
        finally { e.target.value = ""; }
      }} />

      {/* ══ SIDEBAR ══ */}
      <aside style={{
        width: isSidebarOpen ? "260px" : "0px",
        transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden", flexShrink: 0,
        background: sidebarBg,
        display: "flex", flexDirection: "column",
        borderRight: "none",
      }}>
        <div style={{ padding: "20px 16px 16px" }}>
          <Link to="/" style={{ textDecoration: "none", display: "block" }}>
            <div style={{
              background: "#FFFFFF", borderRadius: "14px", padding: "10px 16px",
              display: "flex", alignItems: "center", justifyContent: "flex-start",
              boxShadow: "0 2px 12px rgba(0,0,0,0.28), 0 1px 3px rgba(0,0,0,0.18)",
            }}>
              <img src="/assets/logo.png" alt="Plumtrips"
                style={{ height: "30px", objectFit: "contain", display: "block" }} />
            </div>
          </Link>
        </div>

        <nav style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {[
            { to: "/", icon: <Home size={15} />, label: "Home" },
            { to: "/customer/approvals/new", icon: <FilePlus size={15} />, label: "Raise Request", highlight: true },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 14px", borderRadius: "10px", fontSize: "13px",
              fontWeight: 600, textDecoration: "none",
              color: item.highlight ? T.gold : "rgba(255,255,255,0.45)",
              background: item.highlight ? "rgba(201,169,110,0.08)" : "transparent",
              transition: "all 0.15s ease",
            }}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: "20px 12px 12px" }}>
          <button
            onClick={() => { setMessages([]); setVideos([]); setActiveVideoAnalysisId(null); setConversationContext(null); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "8px", width: "100%", padding: "13px",
              background: "transparent", border: `1px solid rgba(201,169,110,0.3)`,
              borderRadius: "12px", color: T.gold, fontSize: "11px", fontWeight: 900,
              letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,169,110,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Plus size={13} /> NEW EXPLORATION
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
          <p style={{ fontSize: "9px", fontWeight: 800, color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 4px 10px" }}>
            Recent Sessions
          </p>
          {recentChats.map(chat => (
            <button key={chat.id} onClick={() => setMessages(chat.messages)} style={{
              display: "flex", alignItems: "center", gap: "10px",
              width: "100%", padding: "9px 10px", borderRadius: "9px",
              background: "transparent", border: "none", cursor: "pointer",
              textAlign: "left", transition: "background 0.15s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <History size={12} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {chat.title}
              </span>
            </button>
          ))}
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Theme</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {THEMES.map((t, i) => (
                <button key={i} onClick={() => setThemeIdx(i)} title={t.name} style={{
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: t.canvas, border: i === themeIdx ? "2px solid #C9A96E" : "2px solid rgba(255,255,255,0.15)",
                  cursor: "pointer", padding: 0, transition: "all 0.2s ease",
                  transform: i === themeIdx ? "scale(1.2)" : "scale(1)",
                }} />
              ))}
            </div>
          </div>
          <button onClick={() => logout?.()} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", width: "100%", padding: "11px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px", color: "rgba(255,255,255,0.35)",
            fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", cursor: "pointer",
          }}>
            <LogOut size={12} /> LOGOUT
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        <nav style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", height: "60px", flexShrink: 0,
          background: isDark ? "rgba(18,18,20,0.9)" : "rgba(249,248,245,0.85)", backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${T.border}`, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "6px",
              color: T.inkMid, borderRadius: "8px",
            }}>
              <Menu size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="/assets/plutologo.png" alt="Pluto.ai" style={{ height: "22px", objectFit: "contain" }} />
              <span style={{
                fontSize: "8px", padding: "3px 10px", borderRadius: "100px",
                background: T.obsidian, color: T.gold,
                fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Travel Companion
              </span>
            </div>
          </div>
        </nav>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: "160px" }}>
          <div style={{ maxWidth: "860px", margin: "0 auto", padding: "60px 32px 0" }}>

            {messages.length === 0 && (
              <div style={{ animation: "fadeUp 0.6s ease both" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: T.gold, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                  Pluto.ai
                </p>
                <h1 style={{
                  fontSize: "56px", fontWeight: 400, color: inkColor,
                  fontFamily: T.display, letterSpacing: "-0.02em",
                  lineHeight: 1.1, margin: "0 0 16px",
                }}>
                  Beyond the<br /><em>horizon.</em>
                </h1>
                <p style={{ fontSize: "16px", color: T.inkMid, fontWeight: 400, marginBottom: "40px", lineHeight: 1.6 }}>
                  Intelligent routes for extraordinary experiences.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {["3-day business trip to Tokyo", "Executive stay in London Soho", "Swiss Alps Team Offsite", "Check flight 6E-2582"].map(text => (
                    <button key={text} onClick={() => submit(text)} style={{
                      padding: "12px 20px", background: "#fff",
                      border: `1px solid ${T.border}`, borderRadius: "100px",
                      fontSize: "13px", fontWeight: 600, color: T.inkMid,
                      cursor: "pointer", transition: "all 0.2s ease", fontFamily: T.body,
                    }}
                    onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { borderColor: T.gold, color: T.ink, transform: "translateY(-1px)" }); }}
                    onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { borderColor: T.border, color: T.inkMid, transform: "translateY(0)" }); }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  display: "flex", gap: "20px",
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                  animation: "fadeUp 0.4s ease both",
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px",
                    background: m.role === "user" ? T.canvasDeep : T.obsidian,
                    border: `1px solid ${m.role === "user" ? T.border : "transparent"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {m.role === "user"
                      ? <User size={16} color={T.inkSoft} />
                      : <img src="/assets/hr-copilot-mascot.png" style={{ width: "28px", height: "28px" }} />
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {m.role === "user" ? (
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "18px", fontWeight: 700, color: T.ink, margin: 0, letterSpacing: "-0.01em" }}>
                          {m.content}
                        </p>
                        {m.videos && m.videos.length > 0 && (
                          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                            {m.videos.map(v => (
                              <video key={v.id} src={v.url} controls style={{ width: "200px", borderRadius: "12px", border: `1px solid ${T.border}` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ opacity: m.isTyping ? 0.4 : 1, filter: m.isTyping ? "blur(2px)" : "none", transition: "all 0.8s ease" }}>

                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                          borderBottom: `1px solid ${T.border}`, paddingBottom: "24px", marginBottom: "32px",
                        }}>
                          <div>
                            <span style={{ fontSize: "9px", fontWeight: 900, color: T.gold, letterSpacing: "0.2em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                              Verified Itinerary
                            </span>
                            <h2 style={{ fontSize: "26px", fontWeight: 800, color: T.ink, margin: 0, letterSpacing: "-0.02em", fontFamily: T.body }}>
                              {m.content.title}
                            </h2>
                          </div>
                          {!m.isTyping && (
                            <button
                              onClick={() => generatePDF(m.content, user?.email)}
                              style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                padding: "10px 18px", background: T.obsidian,
                                color: T.gold, border: "none", borderRadius: "10px",
                                fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em",
                                cursor: "pointer", whiteSpace: "nowrap", fontFamily: T.body,
                                flexShrink: 0, marginLeft: "16px",
                              }}
                            >
                              <Download size={12} /> EXPORT
                            </button>
                          )}
                        </div>

                        {!m.isTyping && m.flightData && (
                          <div style={{ marginBottom: "32px" }}>
                            <FlightStatusCard data={m.flightData} reply={m.content} onNextStep={(step) => setPrompt(step)} />
                          </div>
                        )}

                        <p style={{
                          fontSize: "16px", lineHeight: 1.8, color: T.inkMid,
                          margin: "0 0 32px", fontWeight: 400,
                          borderLeft: `3px solid ${T.goldLight}`, paddingLeft: "16px",
                        }}>
                          {m.content.context}
                        </p>

                        {(() => {
                          const videoId = m.videoConsent?.videoId;
                          if (!videoId) return null;
                          return (
                            <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                              <button onClick={async () => {
                                const r = await fetch(`/api/v1/copilot/video/${videoId}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ consent: "yes" }) });
                                const d = await r.json();
                                if (!d?.ok) { alert("Failed to confirm consent"); return; }
                                if (d.reply) setMessages(prev => [...prev, { role: "assistant", content: d.reply }]);
                                setActiveVideoAnalysisId(videoId);
                                if (d.contextPatch) setConversationContext(prev => ({ ...(prev ?? {}), ...d.contextPatch, locked: { ...(prev?.locked ?? {}), ...(d.contextPatch.locked ?? {}) } }));
                              }} style={{
                                padding: "12px 24px", background: T.obsidian, color: T.gold,
                                border: "none", borderRadius: "12px", fontSize: "12px",
                                fontWeight: 900, letterSpacing: "0.08em", cursor: "pointer", fontFamily: T.body,
                              }}>
                                Let's plan this
                              </button>
                              <button onClick={async () => {
                                const r = await fetch(`/api/v1/copilot/video/${videoId}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ consent: "no" }) });
                                const d = await r.json();
                                if (d?.reply) setMessages(prev => [...prev, { role: "assistant", content: d.reply }]);
                              }} style={{
                                padding: "12px 20px", background: T.canvasDeep, color: T.inkMid,
                                border: `1px solid ${T.border}`, borderRadius: "12px",
                                fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: T.body,
                              }}>
                                No
                              </button>
                            </div>
                          );
                        })()}

                        {!m.isTyping && m.content.flightSearch && !m.flightData && (() => {
                          // Only show FlightSearchPanel for trip-planning replies.
                          // When flightData exists it's a flight-status response — the backend
                          // also sends a junk flightSearch (YOU→YOU) in that case, so we skip it.
                          const fs = m.content.flightSearch;
                          const isJunk = (s: string) => {
                            if (!s) return true;
                            const u = s.toUpperCase().trim();
                            // Valid IATA is exactly 3 alpha chars — anything else is a placeholder
                            return !/^[A-Z]{3}$/.test(u);
                          };
                          if (isJunk(fs.origin?.iata) || isJunk(fs.destination?.iata)) return null;
                          if (fs.origin.iata === fs.destination.iata) return null;
                          return <FlightSearchPanel data={fs} />;
                        })()}

                        {m.content.hotels && m.content.hotels.length > 0 && (
                          <div style={{ marginBottom: "40px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                              <span style={{ fontSize: "9px", fontWeight: 900, color: T.gold, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                                01 · Recommended Stays
                              </span>
                              <div style={{ flex: 1, height: "1px", background: T.border }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
                              {m.content.hotels.map((h, idx) => <HotelCard key={idx} hotel={h} index={idx} />)}
                            </div>
                          </div>
                        )}

                        {m.content.itinerary && m.content.itinerary.length > 0 && (
                          <div style={{ marginBottom: "40px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                              <span style={{ fontSize: "9px", fontWeight: 900, color: T.gold, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                                02 · Schedule Breakdown
                              </span>
                              <div style={{ flex: 1, height: "1px", background: T.border }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                              {m.content.itinerary.map(d => <DayCard key={d.day} day={d} />)}
                            </div>
                          </div>
                        )}

                        {!m.isTyping && m.content.itinerary && m.content.itinerary.length > 0 && !m.flightData && (
                          <div style={{ marginBottom: "40px", padding: "24px", background: isDark ? "rgba(201,169,110,0.05)" : "rgba(201,169,110,0.04)", borderRadius: "20px", border: `1px solid ${T.goldLight}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                              <span style={{ fontSize: "9px", fontWeight: 900, color: T.gold, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                                03 · Flight Options
                              </span>
                              <div style={{ flex: 1, height: "1px", background: T.goldLight }} />
                              <span style={{ fontSize: "9px", fontWeight: 600, color: T.inkSoft, fontStyle: "italic" }}>AI suggested</span>
                            </div>
                            <p style={{ fontSize: "13px", color: T.inkMid, marginBottom: "16px", lineHeight: 1.6 }}>
                              To complete your trip plan, share your <strong style={{ color: inkColor }}>origin city</strong> and <strong style={{ color: inkColor }}>travel dates</strong> and I'll find the best flight options for this itinerary.
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {[
                                "Find flights for this trip",
                                "Check flight prices and availability",
                                "Add flights to my itinerary",
                              ].map((action, idx) => (
                                <button key={idx} onClick={() => { setPrompt(action); }} style={{
                                  display: "flex", alignItems: "center", gap: "6px",
                                  padding: "9px 14px", background: "transparent",
                                  border: `1px solid ${T.gold}`, borderRadius: "100px",
                                  fontSize: "11px", fontWeight: 700, color: T.goldDeep,
                                  cursor: "pointer", fontFamily: T.body, transition: "all 0.2s ease",
                                }}
                                onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: T.gold, color: "#fff" }); }}
                                onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: "transparent", color: T.goldDeep }); }}
                                >
                                  ✈ {action}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {!m.isTyping && m.content.nextSteps && m.content.nextSteps.length > 0 && (
                          <div style={{ paddingTop: "24px", borderTop: `1px solid ${T.border}` }}>
                            <p style={{ fontSize: "9px", fontWeight: 900, color: T.inkSoft, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px" }}>
                              Continue planning
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {m.content.nextSteps.map((step, idx) => (
                                <button key={idx} onClick={() => submit(step)} style={{
                                  display: "flex", alignItems: "center", gap: "8px",
                                  padding: "10px 16px", background: T.canvasDeep,
                                  border: `1px solid ${T.border}`, borderRadius: "100px",
                                  fontSize: "12px", fontWeight: 600, color: T.inkMid,
                                  cursor: "pointer", transition: "all 0.2s ease", fontFamily: T.body,
                                }}
                                onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: T.obsidian, color: T.gold, borderColor: T.obsidian }); }}
                                onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: T.canvasDeep, color: T.inkMid, borderColor: T.border }); }}
                                >
                                  {step} <ArrowRight size={11} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: "flex", gap: "20px", animation: "fadeUp 0.3s ease both" }}>
                  <div style={{ width: "36px", height: "36px", flexShrink: 0, borderRadius: "10px", background: T.obsidian, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src="/assets/hr-copilot-mascot.png" style={{ width: "28px", height: "28px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "8px" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: "6px", height: "6px", borderRadius: "50%", background: T.gold,
                        animation: `bounce 1.2s ease infinite ${i * 0.15}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {videos.length > 0 && (
          <div style={{ position: "absolute", bottom: "148px", left: 0, right: 0, zIndex: 20 }}>
            <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px" }}>
              <div style={{
                background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)",
                border: `1px solid ${T.border}`, borderRadius: "16px",
                padding: "12px 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
              }}>
                <p style={{ fontSize: "9px", fontWeight: 900, color: T.inkSoft, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Processing video
                </p>
                <div style={{ display: "flex", gap: "12px", overflowX: "auto" }}>
                  {videos.map(v => (
                    <div key={v.id} style={{ position: "relative", flexShrink: 0 }}>
                      <video src={v.url} style={{ width: "140px", height: "80px", objectFit: "cover", borderRadius: "10px", border: `1px solid ${T.border}` }} />
                      <button onClick={() => setVideos(prev => prev.filter(vid => vid.id !== v.id))} style={{
                        position: "absolute", top: "-6px", right: "-6px",
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: T.obsidian, color: "#fff", border: "none",
                        fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 32px", zIndex: 30, pointerEvents: "none" }}>
          <div style={{ maxWidth: "860px", margin: "0 auto", pointerEvents: "auto" }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: isDark ? "rgba(30,30,32,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
              border: `1px solid ${T.border}`,
              borderRadius: "20px", padding: "6px 6px 6px 20px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ height: "28px", width: "28px", marginRight: "12px", overflow: "hidden", flexShrink: 0 }}>
                <img src="/assets/hr-copilot-mascot.png" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
              </div>

              <input
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (prompt.trim() || videos.length > 0)) submit(); }}
                placeholder="Brief your Concierge..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: "16px", fontWeight: 500, fontFamily: T.body,
                  padding: "12px 0", color: inkColor,
                }}
              />

              <button onClick={() => videoInputRef.current?.click()} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "10px 12px", color: T.inkSoft, fontSize: "18px",
              }}>🎬</button>

              <button onClick={() => submit()} disabled={loading || (!prompt.trim() && videos.length === 0)} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "44px", height: "44px", borderRadius: "14px",
                background: loading ? T.inkGhost : T.obsidian,
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease", flexShrink: 0,
              }}>
                {loading
                  ? <Loader2 size={18} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
                  : <Send size={16} color={T.gold} />
                }
              </button>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </div>
  );
}