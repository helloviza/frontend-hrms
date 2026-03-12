import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { T } from "../../components/sbt/FlightResultCard";

declare global {
  interface Window { Razorpay: any; }
}

const STEPS = ["Guests", "Review", "Payment", "Confirmed"];

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

function Stars({ n }: { n: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ fontSize: 12, color: i < n ? T.gold : T.cardBorder }}>★</span>
      ))}
    </span>
  );
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 1;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

/** Parse TBO date strings like "09-03-2026 00:00:00" (DD-MM-YYYY) or ISO */
function parseCancelDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const ddmm = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (ddmm) {
    const d = new Date(`${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function isCancelDateValid(cancelFromDate: string, checkOut: string): boolean {
  const cancel = parseCancelDate(cancelFromDate);
  if (!cancel) return false;
  const checkout = new Date(checkOut);
  if (isNaN(checkout.getTime())) return true;
  if (cancel > checkout) return false;
  return true;
}

function formatCancelDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = parseCancelDate(dateStr);
  if (!d) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function SBTHotelReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rateExpanded, setRateExpanded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  if (!state?.hotel || !state?.room || !state?.guests) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>🏨</div>
          <p style={{ color: T.inkMid, marginBottom: 16, fontSize: 14 }}>Session expired.</p>
          <button onClick={() => navigate("/sbt/hotels")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Hotels
          </button>
        </div>
      </div>
    );
  }

  const { hotel, room, guests, prebookResult, searchParams } = state;
  const hotelName = hotel.hotelName || hotel.HotelName || "Hotel";
  const starRating = hotel.starRating ?? hotel.StarRating ?? 0;
  const cityName = hotel.cityName || searchParams?.CityName || "";
  const checkIn = searchParams?.CheckIn || hotel.checkIn || "";
  const checkOut = searchParams?.CheckOut || hotel.checkOut || "";
  const nights = nightsBetween(checkIn, checkOut);
  const roomName = room.name || room.Name?.[0] || room.RoomTypeName || "Room";
  const mealType = room.mealType || room.MealType || "Room Only";

  // Use prebook fare if available, otherwise room fare
  const prebookHotel = prebookResult?.HotelResult?.[0] || prebookResult?.PreBookResult?.HotelResult?.[0];
  const totalFare = prebookHotel?.Rooms?.[0]?.TotalFare ?? room.totalFare ?? 0;
  const totalTax = prebookHotel?.Rooms?.[0]?.TotalTax ?? room.totalTax ?? 0;
  const baseFare = totalFare - totalTax;
  const cancelPolicies = prebookHotel?.Rooms?.[0]?.CancelPolicies || room.cancelPolicies || [];
  const rateConditions = prebookHotel?.Rooms?.[0]?.RateConditions || prebookResult?.RateConditions || [];
  const supplements = prebookHotel?.Rooms?.[0]?.Supplements || [];
  const isRefundable = room.isRefundable ?? false;
  const bookingCode = prebookHotel?.Rooms?.[0]?.BookingCode || room.BookingCode || room.bookingCode || "";

  const cardStyle: React.CSSProperties = {
    background: "#fff", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 16, padding: "20px 24px", marginBottom: 18,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16,
    paddingBottom: 10, borderBottom: `1px solid ${T.cardBorder}`, display: "block",
  };

  async function handlePayment() {
    setLoading(true);
    setError("");

    try {
      // 1. Create Razorpay order
      const orderRes = await api.post("/sbt/hotels/payment/create-order", {
        amount: totalFare,
        currency: "INR",
        receipt: `sbt_htl_${Date.now()}`,
      });

      if (!orderRes?.orderId) {
        setError("Failed to create payment order");
        setLoading(false);
        return;
      }

      // 2. Open Razorpay
      const leadGuest = guests.find((g: any) => g.LeadPassenger);
      const rzp = new window.Razorpay({
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        order_id: orderRes.orderId,
        name: "PlumTrips",
        description: `Hotel: ${hotelName} - ${roomName}`,
        handler: async (response: any) => {
          try {
            // 3. Verify payment
            await api.post("/sbt/hotels/payment/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // 4. Book on TBO
            const bookRes = await api.post("/sbt/hotels/book", {
              BookingCode: bookingCode,
              GuestNationality: searchParams?.GuestNationality || "IN",
              NetAmount: totalFare,
              Guests: guests,
              UserIp: "1.1.1.1",
              PaymentId: response.razorpay_payment_id,
            });

            // 5. Save to MongoDB
            console.log('[TBO Hotel Book Response]', JSON.stringify(bookRes, null, 2));

            const tboBookingId = bookRes?.BookingId || bookRes?.HotelBookingId || "";
            const tboConfirmationNo = bookRes?.ConfirmationNo || bookRes?.BookingRefNo || "";

            const commonSaveData = {
              bookingId: tboBookingId,
              confirmationNo: tboConfirmationNo,
              bookingRefNo: bookRes?.BookingRefNo || "",
              hotelCode: hotel.hotelCode || hotel.HotelCode || "",
              hotelName,
              cityName,
              checkIn,
              checkOut,
              rooms: (searchParams?.Rooms || searchParams?.rooms || []).length || 1,
              guests: guests.map((g: any) => ({
                Title: g.Title,
                FirstName: g.FirstName,
                LastName: g.LastName,
                PaxType: g.PaxType,
                LeadPassenger: g.LeadPassenger,
              })),
              roomName,
              mealType,
              totalFare,
              netAmount: totalFare,
              currency: "INR",
              isRefundable,
              cancelPolicies,
              paymentStatus: "paid",
              paymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayAmount: totalFare,
              isVouchered: true,
              ...(state?.sbtRequest?._id ? { sbtRequestId: state.sbtRequest._id } : {}),
            };

            // Validate TBO response has a real BookingId
            if (!tboBookingId) {
              await api.post("/sbt/hotels/bookings/save", {
                ...commonSaveData,
                status: "FAILED",
                failureReason: "TBO booking failed after payment. Refund will be processed.",
              });

              setLoading(false);
              navigate("/sbt/hotels/bookings", {
                state: {
                  error: true,
                  paymentId: response.razorpay_payment_id,
                  amount: totalFare,
                },
              });
              return;
            }

            const tboStatus = (bookRes?.HotelBookingStatus || "").toLowerCase();
            const bookingStatus =
              tboStatus === "confirmed" ? "CONFIRMED" :
              tboStatus === "cancelled" ? "CANCELLED" :
              tboStatus === "failed" ? "FAILED" :
              "PENDING";

            await api.post("/sbt/hotels/bookings/save", {
              ...commonSaveData,
              status: bookingStatus,
            });

            // 6. Navigate to confirmed (or inbox if booking on behalf)
            if (state?.sbtRequest) {
              navigate("/sbt/inbox", { replace: true });
            } else {
              navigate("/sbt/hotels/book/confirmed", {
                state: {
                  hotel, room, guests, searchParams,
                  bookingResult: bookRes,
                  totalFare, totalTax,
                  paymentId: response.razorpay_payment_id,
                },
              });
            }
          } catch (e: any) {
            setError(e?.message || "Booking failed after payment. Contact support.");
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => { setLoading(false); },
        },
        prefill: {
          email: leadGuest?.Email || "",
          contact: leadGuest?.Phone || "",
        },
        theme: { color: "#004A8C" },
      });
      rzp.open();
    } catch (e: any) {
      setError(e?.message || "Payment initiation failed");
      setLoading(false);
    }
  }

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
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>
              {cityName} · {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: T.gold, fontSize: 18, fontWeight: 800, margin: 0 }}>₹{totalFare.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 100px" }}>
        <StepBar step={2} />

        {/* Hotel summary */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Hotel Summary</span>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏨</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: "0 0 4px" }}>{hotelName}</p>
              <Stars n={starRating} />
              <p style={{ fontSize: 12, color: T.inkMid, margin: "6px 0 0" }}>{cityName}</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 16, background: T.surface, borderRadius: 12, padding: "12px 16px" }}>
            {[
              { label: "Check-in", value: fmtDate(checkIn) },
              { label: "Check-out", value: fmtDate(checkOut) },
              { label: "Duration", value: `${nights} Night${nights > 1 ? "s" : ""}` },
              { label: "Room", value: roomName },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>{item.label}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: T.ink, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              background: `${T.gold}18`, color: T.goldDim,
            }}>{mealType}</span>
          </div>
        </div>

        {/* Guest manifest */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Guests ({guests.length})</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {guests.map((g: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.surface, borderRadius: 10 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                    {g.Title} {g.FirstName} {g.LastName}
                    {g.LeadPassenger && <span style={{ marginLeft: 8, fontSize: 10, background: `${T.gold}20`, color: T.gold, padding: "2px 8px", borderRadius: 20 }}>Lead</span>}
                  </p>
                  <p style={{ fontSize: 11, color: T.inkFaint, margin: "2px 0 0" }}>
                    {g.PaxType === 1 ? "Adult" : `Child (${g.Age} yrs)`}
                    {g.LeadPassenger && g.Phone ? ` · ${g.Phone}` : ""}
                  </p>
                </div>
                {g.LeadPassenger && g.Email && <span style={{ fontSize: 11, color: T.inkMid }}>✉ {g.Email}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Price Breakdown</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.inkMid }}>Base Fare</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>₹{baseFare.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.inkMid }}>Taxes & Fees</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>₹{totalTax.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ height: 1, background: T.cardBorder, margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>₹{totalFare.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Cancellation policy */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Cancellation Policy</span>
          {(() => {
            const validPolicies = cancelPolicies.filter((p: any) =>
              !p.FromDate || isCancelDateValid(p.FromDate, checkOut)
            );
            if (validPolicies.length > 0) return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {validPolicies.map((p: any, i: number) => (
                  <div key={i} style={{ padding: "10px 14px", background: T.surface, borderRadius: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.ink, margin: "0 0 4px" }}>
                      {p.ChargeType === "Fixed"
                        ? `₹${p.CancellationCharge?.toLocaleString("en-IN") || 0} cancellation charge`
                        : `${p.CancellationCharge || 0}% cancellation charge`}
                    </p>
                    {p.FromDate && (
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: 0 }}>
                        From {formatCancelDate(p.FromDate)}{p.ToDate ? ` to ${formatCancelDate(p.ToDate)}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
            if (cancelPolicies.length > 0) return (
              <div style={{ padding: "10px 14px", background: T.surface, borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: T.inkMid, margin: 0 }}>
                  Cancellation policy details unavailable. Please contact support before cancelling.
                </p>
              </div>
            );
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: isRefundable ? `${T.emerald}12` : `${T.amber}12`, borderRadius: 8 }}>
                <span style={{ fontSize: 13 }}>{isRefundable ? "✓" : "⚠"}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: isRefundable ? T.emerald : T.amber }}>
                  {isRefundable ? "Free cancellation available" : "Non-refundable rate"}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Rate conditions */}
        {rateConditions.length > 0 && (
          <div style={cardStyle}>
            <button
              onClick={() => setRateExpanded(!rateExpanded)}
              style={{
                width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Rate Conditions</span>
              <span style={{ fontSize: 12, color: T.inkFaint }}>{rateExpanded ? "▲" : "▼"}</span>
            </button>
            {rateExpanded && (
              <div style={{ marginTop: 12, fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>
                {rateConditions.map((rc: string, i: number) => (
                  <p key={i} style={{ margin: "0 0 6px" }}>• {rc}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Supplements */}
        {supplements.length > 0 && (
          <div style={{
            ...cardStyle,
            background: `${T.amber}08`, border: `1.5px solid ${T.amber}30`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.amber, display: "block", marginBottom: 10 }}>
              ⚠ Charges at Property
            </span>
            {supplements.map((s: any, i: number) => (
              <p key={i} style={{ fontSize: 12, color: T.inkMid, margin: "0 0 4px" }}>
                • {s.Type || s.Description || JSON.stringify(s)}: {s.Price ? `₹${s.Price}` : ""}
              </p>
            ))}
          </div>
        )}

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
            onClick={handlePayment}
            disabled={loading}
            style={{
              background: loading ? T.inkFaint : T.gold, color: T.obsidian, border: "none",
              borderRadius: 12, padding: "14px 40px", fontWeight: 800, fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : `0 4px 20px ${T.gold}40`,
              letterSpacing: "0.03em",
            }}
          >
            {loading ? "Processing…" : `Pay ₹${totalFare.toLocaleString("en-IN")} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
