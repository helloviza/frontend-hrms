import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../components/sbt/FlightResultCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HotelDestination {
  cityId: string;
  cityName: string;
  countryName: string;
  countryCode: string;
}

export interface SBTHotel {
  resultIndex: string;
  hotelCode: string;
  hotelName: string;
  starRating: number;
  address: string;
  cityName: string;
  countryName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  lowestPrice: number;
  currency: string;
  isRefundable: boolean;
  imageUrl?: string;
  amenities: string[];
  /** Raw TBO Rooms array preserved for downstream pages */
  Rooms?: any[];
}

export interface RoomConfig {
  guests: { adults: number; children: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 1;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🏨";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

const RATING_MAP: Record<string, number> = {
  OneStar: 1, TwoStar: 2, ThreeStar: 3, FourStar: 4, FiveStar: 5,
};

function parseStarRating(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return RATING_MAP[v] ?? (parseInt(v, 10) || 3);
  return 3;
}

/** Map a raw TBO hotel object (PascalCase) → SBTHotel (camelCase) */
function mapTBOHotel(raw: any, checkIn: string, checkOut: string): SBTHotel {
  // Find lowest room fare
  const rooms: any[] = raw.Rooms || raw.rooms || [];
  const fares = rooms.map((r: any) => r.TotalFare ?? r.totalFare ?? r.DayRates?.[0]?.BasePrice ?? 0);
  const lowestPrice = fares.length ? Math.min(...fares) : 0;
  const firstRoom = rooms[0] || {};

  return {
    resultIndex: String(raw.ResultIndex ?? raw.resultIndex ?? raw.HotelCode ?? ""),
    hotelCode: String(raw.HotelCode ?? raw.hotelCode ?? ""),
    hotelName: raw.HotelName ?? raw.hotelName ?? "Hotel",
    starRating: parseStarRating(raw.HotelRating ?? raw.starRating ?? raw.StarRating),
    address: raw.Address ?? raw.address ?? "",
    cityName: raw.CityName ?? raw.cityName ?? "",
    countryName: raw.CountryName ?? raw.countryName ?? "",
    checkIn: raw.CheckIn ?? checkIn,
    checkOut: raw.CheckOut ?? checkOut,
    nights: nightsBetween(checkIn, checkOut),
    lowestPrice,
    currency: raw.Currency ?? raw.currency ?? "INR",
    isRefundable: firstRoom.IsRefundable ?? firstRoom.isRefundable ?? false,
    imageUrl: raw.HotelPicture ?? raw.imageUrl ?? "",
    amenities: Array.isArray(raw.HotelFacilities) ? raw.HotelFacilities
      : typeof raw.HotelFacilities === "string" ? raw.HotelFacilities.split(",").map((s: string) => s.trim()).filter(Boolean)
      : raw.amenities ?? [],
    // Preserve raw Rooms for downstream pages (detail, prebook)
    ...(rooms.length ? { Rooms: rooms } : {}),
  };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_HOTEL_NAMES = [
  "The Grand Meridian", "Horizon Suites", "Azure Palace Hotel",
  "The Oberoi Collection", "Park Regis Central", "Courtyard Premier",
  "The Leela Signature", "Vivanta by Taj", "ITC Windsor Manor",
];
const AMENITY_POOL = [
  "Free WiFi", "Pool", "Spa", "Gym", "Restaurant",
  "Room Service", "Parking", "Airport Shuttle", "Bar",
];

function buildMockHotels(cityName: string, checkIn: string, nights: number): SBTHotel[] {
  return MOCK_HOTEL_NAMES.map((name, i) => ({
    resultIndex: `MOCK-${i}`,
    hotelCode: `HTL${100 + i}`,
    hotelName: name,
    starRating: Math.min(5, Math.max(3, 5 - (i % 3))),
    address: `${12 + i} Main Road, ${cityName}`,
    cityName,
    countryName: "India",
    checkIn,
    checkOut: addDays(checkIn, nights),
    nights,
    lowestPrice: 2800 + i * 1400,
    currency: "INR",
    isRefundable: i % 3 !== 0,
    amenities: AMENITY_POOL.slice(0, 4 + (i % 4)),
  }));
}

// ─── Popular cities ───────────────────────────────────────────────────────────

const POPULAR_CITIES: HotelDestination[] = [
  { cityId: "130443", cityName: "New Delhi",   countryName: "India", countryCode: "IN" },
  { cityId: "144306", cityName: "Mumbai",      countryName: "India", countryCode: "IN" },
  { cityId: "111124", cityName: "Bengaluru",   countryName: "India", countryCode: "IN" },
  { cityId: "127343", cityName: "Chennai",     countryName: "India", countryCode: "IN" },
  { cityId: "145710", cityName: "Hyderabad",   countryName: "India", countryCode: "IN" },
  { cityId: "113128", cityName: "Kolkata",     countryName: "India", countryCode: "IN" },
  { cityId: "122175", cityName: "Jaipur",      countryName: "India", countryCode: "IN" },
  { cityId: "133133", cityName: "Pune",        countryName: "India", countryCode: "IN" },
  { cityId: "100263", cityName: "Ahmedabad",   countryName: "India", countryCode: "IN" },
  { cityId: "100589", cityName: "Agra",        countryName: "India", countryCode: "IN" },
  { cityId: "101204", cityName: "Kochi",       countryName: "India", countryCode: "IN" },
  { cityId: "145086", cityName: "Udaipur",     countryName: "India", countryCode: "IN" },
];

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ fontSize: size, color: i < n ? T.gold : T.cardBorder }}>★</span>
      ))}
    </span>
  );
}

// ─── CityInput ────────────────────────────────────────────────────────────────

function CityInput({
  label, value, onChange, onSelect,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: HotelDestination) => void;
}) {
  const [sugg, setSugg] = useState<HotelDestination[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    const q = v.trim();

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setSugg(POPULAR_CITIES.slice(0, 6));
      setOpen(true);
      setSearching(false);
      return;
    }

    // Short queries: filter popular cities locally
    if (q.length < 3) {
      const lq = q.toLowerCase();
      setSugg(POPULAR_CITIES.filter(
        (c) => c.cityName.toLowerCase().includes(lq) || c.countryName.toLowerCase().includes(lq)
      ));
      setOpen(true);
      return;
    }

    // 3+ chars: debounce and call backend /cities API
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.get(`/sbt/hotels/cities?q=${encodeURIComponent(q)}&countryCode=IN`);
        const mapped: HotelDestination[] = (Array.isArray(results) ? results : []).map((r: any) => ({
          cityId: r.CityId || r.cityId || "",
          cityName: r.CityName || r.cityName || "",
          countryName: r.CountryName || r.countryName || r.StateProvince || "India",
          countryCode: r.CountryCode || r.countryCode || "IN",
        }));
        // Merge: show API results first, then popular matches as fallback
        const lq = q.toLowerCase();
        const popularMatches = POPULAR_CITIES.filter(
          (c) => c.cityName.toLowerCase().includes(lq) && !mapped.some((m) => m.cityId === c.cityId)
        );
        setSugg([...mapped.slice(0, 10), ...popularMatches].slice(0, 12));
      } catch {
        // Fallback to popular cities on API failure
        const lq = q.toLowerCase();
        setSugg(POPULAR_CITIES.filter(
          (c) => c.cityName.toLowerCase().includes(lq) || c.countryName.toLowerCase().includes(lq)
        ));
      } finally {
        setSearching(false);
      }
      setOpen(true);
    }, 300);
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <label style={{
        fontSize: 12, fontWeight: 800, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.08em",
        display: "block", marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 12, top: "50%",
          transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none",
        }}>🏨</span>
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (!value.trim()) { setSugg(POPULAR_CITIES.slice(0, 6)); setOpen(true); }
            else setOpen(true);
          }}
          placeholder="City or destination"
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: 38, paddingRight: 12, paddingTop: 12, paddingBottom: 12,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
            fontSize: 15, fontWeight: 700, color: "#0f172a", outline: "none",
          }}
        />
        {searching && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 11, color: T.inkFaint,
          }}>...</span>
        )}
      </div>
      {open && sugg.length > 0 && (
        <div style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 6px)", left: 0,
          minWidth: 280, background: "#fff", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: `1px solid ${T.cardBorder}`, overflow: "hidden",
        }}>
          {sugg.map((d, i) => (
            <div
              key={`${d.cityId}-${i}`}
              onClick={() => { onSelect(d); onChange(`${d.cityName}, ${d.countryName}`); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FBF7F0"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{countryFlag(d.countryCode)}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0 }}>{d.cityName}</p>
                <p style={{ fontSize: 11, color: T.inkFaint, margin: 0 }}>{d.countryName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RoomsGuestsSelector ──────────────────────────────────────────────────────

function RoomsGuestsSelector({
  rooms, onChange,
}: {
  rooms: RoomConfig[];
  onChange: (r: RoomConfig[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const totalAdults   = rooms.reduce((s, r) => s + r.guests.adults, 0);
  const totalChildren = rooms.reduce((s, r) => s + r.guests.children, 0);
  const label = `${rooms.length} Room${rooms.length > 1 ? "s" : ""} · ${totalAdults} Adult${totalAdults > 1 ? "s" : ""}${totalChildren ? `, ${totalChildren} Child${totalChildren > 1 ? "ren" : ""}` : ""}`;

  function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

  function updateRoom(ri: number, field: "adults" | "children", delta: number) {
    const next = rooms.map((r, i) => {
      if (i !== ri) return r;
      return { guests: { ...r.guests, [field]: clamp(r.guests[field] + delta, field === "adults" ? 1 : 0, field === "adults" ? 4 : 3) } };
    });
    onChange(next);
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0, width: 240 }}>
      <label style={{
        fontSize: 12, fontWeight: 800, color: "#475569",
        textTransform: "uppercase", letterSpacing: "0.08em",
        display: "block", marginBottom: 6,
      }}>
        Rooms & Guests
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", padding: "12px 14px", background: "#fff",
          border: "1px solid #e2e8f0", borderRadius: 12, textAlign: "left",
          fontSize: 15, fontWeight: 700, color: "#0f172a", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span style={{ color: T.inkFaint, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 6px)", right: 0,
          width: 300, background: "#fff", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          border: `1px solid ${T.cardBorder}`, padding: 16,
        }}>
          {rooms.map((room, ri) => (
            <div key={ri} style={{
              marginBottom: ri < rooms.length - 1 ? 16 : 0,
              paddingBottom: ri < rooms.length - 1 ? 16 : 0,
              borderBottom: ri < rooms.length - 1 ? `1px solid ${T.cardBorder}` : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>Room {ri + 1}</span>
                {rooms.length > 1 && (
                  <button
                    onClick={() => onChange(rooms.filter((_, j) => j !== ri))}
                    style={{ background: "none", border: "none", color: T.rose, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {(["adults", "children"] as const).map((field) => (
                <div key={field} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: 0 }}>
                      {field === "adults" ? "Adults" : "Children"}
                    </p>
                    <p style={{ fontSize: 10, color: T.inkFaint, margin: 0 }}>
                      {field === "adults" ? "12+ yrs" : "2–12 yrs"}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => updateRoom(ri, field, -1)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        border: `1.5px solid ${T.cardBorder}`, background: "#fff",
                        fontSize: 16, cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", color: T.inkMid,
                      }}
                    >−</button>
                    <span style={{ width: 20, textAlign: "center", fontSize: 14, fontWeight: 700, color: T.ink }}>
                      {room.guests[field]}
                    </span>
                    <button
                      onClick={() => updateRoom(ri, field, +1)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        border: `1.5px solid ${T.cardBorder}`, background: "#fff",
                        fontSize: 16, cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", color: T.inkMid,
                      }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {rooms.length < 4 && (
            <button
              onClick={() => onChange([...rooms, { guests: { adults: 1, children: 0 } }])}
              style={{
                width: "100%", marginTop: 12, padding: "9px",
                background: `${T.gold}18`, border: `1.5px dashed ${T.gold}60`,
                borderRadius: 10, fontSize: 12, fontWeight: 600,
                color: T.goldDim, cursor: "pointer",
              }}
            >
              + Add Another Room
            </button>
          )}

          <button
            onClick={() => setOpen(false)}
            style={{
              width: "100%", marginTop: 8, padding: "10px",
              background: T.obsidian, border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface HotelFilterState {
  stars: number[];
  maxPrice: number;
  refundableOnly: boolean;
  amenities: string[];
}

const AMENITY_OPTIONS = ["Free WiFi", "Pool", "Spa", "Gym", "Restaurant", "Parking", "Airport Shuttle"];

function applyHotelFilters(hotels: SBTHotel[], f: HotelFilterState): SBTHotel[] {
  return hotels.filter((h) => {
    if (f.stars.length && !f.stars.includes(h.starRating)) return false;
    if (f.maxPrice && h.lowestPrice > f.maxPrice) return false;
    if (f.refundableOnly && !h.isRefundable) return false;
    if (f.amenities.length && !f.amenities.every((a) => h.amenities.includes(a))) return false;
    return true;
  });
}

function HotelFilters({
  hotels, filters, onChange,
}: {
  hotels: SBTHotel[];
  filters: HotelFilterState;
  onChange: (f: HotelFilterState) => void;
}) {
  const maxP = Math.max(...hotels.map((h) => h.lowestPrice), 0);
  const secTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: T.inkMid,
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 10, display: "block",
  };

  function toggleArr<V>(arr: V[], v: V): V[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: "pointer",
    border: `1.5px solid ${active ? T.gold : T.cardBorder}`,
    background: active ? `${T.gold}18` : "#fff",
    color: active ? T.goldDim : T.inkMid,
  });

  return (
    <div style={{
      width: 200, flexShrink: 0, background: "#fff",
      borderRadius: 16, border: `1.5px solid ${T.cardBorder}`,
      padding: "16px 14px", alignSelf: "flex-start",
      position: "sticky", top: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Filters</span>
        <button
          onClick={() => onChange({ stars: [], maxPrice: 0, refundableOnly: false, amenities: [] })}
          style={{ background: "none", border: "none", fontSize: 11, color: T.gold, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          Clear all
        </button>
      </div>

      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${T.cardBorder}` }}>
        <span style={secTitle}>Star Rating</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[5, 4, 3].map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, stars: toggleArr(filters.stars, s) })}
              style={chipStyle(filters.stars.includes(s))}
            >
              {s}★
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${T.cardBorder}` }}>
        <span style={secTitle}>Max Price / Night</span>
        <input
          type="range" min={0} max={maxP || 20000} step={500}
          value={filters.maxPrice || maxP || 20000}
          onChange={(e) => onChange({ ...filters, maxPrice: +e.target.value })}
          style={{ width: "100%", accentColor: T.gold }}
        />
        <p style={{ fontSize: 12, fontWeight: 600, color: T.gold, margin: "4px 0 0" }}>
          Up to ₹{(filters.maxPrice || maxP || 20000).toLocaleString("en-IN")}
        </p>
      </div>

      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${T.cardBorder}` }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={filters.refundableOnly}
            onChange={(e) => onChange({ ...filters, refundableOnly: e.target.checked })}
            style={{ accentColor: T.gold }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Free Cancellation</span>
        </label>
      </div>

      <div>
        <span style={secTitle}>Amenities</span>
        {AMENITY_OPTIONS.map((a) => (
          <label key={a} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0" }}>
            <input
              type="checkbox"
              checked={filters.amenities.includes(a)}
              onChange={() => onChange({ ...filters, amenities: toggleArr(filters.amenities, a) })}
              style={{ accentColor: T.gold }}
            />
            <span style={{ fontSize: 12, color: T.inkMid }}>{a}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── HotelCard ────────────────────────────────────────────────────────────────

function HotelCard({
  hotel, nights, selected, onSelect,
}: {
  hotel: SBTHotel;
  nights: number;
  selected: boolean;
  onSelect: (h: SBTHotel) => void;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      onClick={() => onSelect(hotel)}
      style={{
        background: "#fff",
        border: `2px solid ${selected ? T.gold : T.cardBorder}`,
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        display: "flex", marginBottom: 12,
        boxShadow: selected ? `0 0 0 3px ${T.gold}30` : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = `${T.gold}60`; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = T.cardBorder; }}
    >
      {/* Image */}
      <div style={{
        width: 180, flexShrink: 0, position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`,
      }}>
        {!imgErr && hotel.imageUrl ? (
          <img
            src={hotel.imageUrl}
            alt={hotel.hotelName}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.3,
          }}>🏨</div>
        )}
        {hotel.isRefundable && (
          <div style={{
            position: "absolute", top: 8, left: 8, background: T.emerald,
            color: "#fff", fontSize: 9, fontWeight: 700,
            padding: "3px 7px", borderRadius: 20, letterSpacing: "0.04em",
          }}>
            Free Cancel
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: "0 0 4px" }}>{hotel.hotelName}</p>
              <Stars n={hotel.starRating} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: T.gold, margin: 0 }}>
                ₹{hotel.lowestPrice.toLocaleString("en-IN")}
              </p>
              <p style={{ fontSize: 10, color: T.inkFaint, margin: 0 }}>per night</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: T.inkMid, margin: "2px 0 0" }}>
                ₹{(hotel.lowestPrice * nights).toLocaleString("en-IN")} total
              </p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: T.inkMid, margin: "8px 0 0" }}>📍 {hotel.address}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
          {hotel.amenities.slice(0, 5).map((a) => (
            <span key={a} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px",
              background: T.surface, color: T.inkMid,
              border: `1px solid ${T.cardBorder}`, borderRadius: 20,
            }}>{a}</span>
          ))}
          {hotel.amenities.length > 5 && (
            <span style={{
              fontSize: 10, padding: "3px 8px",
              background: T.surface, color: T.inkFaint,
              border: `1px solid ${T.cardBorder}`, borderRadius: 20,
            }}>+{hotel.amenities.length - 5} more</span>
          )}
        </div>
      </div>

      {/* Select column */}
      <div style={{
        width: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: selected ? `${T.gold}12` : "transparent",
        borderLeft: `1px solid ${selected ? T.gold : T.cardBorder}`,
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          border: `2px solid ${selected ? T.gold : T.cardBorder}`,
          background: selected ? T.gold : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SBTHotelSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const sbtRole = (user as any)?.sbtRole as string | null;
  const today = new Date().toISOString().split("T")[0];

  // L2 booking-on-behalf flow: detect requestId from URL
  const requestId = searchParams.get("requestId");
  const [sbtRequest, setSbtRequest] = useState<any>(null);
  const [sbtRequestLoading, setSbtRequestLoading] = useState(!!requestId);
  const sbtRequestFetched = useRef(false);

  const [destQ, setDestQ]     = useState("");
  const [dest, setDest]       = useState<HotelDestination | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [rooms, setRooms]     = useState<RoomConfig[]>([{ guests: { adults: 1, children: 0 } }]);
  const [sortBy, setSortBy]   = useState<"price" | "stars" | "name">("price");

  const [results, setResults]   = useState<SBTHotel[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SBTHotel | null>(null);
  const [filters, setFilters]   = useState<HotelFilterState>({
    stars: [], maxPrice: 0, refundableOnly: false, amenities: [],
  });

  const nights = nightsBetween(checkIn, checkOut);

  // Fetch SBT request details when requestId is present (L2 booking-on-behalf)
  useEffect(() => {
    if (!requestId || sbtRequestFetched.current) return;
    sbtRequestFetched.current = true;
    (async () => {
      try {
        const res = await api.get(`/sbt/requests/${requestId}`);
        const req = res?.data ?? res;
        setSbtRequest(req);
        const sp = req.searchParams || {};
        if (sp.CityCode || sp.cityId) {
          setDest({
            cityId: sp.CityCode || sp.cityId || "",
            cityName: sp.CityName || sp.cityName || sp.destination || "",
            countryName: sp.CountryName || sp.countryName || "",
            countryCode: sp.CountryCode || sp.countryCode || "IN",
          });
          setDestQ(sp.CityName || sp.cityName || sp.destination || "");
        }
        if (sp.CheckIn || sp.checkIn) setCheckIn(sp.CheckIn || sp.checkIn);
        if (sp.CheckOut || sp.checkOut) setCheckOut(sp.CheckOut || sp.checkOut);
      } catch (e: any) {
        console.error("Failed to fetch SBT request:", e);
      } finally {
        setSbtRequestLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (results.length) setFilters({ stars: [], maxPrice: 0, refundableOnly: false, amenities: [] });
  }, [results]);

  const filtered = applyHotelFilters(results, filters).sort((a, b) => {
    if (sortBy === "price") return a.lowestPrice - b.lowestPrice;
    if (sortBy === "stars") return b.starRating - a.starRating;
    return a.hotelName.localeCompare(b.hotelName);
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!dest)  { setError("Please select a destination city."); return; }
    if (!checkIn || !checkOut) { setError("Please select check-in and check-out dates."); return; }
    if (new Date(checkOut) <= new Date(checkIn)) { setError("Check-out must be after check-in."); return; }

    setLoading(true); setError(""); setResults([]); setSelected(null); setSearched(true);
    try {
      const data = await api.post("/sbt/hotels/search", {
        CityCode: dest.cityId, CityName: dest.cityName, CheckIn: checkIn, CheckOut: checkOut,
        CountryCode: dest.countryCode,
        GuestNationality: "IN",
        Rooms: rooms.map((r) => ({ Adults: r.guests.adults, Children: r.guests.children, ChildrenAges: null })),
      });
      const raw: any[] = data?.Hotels || data?.hotels || data?.Results || [];
      const mapped: SBTHotel[] = raw.map((h: any) => mapTBOHotel(h, checkIn, checkOut));
      setResults(mapped);
      if (!mapped.length) setError("No hotels found. Try different dates or destination.");
    } catch (err: any) {
      const code = err?.code;
      const friendlyMessages: Record<string, string> = {
        HOTEL_ACCESS_DENIED: "Hotel booking is not enabled for your account. Contact your admin.",
        COMPANY_HOTEL_ACCESS_DENIED: "Your company has not enabled hotel bookings. Contact your admin.",
        APPROVAL_FLOW_REQUIRED: "Direct booking is not available. Please raise a travel request through the approval flow.",
      };
      if (friendlyMessages[code]) {
        setError(friendlyMessages[code]);
      } else {
        // Backend not live yet — show mock data
        setResults(buildMockHotels(dest.cityName, checkIn, nights));
      }
    } finally {
      setLoading(false);
    }
  }

  const totalGuests = rooms.reduce((s, r) => s + r.guests.adults + r.guests.children, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "inherit" }}>

      {/* ── Booking-on-behalf banner ──────────────────────────────────── */}
      {sbtRequest && (
        <div className="mx-4 md:mx-auto max-w-6xl mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-600 text-lg">&#128100;</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Booking on behalf of {sbtRequest.requesterId?.name || sbtRequest.requesterId?.email || "team member"}
              </p>
              <p className="text-xs text-amber-600">
                Search results pre-filled from request. Select a hotel and proceed to book.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search Panel ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mx-4 md:mx-auto max-w-6xl mt-6">
        <div style={{ padding: "20px 24px 0" }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8,
              background: "#f1f5f9", borderRadius: 8, padding: "4px 12px" }}>
              <span style={{ fontSize: 16 }}>🏨</span>
              <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>Hotel Search</span>
              <span style={{ color: "#64748b", fontSize: 11, fontWeight: 500 }}>· Self Booking Tool</span>
            </div>

            {/* Flights / Hotels tab switcher */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 12, padding: 4, gap: 4 }}>
              {[
                { label: "✈ Flights", path: "/sbt/flights" },
                { label: "🏨 Hotels", path: "/sbt/hotels" },
              ].map((tab) => {
                const active = tab.path === "/sbt/hotels";
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    style={{
                      padding: "7px 16px", borderRadius: 9, border: "none",
                      fontSize: 14, cursor: "pointer",
                      background: active ? "#fff" : "transparent",
                      color: active ? "#0f172a" : "#475569",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <CityInput label="Destination" value={destQ} onChange={setDestQ} onSelect={setDest} />

              {/* Check-in */}
              <div style={{ flexShrink: 0, width: 160 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569",
                  textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  Check-in
                </label>
                <input
                  type="date" value={checkIn} min={today}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    if (checkOut && e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
                  }}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "12px",
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                    fontSize: 15, fontWeight: 700, color: "#0f172a", outline: "none",
                  }}
                />
              </div>

              {/* Check-out */}
              <div style={{ flexShrink: 0, width: 160 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569",
                  textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  Check-out{checkIn && checkOut ? (
                    <span style={{ color: '#00477f', fontWeight: 800 }}> · {nights} night{nights > 1 ? "s" : ""}</span>
                  ) : null}
                </label>
                <input
                  type="date" value={checkOut} min={checkIn ? addDays(checkIn, 1) : today}
                  onChange={(e) => setCheckOut(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "12px",
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                    fontSize: 15, fontWeight: 700, color: "#0f172a", outline: "none",
                  }}
                />
              </div>

              <RoomsGuestsSelector rooms={rooms} onChange={setRooms} />

            </div>

            {error && !results.length && (
              <p style={{ color: "#ef4444", fontSize: 12, marginTop: 10 }}>{error}</p>
            )}
          </form>
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          style={{
            width: "100%", padding: "16px",
            background: loading ? "rgba(0,71,127,0.5)" : "#00477f",
            color: "#fff", border: "none", borderRadius: "0 0 16px 16px",
            fontWeight: 800, fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}
        >
          {loading ? "Searching…" : "SEARCH"}
        </button>
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {searched && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 100px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: `3px solid rgba(201,169,110,0.2)`, borderTopColor: T.gold,
                  animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
                }} />
                <p style={{ color: T.inkMid, fontSize: 14 }}>Finding best hotel rates…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div style={{ display: "flex", gap: 20 }}>
              <HotelFilters hotels={results} filters={filters} onChange={setFilters} />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Sort bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: T.inkMid, margin: 0 }}>
                    <span style={{ fontWeight: 700, color: T.ink }}>{filtered.length}</span> of {results.length} hotels
                    {dest && <span style={{ color: T.inkFaint }}> in {dest.cityName}</span>}
                    {checkIn && checkOut && (
                      <span style={{ color: T.inkFaint }}>
                        {" · "}{fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "#fff", borderRadius: 12,
                    border: `1.5px solid ${T.cardBorder}`, padding: 4,
                  }}>
                    <span style={{ fontSize: 11, color: T.inkFaint, padding: "0 6px" }}>Sort:</span>
                    {([
                      { v: "price", l: "Cheapest" },
                      { v: "stars", l: "Top Rated" },
                      { v: "name",  l: "Name" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => setSortBy(opt.v)}
                        style={{
                          padding: "6px 12px", borderRadius: 9, border: "none",
                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: sortBy === opt.v ? T.obsidian : "transparent",
                          color: sortBy === opt.v ? "#fff" : T.inkMid,
                        }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div style={{
                    background: "#fff", borderRadius: 16,
                    border: `1.5px solid ${T.cardBorder}`, padding: "40px 24px", textAlign: "center",
                  }}>
                    <p style={{ color: T.inkMid, fontSize: 14 }}>No hotels match your filters.</p>
                  </div>
                ) : (
                  filtered.map((h) => (
                    <HotelCard
                      key={h.resultIndex}
                      hotel={h}
                      nights={nights}
                      selected={selected?.resultIndex === h.resultIndex}
                      onSelect={(htl) => setSelected(selected?.resultIndex === htl.resultIndex ? null : htl)}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            !loading && (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <p style={{ color: T.inkMid, fontSize: 14 }}>{error || "No hotels found."}</p>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!searched && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.15 }}>🏨</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: T.inkMid, margin: "0 0 8px" }}>Find the perfect stay</p>
          <p style={{ fontSize: 13, color: T.inkFaint, margin: 0 }}>
            Search from thousands of hotels. Select destination, dates, and guests to get started.
          </p>
        </div>
      )}

      {/* ── Sticky booking bar ────────────────────────────────────────── */}
      {selected && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderTop: `1.5px solid ${T.cardBorder}`,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)", zIndex: 40,
        }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto", padding: "12px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>🏨</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: "0 0 2px" }}>{selected.hotelName}</p>
                <p style={{ fontSize: 11, color: T.inkMid, margin: 0 }}>
                  <Stars n={selected.starRating} size={10} />
                  <span style={{ marginLeft: 6 }}>
                    {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
                    · {rooms.length} room{rooms.length > 1 ? "s" : ""} · {totalGuests} guest{totalGuests > 1 ? "s" : ""}
                  </span>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: T.gold, margin: 0 }}>
                  ₹{(selected.lowestPrice * nights * rooms.length).toLocaleString("en-IN")}
                </p>
                <p style={{ fontSize: 10, color: T.inkFaint, margin: 0 }}>
                  ₹{selected.lowestPrice.toLocaleString("en-IN")}/night · {nights} night{nights > 1 ? "s" : ""} · {rooms.length} room{rooms.length > 1 ? "s" : ""}
                </p>
              </div>
              {sbtRequest ? (
                /* L2 booking on behalf of L1 */
                <button
                  onClick={() => navigate("/sbt/hotels/detail", {
                    state: {
                      hotel: selected,
                      searchParams: {
                        CityCode: dest?.cityId, CityName: dest?.cityName, CheckIn: checkIn, CheckOut: checkOut,
                        CountryCode: dest?.countryCode, GuestNationality: "IN",
                        Rooms: rooms.map((r) => ({ Adults: r.guests.adults, Children: r.guests.children })),
                      },
                      sbtRequest,
                    },
                  })}
                  style={{
                    background: "#00477f", color: "#fff", border: "none",
                    borderRadius: 12, padding: "12px 28px", fontWeight: 800,
                    fontSize: 13, cursor: "pointer", letterSpacing: "0.05em",
                    textTransform: "uppercase", boxShadow: "0 4px 16px rgba(0,71,127,0.25)",
                  }}
                >
                  Proceed to Book →
                </button>
              ) : sbtRole === "L1" ? (
                <button
                  onClick={() => navigate("/sbt/request", {
                    state: {
                      preSelected: selected,
                      type: "hotel",
                      searchParams: {
                        CityCode: dest?.cityId, CityName: dest?.cityName, CheckIn: checkIn, CheckOut: checkOut,
                        hotelName: selected?.hotelName || (selected as any)?.HotelName || "",
                      },
                    },
                  })}
                  style={{
                    background: "#00477f", color: "#fff", border: "none",
                    borderRadius: 12, padding: "12px 28px", fontWeight: 800,
                    fontSize: 13, cursor: "pointer", letterSpacing: "0.05em",
                    textTransform: "uppercase", boxShadow: "0 4px 16px rgba(0,71,127,0.25)",
                  }}
                >
                  Raise Request →
                </button>
              ) : sbtRole === "BOTH" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => navigate("/sbt/hotels/detail", {
                      state: {
                        hotel: selected,
                        searchParams: {
                          CityCode: dest?.cityId, CityName: dest?.cityName, CheckIn: checkIn, CheckOut: checkOut,
                          CountryCode: dest?.countryCode, GuestNationality: "IN",
                          Rooms: rooms.map((r) => ({ Adults: r.guests.adults, Children: r.guests.children })),
                        },
                      },
                    })}
                    style={{
                      background: T.gold, color: T.obsidian, border: "none",
                      borderRadius: 12, padding: "12px 20px", fontWeight: 800,
                      fontSize: 13, cursor: "pointer", letterSpacing: "0.05em",
                      textTransform: "uppercase", boxShadow: `0 4px 16px ${T.gold}40`,
                    }}
                  >
                    Book for Myself →
                  </button>
                  <button
                    onClick={() => navigate("/sbt/request", {
                      state: {
                        preSelected: selected,
                        type: "hotel",
                        searchParams: {
                          CityCode: dest?.cityId, CityName: dest?.cityName, CheckIn: checkIn, CheckOut: checkOut,
                          hotelName: selected?.hotelName || (selected as any)?.HotelName || "",
                        },
                      },
                    })}
                    style={{
                      background: "#00477f", color: "#fff", border: "none",
                      borderRadius: 12, padding: "12px 20px", fontWeight: 800,
                      fontSize: 13, cursor: "pointer", letterSpacing: "0.05em",
                      textTransform: "uppercase", boxShadow: "0 4px 16px rgba(0,71,127,0.25)",
                    }}
                  >
                    Raise Request →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => navigate("/sbt/hotels/detail", {
                    state: {
                      hotel: selected,
                      searchParams: {
                        CityCode: dest?.cityId, CityName: dest?.cityName, CheckIn: checkIn, CheckOut: checkOut,
                        CountryCode: dest?.countryCode, GuestNationality: "IN",
                        Rooms: rooms.map((r) => ({ Adults: r.guests.adults, Children: r.guests.children })),
                      },
                    },
                  })}
                  style={{
                    background: T.gold, color: T.obsidian, border: "none",
                    borderRadius: 12, padding: "12px 28px", fontWeight: 800,
                    fontSize: 13, cursor: "pointer", letterSpacing: "0.05em",
                    textTransform: "uppercase", boxShadow: `0 4px 16px ${T.gold}40`,
                  }}
                >
                  View Rooms →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
