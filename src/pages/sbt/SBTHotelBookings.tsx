import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import jsPDF from "jspdf";

function Stars({ n }: { n: number }) {
  return (
    <span>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, color: i < n ? '#f59e0b' : '#e2e8f0' }}>★</span>
      ))}
    </span>
  );
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 1;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function statusColor(s: string): string {
  switch (s) {
    case "CONFIRMED": return '#00b67a';
    case "CANCELLED": return '#ef4444';
    case "FAILED": return '#ef4444';
    case "PENDING": return '#f59e0b';
    default: return '#64748b';
  }
}

function generateVoucherPDF(b: any): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 20;

  // Header
  doc.setFillColor(0, 71, 127);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PlumTrips', 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 255);
  doc.text('Hotel Booking Voucher', 14, 24);

  y = 42;

  // References
  const refs: [string, string][] = [
    ['BOOKING ID', String(b.bookingId || '\u2014')],
    ['CONFIRMATION NO', String(b.confirmationNo || '\u2014')],
    ['STATUS', String(b.status || '\u2014')],
  ];
  refs.forEach(([label, value], i) => {
    const x = 14 + i * 62;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x, y + 6);
  });

  y += 20;
  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, W - 14, y);
  y += 10;

  // Hotel details
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(b.hotelName || 'Hotel', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(b.cityName || '', 14, y);
  y += 12;

  // Stay grid
  const nights = nightsBetween(b.checkIn, b.checkOut);
  const stay: [string, string][] = [
    ['CHECK-IN', fmtDate(b.checkIn)],
    ['CHECK-OUT', fmtDate(b.checkOut)],
    ['DURATION', `${nights} night${nights > 1 ? 's' : ''}`],
    ['ROOM', b.roomName || '\u2014'],
  ];
  stay.forEach(([label, value], i) => {
    const x = 14 + i * 46;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const lines = doc.splitTextToSize(value, 40);
    doc.text(lines, x, y + 5);
  });

  y += 20;
  doc.line(14, y, W - 14, y);
  y += 10;

  // Fare
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Total Paid', 14, y);
  doc.setTextColor(0, 71, 127);
  doc.text(
    `INR ${(b.totalFare || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    W - 14, y, { align: 'right' }
  );

  y += 14;
  doc.line(14, y, W - 14, y);
  y += 8;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated voucher. For support: support@plumtrips.com', 14, y);

  doc.save(`PlumTrips_Hotel_${b.confirmationNo || b.bookingId || 'Voucher'}.pdf`);
}

type Tab = "ALL" | "CONFIRMED" | "CANCELLED" | "FAILED";

export default function SBTHotelBookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const navError = (location.state as any)?.error;
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("ALL");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/sbt/hotels/bookings");
        const list = data?.bookings || [];
        setBookings(list);

        // Auto-sync any pending bookings
        const hasPending = list.some((b: any) => b.status === "PENDING");
        if (hasPending) {
          setSyncing(true);
          try {
            const syncRes = await api.post("/sbt/hotels/bookings/sync-all-pending", {});
            if (syncRes?.updated > 0) {
              const refreshed = await api.get("/sbt/hotels/bookings");
              setBookings(refreshed?.bookings || list);
            }
          } catch {
            // silently fail — don't block the page
          } finally {
            setSyncing(false);
          }
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = tab === "ALL" ? bookings : bookings.filter((b) => b.status === tab);

  const tabCounts: Record<Tab, number> = {
    ALL: bookings.length,
    CONFIRMED: bookings.filter((b) => b.status === "CONFIRMED").length,
    CANCELLED: bookings.filter((b) => b.status === "CANCELLED").length,
    FAILED: bookings.filter((b) => b.status === "FAILED").length,
  };

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await api.post(`/sbt/hotels/bookings/${id}/cancel`, {});
      setBookings((prev) =>
        prev.map((b) => (b._id === id ? { ...b, status: "CANCELLED" } : b))
      );
    } catch {
      // silently fail
    } finally {
      setCancellingId(null);
      setCancelConfirm(null);
    }
  }

  function downloadVoucher(b: any) {
    generateVoucherPDF(b);
  }

  return (
    <div style={{ minHeight: "100vh", background: '#f1f5f9', fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '2px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏨</span>
              <span style={{ color: '#0f172a', fontSize: 20, fontWeight: 800 }}>My Hotel Bookings</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => navigate("/sbt/hotels")}
                style={{
                  background: '#00477f', color: '#ffffff', border: 'none', borderRadius: 10,
                  padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,71,127,0.2)',
                }}
              >
                Book Hotel
              </button>
              <button
                onClick={() => navigate("/sbt/flights/bookings")}
                style={{
                  background: '#ffffff', color: '#00477f', border: '2px solid #00477f',
                  borderRadius: 10, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Flight Bookings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 80px" }}>
        {navError && (
          <div style={{
            background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12,
            padding: '16px 20px', marginBottom: 20, fontSize: 14, color: '#dc2626', fontWeight: 600,
          }}>
            Your payment was received but the hotel booking could not be confirmed.
            {(location.state as any)?.paymentId && (
              <> Payment ID: <strong>{(location.state as any).paymentId}</strong>.</>
            )}
            {(location.state as any)?.amount && (
              <> A refund of <strong>{"\u20B9"}{(location.state as any).amount.toLocaleString("en-IN")}</strong> will be processed within 5–7 business days.</>
            )}
            {" "}Contact{" "}
            <a href="mailto:support@plumtrips.com" style={{ color: '#dc2626', fontWeight: 700 }}>
              support@plumtrips.com
            </a>{" "}for help.
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12,
          border: '1.5px solid #e2e8f0', padding: 4, marginBottom: 24, width: 'fit-content',
        }}>
          {(["ALL", "CONFIRMED", "CANCELLED", "FAILED"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px", borderRadius: 9, border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: tab === t ? '#00477f' : "transparent",
                color: tab === t ? '#ffffff' : '#64748b',
              }}
            >
              {t} {tabCounts[t] > 0 && <span style={{ marginLeft: 4, fontSize: 11, opacity: 1 }}>({tabCounts[t]})</span>}
            </button>
          ))}
        </div>

        {syncing && (
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
            padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #bfdbfe', borderTopColor: '#00477f',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>Syncing booking status with hotel provider…</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              border: '3px solid #e2e8f0', borderTopColor: '#00477f',
              animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
            }} />
            <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>Loading bookings…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: '#ffffff', border: '2px solid #e2e8f0', borderRadius: 20,
            padding: '80px 24px', textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.25 }}>🏨</div>
            <p style={{ color: '#475569', fontSize: 16, fontWeight: 500, marginBottom: 16 }}>No hotel bookings found.</p>
            <button onClick={() => navigate("/sbt/hotels")}
              style={{ background: '#00477f', color: '#ffffff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 12px rgba(0,71,127,0.25)' }}>
              Book a Hotel
            </button>
          </div>
        ) : (
          filtered.map((b) => {
            const nights = nightsBetween(b.checkIn, b.checkOut);
            const sc = statusColor(b.status);

            return (
              <div key={b._id} style={{
                background: '#ffffff', border: '2px solid #e2e8f0', borderRadius: 20,
                padding: '20px 24px', marginBottom: 14,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)', transition: 'box-shadow 0.2s',
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>{b.hotelName}</p>
                      <Stars n={b.starRating || 0} />
                      <span style={{
                        fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8,
                        background: `${sc}14`, color: sc,
                      }}>{b.status}</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#475569', fontWeight: 500, margin: "0 0 8px" }}>
                      {b.cityName} · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {nights} night{nights > 1 ? "s" : ""}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {b.roomName && (
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                          {b.roomName}
                        </span>
                      )}
                      {b.mealType && (
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8 }}>
                          {b.mealType}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                      {b.bookingId && <span>Booking ID: <strong style={{ color: '#0f172a', fontWeight: 700 }}>{b.bookingId}</strong></span>}
                      {b.confirmationNo && <span>Conf: <strong style={{ color: '#0f172a', fontWeight: 700 }}>{b.confirmationNo}</strong></span>}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 22, fontWeight: 900, color: '#00477f', margin: "0 0 8px" }}>
                      ₹{(b.totalFare || 0).toLocaleString("en-IN")}
                    </p>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {b.status === "CONFIRMED" && (
                        <>
                          <button
                            onClick={() => downloadVoucher(b)}
                            style={{
                              background: '#00477f', color: '#ffffff', border: 'none', borderRadius: 8,
                              padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,71,127,0.2)',
                            }}
                          >
                            Download Voucher
                          </button>
                          {cancelConfirm === b._id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => handleCancel(b._id)}
                                disabled={cancellingId === b._id}
                                style={{
                                  background: '#ffffff', color: '#ef4444', border: '2px solid #ef4444', borderRadius: 8,
                                  padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                {cancellingId === b._id ? "…" : "Confirm"}
                              </button>
                              <button
                                onClick={() => setCancelConfirm(null)}
                                style={{
                                  background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 8,
                                  padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#64748b',
                                }}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCancelConfirm(b._id)}
                              style={{
                                background: 'none', border: '2px solid #ef4444', borderRadius: 8,
                                padding: '8px 14px', fontWeight: 700, fontSize: 12, color: '#ef4444', cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </>
                      )}
                      {b.status === "FAILED" && (
                        <button
                          onClick={() => window.location.href = `mailto:support@plumtrips.com?subject=Failed Hotel Booking ${b.paymentId || b._id}&body=Payment ID: ${b.paymentId || "N/A"}%0AHotel: ${b.hotelName}%0AAmount: ${b.totalFare}`}
                          style={{
                            background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 8,
                            padding: '8px 14px', fontWeight: 600, fontSize: 12, color: '#64748b', cursor: 'pointer',
                          }}
                        >
                          Contact Support
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {b.status === "FAILED" && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px', background: '#fef2f2',
                    border: '1px solid #fecaca', borderRadius: 10, fontSize: 13,
                    color: '#dc2626', fontWeight: 500,
                  }}>
                    Booking failed after payment.
                    {b.paymentId && (
                      <span> Payment ID: <strong>{b.paymentId}</strong>.</span>
                    )}
                    {" "}Refund will be processed within 5–7 business days.
                    Contact{" "}
                    <a href="mailto:support@plumtrips.com" style={{ color: '#dc2626', fontWeight: 700 }}>
                      support@plumtrips.com
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
