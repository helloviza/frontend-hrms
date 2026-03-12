import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { T } from "../../components/sbt/FlightResultCard";

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ fontSize: size, color: i < n ? T.gold : T.cardBorder }}>★</span>
      ))}
    </span>
  );
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Parse TBO date strings like "09-03-2026 00:00:00" (DD-MM-YYYY) or ISO */
function parseCancelDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Try DD-MM-YYYY HH:mm:ss format first
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
  if (isNaN(checkout.getTime())) return true; // no checkout to compare — show it
  if (cancel > checkout) return false;
  return true;
}

function formatCancelDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  const d = parseCancelDate(dateStr);
  if (!d) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function SBTHotelDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);

  const hotel = state?.hotel;
  const searchParams = state?.searchParams;

  useEffect(() => {
    if (!hotel?.hotelCode && !hotel?.HotelCode) return;
    (async () => {
      try {
        const code = hotel.hotelCode || hotel.HotelCode;
        const data = await api.get(`/sbt/hotels/details?hotelCodes=${code}`);
        setDetails(data?.HotelDetails?.[0] || data?.Hotels?.[0] || data);
      } catch {
        // No details available
      } finally {
        setLoading(false);
      }
    })();
  }, [hotel]);

  if (!hotel) {
    return (
      <div style={{ minHeight: "100vh", background: T.canvas, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  const hotelName = hotel.hotelName || hotel.HotelName || "Hotel";
  const starRating = hotel.starRating ?? hotel.StarRating ?? 0;
  const address = hotel.address || hotel.HotelAddress || hotel.Address || "";
  const cityName = hotel.cityName || searchParams?.CityName || "";
  const images: string[] = details?.Images || hotel.images || [];
  const amenities: string[] = details?.HotelFacilities || hotel.amenities || [];
  const description = details?.HotelDescription || details?.Description || "";

  // Rooms from the search result
  const rooms: any[] = hotel.Rooms || hotel.rooms || [];

  return (
    <div style={{ minHeight: "100vh", background: T.canvas, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{
        background: T.obsidian, padding: "0 28px", height: 60, display: "flex",
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 22, padding: 0 }}>←</button>
          <div>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0 }}>{hotelName}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: 0 }}>
              {cityName}{searchParams?.CheckIn ? ` · ${fmtDate(searchParams.CheckIn)} → ${fmtDate(searchParams.CheckOut)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* Hotel info header */}
        <div style={{
          background: "#fff", border: `1.5px solid ${T.cardBorder}`, borderRadius: 16,
          padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: "0 0 6px" }}>{hotelName}</h1>
              <Stars n={starRating} size={14} />
              {address && <p style={{ fontSize: 13, color: T.inkMid, margin: "8px 0 0" }}>📍 {address}</p>}
            </div>
          </div>

          {/* Image gallery */}
          {images.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                height: 300, borderRadius: 12, overflow: "hidden", position: "relative",
                background: `linear-gradient(135deg, ${T.obsidian}22, ${T.gold}22)`,
              }}>
                <img
                  src={images[imgIdx]}
                  alt={hotelName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                      style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>‹</button>
                    <button onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>›</button>
                    <div style={{ position: "absolute", bottom: 10, right: 14, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
              {amenities.slice(0, 12).map((a, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px",
                  background: T.surface, color: T.inkMid,
                  border: `1px solid ${T.cardBorder}`, borderRadius: 20,
                }}>{a}</span>
              ))}
              {amenities.length > 12 && (
                <span style={{ fontSize: 11, padding: "4px 10px", background: T.surface, color: T.inkFaint, border: `1px solid ${T.cardBorder}`, borderRadius: 20 }}>
                  +{amenities.length - 12} more
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <p style={{ fontSize: 13, color: T.inkMid, margin: "16px 0 0", lineHeight: 1.7 }}>
              {description.length > 400 ? description.slice(0, 400) + "…" : description}
            </p>
          )}
        </div>

        {/* Rooms list */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: "0 0 14px" }}>
          Available Rooms {rooms.length > 0 && `(${rooms.length})`}
        </h2>

        {loading && !rooms.length ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              border: `3px solid rgba(201,169,110,0.2)`, borderTopColor: T.gold,
              animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }} />
            <p style={{ color: T.inkMid, fontSize: 13 }}>Loading room details…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ background: "#fff", border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
            <p style={{ color: T.inkMid, fontSize: 14 }}>No room details available. Please go back and try again.</p>
          </div>
        ) : (
          rooms.map((room: any, ri: number) => {
            const roomName = room.Name?.[0] || room.RoomTypeName || room.name || `Room ${ri + 1}`;
            const mealType = room.MealType || room.mealType || "Room Only";
            const totalFare = room.TotalFare ?? room.totalFare ?? 0;
            const totalTax = room.TotalTax ?? room.totalTax ?? 0;
            const isRefundable = room.IsRefundable ?? room.isRefundable ?? false;
            const bookingCode = room.BookingCode || room.bookingCode || "";
            const cancellation = room.CancelPolicies || room.cancelPolicies || [];
            const inclusions = room.Inclusion || room.inclusions || [];

            return (
              <div key={ri} style={{
                background: "#fff", border: `1.5px solid ${T.cardBorder}`, borderRadius: 16,
                padding: "18px 22px", marginBottom: 12,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: "0 0 6px" }}>{roomName}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: `${T.gold}18`, color: T.goldDim,
                    }}>{mealType}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: isRefundable ? `${T.emerald}14` : `${T.rose}14`,
                      color: isRefundable ? T.emerald : T.rose,
                    }}>
                      {isRefundable ? "Free Cancellation" : "Non-refundable"}
                    </span>
                  </div>
                  {(() => {
                    const coDate = searchParams?.CheckOut || "";
                    const valid = cancellation.filter((p: any) =>
                      !p.FromDate || isCancelDateValid(p.FromDate, coDate)
                    );
                    if (valid.length === 0 && cancellation.length > 0) return (
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: "0 0 4px" }}>
                        Cancellation policy details unavailable. Please contact support before cancelling.
                      </p>
                    );
                    if (valid.length === 0) return null;
                    const p = valid[0];
                    return (
                      <p style={{ fontSize: 11, color: T.inkFaint, margin: "0 0 4px" }}>
                        Cancel policy: {p.ChargeType === "Fixed"
                          ? `₹${p.CancellationCharge || 0} charge`
                          : `${p.CancellationCharge || 0}% charge`}
                        {p.FromDate ? ` from ${formatCancelDate(p.FromDate)}` : ""}
                      </p>
                    );
                  })()}
                  {inclusions && (Array.isArray(inclusions) ? inclusions.length > 0 : typeof inclusions === "string" && inclusions.trim()) && (
                    <p style={{ fontSize: 11, color: T.emerald, margin: 0 }}>
                      Includes: {Array.isArray(inclusions) ? inclusions.slice(0, 3).join(", ") : inclusions}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: T.gold, margin: "0 0 2px" }}>
                    ₹{totalFare.toLocaleString("en-IN")}
                  </p>
                  {totalTax > 0 && (
                    <p style={{ fontSize: 10, color: T.inkFaint, margin: "0 0 8px" }}>incl. ₹{totalTax.toLocaleString("en-IN")} tax</p>
                  )}
                  <button
                    onClick={() => navigate("/sbt/hotels/book/guests", {
                      state: {
                        hotel,
                        room: { ...room, BookingCode: bookingCode, name: roomName, mealType, totalFare, totalTax, isRefundable, cancelPolicies: cancellation },
                        searchParams,
                        ...(state?.sbtRequest ? { sbtRequest: state.sbtRequest } : {}),
                      },
                    })}
                    style={{
                      background: T.obsidian, color: "#fff", border: "none", borderRadius: 10,
                      padding: "9px 20px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Select Room →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
