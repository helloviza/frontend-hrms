import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { SBTFlight, T } from "../../components/sbt/FlightResultCard";
import BookingProgressBar from "../../components/sbt/BookingProgressBar";
import PriceSummary from "../../components/sbt/PriceSummary";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface PassengerForm {
  title: string; firstName: string; lastName: string;
  dob: string; gender: string; nationality: string;
  passportNo: string; passportExpiry: string;
  email: string; phone: string;
  paxType: "adult" | "child" | "infant";
  isLead: boolean;
}

interface SeatsState {
  flight: SBTFlight;
  traceId: string;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  cabin: number;
  fareQuoteResult?: any;
  priceChanged?: boolean;
  newFare?: number | null;
  passengers: PassengerForm[];
  contactInfo: { email: string; phone: string };
}

interface Seat {
  RowNo: string;
  SeatCode: string;
  SeatType: number; // 1=Window, 2=Middle, 3=Aisle
  SeatWayType: number;
  Price: number;
  AvailablityType: number; // 1=available, 2=occupied, 3=blocked
  Column: string; // A, B, C, D, E, F
}

/* ── Parse SSR response into Seat[] ────────────────────────────────────── */
function parseSSR(data: any): Seat[] {
  const seatDynamic = data?.SeatDynamic ?? data?.Response?.SeatDynamic ?? [];
  if (!seatDynamic.length) return [];

  const seats: Seat[] = [];
  for (const segment of seatDynamic) {
    const segSeats = segment?.SegmentSeat ?? [];
    for (const row of segSeats) {
      const rowSeats = row?.RowSeats ?? [];
      for (const s of rowSeats) {
        const seatInfo = s?.SeatInformation;
        if (!seatInfo) continue;
        seats.push({
          RowNo: String(seatInfo.RowNo ?? s.RowNo ?? ""),
          SeatCode: seatInfo.SeatCode ?? `${seatInfo.RowNo}${seatInfo.Column}`,
          SeatType: seatInfo.SeatType ?? 0,
          SeatWayType: seatInfo.SeatWayType ?? 0,
          Price: seatInfo.Price ?? 0,
          AvailablityType: seatInfo.AvailablityType ?? 1,
          Column: seatInfo.Column ?? "",
        });
      }
    }
  }
  return seats;
}

const COLS_LEFT = ["A", "B", "C"];
const COLS_RIGHT = ["D", "E", "F"];
const SEAT_SIZE = 32;

function seatTypeLabel(type: number): string {
  if (type === 1) return "Window";
  if (type === 2) return "Middle";
  if (type === 3) return "Aisle";
  return "";
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SBTSeats() {
  const { state } = useLocation() as { state: SeatsState | null };
  const navigate = useNavigate();
  const hasLoaded = useRef(false);

  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState<Record<number, { seatCode: string; price: number }>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [noSeats, setNoSeats] = useState(false);

  // Guard
  if (!state) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: T.inkMid, marginBottom: 16 }}>No flight selected.</p>
          <button onClick={() => navigate("/sbt/flights")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10,
              padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Flights
          </button>
        </div>
      </div>
    );
  }

  const { flight, traceId, passengers, origin, dest, pax, fareQuoteResult, priceChanged, newFare } = state;
  const fqFare = fareQuoteResult?.Fare;
  const baseFare = Number(fqFare?.BaseFare ?? flight.Fare?.BaseFare ?? 0);
  const taxes = Number(fqFare?.Tax ?? flight.Fare?.Tax ?? 0);
  const totalFare = Number((fqFare?.PublishedFare ?? flight.Fare?.PublishedFare ?? (baseFare + taxes)) || 0);
  const seatTotal = Object.values(selectedSeats).reduce((sum, s) => sum + s.price, 0);

  // Fetch SSR
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    (async () => {
      try {
        const res = await api.post("/sbt/flights/ssr", {
          ResultIndex: flight.ResultIndex,
          TraceId: traceId,
        });
        const parsed = parseSSR(res);
        if (parsed.length > 0) {
          setSeats(parsed);
        } else {
          setNoSeats(true);
        }
      } catch {
        setNoSeats(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [flight.ResultIndex, traceId]);

  // Build row map
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rows = useMemo(() => {
    const map = new Map<string, Map<string, Seat>>();
    for (const s of seats) {
      if (!map.has(s.RowNo)) map.set(s.RowNo, new Map());
      map.get(s.RowNo)!.set(s.Column, s);
    }
    // Sort rows numerically
    const sorted = [...map.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return sorted;
  }, [seats]);

  // Selected seat codes set (for quick lookup)
  const selectedCodes = new Set(Object.values(selectedSeats).map(s => s.seatCode));

  function handleSeatClick(seat: Seat) {
    if (seat.AvailablityType !== 1) return;

    // Remove this seat from any other passenger
    const nextSeats = { ...selectedSeats };
    for (const [pIdx, s] of Object.entries(nextSeats)) {
      if (s.seatCode === seat.SeatCode) delete nextSeats[Number(pIdx)];
    }

    // Assign to active passenger
    nextSeats[activeTab] = { seatCode: seat.SeatCode, price: seat.Price };
    setSelectedSeats(nextSeats);

    // Auto-advance to next passenger without a seat
    const totalPax = passengers.length;
    for (let i = 1; i <= totalPax; i++) {
      const nextIdx = (activeTab + i) % totalPax;
      if (!nextSeats[nextIdx]) {
        setActiveTab(nextIdx);
        return;
      }
    }
  }

  function handleSkip() {
    navigate("/sbt/flights/book/extras", {
      state: { ...state, selectedSeats: {} },
    });
  }

  function handleContinue() {
    navigate("/sbt/flights/book/extras", {
      state: { ...state, selectedSeats },
    });
  }

  const allAssigned = passengers.every((_, i) => selectedSeats[i]);

  return (
    <div style={{ minHeight: "100vh", background: T.canvas }}>
      <BookingProgressBar currentStep="seats" />

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "32px 24px", gap: 28 }}>
        {/* Left: Seat map */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Back button */}
          <button onClick={() => navigate("/sbt/flights/book/passengers", { state })} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 16,
            fontSize: 12, fontWeight: 600, color: T.inkMid,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          {/* Header + skip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
              Choose Your Seats
            </div>
            <button onClick={handleSkip} style={{
              background: "none", border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 8, padding: "6px 14px", fontSize: 12,
              fontWeight: 600, color: T.inkMid, cursor: "pointer",
            }}>
              Skip seat selection
            </button>
          </div>

          {loading ? (
            /* Skeleton while SSR loads */
            <div style={{
              background: T.cardBg, border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 16, padding: "20px 16px",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "20px 0" }}>
                {Array.from({ length: 10 }).map((_, ri) => (
                  <div key={ri} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ width: 20, fontSize: 10, color: T.inkFaint, textAlign: "right" }}>{ri + 1}</div>
                    {Array.from({ length: 6 }).map((__, ci) => (
                      <div key={ci} style={{
                        width: SEAT_SIZE, height: SEAT_SIZE, borderRadius: 6,
                        background: T.surface, marginLeft: ci === 3 ? 16 : 0,
                      }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : noSeats ? (
            /* No seat data — designed empty state */
            <div style={{
              background: T.cardBg, border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 16, padding: "48px 32px", textAlign: "center",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: T.surface,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.inkFaint}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 18V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10" />
                  <path d="M5 18h14" />
                  <path d="M7 12h10" />
                  <path d="M9 6V4" /><path d="M15 6V4" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: "0 0 10px" }}>
                Seat selection unavailable
              </p>
              <p style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 8px" }}>
                Seat maps are provided by the airline and may not be available for all flights.
                Your seat will be assigned at check-in.
              </p>
              {!flight.IsLCC && (
                <p style={{
                  fontSize: 12, color: T.gold, fontWeight: 600,
                  background: `${T.gold}10`, borderRadius: 8,
                  padding: "8px 16px", display: "inline-block", margin: "8px auto 0",
                }}>
                  For full-service airlines, seat preferences can be added as a special request during check-in.
                </p>
              )}
              <div style={{ marginTop: 28 }}>
                <button onClick={handleSkip} style={{
                  padding: "13px 36px", borderRadius: 10, border: "none",
                  background: T.gold, color: T.obsidian,
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}>
                  Continue to Extras →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Passenger tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                {passengers.map((p, i) => {
                  const isActive = activeTab === i;
                  const assigned = selectedSeats[i];
                  return (
                    <button key={i} onClick={() => setActiveTab(i)} style={{
                      padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      background: isActive ? T.obsidian : T.surface,
                      color: isActive ? "#fff" : T.inkMid,
                      transition: "all 0.15s",
                    }}>
                      {p.firstName || `Pax ${i + 1}`} {p.lastName ? p.lastName[0] + "." : ""}
                      {assigned && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 700,
                          color: isActive ? T.gold : T.emerald,
                        }}>
                          {assigned.seatCode}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Seat map card */}
              <div style={{
                background: T.cardBg, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 16, padding: "20px 16px", position: "relative",
                overflowY: "auto", maxHeight: 600,
              }}>
                {error ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ color: T.inkMid, marginBottom: 12, fontSize: 13 }}>
                      Seat selection unavailable
                    </p>
                    <button onClick={handleSkip} style={{
                      background: T.gold, color: T.obsidian, border: "none", borderRadius: 10,
                      padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}>
                      Skip →
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Nose */}
                    <div style={{
                      width: 120, height: 40, margin: "0 auto 16px",
                      borderRadius: "60px 60px 0 0",
                      background: T.surface, border: `1.5px solid ${T.cardBorder}`,
                      borderBottom: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.inkFaint, letterSpacing: "0.5px" }}>
                        FRONT
                      </span>
                    </div>

                    {/* Seat rows */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      {/* Column headers */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                        <div style={{ width: 22 }} />
                        {COLS_LEFT.map(c => (
                          <div key={c} style={{
                            width: SEAT_SIZE, textAlign: "center",
                            fontSize: 10, fontWeight: 700, color: T.inkFaint,
                          }}>{c}</div>
                        ))}
                        <div style={{ width: 16 }} />
                        {COLS_RIGHT.map(c => (
                          <div key={c} style={{
                            width: SEAT_SIZE, textAlign: "center",
                            fontSize: 10, fontWeight: 700, color: T.inkFaint,
                          }}>{c}</div>
                        ))}
                        <div style={{ width: 22 }} />
                      </div>

                      {rows.map(([rowNo, colMap]) => (
                        <div key={rowNo} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {/* Row number left */}
                          <div style={{ width: 22, textAlign: "right", fontSize: 10, color: T.inkFaint, fontWeight: 600 }}>
                            {rowNo}
                          </div>

                          {/* Left seats A B C */}
                          {COLS_LEFT.map(col => {
                            const seat = colMap.get(col);
                            if (!seat) return <div key={col} style={{ width: SEAT_SIZE, height: SEAT_SIZE }} />;
                            return renderSeat(seat);
                          })}

                          {/* Aisle */}
                          <div style={{ width: 16 }} />

                          {/* Right seats D E F */}
                          {COLS_RIGHT.map(col => {
                            const seat = colMap.get(col);
                            if (!seat) return <div key={col} style={{ width: SEAT_SIZE, height: SEAT_SIZE }} />;
                            return renderSeat(seat);
                          })}

                          {/* Row number right */}
                          <div style={{ width: 22, textAlign: "left", fontSize: 10, color: T.inkFaint, fontWeight: 600 }}>
                            {rowNo}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 16, marginTop: 20, paddingTop: 14,
                      borderTop: `1px solid ${T.cardBorder}`,
                    }}>
                      <LegendItem color={T.cardBg} border={T.cardBorder} label="Free" />
                      <LegendItem color={T.surface} border={T.gold} label="Paid" />
                      <LegendItem color={T.obsidian} border={T.obsidian} label="Selected" />
                      <LegendItem color={T.inkFaint} border={T.inkFaint} label="Occupied" />
                    </div>
                  </>
                )}
              </div>

              {/* Seat total */}
              {seatTotal > 0 && (
                <div style={{
                  marginTop: 12, padding: "8px 14px", borderRadius: 10,
                  background: `${T.gold}10`, border: `1px solid ${T.gold}30`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>Seat charges</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>
                    + ₹{seatTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Continue */}
              <button onClick={handleContinue} style={{
                width: "100%", marginTop: 16, padding: "14px 0",
                background: T.obsidian, color: "#fff", border: "none",
                borderRadius: 12, fontWeight: 700, fontSize: 14,
                cursor: "pointer", letterSpacing: "0.5px",
                transition: "background 0.15s",
                opacity: allAssigned ? 1 : 0.7,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = T.gold; e.currentTarget.style.color = T.obsidian; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.obsidian; e.currentTarget.style.color = "#fff"; }}
              >
                Continue to Extras →
              </button>
            </>
          )}
        </div>

        {/* Right: PriceSummary */}
        <PriceSummary
          flight={flight} origin={origin} dest={dest} pax={pax}
          baseFare={baseFare} taxes={taxes} totalFare={totalFare}
          confirmedFare={priceChanged ? newFare : null}
          extras={{ seats: seatTotal }}
        />
      </div>

      {/* Tooltip */}
      {hovered && (() => {
        const seat = seats.find(s => s.SeatCode === hovered);
        if (!seat || seat.AvailablityType !== 1) return null;
        return (
          <div style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: T.obsidian, color: "#fff", padding: "8px 16px",
            borderRadius: 10, fontSize: 12, fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 200,
            whiteSpace: "nowrap", pointerEvents: "none",
          }}>
            Seat {seat.SeatCode} · {seatTypeLabel(seat.SeatType)}
            {seat.Price > 0 ? ` · ₹${seat.Price}` : " · Free"}
          </div>
        );
      })()}
    </div>
  );

  function renderSeat(seat: Seat) {
    const isOccupied = seat.AvailablityType === 2;
    const isBlocked = seat.AvailablityType === 3;
    const isUnavailable = isOccupied || isBlocked;
    const isSelected = selectedCodes.has(seat.SeatCode);
    const isPaid = seat.Price > 0 && !isUnavailable;
    const isHov = hovered === seat.SeatCode && !isUnavailable && !isSelected;

    let bg = T.cardBg;
    let border = T.cardBorder;
    let textColor = T.ink;

    if (isSelected) {
      bg = T.obsidian; border = T.gold; textColor = "#fff";
    } else if (isUnavailable) {
      bg = T.inkFaint; border = T.inkFaint; textColor = "#fff";
    } else if (isHov) {
      bg = `${T.gold}20`; border = T.gold; textColor = T.ink;
    } else if (isPaid) {
      bg = T.surface; border = T.gold; textColor = T.ink;
    }

    return (
      <div
        key={seat.SeatCode}
        onClick={isUnavailable ? undefined : () => handleSeatClick(seat)}
        onMouseEnter={isUnavailable ? undefined : () => setHovered(seat.SeatCode)}
        onMouseLeave={() => setHovered(null)}
        style={{
          width: SEAT_SIZE, height: SEAT_SIZE,
          borderRadius: 6,
          background: bg,
          border: `1.5px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isUnavailable ? "not-allowed" : "pointer",
          opacity: isBlocked ? 0.4 : 1,
          transition: "all 0.12s ease",
          fontSize: 9, fontWeight: 700, color: textColor,
          position: "relative",
        }}
      >
        {isSelected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        ) : isUnavailable ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : isPaid ? (
          <span style={{ fontSize: 8, color: T.goldDim }}>₹</span>
        ) : null}
      </div>
    );
  }
}

function LegendItem({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        background: color, border: `1.5px solid ${border}`,
      }} />
      <span style={{ fontSize: 10, color: T.inkMid, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
