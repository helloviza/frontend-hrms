import { useState, useEffect, useRef } from "react";
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

interface ExtrasState {
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
  selectedSeats: Record<number, { seatCode: string; price: number }>;
}

interface BaggageOption {
  code: string;
  description: string;
  weight: string;
  price: number;
}

interface MealOption {
  code: string;
  description: string;
  airlineDescription?: string;
  price: number;
}

/* ── Mock data ─────────────────────────────────────────────────────────── */
const MOCK_BAGGAGE: BaggageOption[] = [
  { code: "FREE", description: "Free Baggage", weight: "15 Kg", price: 0 },
  { code: "BAG15", description: "Extra 15 Kg", weight: "15 Kg", price: 650 },
  { code: "BAG20", description: "Extra 20 Kg", weight: "20 Kg", price: 850 },
  { code: "BAG30", description: "Extra 30 Kg", weight: "30 Kg", price: 1150 },
];

const MOCK_MEALS: MealOption[] = [
  { code: "NONE", description: "No Meal Preference", price: 0 },
  { code: "VGML", description: "Vegetarian Meal", price: 0 },
  { code: "NVML", description: "Non-Vegetarian Meal", price: 0 },
  { code: "JNML", description: "Jain Meal", price: 0 },
];

/* ── Parse SSR response ────────────────────────────────────────────────── */
function parseBaggage(data: any): BaggageOption[] {
  const bag = data?.Baggage ?? data?.Response?.Baggage ?? [];
  if (!Array.isArray(bag) || !bag.length) return [];
  // Baggage is typically bag[segmentIndex][paxIndex] — flatten first segment
  const first = Array.isArray(bag[0]) ? bag[0] : bag;
  const flat: any[] = Array.isArray(first[0]) ? first[0] : first;
  return flat
    .filter((b: any) => b && (b.Code || b.Weight != null))
    .map((b: any) => {
      // TBO Description field often contains WayType number (1/2), not a label
      const descIsNumeric = typeof b.Description === "number" || /^\d+$/.test(String(b.Description ?? ""));
      const weight = b.Weight ? `${b.Weight} Kg` : "";
      const label = descIsNumeric ? "" : (b.Description ?? "");
      return {
        code: b.Code ?? `bag_${b.Weight ?? 0}`,
        description: label || (b.Price === 0 ? "No extra baggage" : weight || b.Code || ""),
        weight,
        price: b.Price ?? 0,
      };
    });
}

function parseMeals(data: any): MealOption[] {
  const meals = data?.MealDynamic ?? data?.Response?.MealDynamic ?? [];
  if (!Array.isArray(meals) || !meals.length) return [];
  // MealDynamic is typically [segmentIndex][paxIndex][...options]
  // Take only the first segment's first pax options to avoid duplicates
  const first = Array.isArray(meals[0]) ? meals[0] : meals;
  const flat: any[] = Array.isArray(first[0]) ? first[0] : first;
  const parsed = flat
    .filter((m: any) => m && (m.Code || m.AirlineDescription))
    .map((m: any) => {
      // TBO Description field often contains WayType number (1/2), not meal name
      const descIsNumeric = typeof m.Description === "number" || /^\d+$/.test(String(m.Description ?? ""));
      const realDesc = descIsNumeric ? "" : (m.Description ?? "");
      const label = m.AirlineDescription || realDesc || m.Code || "";
      return {
        code: m.Code ?? "",
        description: m.Price === 0 && !label ? "No meal preference" : label,
        airlineDescription: m.AirlineDescription && m.AirlineDescription !== label ? m.AirlineDescription : "",
        price: m.Price ?? 0,
      };
    });
  // Deduplicate by code to prevent duplicate meal options from multi-segment data
  const seen = new Set<string>();
  return parsed.filter(m => {
    if (seen.has(m.code)) return false;
    seen.add(m.code);
    return true;
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SBTExtras() {
  const { state } = useLocation() as { state: ExtrasState | null };
  const navigate = useNavigate();
  const hasLoaded = useRef(false);

  const [baggageOptions, setBaggageOptions] = useState<BaggageOption[]>([]);
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [bagTab, setBagTab] = useState(0);
  const [mealTab, setMealTab] = useState(0);
  const [selectedBaggage, setSelectedBaggage] = useState<Record<number, BaggageOption>>({});
  const [selectedMeals, setSelectedMeals] = useState<Record<number, MealOption>>({});
  const [isMockBaggage, setIsMockBaggage] = useState(false);
  const [isMockMeals, setIsMockMeals] = useState(false);

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

  const { flight, traceId, passengers, origin, dest, pax, fareQuoteResult, priceChanged, newFare, selectedSeats } = state;
  const fqFare = fareQuoteResult?.Fare;
  const baseFare = Number(fqFare?.BaseFare ?? flight.Fare?.BaseFare ?? 0);
  const taxes = Number(fqFare?.Tax ?? flight.Fare?.Tax ?? 0);
  const totalFare = Number((fqFare?.PublishedFare ?? flight.Fare?.PublishedFare ?? (baseFare + taxes)) || 0);

  const seatTotal = Object.values(selectedSeats || {}).reduce((sum, s) => sum + s.price, 0);
  const baggageTotal = Object.values(selectedBaggage).reduce((sum, b) => sum + b.price, 0);
  const mealTotal = Object.values(selectedMeals).reduce((sum, m) => sum + m.price, 0);

  const seg0 = flight.Segments[0]?.[0];
  const includedBaggage = seg0?.Baggage ?? "15 Kg";
  const includedCabin = seg0?.CabinBaggage ?? "7 Kg";

  // Auto-select free baggage for all passengers
  function autoSelectFree(opts: BaggageOption[]) {
    const freeOpt = opts.find(b => b.price === 0);
    if (!freeOpt) return;
    const initial: Record<number, BaggageOption> = {};
    for (let i = 0; i < passengers.length; i++) {
      initial[i] = freeOpt;
    }
    setSelectedBaggage(initial);
  }

  // Auto-select "no meal" for all passengers
  function autoSelectNoMeal(opts: MealOption[]) {
    const noMeal = opts.find(m => m.price === 0);
    if (!noMeal) return;
    const initial: Record<number, MealOption> = {};
    for (let i = 0; i < passengers.length; i++) {
      initial[i] = noMeal;
    }
    setSelectedMeals(initial);
  }

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
        const bag = parseBaggage(res);
        const meals = parseMeals(res);

        const finalBag = bag.length > 0 ? bag : MOCK_BAGGAGE;
        const finalMeals = meals.length > 0 ? meals : MOCK_MEALS;
        if (bag.length === 0) setIsMockBaggage(true);
        if (meals.length === 0) setIsMockMeals(true);

        setBaggageOptions(finalBag);
        setMealOptions(finalMeals);
        autoSelectFree(finalBag);
        autoSelectNoMeal(finalMeals);
      } catch {
        setBaggageOptions(MOCK_BAGGAGE);
        setMealOptions(MOCK_MEALS);
        setIsMockBaggage(true);
        setIsMockMeals(true);
        autoSelectFree(MOCK_BAGGAGE);
        autoSelectNoMeal(MOCK_MEALS);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.ResultIndex, traceId]);

  function handleBaggageSelect(opt: BaggageOption) {
    // Don't allow deselecting free baggage
    if (selectedBaggage[bagTab]?.code === opt.code && opt.price === 0) return;
    setSelectedBaggage(prev => ({ ...prev, [bagTab]: opt }));
  }

  function handleMealSelect(opt: MealOption) {
    setSelectedMeals(prev => ({ ...prev, [mealTab]: opt }));
  }

  function buildExtrasState() {
    // Ensure free baggage for any passenger without selection
    const finalBag = { ...selectedBaggage };
    const freeOpt = baggageOptions.find(b => b.price === 0) ?? MOCK_BAGGAGE[0];
    for (let i = 0; i < passengers.length; i++) {
      if (!finalBag[i]) finalBag[i] = freeOpt;
    }

    return {
      ...state,
      selectedSeats,
      selectedBaggage: finalBag,
      selectedMeals,
      extras: {
        seats: seatTotal,
        baggage: baggageTotal,
        meals: mealTotal,
      },
    };
  }

  function handleContinue() {
    navigate("/sbt/flights/book/review", { state: buildExtrasState() });
  }

  function handleSkip() {
    // Still auto-select free baggage before skipping
    const freeOpt = baggageOptions.find(b => b.price === 0) ?? MOCK_BAGGAGE[0];
    const freeBag: Record<number, BaggageOption> = {};
    for (let i = 0; i < passengers.length; i++) freeBag[i] = freeOpt;

    navigate("/sbt/flights/book/review", {
      state: {
        ...state,
        selectedSeats,
        selectedBaggage: freeBag,
        selectedMeals: {},
        extras: { seats: seatTotal, baggage: 0, meals: 0 },
      },
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: T.canvas }}>
      <BookingProgressBar currentStep="extras" />

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "32px 24px", gap: 28 }}>
        {/* Left */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Back button */}
          <button onClick={() => navigate("/sbt/flights/book/seats", { state })} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 16,
            fontSize: 12, fontWeight: 600, color: T.inkMid,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          {/* Header + skip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>
              Extras
            </div>
            <button onClick={handleSkip} style={{
              background: "none", border: `1.5px solid ${T.cardBorder}`,
              borderRadius: 8, padding: "6px 14px", fontSize: 12,
              fontWeight: 600, color: T.inkMid, cursor: "pointer",
            }}>
              Skip extras
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 80, borderRadius: 12, background: T.surface,
                  animation: "shimmer 1.5s infinite",
                  backgroundImage: `linear-gradient(90deg, ${T.surface} 25%, ${T.cardBorder} 50%, ${T.surface} 75%)`,
                  backgroundSize: "200% 100%",
                }} />
              ))}
              <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            </div>
          ) : (
            <>
              {/* ── BAGGAGE SECTION ────────────────────────────────── */}
              <div style={{
                background: T.cardBg, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 16, padding: "20px 24px", marginBottom: 20,
              }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Baggage Allowance</div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>
                    Select additional baggage for your journey
                  </div>
                </div>

                {isMockBaggage && (
                  <div style={{
                    fontSize: 12, color: "#b45309", background: "rgba(180,83,9,0.08)",
                    padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                  }}>
                    {flight.IsLCC === false
                      ? "Baggage preferences are indicative for this airline."
                      : "Baggage options unavailable from airline — showing standard options."}
                  </div>
                )}

                {/* Included baggage */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: 12, borderRadius: 10, background: T.surface, marginBottom: 16,
                }}>
                  <IncludedRow label={`${includedCabin} cabin baggage included`} />
                  <IncludedRow label={`${includedBaggage} check-in baggage included`} />
                </div>

                {/* Passenger tabs */}
                <PaxTabs passengers={passengers} active={bagTab} onSelect={setBagTab}
                  selection={selectedBaggage} labelFn={b => b?.weight ?? ""} />

                {/* Baggage options */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
                  {baggageOptions.map(opt => {
                    const isSelected = selectedBaggage[bagTab]?.code === opt.code;
                    const isFree = opt.price === 0;
                    return (
                      <div key={opt.code}
                        onClick={() => handleBaggageSelect(opt)}
                        style={{
                          padding: "14px 12px", borderRadius: 12, cursor: isFree && isSelected ? "default" : "pointer",
                          border: `1.5px solid ${isSelected ? T.obsidian : T.cardBorder}`,
                          background: isSelected ? `${T.gold}10` : T.cardBg,
                          transition: "all 0.15s",
                          textAlign: "center",
                        }}
                      >
                        {/* Briefcase icon */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                          stroke={isSelected ? T.gold : T.inkMid} strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{ margin: "0 auto 6px", display: "block" }}>
                          <rect x="3" y="7" width="18" height="13" rx="2" />
                          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                          {isFree ? "No extra baggage" : (opt.weight || opt.description)}
                        </div>
                        {!isFree && opt.description && opt.description !== opt.weight && (
                          <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>{opt.description}</div>
                        )}
                        <div style={{
                          fontSize: 12, fontWeight: 700, marginTop: 6,
                          color: isFree ? T.emerald : T.gold,
                        }}>
                          {isFree ? "Included" : `₹${opt.price}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── MEALS SECTION ──────────────────────────────────── */}
              <div style={{
                background: T.cardBg, border: `1.5px solid ${T.cardBorder}`,
                borderRadius: 16, padding: "20px 24px", marginBottom: 20,
              }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Meal Preferences</div>
                  <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>
                    Optional — select a meal for your flight
                  </div>
                </div>

                {isMockMeals && (
                  <div style={{
                    fontSize: 12, color: "#b45309", background: "rgba(180,83,9,0.08)",
                    padding: "8px 12px", borderRadius: 8, marginBottom: 12,
                  }}>
                    {flight.IsLCC === false
                      ? "Meal preferences are indicative for this airline."
                      : "Meal options unavailable from airline — showing standard preferences."}
                  </div>
                )}

                {/* Passenger tabs */}
                <PaxTabs passengers={passengers} active={mealTab} onSelect={setMealTab}
                  selection={selectedMeals} labelFn={m => m?.description ?? ""} />

                {/* Meal options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {mealOptions.map(opt => {
                    const isSelected = selectedMeals[mealTab]?.code === opt.code;
                    return (
                      <div key={opt.code}
                        onClick={() => handleMealSelect(opt)}
                        style={{
                          padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                          border: `1.5px solid ${isSelected ? T.obsidian : T.cardBorder}`,
                          background: isSelected ? `${T.gold}10` : T.cardBg,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          transition: "all 0.15s",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{opt.description}</div>
                          {opt.airlineDescription && opt.airlineDescription !== opt.description && (
                            <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>{opt.airlineDescription}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: opt.price === 0 ? T.emerald : T.gold,
                          }}>
                            {opt.price === 0 ? "Included" : `₹${opt.price}`}
                          </span>
                          <div style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: `2px solid ${isSelected ? T.obsidian : T.cardBorder}`,
                            background: isSelected ? T.obsidian : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}>
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extras total */}
              {(baggageTotal + mealTotal + seatTotal) > 0 && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: `${T.gold}10`, border: `1px solid ${T.gold}30`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>Total extras</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>
                    + ₹{(baggageTotal + mealTotal + seatTotal).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Continue */}
              <button onClick={handleContinue} style={{
                width: "100%", padding: "14px 0",
                background: T.obsidian, color: "#fff", border: "none",
                borderRadius: 12, fontWeight: 700, fontSize: 14,
                cursor: "pointer", letterSpacing: "0.5px",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = T.gold; e.currentTarget.style.color = T.obsidian; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.obsidian; e.currentTarget.style.color = "#fff"; }}
              >
                Continue to Review →
              </button>
            </>
          )}
        </div>

        {/* Right: PriceSummary */}
        <PriceSummary
          flight={flight} origin={origin} dest={dest} pax={pax}
          baseFare={baseFare} taxes={taxes} totalFare={totalFare}
          confirmedFare={priceChanged ? newFare : null}
          extras={{ seats: seatTotal, baggage: baggageTotal, meals: mealTotal }}
        />
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function IncludedRow({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.emerald}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function PaxTabs<S>({ passengers, active, onSelect, selection, labelFn }: {
  passengers: PassengerForm[];
  active: number;
  onSelect: (i: number) => void;
  selection: Record<number, S>;
  labelFn: (s: S) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {passengers.map((p, i) => {
        const isActive = active === i;
        const sel = selection[i];
        return (
          <button key={i} onClick={() => onSelect(i)} style={{
            padding: "7px 12px", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: isActive ? T.obsidian : T.surface,
            color: isActive ? "#fff" : T.inkMid,
            transition: "all 0.15s",
          }}>
            {p.firstName || `Pax ${i + 1}`} {p.lastName ? p.lastName[0] + "." : ""}
            {sel && (
              <span style={{
                marginLeft: 5, fontSize: 10, fontWeight: 700,
                color: isActive ? T.gold : T.emerald,
              }}>
                {labelFn(sel)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
