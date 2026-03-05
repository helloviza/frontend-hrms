import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import FlightResultCard, { AirlineLogo, SBTFlight, T, formatTime, formatDur, formatDateShort } from "../../components/sbt/FlightResultCard";
import FlightFilters, { applyFilters, FilterState } from "../../components/sbt/FlightFilters";

interface Airport {
  code: string; city: string; name: string; country: string; countryCode: string; label: string;
}

function countryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "✈️";
  const code = countryCode.toUpperCase();
  return String.fromCodePoint(
    ...code.split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

interface PaxCount { adults: number; children: number; infants: number; }

// ── Airport Autocomplete ──────────────────────────────────────────────
function AirportInput({ label, placeholder, value, onChange, onSelect, icon }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; onSelect: (a: Airport) => void;
  icon?: React.ReactNode;
}) {
  const [sugg, setSugg] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    clearTimeout(timer.current);
    if (v.length < 2) { setSugg([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const data = await api.get(`/sbt/flights/airports?q=${encodeURIComponent(v)}`);
        setSugg(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setSugg([]); }
      finally { setLoading(false); }
    }, 200);
  }

  function highlight(text: string, q: string) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return <span>{text}</span>;
    return <span>{text.slice(0,i)}<strong className="text-slate-900">{text.slice(i,i+q.length)}</strong>{text.slice(i+q.length)}</span>;
  }

  return (
    <div ref={ref} className="relative flex-1">
      <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input value={value} onChange={e => handleChange(e.target.value)}
          onFocus={() => sugg.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`w-full ${icon ? "pl-9" : "pl-3"} pr-3 py-3 text-slate-900 text-sm font-medium
            bg-white border border-transparent rounded-xl focus:outline-none focus:ring-2
            focus:ring-white/20 transition-all placeholder:font-normal placeholder:text-slate-400`} />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-slate-300 border-t-amber-400 rounded-full animate-spin"></div>}
      </div>
      {open && sugg.length > 0 && (
        <div className="absolute z-50 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="py-1">
            {sugg.map((a, i) => (
              <div key={a.code + i}
                onClick={() => { onSelect(a); onChange(`${a.city} (${a.code})`); setSugg([]); setOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 cursor-pointer group transition-colors">
                <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-600 font-medium truncate">
                    {highlight(a.city, value)} <span className="text-amber-600 font-bold">({a.code})</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <span>{countryFlag(a.countryCode)}</span>
                    <span>{a.name} · {a.country}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Passenger Selector ────────────────────────────────────────────────
function PaxSelector({ value, onChange }: { value: PaxCount; onChange: (p: PaxCount) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const total = value.adults + value.children + value.infants;
  const label = `${value.adults} Adult${value.adults > 1 ? "s" : ""}${value.children ? `, ${value.children} Child${value.children > 1 ? "ren" : ""}` : ""}${value.infants ? `, ${value.infants} Infant${value.infants > 1 ? "s" : ""}` : ""}`;

  function Counter({ label, sublabel, val, min, max, onUp, onDown }: any) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
        <div>
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-400">{sublabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onDown} disabled={val <= min}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-amber-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-medium">−</button>
          <span className="w-4 text-center font-semibold text-slate-900">{val}</span>
          <button onClick={onUp} disabled={val >= max || total >= 9}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-amber-400 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-medium">+</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">Passengers</label>
      <button onClick={() => setOpen(!open)} type="button"
        className="w-full px-3 py-3 text-left text-sm font-medium text-slate-900 bg-white border border-transparent rounded-xl
          focus:outline-none focus:ring-2 focus:ring-white/20 transition-all flex items-center justify-between">
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4">
          <Counter label="Adults" sublabel="12+ years" val={value.adults} min={1} max={9}
            onUp={() => onChange({...value, adults: value.adults+1})}
            onDown={() => onChange({...value, adults: value.adults-1})} />
          <Counter label="Children" sublabel="2-12 years" val={value.children} min={0} max={8}
            onUp={() => onChange({...value, children: value.children+1})}
            onDown={() => onChange({...value, children: value.children-1})} />
          <Counter label="Infants" sublabel="Under 2 years" val={value.infants} min={0} max={value.adults}
            onUp={() => onChange({...value, infants: value.infants+1})}
            onDown={() => onChange({...value, infants: value.infants-1})} />
          <p className="text-[10px] text-slate-400 mt-3 text-center">Maximum 9 passengers per booking</p>
          <button onClick={() => setOpen(false)}
            className="w-full mt-2 bg-amber-400 text-slate-900 py-2 rounded-xl text-sm font-medium hover:bg-amber-300 transition-colors">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ── Cabin Class Selector ──────────────────────────────────────────────
const CABIN_CLASSES = [
  { v: 1, l: "All Classes" }, { v: 2, l: "Economy" },
  { v: 3, l: "Premium Economy" }, { v: 4, l: "Business" }, { v: 6, l: "First Class" }
];

// ── Multi-city Segment ────────────────────────────────────────────────
interface Segment { originQ: string; destQ: string; origin: Airport|null; dest: Airport|null; date: string; }

// ── Main Component ────────────────────────────────────────────────────
export default function SBTFlightSearch() {
  const [journeyType, setJourneyType] = useState<1|2|3>(1);
  const [originQ, setOriginQ] = useState("");
  const [destQ, setDestQ] = useState("");
  const [origin, setOrigin] = useState<Airport|null>(null);
  const [dest, setDest] = useState<Airport|null>(null);
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [pax, setPax] = useState<PaxCount>({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState(2);
  const [segments, setSegments] = useState<Segment[]>([
    { originQ:"", destQ:"", origin:null, dest:null, date:"" },
    { originQ:"", destQ:"", origin:null, dest:null, date:"" },
  ]);

  const [results, setResults] = useState<SBTFlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SBTFlight|null>(null);
  const [searched, setSearched] = useState(false);
  const [sortBy, setSortBy] = useState<"price"|"duration"|"departure">("price");

  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    airlines: [],
    refundable: false,
    maxPrice: 0,
    depSlots: [],
    maxDuration: 0,
  });

  // Reset filters when new results load
  useEffect(() => {
    if (results.length) {
      setFilters({ stops:[], airlines:[], refundable:false, maxPrice:0, depSlots:[], maxDuration:0 });
    }
  }, [results]);

  const filtered = applyFilters(results, filters)
    .sort((a, b) => {
      if (sortBy === "price") return (a.Fare.PublishedFare||a.Fare.TotalFare) - (b.Fare.PublishedFare||b.Fare.TotalFare);
      if (sortBy === "duration") return (a.Segments[0][0].Duration||0) - (b.Segments[0][0].Duration||0);
      return new Date(a.Segments[0][0].Origin.DepTime).getTime() - new Date(b.Segments[0][0].Origin.DepTime).getTime();
    });

  function swapRoutes() {
    const [o, d, oQ, dQ] = [origin, dest, originQ, destQ];
    setOrigin(d); setOriginQ(dQ);
    setDest(o); setDestQ(oQ);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (journeyType !== 3 && (!origin || !dest || !date)) { setError("Please fill all required fields."); return; }
    setLoading(true); setError(""); setResults([]); setSelected(null); setSearched(true);
    try {
      const payload: any = {
        origin: origin?.code,
        destination: dest?.code,
        departDate: date,
        adults: pax.adults,
        children: pax.children,
        infants: pax.infants,
        cabinClass: cabin,
        JourneyType: journeyType,
      };
      if (journeyType === 2) payload.returnDate = returnDate;
      const data = await api.post("/sbt/flights/search", payload);
      const res = data?.Response || data;
      const r = res?.Results || data?.Results || [];
      setResults(r);
      if (!r.length) setError("No flights found. Try different dates or routes.");
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Search Panel ─────────────────────────────────────── */}
      <div style={{ background: T.obsidian }} className="shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5">
                  <img src="/assets/plutologo.png" alt="Pluto.ai" className="h-4" onError={e => e.currentTarget.style.display="none"} />
                </div>
                <span className="text-white/90 text-sm font-medium">Self Booking Tool</span>
                <span className="text-white/40 text-xs">·</span>
                <span className="text-white/50 text-xs">Powered by Pluto.ai</span>
              </div>
            </div>
            {/* Journey type tabs */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {[{v:1,l:"One Way"},{v:2,l:"Return"},{v:3,l:"Multi-City"}].map(j => (
                <button key={j.v} type="button" onClick={() => setJourneyType(j.v as 1|2|3)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${journeyType === j.v ? "bg-white text-slate-900 shadow-sm" : "text-white/70 hover:text-white"}`}>
                  {j.l}
                </button>
              ))}
            </div>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch}>
            {journeyType !== 3 ? (
              <div className="flex items-end gap-2">
                <AirportInput label="From" placeholder="City or airport" value={originQ}
                  onChange={setOriginQ} onSelect={setOrigin}
                  icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>} />

                {/* Swap */}
                <button type="button" onClick={swapRoutes}
                  className="flex-shrink-0 mb-0.5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                </button>

                <AirportInput label="To" placeholder="City or airport" value={destQ}
                  onChange={setDestQ} onSelect={setDest}
                  icon={<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>} />

                <div className="flex-shrink-0 w-40">
                  <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">Departure</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-3 text-sm text-slate-900 bg-white border border-transparent rounded-xl
                      focus:outline-none focus:ring-2 focus:ring-white/30 transition-all" />
                </div>

                {journeyType === 2 && (
                  <div className="flex-shrink-0 w-40">
                    <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">Return</label>
                    <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                      min={date || new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-3 text-sm text-slate-900 bg-white border border-transparent rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-white/30 transition-all" />
                  </div>
                )}

                <div className="flex-shrink-0 w-52">
                  <PaxSelector value={pax} onChange={setPax} />
                </div>

                <div className="flex-shrink-0 w-40">
                  <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">Cabin</label>
                  <select value={cabin} onChange={e => setCabin(+e.target.value)}
                    className="w-full px-3 py-3 text-sm text-slate-900 bg-white border border-transparent rounded-xl
                      focus:outline-none bg-white transition-all">
                    {CABIN_CLASSES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>

                <button type="submit" disabled={loading}
                  className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-slate-900
                    px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-yellow-400/30 uppercase tracking-wide">
                  {loading ? "..." : "Search"}
                </button>
              </div>
            ) : (
              /* Multi-city */
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <span className="text-white/40 text-xs w-16 pb-3 flex-shrink-0">Flight {i+1}</span>
                    <AirportInput label="From" placeholder="City" value={seg.originQ}
                      onChange={v => { const s=[...segments]; s[i]={...s[i],originQ:v,origin:null}; setSegments(s); }}
                      onSelect={a => { const s=[...segments]; s[i]={...s[i],origin:a,originQ:`${a.city} (${a.code})`}; setSegments(s); }} />
                    <AirportInput label="To" placeholder="City" value={seg.destQ}
                      onChange={v => { const s=[...segments]; s[i]={...s[i],destQ:v,dest:null}; setSegments(s); }}
                      onSelect={a => { const s=[...segments]; s[i]={...s[i],dest:a,destQ:`${a.city} (${a.code})`}; setSegments(s); }} />
                    <div className="flex-shrink-0 w-36">
                      <label className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1 block">Date</label>
                      <input type="date" value={seg.date}
                        onChange={e => { const s=[...segments]; s[i]={...s[i],date:e.target.value}; setSegments(s); }}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-3 text-sm text-slate-900 bg-white rounded-xl focus:outline-none transition-all" />
                    </div>
                    {i >= 2 && (
                      <button type="button" onClick={() => setSegments(segments.filter((_,j)=>j!==i))}
                        className="flex-shrink-0 mb-0.5 w-9 h-9 rounded-full bg-red-400/20 hover:bg-red-400/40 text-white flex items-center justify-center transition-all">✕</button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  {segments.length < 5 && (
                    <button type="button" onClick={() => setSegments([...segments, {originQ:"",destQ:"",origin:null,dest:null,date:""}])}
                      className="text-white/70 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-lg transition-all">
                      + Add City
                    </button>
                  )}
                  <div className="flex-shrink-0 w-48"><PaxSelector value={pax} onChange={setPax} /></div>
                  <button type="submit" disabled={loading}
                    className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all">
                    {loading ? "Searching..." : "Search Flights"}
                  </button>
                </div>
              </div>
            )}
            {error && !results.length && <p className="text-yellow-200 text-xs mt-2">{error}</p>}
          </form>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────── */}
      {searched && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-500 text-sm">Searching best fares...</p>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="flex gap-5">
              {/* ── Filters sidebar ── */}
              <div style={{ width:220, flexShrink:0 }}>
                <FlightFilters
                  flights={results}
                  filters={filters}
                  onChange={setFilters}
                  dark={false}
                />
              </div>

              {/* ── Flight list ── */}
              <div className="flex-1 min-w-0">
                {/* Sort bar */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of {results.length} flights
                    {origin && dest && <span className="text-slate-400"> · {origin.city} → {dest.city}</span>}
                  </p>
                  <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-100 p-1">
                    <span className="text-xs text-slate-400 px-2">Sort:</span>
                    {[{v:"price",l:"Cheapest"},{v:"duration",l:"Fastest"},{v:"departure",l:"Earliest"}].map(s => (
                      <button key={s.v} onClick={() => setSortBy(s.v as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${sortBy === s.v ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        style={sortBy === s.v ? { background: T.obsidian } : {}}>
                        {s.l}
                      </button>
                    ))}
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                    <p className="text-slate-500">No flights match your filters. Try adjusting them.</p>
                  </div>
                ) : (
                  <div>
                    {filtered.map(r => (
                      <FlightResultCard
                        key={r.ResultIndex}
                        flight={r}
                        selected={selected?.ResultIndex === r.ResultIndex}
                        onSelect={f => setSelected(selected?.ResultIndex === f.ResultIndex ? null : f)}
                        adultsCount={pax.adults}
                        mode="sbt"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            !loading && <div className="text-center py-20">
              <p className="text-slate-500">{error || "No flights found."}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky booking bar ── */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AirlineLogo code={selected.Segments[0][0].Airline.AirlineCode} />
              <div>
                <p className="font-semibold text-slate-900 text-sm">
                  {selected.Segments[0][0].Airline.FlightNumber} · {origin?.city} → {dest?.city}
                </p>
                <p className="text-xs text-slate-400">
                  {formatTime(selected.Segments[0][0].Origin.DepTime)} → {formatTime(selected.Segments[0][0].Destination.ArrTime)}
                  · {pax.adults + pax.children + pax.infants} passenger{pax.adults + pax.children + pax.infants > 1 ? "s" : ""}
                  · {CABIN_CLASSES.find(c=>c.v===cabin)?.l}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: T.gold }}>
                  ₹{((selected.Fare.PublishedFare||selected.Fare.TotalFare) * pax.adults).toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] text-slate-400">Total for {pax.adults} adult{pax.adults>1?"s":""}</p>
              </div>
              <button className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-lg uppercase tracking-wide">
                Book Now →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
