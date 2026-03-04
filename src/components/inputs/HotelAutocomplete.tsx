// apps/frontend/src/components/inputs/HotelAutocomplete.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

type HotelPrediction = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type HotelMeta = {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  website: string;
  rating: number | null;
  googleMapsUrl: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  value?: string; // display value (usually selected hotel name or typed text)
  onChangeText?: (text: string) => void; // fires when user types
  onSelectHotel: (hotel: HotelMeta) => void; // fires when details loaded
  selectedHotel?: HotelMeta | null;
  disabled?: boolean;
  className?: string;
};

function uuid(): string {
  // Good enough for sessionToken
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export const HotelAutocomplete: React.FC<Props> = ({
  label = "City / Hotel",
  placeholder = "Type city or hotel name…",
  value = "",
  onChangeText,
  onSelectHotel,
  selectedHotel,
  disabled,
  className = "",
}) => {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<HotelPrediction[]>([]);
  const [error, setError] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<string>(uuid());

  const debouncedInput = useDebouncedValue(input, 250);

  useEffect(() => {
    setInput(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const canSearch = useMemo(() => debouncedInput.trim().length >= 2, [debouncedInput]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError("");

      if (!canSearch || disabled) {
        setPredictions([]);
        return;
      }

      setLoading(true);
      try {
const r = await fetch("/api/places/hotels/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: debouncedInput.trim() }),
});
const data = await r.json();

if (!r.ok) throw new Error(data?.message || "Failed to fetch suggestions");

setPredictions(data?.predictions || []);
setOpen(true);
setActiveIndex(-1);
      } catch (e: any) {
  if (cancelled) return;
  setError(e?.message || "Something went wrong");
  setPredictions([]);
  setOpen(true);       // ✅ show dropdown so error is visible
  setActiveIndex(-1);
} finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedInput, canSearch, disabled]);

  const setText = (text: string) => {
    setInput(text);
    onChangeText?.(text);
  };

  const fetchDetailsAndSelect = async (placeId: string) => {
    setLoading(true);
    setError("");
    try {
      const url = new URL("/api/places/hotels/details", window.location.origin);
      url.searchParams.set("placeId", placeId);
      url.searchParams.set("sessionToken", sessionTokenRef.current);

      const r = await fetch(url.toString(), { method: "GET" });
      const data = await r.json();

      if (!r.ok) throw new Error(data?.message || "Failed to load hotel details");

      const hotel: HotelMeta = data.hotel;

      // Update UI text
      setText(hotel.name || input);
      setOpen(false);
      setPredictions([]);
      setActiveIndex(-1);

      // Important: new token for next search session (Google billing best practice)
      sessionTokenRef.current = uuid();

      onSelectHotel(hotel);
    } catch (e: any) {
      setError(e?.message || "Could not load hotel details");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open && e.key === "ArrowDown" && predictions.length) {
      setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (!open) return;

    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, predictions.length - 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const item = predictions[activeIndex];
      if (item) fetchDetailsAndSelect(item.placeId);
      return;
    }
  };

  const showSelectedMeta = !!selectedHotel?.placeId;

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>

      <div className="relative">
        <input
          value={input}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            // If user edits text after selecting, we should treat it as a new search (hotel may no longer match)
            if (showSelectedMeta && e.target.value !== selectedHotel?.name) {
              // No forced clearing here; parent can clear selectedHotel if desired.
            }
          }}
          onFocus={() => {
            if (predictions.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={[
            "w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none",
            "border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
            disabled ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        />

        {loading && <div className="absolute right-3 top-2.5 text-xs text-slate-500">Loading…</div>}

        {open && !disabled && (predictions.length > 0 || error) && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {error ? (
              <div className="px-3 py-2 text-sm text-red-600">{error}</div>
            ) : (
              <ul className="max-h-64 overflow-auto">
                {predictions.map((p, idx) => {
                  const active = idx === activeIndex;
                  return (
                    <li
                      key={p.placeId}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        // prevent blur before click
                        e.preventDefault();
                        fetchDetailsAndSelect(p.placeId);
                      }}
                      className={["px-3 py-2 cursor-pointer", active ? "bg-slate-100" : "bg-white"].join(" ")}
                    >
                      <div className="text-sm font-medium text-slate-900">{p.primaryText}</div>
                      {p.secondaryText ? (
                        <div className="text-xs text-slate-600 mt-0.5">{p.secondaryText}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {showSelectedMeta && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-900">{selectedHotel?.name}</div>
          {selectedHotel?.address ? (
            <div className="text-xs text-slate-700 mt-1">{selectedHotel.address}</div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
            {typeof selectedHotel?.rating === "number" ? (
              <span className="rounded-lg bg-white border border-slate-200 px-2 py-1">⭐ {selectedHotel.rating}</span>
            ) : null}

            {selectedHotel?.phone ? (
              <span className="rounded-lg bg-white border border-slate-200 px-2 py-1">📞 {selectedHotel.phone}</span>
            ) : null}

            {selectedHotel?.website ? (
              <a
                className="rounded-lg bg-white border border-slate-200 px-2 py-1 hover:bg-slate-100"
                href={selectedHotel.website}
                target="_blank"
                rel="noreferrer"
              >
                🌐 Website
              </a>
            ) : null}

            {selectedHotel?.googleMapsUrl ? (
              <a
                className="rounded-lg bg-white border border-slate-200 px-2 py-1 hover:bg-slate-100"
                href={selectedHotel.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                📍 Maps
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

// ✅ Add these two lines to support your current import style
export default HotelAutocomplete;

