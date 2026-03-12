import { useState, useMemo, useEffect, useRef } from "react";
import { T } from "./FlightResultCard";

interface Props {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onClose: () => void;
  origin: string;
  destination: string;
  prices: Record<string, number | null>;
  onMonthChange?: (month: Date) => void;
  minDate?: string;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function formatPriceShort(p: number): string {
  if (p >= 10000) return `₹${(p / 1000).toFixed(1)}k`;
  if (p >= 1000) return `₹${(p / 1000).toFixed(1)}k`;
  return `₹${p}`;
}

export default function PriceCalendar({
  selectedDate, onDateSelect, onClose, origin, destination, prices, onMonthChange, minDate,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayISO();

  // Month being displayed
  const initial = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [hovered, setHovered] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function changeMonth(dir: -1 | 1) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    onMonthChange?.(new Date(y, m, 1));
  }

  // Build grid cells
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Monday=0 ... Sunday=6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const grid: (null | { iso: string; day: number })[] = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ iso: toISO(viewYear, viewMonth, d), day: d });
    }
    return grid;
  }, [viewYear, viewMonth]);

  // Find cheapest future date in this month
  const minDateCutoff = minDate && minDate > today ? minDate : today;
  const futurePrices = cells
    .filter((c): c is { iso: string; day: number } => c !== null && c.iso >= minDateCutoff && prices[c.iso] != null)
    .map(c => ({ iso: c.iso, price: prices[c.iso]! }));
  const cheapestPrice = futurePrices.length ? Math.min(...futurePrices.map(p => p.price)) : null;
  const cheapestISO = futurePrices.find(p => p.price === cheapestPrice)?.iso ?? null;

  return (
    <div ref={ref} style={{
      background: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 16,
      boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
      padding: 16,
      width: 380,
      zIndex: 100,
      userSelect: "none",
    }}>
      {/* Header: nav + route */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => changeMonth(-1)} style={{
          width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.cardBorder}`,
          background: T.cardBg, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", color: T.inkMid,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>
          {origin && destination && (
            <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 600, marginTop: 2 }}>
              {origin} → {destination}
            </div>
          )}
        </div>

        <button onClick={() => changeMonth(1)} style={{
          width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.cardBorder}`,
          background: T.cardBg, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", color: T.inkMid,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* DOW headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DOW_HEADERS.map(d => (
          <div key={d} style={{
            textAlign: "center", fontSize: 10, fontWeight: 700,
            color: T.inkFaint, padding: "4px 0", letterSpacing: "0.5px",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;

          const { iso, day } = cell;
          const isPast = iso < today || (minDate ? iso < minDate : false);
          const isSelected = iso === selectedDate;
          const isHov = iso === hovered;
          const price = prices[iso];
          const isCheapest = iso === cheapestISO;

          let bg = T.cardBg;
          let textColor = T.ink;
          let priceCol: string = T.inkMid;
          let borderCol = "transparent";

          if (isPast) {
            textColor = T.inkFaint;
            priceCol = T.inkFaint;
          } else if (isSelected) {
            bg = T.obsidian;
            textColor = "#fff";
            priceCol = T.gold;
            borderCol = T.gold;
          } else if (isCheapest && price != null) {
            bg = `${T.emerald}0D`;
            priceCol = T.emerald;
            borderCol = `${T.emerald}30`;
          } else if (isHov) {
            bg = `${T.gold}10`;
            borderCol = `${T.gold}30`;
          }

          return (
            <div key={iso}
              onClick={isPast ? undefined : () => onDateSelect(iso)}
              onMouseEnter={isPast ? undefined : () => setHovered(iso)}
              onMouseLeave={isPast ? undefined : () => setHovered(null)}
              style={{
                position: "relative",
                borderRadius: 8,
                border: `1.5px solid ${borderCol}`,
                background: bg,
                padding: "6px 2px 4px",
                textAlign: "center",
                cursor: isPast ? "default" : "pointer",
                opacity: isPast ? 0.35 : 1,
                transition: "all 0.12s ease",
                minHeight: 48,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
              {/* Lowest badge */}
              {isCheapest && !isSelected && !isPast && (
                <div style={{
                  position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
                  background: T.emerald, color: "#fff", fontSize: 7, fontWeight: 800,
                  padding: "1px 4px", borderRadius: 4, letterSpacing: "0.3px",
                  whiteSpace: "nowrap",
                }}>
                  LOWEST
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: textColor, lineHeight: 1 }}>
                {day}
              </div>

              {/* Price or skeleton */}
              <div style={{ marginTop: 3, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPast ? (
                  <span style={{ fontSize: 9, color: T.inkFaint }}>—</span>
                ) : price != null ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: priceCol }}>
                    {formatPriceShort(price)}
                  </span>
                ) : (
                  /* Skeleton shimmer */
                  <div style={{
                    width: 32, height: 10, borderRadius: 4,
                    background: `linear-gradient(90deg, ${T.surface} 25%, ${T.cardBorder} 50%, ${T.surface} 75%)`,
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shimmer keyframes injected via style tag */}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
