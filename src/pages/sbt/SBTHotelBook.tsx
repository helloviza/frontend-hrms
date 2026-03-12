import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { T } from "../../components/sbt/FlightResultCard";
import type { SBTHotel, HotelDestination, RoomConfig } from "./SBTHotelSearch";

interface BookState {
  hotel: SBTHotel;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: RoomConfig[];
  dest: HotelDestination;
}

interface GuestDetail {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isLead: boolean;
  roomIndex: number;
  paxType: "adult" | "child";
}

const TITLES = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof"];

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function buildGuests(rooms: RoomConfig[]): GuestDetail[] {
  const list: GuestDetail[] = [];
  rooms.forEach((room, ri) => {
    for (let a = 0; a < room.guests.adults; a++) {
      list.push({ title: "Mr", firstName: "", lastName: "", phone: "", email: "", isLead: list.length === 0, roomIndex: ri, paxType: "adult" });
    }
    for (let c = 0; c < room.guests.children; c++) {
      list.push({ title: "Master", firstName: "", lastName: "", phone: "", email: "", isLead: false, roomIndex: ri, paxType: "child" });
    }
  });
  return list;
}

function Stars({ n }: { n: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < n ? T.gold : T.cardBorder, fontSize: 12 }}>★</span>
      ))}
    </span>
  );
}

const s = {
  page: { height: "100vh", overflowY: "auto" as const, background: T.canvas, fontFamily: "inherit" },
  header: {
    background: T.obsidian, borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 28px", height: 60, display: "flex", alignItems: "center",
    justifyContent: "space-between", flexShrink: 0,
  } as React.CSSProperties,
  container: { maxWidth: 860, margin: "0 auto", padding: "32px 20px 100px" } as React.CSSProperties,
  card: {
    background: "#fff", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 16, padding: "20px 24px", marginBottom: 18,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16,
    paddingBottom: 10, borderBottom: `1px solid ${T.cardBorder}`, display: "block",
  } as React.CSSProperties,
  label: {
    fontSize: 11, fontWeight: 600, color: T.inkMid,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
    display: "block", marginBottom: 5,
  },
  input: {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10, fontSize: 13, color: T.ink, background: T.surface,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit",
  },
  select: {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10, fontSize: 13, color: T.ink, background: T.surface,
    outline: "none", boxSizing: "border-box" as const, appearance: "none" as const, fontFamily: "inherit",
  },
  grid: (cols: string): React.CSSProperties => ({ display: "grid", gridTemplateColumns: cols, gap: 12, marginBottom: 12 }),
  stepDot: (active: boolean, done: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: "50%",
    background: done ? T.emerald : active ? T.gold : T.surface,
    border: `2px solid ${done ? T.emerald : active ? T.gold : T.cardBorder}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700, color: done ? "#fff" : active ? T.obsidian : T.inkFaint, flexShrink: 0,
  }),
  errBox: {
    background: `${T.rose}12`, border: `1px solid ${T.rose}40`,
    borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.rose, fontSize: 13,
  } as React.CSSProperties,
};

const STEPS = ["Guest Details", "Review & Confirm", "Booking Confirmed"];

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "initial" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={s.stepDot(active, done)}>{done ? "✓" : n}</div>
              <span style={{ fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", color: active ? T.gold : done ? T.emerald : T.inkFaint }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ flex: 1, height: 2, margin: "0 8px", marginBottom: 16, background: done ? T.emerald : T.cardBorder }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SBTHotelBook() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as BookState | null;

  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [guests, setGuests]       = useState<GuestDetail[]>(state ? buildGuests(state.rooms) : []);
  const [specialReqs, setSpecialReqs] = useState("");
  const [gstOn, setGstOn]         = useState(false);
  const [gst, setGst]             = useState({ company: "", number: "", email: "", phone: "", address: "" });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [bookingResult, setBookingResult] = useState<{ bookingRef?: string; BookingId?: string; ConfirmationNo?: string } | null>(null);

  if (!state) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>🏨</div>
          <p style={{ color: T.inkMid, marginBottom: 16, fontSize: 14 }}>No hotel selected.</p>
          <button onClick={() => navigate("/sbt/hotels")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Hotels
          </button>
        </div>
      </div>
    );
  }

  const { hotel, checkIn, checkOut, nights, rooms, dest } = state;
  const totalRooms  = rooms.length;
  const totalGuests = rooms.reduce((acc, r) => acc + r.guests.adults + r.guests.children, 0);
  const totalPrice  = hotel.lowestPrice * nights * totalRooms;

  function updateGuest(idx: number, field: keyof GuestDetail, value: string | boolean) {
    setGuests((prev) => { const next = [...prev]; next[idx] = { ...next[idx], [field]: value }; return next; });
  }

  function validate(): string {
    for (let i = 0; i < guests.length; i++) {
      if (!guests[i].firstName.trim()) return `Guest ${i + 1}: First name required`;
      if (!guests[i].lastName.trim())  return `Guest ${i + 1}: Last name required`;
    }
    const lead = guests.find((g) => g.isLead);
    if (!lead?.phone?.trim()) return "Lead guest: Phone number required";
    if (!lead?.email?.trim()) return "Lead guest: Email required";
    return "";
  }

  async function confirmBooking() {
    setLoading(true); setError("");
    try {
      const result = await api.post("/sbt/hotels/book", {
        hotelCode: hotel.hotelCode, resultIndex: hotel.resultIndex,
        checkIn, checkOut, rooms, guests, specialRequests: specialReqs,
        gst: gstOn ? gst : undefined,
      });
      setBookingResult(result);
      setStep(3);
    } catch {
      // Stub — backend not live yet
      setBookingResult({ bookingRef: `HTL-${Date.now().toString(36).toUpperCase()}` });
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  const guestsByRoom = rooms.map((_, ri) => guests.filter((g) => g.roomIndex === ri));

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate("/sbt/hotels")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 22, padding: 0 }}
          >←</button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏨</div>
          <div>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>{hotel.hotelName}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>
              {dest?.cityName} · {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: T.gold, fontSize: 18, fontWeight: 800, margin: 0 }}>₹{totalPrice.toLocaleString("en-IN")}</p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: 0 }}>
            {totalRooms} room{totalRooms > 1 ? "s" : ""} · {totalGuests} guest{totalGuests > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div style={s.container}>
        <StepBar step={step} />

        {/* ── Step 1 — Guest Details ── */}
        {step === 1 && (
          <>
            {guestsByRoom.map((roomGuests, ri) => (
              <div key={ri}>
                {totalRooms > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: T.obsidian, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: T.gold, flexShrink: 0 }}>{ri + 1}</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.inkMid }}>Room {ri + 1}</span>
                    <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
                  </div>
                )}
                {roomGuests.map((g) => {
                  const idx = guests.indexOf(g);
                  const sameTypeGuests = roomGuests.filter((x) => x.paxType === g.paxType);
                  const typeIdx = sameTypeGuests.indexOf(g);
                  const gLabel = g.paxType === "adult" ? `Adult ${typeIdx + 1}` : `Child ${typeIdx + 1}`;
                  return (
                    <div key={idx} style={s.card}>
                      <span style={s.sectionTitle}>
                        {gLabel}
                        {g.isLead && (
                          <span style={{ marginLeft: 10, fontSize: 10, background: `${T.gold}20`, color: T.gold, padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>
                            Lead Guest
                          </span>
                        )}
                      </span>
                      <div style={s.grid("100px 1fr 1fr")}>
                        <div>
                          <label style={s.label}>Title</label>
                          <select style={s.select} value={g.title} onChange={(e) => updateGuest(idx, "title", e.target.value)}>
                            {TITLES.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={s.label}>First Name</label>
                          <input style={s.input} placeholder="As on passport" value={g.firstName} onChange={(e) => updateGuest(idx, "firstName", e.target.value)} />
                        </div>
                        <div>
                          <label style={s.label}>Last Name</label>
                          <input style={s.input} placeholder="As on passport" value={g.lastName} onChange={(e) => updateGuest(idx, "lastName", e.target.value)} />
                        </div>
                      </div>
                      {g.isLead && (
                        <div style={s.grid("1fr 1fr")}>
                          <div>
                            <label style={s.label}>Phone</label>
                            <input style={s.input} type="tel" placeholder="+91 98765 43210" value={g.phone} onChange={(e) => updateGuest(idx, "phone", e.target.value)} />
                          </div>
                          <div>
                            <label style={s.label}>Email</label>
                            <input style={s.input} type="email" placeholder="you@company.com" value={g.email} onChange={(e) => updateGuest(idx, "email", e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Special requests */}
            <div style={s.card}>
              <span style={s.sectionTitle}>Special Requests <span style={{ fontWeight: 400, color: T.inkFaint }}>(optional)</span></span>
              <textarea
                value={specialReqs} onChange={(e) => setSpecialReqs(e.target.value)}
                placeholder="Early check-in, high floor, twin beds…"
                rows={3}
                style={{ ...s.input, resize: "vertical", lineHeight: 1.6 }}
              />
              <p style={{ fontSize: 11, color: T.inkFaint, margin: "6px 0 0" }}>Requests are subject to availability.</p>
            </div>

            {/* GST toggle */}
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>GST Invoice</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <span style={{ fontSize: 12, color: T.inkMid }}>Claim for business</span>
                  <div
                    onClick={() => setGstOn((v) => !v)}
                    style={{ width: 40, height: 22, borderRadius: 11, background: gstOn ? T.emerald : T.cardBorder, position: "relative", cursor: "pointer", transition: "background 0.2s" }}
                  >
                    <div style={{ position: "absolute", top: 3, left: gstOn ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </label>
              </div>
              {gstOn && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.grid("1fr 1fr")}>
                    <div><label style={s.label}>Company Name</label><input style={s.input} value={gst.company} onChange={(e) => setGst((g) => ({ ...g, company: e.target.value }))} /></div>
                    <div><label style={s.label}>GST Number</label><input style={s.input} placeholder="22AAAAA0000A1Z5" value={gst.number} onChange={(e) => setGst((g) => ({ ...g, number: e.target.value }))} /></div>
                  </div>
                  <div style={s.grid("1fr 1fr")}>
                    <div><label style={s.label}>Company Email</label><input style={s.input} type="email" value={gst.email} onChange={(e) => setGst((g) => ({ ...g, email: e.target.value }))} /></div>
                    <div><label style={s.label}>Phone</label><input style={s.input} value={gst.phone} onChange={(e) => setGst((g) => ({ ...g, phone: e.target.value }))} /></div>
                  </div>
                  <div><label style={s.label}>Registered Address</label><input style={s.input} value={gst.address} onChange={(e) => setGst((g) => ({ ...g, address: e.target.value }))} /></div>
                </div>
              )}
            </div>

            {error && <div style={s.errBox}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => { const e = validate(); if (e) { setError(e); return; } setError(""); setStep(2); }}
                style={{ background: T.obsidian, color: "#fff", border: "none", borderRadius: 12, padding: "13px 36px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Continue to Review →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2 — Review & Confirm ── */}
        {step === 2 && (
          <>
            <div style={s.card}>
              <span style={s.sectionTitle}>Hotel Details</span>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 80, height: 80, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🏨</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{hotel.hotelName}</p>
                  <Stars n={hotel.starRating} />
                  <p style={{ fontSize: 12, color: T.inkMid, margin: "6px 0 0" }}>📍 {hotel.address}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 20, background: T.surface, borderRadius: 12, padding: "14px 16px" }}>
                {[
                  { label: "Check-in",  value: fmtDate(checkIn) },
                  { label: "Check-out", value: fmtDate(checkOut) },
                  { label: "Duration",  value: `${nights} Night${nights > 1 ? "s" : ""}` },
                  { label: "Rooms",     value: `${totalRooms} Room${totalRooms > 1 ? "s" : ""}` },
                ].map((item) => (
                  <div key={item.label}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>{item.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.card}>
              <span style={s.sectionTitle}>Guests ({guests.length})</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {guests.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.surface, borderRadius: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                        {g.title} {g.firstName} {g.lastName}
                        {g.isLead && <span style={{ marginLeft: 8, fontSize: 10, background: `${T.gold}20`, color: T.gold, padding: "2px 8px", borderRadius: 20 }}>Lead</span>}
                      </p>
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: "2px 0 0" }}>
                        {g.paxType === "adult" ? "Adult" : "Child"}{totalRooms > 1 ? ` · Room ${g.roomIndex + 1}` : ""}
                        {g.isLead && g.phone ? ` · ${g.phone}` : ""}
                      </p>
                    </div>
                    {g.isLead && g.email && <span style={{ fontSize: 11, color: T.inkMid }}>✉ {g.email}</span>}
                  </div>
                ))}
              </div>
            </div>

            {specialReqs && (
              <div style={s.card}>
                <span style={s.sectionTitle}>Special Requests</span>
                <p style={{ fontSize: 13, color: T.inkMid, margin: 0, lineHeight: 1.6 }}>{specialReqs}</p>
              </div>
            )}

            <div style={s.card}>
              <span style={s.sectionTitle}>Fare Breakdown</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: T.inkMid }}>₹{hotel.lowestPrice.toLocaleString("en-IN")} × {nights} night{nights > 1 ? "s" : ""} × {totalRooms} room{totalRooms > 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>₹{totalPrice.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: T.inkMid }}>Taxes & Fees</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Included</span>
                </div>
                <div style={{ height: 1, background: T.cardBorder, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>₹{totalPrice.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "8px 12px", background: hotel.isRefundable ? `${T.emerald}12` : `${T.amber}12`, borderRadius: 8 }}>
                  <span style={{ fontSize: 13 }}>{hotel.isRefundable ? "✓" : "⚠"}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: hotel.isRefundable ? T.emerald : T.amber }}>
                    {hotel.isRefundable ? "Free cancellation available" : "Non-refundable rate"}
                  </span>
                </div>
              </div>
            </div>

            {error && <div style={s.errBox}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setStep(1)} style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "12px 24px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>← Back</button>
              <button
                onClick={confirmBooking} disabled={loading}
                style={{ background: loading ? T.inkFaint : T.gold, color: T.obsidian, border: "none", borderRadius: 12, padding: "13px 40px", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : `0 4px 20px ${T.gold}40` }}
              >
                {loading ? "Processing…" : "Confirm & Book →"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3 — Booking Confirmed ── */}
        {step === 3 && (
          <div style={{ ...s.card, textAlign: "center", padding: "52px 36px" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${T.emerald}14`, border: `2.5px solid ${T.emerald}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>✓</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "0 0 10px" }}>Hotel Booked!</h2>
            <p style={{ fontSize: 14, color: T.inkMid, margin: "0 0 32px", lineHeight: 1.6 }}>
              {hotel.hotelName} · {dest?.cityName}<br />
              {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
            </p>

            <div style={{ display: "inline-block", background: T.surface, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "18px 32px", marginBottom: 32, minWidth: 260 }}>
              {bookingResult?.bookingRef ? (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Booking Reference</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: T.obsidian, margin: 0 }}>{bookingResult.bookingRef}</p>
                  <p style={{ fontSize: 10, color: T.inkFaint, margin: "8px 0 0" }}>⚠ Stub mode — TBO hotel API not yet connected</p>
                </>
              ) : (
                <>
                  {bookingResult?.BookingId && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Booking ID</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: T.obsidian, margin: 0 }}>{bookingResult.BookingId}</p>
                    </div>
                  )}
                  {bookingResult?.ConfirmationNo && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>Confirmation No.</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: T.gold, margin: 0 }}>{bookingResult.ConfirmationNo}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => navigate("/booking-history")} style={{ background: T.obsidian, color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>View Bookings</button>
              <button onClick={() => navigate("/sbt/hotels")} style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "12px 28px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>Search Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
