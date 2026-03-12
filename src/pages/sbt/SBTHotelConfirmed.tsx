import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { T } from "../../components/sbt/FlightResultCard";

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

export default function SBTHotelConfirmed() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  if (!state?.hotel) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>🏨</div>
          <p style={{ color: T.inkMid, marginBottom: 16, fontSize: 14 }}>No booking data found.</p>
          <button onClick={() => navigate("/sbt/hotels")}
            style={{ background: T.gold, color: T.obsidian, border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Search Hotels
          </button>
        </div>
      </div>
    );
  }

  const { hotel, room, guests, searchParams, bookingResult, totalFare, totalTax, paymentId } = state;
  const hotelName = hotel.hotelName || hotel.HotelName || "Hotel";
  const starRating = hotel.starRating ?? hotel.StarRating ?? 0;
  const cityName = hotel.cityName || searchParams?.CityName || "";
  const checkIn = searchParams?.CheckIn || hotel.checkIn || "";
  const checkOut = searchParams?.CheckOut || hotel.checkOut || "";
  const nights = nightsBetween(checkIn, checkOut);
  const roomName = room?.name || room?.Name?.[0] || room?.RoomTypeName || "Room";
  const mealType = room?.mealType || room?.MealType || "Room Only";
  const isRefundable = room?.isRefundable ?? false;
  const cancelPolicies = room?.cancelPolicies || [];

  const bookingId = bookingResult?.BookingId || "";
  const confirmationNo = bookingResult?.ConfirmationNo || "";
  const bookingRefNo = bookingResult?.BookingRefNo || "";

  function downloadVoucher() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    let y = 20;

    // ── Header ──
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("PlumTrips", 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 180);
    doc.text("Hotel Booking Voucher", 14, 24);

    y = 42;

    // ── Booking References ──
    const refs: [string, string][] = [
      ["BOOKING ID", bookingId || "\u2014"],
      ["CONFIRMATION NO", confirmationNo || "\u2014"],
      ["BOOKING REF", bookingRefNo || "\u2014"],
      ["BOOKED ON", new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
    ];
    refs.forEach(([label, value], i) => {
      const x = 14 + i * 48;
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.text(label, x, y);
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), x, y + 6);
    });

    y += 22;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, W - 14, y);
    y += 10;

    // ── Hotel Details ──
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(hotelName, 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(212, 175, 55);
    doc.text("\u2605".repeat(starRating) + "\u2606".repeat(5 - starRating), 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (cityName) { doc.text(cityName, 14, y); y += 5; }
    const address = hotel.address || hotel.Address || "";
    if (address) {
      const addrLines = doc.splitTextToSize(address, W - 28);
      doc.text(addrLines, 14, y);
      y += addrLines.length * 4.5;
    }
    y += 6;

    // ── Stay Details Grid ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Stay Details", 14, y);
    y += 8;
    const stay: [string, string][] = [
      ["CHECK-IN", fmtDate(checkIn)],
      ["CHECK-OUT", fmtDate(checkOut)],
      ["DURATION", `${nights} Night${nights > 1 ? "s" : ""}`],
      ["ROOM", roomName],
    ];
    stay.forEach(([label, value], i) => {
      const x = 14 + i * 46;
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.text(label, x, y);
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(String(value), 40);
      doc.text(lines, x, y + 5);
    });

    y += 18;
    // Meal type row
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("MEAL PLAN", 14, y);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(mealType, 14, y + 5);

    y += 16;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, W - 14, y);
    y += 10;

    // ── Guests ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Guests", 14, y);
    y += 7;
    const guestList: any[] = guests || [];
    guestList.forEach((g: any) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const name = `${g.Title || ""} ${g.FirstName || ""} ${g.LastName || ""}`.trim();
      const type = g.PaxType === 1 ? "Adult" : "Child";
      const lead = g.LeadPassenger ? "  (Lead Guest)" : "";
      doc.text(`${name}  -  ${type}${lead}`, 18, y);
      y += 6;
    });

    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, W - 14, y);
    y += 10;

    // ── Fare Summary ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Fare Summary", 14, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Total Paid", 14, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(12);
    const fareStr = `INR ${Number(totalFare || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    doc.text(fareStr, W - 14, y, { align: "right" });

    if (paymentId) {
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Payment ID: ${paymentId}`, 14, y);
    }

    y += 12;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, W - 14, y);
    y += 10;

    // ── Footer ──
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "normal");
    doc.text("This is a computer-generated voucher. Present this at the hotel during check-in.", 14, y);
    y += 5;
    doc.text("PlumTrips  |  support@plumtrips.com", 14, y);

    // ── Save ──
    doc.save(`PlumTrips_Hotel_${confirmationNo || bookingId || Date.now()}.pdf`);
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff", border: `1.5px solid ${T.cardBorder}`,
    borderRadius: 16, padding: "20px 24px", marginBottom: 18,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16,
    paddingBottom: 10, borderBottom: `1px solid ${T.cardBorder}`, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{
        background: T.obsidian, padding: "0 28px", height: 60, display: "flex", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏨</div>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Hotel Booking Confirmed</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 80px" }}>
        {/* Success banner */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: `${T.emerald}14`, border: `3px solid ${T.emerald}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, margin: "0 auto 20px",
          }}>✓</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: "0 0 8px" }}>CONFIRMED</h1>
          <p style={{ fontSize: 14, color: T.inkMid, margin: 0 }}>
            Your hotel booking has been confirmed successfully
          </p>
        </div>

        {/* Reference bar */}
        {(bookingId || confirmationNo || bookingRefNo) && (
          <div style={{
            background: "#EFF6FF", border: `1.5px solid #BFDBFE`, borderRadius: 14,
            padding: "16px 24px", marginBottom: 20,
            display: "flex", gap: 32, flexWrap: "wrap",
          }}>
            {bookingId && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>Booking ID</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: T.obsidian, margin: 0 }}>{bookingId}</p>
              </div>
            )}
            {confirmationNo && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>Confirmation No</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: T.gold, margin: 0 }}>{confirmationNo}</p>
              </div>
            )}
            {bookingRefNo && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 2px" }}>Booking Ref</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: T.obsidian, margin: 0 }}>{bookingRefNo}</p>
              </div>
            )}
          </div>
        )}

        {/* Hotel details */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Hotel Details</span>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏨</div>
            <div>
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
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: `${T.gold}18`, color: T.goldDim }}>{mealType}</span>
          </div>
        </div>

        {/* Guest manifest */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Guests</span>
          {(guests || []).map((g: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: T.surface, borderRadius: 10, marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                  {g.Title} {g.FirstName} {g.LastName}
                  {g.LeadPassenger && <span style={{ marginLeft: 8, fontSize: 10, background: `${T.gold}20`, color: T.gold, padding: "2px 8px", borderRadius: 20 }}>Lead</span>}
                </p>
                <p style={{ fontSize: 11, color: T.inkFaint, margin: "2px 0 0" }}>
                  {g.PaxType === 1 ? "Adult" : `Child`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Fare */}
        <div style={cardStyle}>
          <span style={sectionTitle}>Fare Summary</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Total Paid</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: T.gold }}>₹{(totalFare || 0).toLocaleString("en-IN")}</span>
          </div>
          {paymentId && (
            <p style={{ fontSize: 11, color: T.inkFaint, margin: 0 }}>Payment ID: {paymentId}</p>
          )}
        </div>

        {/* Cancellation policy */}
        {(cancelPolicies.length > 0 || isRefundable) && (
          <div style={cardStyle}>
            <span style={sectionTitle}>Cancellation Policy</span>
            {(() => {
              const validPolicies = cancelPolicies.filter((p: any) =>
                !p.FromDate || isCancelDateValid(p.FromDate, checkOut)
              );
              if (validPolicies.length > 0) return validPolicies.map((p: any, i: number) => (
                <div key={i} style={{ padding: "8px 12px", background: T.surface, borderRadius: 8, marginBottom: 6 }}>
                  <p style={{ fontSize: 12, color: T.ink, margin: 0 }}>
                    {p.ChargeType === "Fixed"
                      ? `₹${p.CancellationCharge?.toLocaleString("en-IN") || 0} charge`
                      : `${p.CancellationCharge || 0}% charge`}
                    {p.FromDate ? ` from ${formatCancelDate(p.FromDate)}` : ""}
                  </p>
                </div>
              ));
              if (cancelPolicies.length > 0) return (
                <p style={{ fontSize: 12, color: T.inkMid, margin: 0 }}>
                  Cancellation policy details unavailable. Please contact support before cancelling.
                </p>
              );
              return <p style={{ fontSize: 12, color: T.emerald, margin: 0 }}>Free cancellation available</p>;
            })()}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={downloadVoucher}
            style={{
              background: T.gold, color: T.obsidian, border: "none", borderRadius: 12,
              padding: "13px 28px", fontWeight: 800, fontSize: 13, cursor: "pointer",
              boxShadow: `0 4px 16px ${T.gold}40`,
            }}
          >
            Download Voucher
          </button>
          <button
            onClick={() => navigate("/sbt/hotels")}
            style={{
              background: T.obsidian, color: "#fff", border: "none", borderRadius: 12,
              padding: "13px 28px", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Book Another Hotel
          </button>
          <button
            onClick={() => navigate("/sbt/hotels/bookings")}
            style={{
              background: "none", border: `1.5px solid ${T.cardBorder}`, borderRadius: 12,
              padding: "13px 28px", fontWeight: 600, fontSize: 13, color: T.inkMid, cursor: "pointer",
            }}
          >
            View My Bookings
          </button>
        </div>
      </div>
    </div>
  );
}
