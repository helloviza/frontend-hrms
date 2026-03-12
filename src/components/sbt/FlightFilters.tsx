import { T, SBTFlight } from "./FlightResultCard";

export interface FilterState {
  stops: number[];
  airlines: string[];
  refundable: boolean;
  maxPrice: number;
  depSlots: string[];
  maxDuration: number;
}

interface Props {
  flights: SBTFlight[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  dark?: boolean; // true for concierge dark mode
}

export const DEP_SLOTS = ["Before 6 AM", "6 AM - 12 PM", "12 PM - 6 PM", "After 6 PM"];

export function getDepSlot(dt: string): string {
  const h = new Date(dt).getHours();
  if (h < 6) return "Before 6 AM";
  if (h < 12) return "6 AM - 12 PM";
  if (h < 18) return "12 PM - 6 PM";
  return "After 6 PM";
}

export function applyFilters(flights: SBTFlight[], f: FilterState): SBTFlight[] {
  return flights.filter(r => {
    const seg = r.Segments[0][0];
    const price = r.Fare.PublishedFare || r.Fare.TotalFare;
    const stops = r.Segments[0].length - 1;
    if (f.stops.length && !f.stops.includes(stops)) return false;
    if (f.airlines.length && !f.airlines.includes(seg.Airline.AirlineCode)) return false;
    if (f.refundable && r.NonRefundable) return false;
    if (f.maxPrice && price > f.maxPrice) return false;
    if (f.maxDuration && (seg.Duration ?? 0) > f.maxDuration) return false;
    if (f.depSlots.length && !f.depSlots.includes(getDepSlot(seg.Origin.DepTime))) return false;
    return true;
  });
}

export default function FlightFilters({ flights, filters, onChange, dark = false }: Props) {
  const bg = dark ? "#16213E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.08)" : T.cardBorder;
  const text = dark ? "rgba(255,255,255,0.85)" : T.ink;
  const textFaint = dark ? "rgba(255,255,255,0.35)" : T.inkFaint;
  const accent = T.gold;
  const sectionTitle = { fontSize:10, fontWeight:700, color: dark ? T.gold : T.inkMid,
    letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:8, display:"block" };
  const checkLabel = { display:"flex", alignItems:"center", gap:8, fontSize:12,
    color:text, cursor:"pointer", padding:"4px 0" };

  const allAirlines = [...new Set(flights.map(r => r.Segments[0][0].Airline.AirlineCode))];
  const prices = flights.map(r => r.Fare.PublishedFare || r.Fare.TotalFare);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const maxDur = flights.length ? Math.max(...flights.map(r => r.Segments[0][0].Duration || 0)) : 0;

  function toggle<V>(arr: V[], val: V): V[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function reset() {
    onChange({ stops:[], airlines:[], refundable:false, maxPrice, depSlots:[], maxDuration:maxDur });
  }

  const section: React.CSSProperties = { borderBottom:`1px solid ${border}`, paddingBottom:12, marginBottom:12 };

  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:16,
      padding:16, fontSize:13, position:"sticky", top:80 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:700, color:text }}>Filters</span>
        <button onClick={reset}
          style={{ fontSize:11, color:accent, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
          Reset all
        </button>
      </div>

      {/* Stops */}
      <div style={section}>
        <span style={sectionTitle}>Stops</span>
        {[{v:0,l:"Non-stop"},{v:1,l:"1 Stop"},{v:2,l:"2+ Stops"}].map(s => (
          <label key={s.v} style={checkLabel}>
            <input type="checkbox" checked={filters.stops.includes(s.v)}
              onChange={() => onChange({...filters, stops:toggle(filters.stops, s.v)})}
              style={{ accentColor:accent }} />
            {s.l}
          </label>
        ))}
      </div>

      {/* Refundable */}
      <div style={section}>
        <label style={checkLabel}>
          <input type="checkbox" checked={filters.refundable}
            onChange={e => onChange({...filters, refundable:e.target.checked})}
            style={{ accentColor:accent }} />
          Refundable only
        </label>
      </div>

      {/* Departure slots */}
      <div style={section}>
        <span style={sectionTitle}>Departure Time</span>
        {DEP_SLOTS.map(s => (
          <label key={s} style={checkLabel}>
            <input type="checkbox" checked={filters.depSlots.includes(s)}
              onChange={() => onChange({...filters, depSlots:toggle(filters.depSlots, s)})}
              style={{ accentColor:accent }} />
            <span style={{ fontSize:11 }}>{s}</span>
          </label>
        ))}
      </div>

      {/* Airlines */}
      <div style={section}>
        <span style={sectionTitle}>Airlines</span>
        {allAirlines.map(code => {
          const name = flights.find(r=>r.Segments[0][0].Airline.AirlineCode===code)?.Segments[0][0].Airline.AirlineName || code;
          const minFare = Math.min(...flights.filter(r=>r.Segments[0][0].Airline.AirlineCode===code).map(r=>r.Fare.PublishedFare||r.Fare.TotalFare));
          return (
            <label key={code} style={{...checkLabel, alignItems:"center", gap:8, marginBottom:6}}>
              <input type="checkbox" checked={filters.airlines.includes(code)}
                onChange={() => onChange({...filters, airlines:toggle(filters.airlines, code)})}
                style={{ accentColor:accent }} />
              <img
                src={`https://pics.avs.io/48/48/${code}.png`}
                alt={code}
                style={{ width:24, height:24, objectFit:"contain" }}
                onError={e => { e.currentTarget.style.display="none"; }}
              />
              <div>
                <p style={{ fontSize:11, fontWeight:600, color:text, margin:0 }}>{name}</p>
                <p style={{ fontSize:10, color:textFaint, margin:0 }}>from ₹{minFare.toLocaleString("en-IN")}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Price slider */}
      <div style={section}>
        <span style={sectionTitle}>Price per person</span>
        <input type="range" min={minPrice} max={maxPrice}
          value={filters.maxPrice || maxPrice}
          onChange={e => onChange({...filters, maxPrice:+e.target.value})}
          style={{ width:"100%", accentColor:accent }} />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:10, color:textFaint }}>₹{minPrice.toLocaleString("en-IN")}</span>
          <span style={{ fontSize:10, color:accent, fontWeight:600 }}>
            ≤ ₹{(filters.maxPrice||maxPrice).toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Duration slider */}
      <div>
        <span style={sectionTitle}>Max Duration</span>
        <input type="range" min={60} max={maxDur || 60}
          value={filters.maxDuration || maxDur}
          onChange={e => onChange({...filters, maxDuration:+e.target.value})}
          style={{ width:"100%", accentColor:accent }} />
        <p style={{ fontSize:10, color:accent, fontWeight:600, margin:"4px 0 0" }}>
          ≤ {Math.floor((filters.maxDuration||maxDur)/60)}h {(filters.maxDuration||maxDur)%60}m
        </p>
      </div>
    </div>
  );
}
