import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { T } from "../../components/sbt/FlightResultCard";

const TITLES = ["Mr", "Mrs", "Miss", "Ms"];
const STEPS = ["Guests", "Review", "Payment", "Confirmed"];

interface GuestForm {
  Title: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  PaxType: number; // 1=Adult, 2=Child
  LeadPassenger: boolean;
  Age: number;
}

function StepBar({ step }: { step: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", marginBottom: 28,
      background: '#ffffff', borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '12px 24px',
      position: 'sticky', top: 0, zIndex: 50, borderRadius: 0,
    }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "initial" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? '#00b67a' : active ? '#00477f' : '#f1f5f9',
                border: done ? 'none' : active ? 'none' : '2px solid #cbd5e1',
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800,
                color: done || active ? '#ffffff' : '#94a3b8',
                boxShadow: active ? '0 2px 8px rgba(0,71,127,0.35)' : 'none',
                transition: 'all 0.3s ease',
              }}>{done ? "✓" : n}</div>
              <span style={{
                fontSize: 13, fontWeight: done ? 600 : active ? 800 : 500,
                whiteSpace: "nowrap",
                color: done ? '#00b67a' : active ? '#00477f' : '#94a3b8',
                transition: 'all 0.3s ease',
              }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 8px", background: done ? '#00b67a' : '#e2e8f0', borderRadius: 1, transition: 'background 0.3s ease' }} />}
          </div>
        );
      })}
    </div>
  );
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default function SBTHotelGuests() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() as any;
  const state = location.state as any;

  const hotel = state?.hotel;
  const room = state?.room;
  const searchParams = state?.searchParams;

  const roomConfigs: any[] = searchParams?.Rooms || searchParams?.rooms || [{ Adults: 1, Children: 0 }];

  // Build initial guests
  const buildInitialGuests = (): GuestForm[] => {
    const list: GuestForm[] = [];
    let isFirst = true;
    for (const rc of roomConfigs) {
      const adults = rc.Adults || rc.adults || 1;
      const children = rc.Children || rc.children || 0;
      for (let a = 0; a < adults; a++) {
        list.push({
          Title: "Mr",
          FirstName: isFirst ? (user?.firstName || user?.name?.split(" ")[0] || "") : "",
          LastName: isFirst ? (user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "") : "",
          Email: isFirst ? (user?.email || "") : "",
          Phone: isFirst ? (user?.phone || "") : "",
          PaxType: 1,
          LeadPassenger: isFirst,
          Age: 25,
        });
        isFirst = false;
      }
      for (let c = 0; c < children; c++) {
        list.push({
          Title: "Master",
          FirstName: "",
          LastName: "",
          Email: "",
          Phone: "",
          PaxType: 2,
          LeadPassenger: false,
          Age: 8,
        });
      }
    }
    return list;
  };

  const [guests, setGuests] = useState<GuestForm[]>(buildInitialGuests);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!hotel || !room) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>🏨</div>
          <p style={{ color: T.inkMid, marginBottom: 16, fontSize: 14 }}>No room selected.</p>
          <button onClick={() => navigate("/sbt/hotels")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Hotels
          </button>
        </div>
      </div>
    );
  }

  function updateGuest(idx: number, field: keyof GuestForm, value: string | number | boolean) {
    setGuests((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function validate(): string {
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      if (!g.FirstName.trim() || g.FirstName.trim().length < 2) return `Guest ${i + 1}: First name must be at least 2 characters`;
      if (!g.LastName.trim() || g.LastName.trim().length < 2) return `Guest ${i + 1}: Last name must be at least 2 characters`;
      if (/[^a-zA-Z\s'-]/.test(g.FirstName)) return `Guest ${i + 1}: First name contains invalid characters`;
      if (/[^a-zA-Z\s'-]/.test(g.LastName)) return `Guest ${i + 1}: Last name contains invalid characters`;
      if (g.LeadPassenger) {
        if (!g.Email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.Email)) return `Guest ${i + 1}: Valid email required for lead guest`;
        if (!g.Phone.trim() || g.Phone.replace(/\D/g, "").length < 10) return `Guest ${i + 1}: Valid phone number required for lead guest`;
      }
      if (g.PaxType === 2 && (g.Age < 2 || g.Age > 12)) return `Guest ${i + 1}: Child age must be 2-12`;
    }
    return "";
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setLoading(true);

    try {
      const bookingCode = room.BookingCode || room.bookingCode;
      const prebookResult = await api.post("/sbt/hotels/prebook", {
        BookingCode: bookingCode,
      });

      navigate("/sbt/hotels/book/review", {
        state: { hotel, room, guests, prebookResult, searchParams, ...(state?.sbtRequest ? { sbtRequest: state.sbtRequest } : {}) },
      });
    } catch (e: any) {
      setError(e?.message || "Room availability check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const hotelName = hotel.hotelName || hotel.HotelName || "Hotel";
  const roomName = room.name || room.Name?.[0] || room.RoomTypeName || "Room";

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 10, fontSize: 13, color: T.ink, background: T.surface,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: T.inkMid,
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 5,
  };

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{
        background: T.obsidian, borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 22, padding: 0 }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏨</div>
          <div>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>{hotelName}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>{roomName}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: T.gold, fontSize: 18, fontWeight: 800, margin: 0 }}>₹{(room.totalFare || 0).toLocaleString("en-IN")}</p>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: 0 }}>{room.mealType || "Room Only"}</p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 100px" }}>
        <StepBar step={1} />

        {/* Guest forms */}
        {guests.map((g, idx) => (
          <div key={idx} style={{
            background: "#fff", border: `1.5px solid ${T.cardBorder}`, borderRadius: 16,
            padding: "20px 24px", marginBottom: 16,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16,
              paddingBottom: 10, borderBottom: `1px solid ${T.cardBorder}`, display: "block",
            }}>
              {g.PaxType === 1 ? "Adult" : "Child"} {idx + 1}
              {g.LeadPassenger && (
                <span style={{ marginLeft: 10, fontSize: 10, background: `${T.gold}20`, color: T.gold, padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>
                  Lead Guest
                </span>
              )}
            </span>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <select style={{ ...inputStyle, appearance: "none" as const }} value={g.Title} onChange={(e) => updateGuest(idx, "Title", e.target.value)}>
                  {TITLES.map((t) => <option key={t}>{t}</option>)}
                  {g.PaxType === 2 && <option>Master</option>}
                </select>
              </div>
              <div>
                <label style={labelStyle}>First Name</label>
                <input style={inputStyle} placeholder="First name" value={g.FirstName} onChange={(e) => updateGuest(idx, "FirstName", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input style={inputStyle} placeholder="Last name" value={g.LastName} onChange={(e) => updateGuest(idx, "LastName", e.target.value)} />
              </div>
            </div>

            {g.LeadPassenger && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" placeholder="you@example.com" value={g.Email} onChange={(e) => updateGuest(idx, "Email", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" placeholder="+91 98765 43210" value={g.Phone} onChange={(e) => updateGuest(idx, "Phone", e.target.value)} />
                </div>
              </div>
            )}

            {g.PaxType === 2 && (
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input style={inputStyle} type="number" min={2} max={12} value={g.Age} onChange={(e) => updateGuest(idx, "Age", parseInt(e.target.value) || 8)} />
                </div>
              </div>
            )}
          </div>
        ))}

        {error && (
          <div style={{
            background: `${T.rose}12`, border: `1px solid ${T.rose}40`,
            borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: T.rose, fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "12px 24px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer" }}>
            ← Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: loading ? T.inkFaint : T.obsidian, color: "#fff", border: "none",
              borderRadius: 12, padding: "13px 36px", fontWeight: 700, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying availability…" : "Continue to Review →"}
          </button>
        </div>
      </div>
    </div>
  );
}
