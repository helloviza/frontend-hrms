import React, { useEffect, useMemo, useState } from "react";

/* =======================
   Types
======================= */

type FlightPreview = {
  airline: string;
  airlineCode?: string; 
  flightNo?: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  stops: number;
  approxPrice: number;
};

type HotelPreview = {
  name: string;
  area?: string;
  starRating?: number;
  overallRating?: number;
  approxPricePerNight: number;
  thumbnail?: string;
};

type SearchPreviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  mode: "flight" | "hotel";
  query: any;
  onUseHint: (hint: { note: string; patch?: Record<string, any> }) => void;
};

/* =======================
   Helpers
======================= */

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const formatTime = (timeStr: string) => {
  if (!timeStr) return "--:--";
  const parts = timeStr.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

/**
 * FIXED LOGO LOGIC
 * Uses Google's Favicon Service with a domain-mapped fallback.
 */
const getAirlineLogo = (airlineName: string, iataCode?: string) => {
  const domainMap: Record<string, string> = {
    "IndiGo": "goindigo.in",
    "Air India": "airindia.in",
    "SpiceJet": "spicejet.com",
    "Akasa Air": "akasaair.com",
    "Vistara": "airvistara.com",
    "Air India Express": "airindiaexpress.com",
    "AirAsia": "airasia.com",
    "Go Air": "flygofirst.com"
  };

  // 1. Try domain mapping for Indian carriers (Most Reliable)
  const domain = domainMap[airlineName];
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }

  // 2. Try IATA code via Clearbit if available
  if (iataCode && iataCode.length === 2) {
    return `https://logo.clearbit.com/${iataCode.toLowerCase()}.com`;
  }

  // 3. Last resort fallback
  return `https://www.google.com/s2/favicons?domain=flightstats.com&sz=128`;
};

/* =======================
   Safe Image Component
======================= */

function SafeImage({ src, alt, className, fallbackIcon }: { src?: string; alt: string; className?: string; fallbackIcon: string }) {
  const [error, setError] = useState(false);
  
  // Reset error state if src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className={`bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 ${className}`}>
        {fallbackIcon}
      </div>
    );
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${className} object-contain`} 
      onError={() => setError(true)} 
    />
  );
}

/* =======================
   Main Component
======================= */

export default function SearchPreviewDrawer({ open, onClose, mode, query, onUseHint }: SearchPreviewDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightPreview[]>([]);
  const [hotels, setHotels] = useState<HotelPreview[]>([]);
  const [deepSearch, setDeepSearch] = useState(true);
  const [maxStops, setMaxStops] = useState<number | null>(null);
  const [minStars, setMinStars] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(mode === "flight" ? "/api/preview/flights" : "/api/preview/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(query || {}), deepSearch }),
        });
        const data = await res.json();
        
        if (mode === "flight") {
          setFlights(data?.results || []);
        } else {
          setHotels(data?.results || []);
        }
      } catch (e: any) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, mode, query, deepSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <aside className="relative h-full w-[500px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-white border-b flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              {mode === "flight" ? "✈️ Flight Inventory" : "🏨 Hotel Inventory"}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {mode === "flight" ? (
                ['All', '0', '1', '2'].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setMaxStops(s === 'All' ? null : Number(s))}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full border transition-all ${maxStops === (s === 'All' ? null : Number(s)) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    {s === 'All' ? 'All' : s === '0' ? 'Non-stop' : `${s} Stop`}
                  </button>
                ))
              ) : (
                [3, 4, 5].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setMinStars(minStars === s ? null : s)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-full border transition-all ${minStars === s ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-500 border-slate-200'}`}
                  >
                    {s}★+
                  </button>
                ))
              )}
            </div>
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 cursor-pointer uppercase tracking-widest">
              Deep Search
              <input type="checkbox" checked={deepSearch} onChange={e => setDeepSearch(e.target.checked)} className="accent-blue-600" />
            </label>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fetching live rates...</div>
            </div>
          )}
          
          {error && <div className="p-4 bg-red-50 text-red-500 rounded-xl text-xs font-bold border border-red-100">{error}</div>}

          {/* FLIGHT CARDS */}
          {mode === "flight" && flights.filter(f => maxStops === null || f.stops <= maxStops).map((f, i) => (
            <div key={i} className="group bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-500 transition-all shadow-sm">
              <div className="flex items-center gap-4">
                {/* Brand Area */}
                <div className="w-16 flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center p-1 mb-1">
                    <SafeImage 
                      src={getAirlineLogo(f.airline, f.airlineCode)} 
                      alt={f.airline} 
                      className="w-full h-full" 
                      fallbackIcon="✈️" 
                    />
                  </div>
                  <div className="text-[9px] font-black text-slate-800 leading-tight uppercase tracking-tighter line-clamp-2">{f.airline}</div>
                </div>

                {/* Timeline */}
                <div className="flex-1 flex items-center justify-between gap-2 border-x border-slate-50 px-4">
                  <div className="text-center">
                    <div className="text-lg font-black text-slate-900 leading-none">{formatTime(f.departTime)}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">{query?.from || 'ORG'}</div>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[8px] text-slate-400 font-black mb-1 uppercase tracking-tighter">{f.duration}</span>
                    <div className="h-[2px] w-full bg-slate-100 relative rounded-full">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
                    </div>
                    <span className={`text-[8px] font-black mt-1 uppercase tracking-widest ${f.stops === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                      {f.stops === 0 ? "Direct" : f.stops === 1 ? "1 Stop" : `${f.stops} Stops`}
                    </span>
                  </div>

                  <div className="text-center">
                    <div className="text-lg font-black text-slate-900 leading-none">{formatTime(f.arriveTime)}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">{query?.to || 'DST'}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="w-24 text-right">
                  <div className="text-base font-black text-blue-900 leading-none mb-2">{money(f.approxPrice)}</div>
                  <button 
                    onClick={() => onUseHint({ note: `Flight: ${f.airline} (${money(f.approxPrice)})` })}
                    className="w-full py-1.5 bg-slate-900 text-white text-[9px] font-black rounded-lg hover:bg-blue-600 transition-colors uppercase tracking-widest"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* HOTEL CARDS */}
          {mode === "hotel" && hotels.filter(h => !minStars || (h.starRating || 0) >= minStars).map((h, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="h-32 bg-slate-100 relative">
                <SafeImage src={h.thumbnail} alt={h.name} className="w-full h-full object-cover" fallbackIcon="🏨" />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-lg shadow-xl text-right">
                   <div className="text-[8px] text-slate-500 font-black uppercase mb-0.5">Starts At</div>
                   <div className="text-sm font-black text-blue-900">{money(h.approxPricePerNight)}<span className="text-[10px] font-normal ml-0.5">/nt</span></div>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-black text-slate-800 text-sm leading-tight">{h.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-orange-500 text-[10px]">{"★".repeat(h.starRating || 3)}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h.area}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onUseHint({ note: `Hotel: ${h.name} (${money(h.approxPricePerNight)})` })}
                  className="px-4 py-2 bg-blue-50 text-blue-700 text-[10px] font-black rounded-xl hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t space-y-1.5">
          <p className="text-[9px] text-slate-400 font-bold leading-tight uppercase tracking-tighter">
            * Prices reflect the lowest available room rate. Refundability and final inclusions are confirmed upon selection.
          </p>
          <div className="flex justify-between items-center opacity-30">
             <span className="text-[8px] font-black uppercase tracking-[0.2em]">PlumTrips Engine 2.0</span>
          </div>
        </div>
      </aside>
    </div>
  );
}