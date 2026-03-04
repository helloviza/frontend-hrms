// apps/frontend/src/components/inputs/AirportAutocomplete.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import airportsData from "../../data/airports.json";

type AirportRecord = {
  iata: string;
  airport?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  label?: string; // e.g. "DEL — Indira Gandhi Intl (Delhi, India)"
  search?: string; // precomputed lowercase index string
};

type AirportsJsonShape =
  | { records: AirportRecord[] }
  | AirportRecord[]
  | { data: { records: AirportRecord[] } };

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function getRecords(data: any): AirportRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as AirportRecord[];
  if (Array.isArray(data?.records)) return data.records as AirportRecord[];
  if (Array.isArray(data?.data?.records)) return data.data.records as AirportRecord[];
  return [];
}

function norm(s: any) {
  return String(s ?? "").trim();
}

function lower(s: any) {
  return norm(s).toLowerCase();
}

function buildFallbackSearch(a: AirportRecord) {
  // If your json already has .search, we use that. This is only a fallback.
  return [
    a.iata,
    a.airport,
    a.city,
    a.country,
    a.countryCode,
    a.label,
  ]
    .map(lower)
    .filter(Boolean)
    .join(" ");
}

export default function AirportAutocomplete({
  value,
  onSelect,
  placeholder = "Search airport (code / city / name)",
  label,
  hint,
  disabled,
  minChars = 2,
  maxResults = 10,
  className,
}: {
  value?: string; // selected iata code (e.g., "DEL")
  onSelect: (airport: AirportRecord) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  minChars?: number;
  maxResults?: number;
  className?: string;
}) {
  const all: AirportRecord[] = useMemo(() => getRecords(airportsData as AirportsJsonShape), []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<string>(value ? String(value) : "");
  const [active, setActive] = useState<number>(-1);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep input text in sync when parent changes value
  useEffect(() => {
    if (typeof value === "string" && value !== q) {
      setQ(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const query = useMemo(() => lower(q), [q]);

  const results = useMemo(() => {
    if (!open) return [];
    if (disabled) return [];
    if (!query || query.length < minChars) return [];

    // Fast match:
    // - Prefer direct IATA startsWith
    // - Then search includes on precomputed .search (or fallback)
    const starts: AirportRecord[] = [];
    const contains: AirportRecord[] = [];

    for (const a of all) {
      const iata = lower(a.iata);
      if (!iata) continue;

      if (iata.startsWith(query)) {
        starts.push(a);
        continue;
      }

      const s = a.search ? String(a.search) : buildFallbackSearch(a);
      if (String(s).includes(query)) contains.push(a);
    }

    const merged = [...starts, ...contains].slice(0, maxResults);
    return merged;
  }, [all, query, open, disabled, minChars, maxResults]);

  function pick(a: AirportRecord) {
    if (!a?.iata) return;
    onSelect(a);
    setQ(a.iata);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => {
        const next = Math.min(p + 1, results.length - 1);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => {
        const next = Math.max(p - 1, 0);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < results.length) {
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const selectedPreview = useMemo(() => {
    const code = lower(value);
    if (!code) return null;
    const found = all.find((a) => lower(a.iata) === code);
    return found || null;
  }, [all, value]);

  return (
    <div ref={wrapRef} className={cx("w-full", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-medium text-slate-700">{label}</label>
          {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
        </div>
      ) : null}

      <div className="relative mt-1">
        <div
          className={cx(
            "group flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm",
            disabled
              ? "border-slate-200 opacity-60"
              : "border-slate-200 focus-within:border-[#00477f]/40 focus-within:ring-2 focus-within:ring-[#00477f]/15"
          )}
        >
          <span className="text-slate-400 text-sm">✈️</span>

          <input
            ref={inputRef}
            value={q}
            disabled={disabled}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={cx(
              "w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
            )}
          />

          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setOpen(true);
                setActive(-1);
                inputRef.current?.focus();
              }}
              className="rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              title="Clear"
            >
              ✕
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Type…</span>
          )}
        </div>

        {/* helper line */}
        <div className="mt-1 text-[11px] text-slate-500">
          {query.length > 0 && query.length < minChars ? (
            <>Type at least {minChars} letters to search</>
          ) : selectedPreview ? (
            <>
              Selected:{" "}
              <span className="font-medium text-slate-700">
                {selectedPreview.iata}
              </span>
              {selectedPreview.city ? <> • {selectedPreview.city}</> : null}
              {selectedPreview.country ? <> • {selectedPreview.country}</> : null}
            </>
          ) : (
            <>Search by code, airport name, city or country</>
          )}
        </div>

        {/* dropdown */}
        {open && !disabled ? (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
            {query.length >= minChars ? (
              results.length ? (
                <div className="max-h-80 overflow-auto">
                  {results.map((a, idx) => {
                    const isActive = idx === active;
                    const code = norm(a.iata);
                    const name = norm(a.airport) || norm(a.label) || "Airport";
                    const city = norm(a.city);
                    const country = norm(a.country);
                    return (
                      <button
                        key={`${code}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()} // prevent input blur
                        onClick={() => pick(a)}
                        className={cx(
                          "w-full text-left px-4 py-3 transition",
                          isActive ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex shrink-0 rounded-lg bg-[#00477f]/10 text-[#00477f] px-2 py-0.5 text-xs font-semibold">
                                {code}
                              </span>
                              <div className="truncate text-sm font-medium text-slate-900">
                                {name}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-slate-600 truncate">
                              {city ? city : "—"}
                              {country ? `, ${country}` : ""}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-400 shrink-0">
                            {a.countryCode ? a.countryCode : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-4 text-sm text-slate-600">
                  No matches found for <b>{q}</b>
                </div>
              )
            ) : (
              <div className="px-4 py-4 text-sm text-slate-600">
                Start typing to search airports…
              </div>
            )}

            <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Tip: Use ↑ ↓ and Enter</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setActive(-1);
                }}
                className="text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
