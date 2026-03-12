import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { SBTFlight, T, AirlineLogo, formatTime, formatDur, formatDateShort } from "../../components/sbt/FlightResultCard";
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

interface BaggageOption { code: string; description: string; weight: string; price: number; }
interface MealOption { code: string; description: string; airlineDescription?: string; price: number; }

interface ReviewState {
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
  selectedBaggage: Record<number, BaggageOption>;
  selectedMeals: Record<number, MealOption>;
  extras: { seats: number; baggage: number; meals: number };
}

const CABIN_MAP: Record<number, string> = { 1: "All", 2: "Economy", 3: "Prem Economy", 4: "Business", 5: "Prem Business", 6: "First" };

/* ── Styles ─────────────────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  background: '#ffffff', border: '2px solid #e2e8f0',
  borderRadius: 20, padding: '24px 28px', marginBottom: 16,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
};
const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 800, color: '#0f172a',
  marginBottom: 16, paddingBottom: 12,
  borderBottom: '2px solid #e2e8f0',
  display: "flex", alignItems: "center", justifyContent: "space-between",
  textTransform: 'uppercase' as const, letterSpacing: '0.05em',
};
const editLink: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#00477f',
  textDecoration: 'underline', cursor: "pointer", background: "none", border: "none", padding: 0,
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SBTReview() {
  const { state } = useLocation() as { state: ReviewState | null };
  const navigate = useNavigate();

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [heldPNR, setHeldPNR] = useState<string | null>(null);
  const [heldBookingId, setHeldBookingId] = useState<number | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<"idle" | "paying" | "paid" | "failed">("idle");

  // Load Razorpay script
  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Fare rules
  const [fareRules, setFareRules] = useState<any>(null);
  const [fareRulesLoading, setFareRulesLoading] = useState(false);
  const [fareRulesOpen, setFareRulesOpen] = useState(false);

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

  const {
    flight, traceId, origin, dest, pax, cabin, fareQuoteResult,
    priceChanged, newFare, passengers, contactInfo,
    selectedSeats, selectedBaggage, selectedMeals, extras,
  } = state;

  const sbtRequest = (state as any)?.sbtRequest;

  const seg = flight.Segments[0][0];
  const segLast = flight.Segments[0][flight.Segments[0].length - 1];
  const stops = flight.Segments[0].length - 1;

  const fqFare = fareQuoteResult?.Fare;
  const baseFare = Number(fqFare?.BaseFare ?? flight.Fare?.BaseFare ?? 0);
  const taxes = Number(fqFare?.Tax ?? flight.Fare?.Tax ?? 0);
  const totalFare = Number((fqFare?.PublishedFare ?? flight.Fare?.PublishedFare ?? (baseFare + taxes)) || 0);
  const extrasTotal = (extras?.seats ?? 0) + (extras?.baggage ?? 0) + (extras?.meals ?? 0);

  /* ── Persist booking to our DB ────────────────────────────────────── */
  interface PaymentData {
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
    razorpayAmount?: number;
    paymentStatus: "pending" | "paid" | "failed";
    paymentTimestamp?: string;
  }

  async function saveBookingToServer(
    bookingResult: { PNR: string; BookingId: string; TicketId: string },
    payment?: PaymentData,
  ) {
    const segFirst = flight.Segments[0][0];
    const segEnd = flight.Segments[0][flight.Segments[0].length - 1];
    const payload = {
      pnr: bookingResult.PNR,
      bookingId: String(bookingResult.BookingId),
      ticketId: bookingResult.TicketId,
      origin: origin,
      destination: dest,
      departureTime: segFirst.Origin.DepTime,
      arrivalTime: segEnd.Destination.ArrTime,
      airlineCode: segFirst.Airline.AirlineCode,
      airlineName: segFirst.Airline.AirlineName,
      flightNumber: segFirst.Airline.FlightNumber,
      cabin,
      passengers: passengers.map((p) => ({
        title: p.title, firstName: p.firstName, lastName: p.lastName,
        paxType: p.paxType, isLead: p.isLead,
      })),
      contactEmail: contactInfo.email,
      contactPhone: contactInfo.phone,
      baseFare,
      taxes,
      extras: extrasTotal,
      totalFare: (priceChanged && newFare ? newFare : totalFare) + extrasTotal,
      currency: fqFare?.Currency ?? "INR",
      isLCC: flight.IsLCC,
      ...(payment ?? {}),
      ...(sbtRequest?._id ? { sbtRequestId: sbtRequest._id } : {}),
    };
    try {
      await api.post("/sbt/flights/bookings/save", payload);
    } catch (err) {
      // Don't block navigation — TBO booking already confirmed
      // Silent retry after 3 seconds
      console.error("Booking save failed (attempt 1):", err);
      setTimeout(async () => {
        try {
          await api.post("/sbt/flights/bookings/save", payload);
        } catch (retryErr) {
          console.error("Booking save retry also failed:", retryErr);
        }
      }, 3000);
    }
  }

  /* ── Build TBO passengers ─────────────────────────────────────────── */
  function buildTBOPassengers() {
    const titleMap: Record<string, string> = { Mr: "Mr", Mrs: "Mrs", Ms: "Ms", Dr: "Mr", Master: "Master", Miss: "Miss" };
    return passengers.map((p, i) => ({
      Title: titleMap[p.title] ?? p.title,
      FirstName: p.firstName,
      LastName: p.lastName,
      PaxType: p.paxType === "adult" ? 1 : p.paxType === "child" ? 2 : 3,
      DateOfBirth: p.dob ? formatDOBForTBO(p.dob) : "",
      Gender: p.gender === "Female" ? 2 : 1,
      PassportNo: p.passportNo,
      PassportExpiry: p.passportExpiry,
      Nationality: p.nationality || "IN",
      AddressLine1: "India",
      AddressLine2: "",
      City: "India",
      CountryCode: p.nationality || "IN",
      CountryName: "India",
      ContactNo: p.isLead ? contactInfo.phone : "",
      Email: p.isLead ? contactInfo.email : "",
      IsLeadPax: p.isLead,
      Fare: fqFare ?? flight.Fare,
    }));
  }

  function formatDOBForTBO(dob: string): string {
    // Input: YYYY-MM-DD, Output: DD/MM/YYYY
    const [y, m, d] = dob.split("-");
    if (!y || !m || !d) return dob;
    return `${d}/${m}/${y}`;
  }

  /* ── Payment gate ────────────────────────────────────────────────── */
  async function handlePayment() {
    const grandTotal = (priceChanged && newFare ? newFare : totalFare) + extrasTotal;
    if (grandTotal <= 0) {
      // Zero-cost booking (unlikely but safe)
      confirmBooking();
      return;
    }

    setBooking(true);
    setError("");
    setPaymentStatus("paying");

    try {
      // 1. Create Razorpay order
      const orderRes = await api.post("/sbt/flights/payment/create-order", {
        amount: grandTotal,
        currency: fqFare?.Currency ?? "INR",
        receipt: `sbt_${traceId?.slice(0, 8) ?? Date.now()}`,
      });

      if (!orderRes?.orderId) {
        throw new Error(orderRes?.error || "Failed to create payment order");
      }

      // 2. Open Razorpay checkout
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        throw new Error("Payment gateway failed to load. Please refresh and try again.");
      }

      const rzp = new Razorpay({
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        order_id: orderRes.orderId,
        name: "PlumTrips",
        description: `Flight: ${origin.code} → ${dest.code}`,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            // 3. Verify payment
            const verifyRes = await api.post("/sbt/flights/payment/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (!verifyRes?.verified) {
              throw new Error("Payment verification failed");
            }

            setPaymentStatus("paid");
            // 4. Proceed to book + ticket (MUST await to catch errors)
            await confirmBooking({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayAmount: grandTotal,
              paymentStatus: "paid",
              paymentTimestamp: new Date().toISOString(),
            });
          } catch (err: unknown) {
            setPaymentStatus("failed");
            setBooking(false);
            setError(`Payment verified but failed: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus("idle");
            setBooking(false);
          },
        },
        prefill: {
          email: contactInfo.email,
          contact: contactInfo.phone,
        },
        theme: { color: "#004A8C" },
      });

      rzp.on("payment.failed", (response: any) => {
        setPaymentStatus("failed");
        setBooking(false);
        setError(`Payment failed: ${response?.error?.description || "Unknown error"}`);
        // Persist failed payment to DB (fire-and-forget)
        api.post("/sbt/flights/bookings/save", {
          pnr: "",
          bookingId: "",
          ticketId: "",
          status: "PENDING",
          origin,
          destination: dest,
          departureTime: flight.Segments[0][0].Origin.DepTime,
          arrivalTime: flight.Segments[0][flight.Segments[0].length - 1].Destination.ArrTime,
          airlineCode: flight.Segments[0][0].Airline.AirlineCode,
          airlineName: flight.Segments[0][0].Airline.AirlineName,
          flightNumber: flight.Segments[0][0].Airline.FlightNumber,
          cabin,
          passengers: passengers.map((p) => ({
            title: p.title, firstName: p.firstName, lastName: p.lastName,
            paxType: p.paxType, isLead: p.isLead,
          })),
          contactEmail: contactInfo.email,
          contactPhone: contactInfo.phone,
          baseFare,
          taxes,
          extras: extrasTotal,
          totalFare: grandTotal,
          currency: fqFare?.Currency ?? "INR",
          isLCC: flight.IsLCC,
          razorpayOrderId: orderRes.orderId,
          razorpayAmount: grandTotal,
          paymentStatus: "failed",
          paymentTimestamp: new Date().toISOString(),
        }).catch(() => {});
      });

      rzp.open();
    } catch (err: unknown) {
      setPaymentStatus("failed");
      setBooking(false);
      setError(err instanceof Error ? err.message : "Payment initiation failed");
    }
  }

  /* ── Booking logic (LCC vs Non-LCC) ──────────────────────────────── */
  async function confirmBooking(payment?: PaymentData) {
    setBooking(true);
    setError("");
    setHeldPNR(null);
    setHeldBookingId(null);

    try {
      const tboPassengers = buildTBOPassengers();
      const resultIndex = fareQuoteResult?.Response?.Results?.ResultIndex ?? flight.ResultIndex;

      const payload = {
        TraceId: traceId,
        ResultIndex: resultIndex,
        Passengers: tboPassengers,
        IsPriceChangeAccepted: priceChanged ?? false,
      };

      if (flight.IsLCC) {
        // LCC: direct ticket
        const result = await api.post("/sbt/flights/ticket-lcc", payload);

        // Unwrap TBO envelope: Response.Response or Response or top-level
        const resp = result?.Response?.Response ?? result?.Response ?? result;

        // Check for TBO error
        const tboError = result?.Response?.Error?.ErrorMessage || resp?.Error?.ErrorMessage;
        if (tboError && !resp?.BookingId && !resp?.FlightItinerary?.BookingId) {
          throw new Error(tboError);
        }

        // Extract from FlightItinerary (deepest) → resp (mid) → top-level
        const fi = resp?.FlightItinerary ?? {};
        const extractedPNR = fi.PNR || resp?.PNR || result?.Response?.PNR || "";
        const extractedBookingId = String(fi.BookingId ?? resp?.BookingId ?? result?.Response?.BookingId ?? "");
        const extractedTicketId = fi.Passenger?.[0]?.Ticket?.TicketId
          || resp?.TicketId
          || (extractedBookingId && extractedBookingId !== "" ? extractedBookingId : "");

        const lccBookingResult = {
          PNR: extractedPNR,
          BookingId: extractedBookingId,
          TicketId: extractedTicketId,
        };
        // Persist to backend (await before navigating)
        await saveBookingToServer(lccBookingResult, payment);
        if (sbtRequest) {
          navigate("/sbt/inbox", { replace: true });
        } else {
          navigate("/sbt/flights/book/confirmed", {
            replace: true,
            state: { ...state, bookingResult: lccBookingResult, pnr: extractedPNR, bookingId: extractedBookingId, ticketId: extractedTicketId },
          });
        }
      } else {
        // Non-LCC: Book → Ticket
        const bookResult = await api.post("/sbt/flights/book", payload);
        const bookResp = bookResult?.Response?.Response ?? bookResult;
        if (!bookResp?.BookingId) {
          throw new Error(bookResult?.Response?.Error?.ErrorMessage || "Booking failed");
        }

        setHeldPNR(bookResp.PNR);
        setHeldBookingId(bookResp.BookingId);

        try {
          const ticketResult = await api.post("/sbt/flights/ticket", {
            TraceId: traceId,
            PNR: bookResp.PNR,
            BookingId: bookResp.BookingId,
            Passengers: tboPassengers,
            IsPriceChangeAccepted: priceChanged ?? false,
          });
          const ticketResp = ticketResult?.Response?.Response ?? ticketResult?.Response ?? ticketResult;
          const tfi = ticketResp?.FlightItinerary ?? {};
          const gdsPNR = tfi.PNR || ticketResp?.PNR || bookResp.PNR || "";
          const gdsBookingId = String(tfi.BookingId ?? ticketResp?.BookingId ?? bookResp.BookingId ?? "");
          const gdsTicketId = tfi.Passenger?.[0]?.Ticket?.TicketId
            || ticketResp?.TicketId
            || (gdsBookingId && gdsBookingId !== "" ? gdsBookingId : "");

          const gdsBookingResult = {
            PNR: gdsPNR,
            BookingId: gdsBookingId,
            TicketId: gdsTicketId,
          };
          // Persist to backend (await before navigating)
          await saveBookingToServer(gdsBookingResult, payment);
          if (sbtRequest) {
            navigate("/sbt/inbox", { replace: true });
          } else {
            navigate("/sbt/flights/book/confirmed", {
              replace: true,
              state: { ...state, bookingResult: gdsBookingResult, pnr: gdsPNR, bookingId: gdsBookingId, ticketId: gdsTicketId },
            });
          }
        } catch (ticketErr: unknown) {
          setError(`Booking held (PNR: ${bookResp.PNR}), but ticketing failed: ${ticketErr instanceof Error ? ticketErr.message : "Unknown error"}`);
        }
      }
    } catch (err: unknown) {
      console.error('[CONFIRM BOOKING ERROR]', err);
      setError(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  async function releaseBooking() {
    if (!heldBookingId) return;
    try {
      await api.post("/sbt/flights/release", {
        BookingId: heldBookingId,
        RequestType: 1,
      });
      setError("");
      setHeldPNR(null);
      setHeldBookingId(null);
      navigate("/sbt/flights", { replace: true });
    } catch (err: unknown) {
      setError(`Release failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  async function loadFareRules() {
    if (fareRules) return;
    setFareRulesLoading(true);
    try {
      const result = await api.post("/sbt/flights/farerule", {
        TraceId: traceId,
        ResultIndex: fareQuoteResult?.Response?.Results?.ResultIndex ?? flight.ResultIndex,
      });
      setFareRules(result?.Response?.FareRules ?? result?.FareRules ?? []);
    } catch {
      setFareRules([]);
    } finally {
      setFareRulesLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: '#f1f5f9' }}>
      <BookingProgressBar currentStep="review" />

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "32px 24px", gap: 28 }}>
        {/* Left: Review sections */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Back button */}
          <button onClick={() => navigate("/sbt/flights/book/extras", { state })} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none",
            border: "none", cursor: "pointer", padding: 0, marginBottom: 16,
            fontSize: 12, fontWeight: 600, color: T.inkMid,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          {/* Section 1: Flight Details */}
          <div style={card}>
            <div style={sectionTitle}>
              <span>Flight Details</span>
              <button style={editLink} onClick={() => navigate("/sbt/flights", { state })}>Edit</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <AirlineLogo code={seg.Airline.AirlineCode} size="lg" />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: "0 0 2px" }}>
                  {seg.Airline.AirlineName} · {seg.Airline.FlightNumber}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {formatTime(seg.Origin.DepTime)}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#00477f', margin: 0 }}>
                      {seg.Origin.Airport.AirportCode}
                    </p>
                    <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, margin: 0 }}>
                      {formatDateShort(seg.Origin.DepTime)}
                    </p>
                  </div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: '#64748b', fontWeight: 700, margin: "0 0 4px" }}>{formatDur(seg.Duration)}</p>
                    <div style={{ height: 1, background: T.cardBorder, position: "relative" }}>
                      <span style={{ position: "absolute", left: "50%", top: -8, transform: "translateX(-50%)", fontSize: 14 }}>
                        ✈
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: stops ? T.amber : T.emerald, fontWeight: 700, margin: "6px 0 0" }}>
                      {stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {formatTime(segLast.Destination.ArrTime)}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#00477f', margin: 0 }}>
                      {segLast.Destination.Airport.AirportCode}
                    </p>
                    <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, margin: 0 }}>
                      {formatDateShort(segLast.Destination.ArrTime)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <Badge label={CABIN_MAP[cabin] ?? "Economy"} color={T.inkMid} bg={T.surface} />
                  <Badge label={flight.IsLCC ? "LCC" : "GDS"} color={T.amber} bg={`${T.amber}15`} />
                  <Badge label={flight.NonRefundable ? "Non-refundable" : "Refundable"}
                    color={flight.NonRefundable ? T.rose : T.emerald}
                    bg={flight.NonRefundable ? `${T.rose}15` : `${T.emerald}15`} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Passengers */}
          <div style={card}>
            <div style={sectionTitle}>
              <span>Passengers ({passengers.length})</span>
              <button style={editLink} onClick={() => navigate("/sbt/flights/book/passengers", { state })}>Edit</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {passengers.map((p, i) => {
                const seat = selectedSeats?.[i];
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
                  }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {p.title} {p.firstName} {p.lastName}
                      </p>
                      <p style={{ fontSize: 13, color: '#475569', fontWeight: 500, margin: 0 }}>
                        {p.paxType === "adult" ? "Adult" : p.paxType === "child" ? "Child" : "Infant"}
                        {p.isLead ? " · Lead" : ""}
                        {p.dob ? ` · DOB: ${p.dob}` : ""}
                        {p.gender ? ` · ${p.gender}` : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {seat && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#00477f' }}>
                          Seat {seat.seatCode}
                        </span>
                      )}
                      {p.passportNo && (
                        <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                          ••• {p.passportNo.slice(-4)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Extras */}
          <div style={card}>
            <div style={sectionTitle}>
              <span>Extras</span>
              <button style={editLink} onClick={() => navigate("/sbt/flights/book/extras", { state })}>Edit</button>
            </div>
            {extrasTotal > 0 || Object.keys(selectedBaggage).length > 0 || Object.keys(selectedMeals).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {passengers.map((p, i) => {
                  const bag = selectedBaggage?.[i];
                  const meal = selectedMeals?.[i];
                  const seat = selectedSeats?.[i];
                  if (!bag && !meal && !seat) return null;
                  return (
                    <div key={i} style={{ padding: "10px 14px", background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: "0 0 4px" }}>
                        {p.firstName} {p.lastName}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {bag && (
                          <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>
                            Baggage: {bag.description}{bag.price > 0 ? ` (₹${bag.price})` : ""}
                          </span>
                        )}
                        {meal && (
                          <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>
                            Meal: {meal.description}{meal.price > 0 ? ` (₹${meal.price})` : ""}
                          </span>
                        )}
                        {seat && (
                          <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>
                            Seat: {seat.seatCode}{seat.price > 0 ? ` (₹${seat.price})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500, margin: 0 }}>No extras added</p>
            )}
          </div>

          {/* Section 4: Fare Rules (collapsible) */}
          <div style={{ ...card, padding: "14px 20px" }}>
            <button
              onClick={() => { setFareRulesOpen(v => !v); if (!fareRulesOpen) loadFareRules(); }}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between",
                alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                Cancellation & Date Change Policy
              </span>
              <span style={{ fontSize: 12, color: T.inkFaint }}>{fareRulesOpen ? "Hide" : "Show"}</span>
            </button>

            {fareRulesOpen && (
              <div style={{ marginTop: 14 }}>
                {fareRulesLoading ? (
                  <p style={{ fontSize: 13, color: T.inkMid }}>Loading fare rules...</p>
                ) : !fareRules?.length ? (
                  <p style={{ fontSize: 13, color: T.inkMid }}>Fare rules not available for this flight.</p>
                ) : (
                  fareRules.map((rule: any, i: number) => (
                    <div key={i} style={{
                      marginBottom: 12, paddingBottom: 12,
                      borderBottom: i < fareRules.length - 1 ? `1px solid ${T.cardBorder}` : "none",
                    }}>
                      <p style={{
                        fontSize: 11, fontWeight: 700, color: T.inkMid,
                        textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px",
                      }}>
                        {rule.Origin} → {rule.Destination}
                      </p>
                      <p style={{
                        fontSize: 12, color: T.ink, lineHeight: 1.7, margin: 0,
                        whiteSpace: "pre-wrap", fontFamily: "monospace",
                      }}>
                        {rule.FareRuleDetail || "No details available."}
                      </p>
                    </div>
                  ))
                )}
                <p style={{ fontSize: 10, color: T.inkFaint, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Fees are indicative per pax per sector. GST + RAF + applicable charges extra.
                  Domestic: 2hr before airline deadline. International: 4hr before airline deadline.
                </p>
              </div>
            )}
          </div>

          {/* Section 5: Contact Details */}
          <div style={card}>
            <div style={sectionTitle}>
              <span>Contact Details</span>
              <button style={editLink} onClick={() => navigate("/sbt/flights/book/passengers", { state })}>Edit</button>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Email</p>
                <p style={{ fontSize: 16, color: '#0f172a', fontWeight: 700, margin: 0 }}>{contactInfo.email || "—"}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 2px" }}>Phone</p>
                <p style={{ fontSize: 16, color: '#0f172a', fontWeight: 700, margin: 0 }}>{contactInfo.phone || "—"}</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: `${T.rose}15`, border: `1px solid ${T.rose}40`,
              borderRadius: 10, padding: "12px 16px", marginBottom: 16,
            }}>
              <p style={{ color: T.rose, fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{error}</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handlePayment} style={{
                  background: T.gold, color: T.obsidian, border: "none", borderRadius: 8,
                  padding: "8px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}>
                  Try Again
                </button>
                {heldPNR && (
                  <button onClick={releaseBooking} style={{
                    background: "none", border: `1.5px solid ${T.rose}`, borderRadius: 8,
                    padding: "8px 18px", fontWeight: 600, fontSize: 12, cursor: "pointer",
                    color: T.rose,
                  }}>
                    Release Booking (PNR: {heldPNR})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: PriceSummary + Confirm */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <PriceSummary
            flight={flight} origin={origin} dest={dest} pax={pax}
            baseFare={baseFare} taxes={taxes} totalFare={totalFare}
            confirmedFare={priceChanged ? newFare : null}
            extras={extras}
          />

          {/* Extras breakdown */}
          {extrasTotal > 0 && (
            <div style={{
              background: T.cardBg, border: `1px solid ${T.cardBorder}`,
              borderRadius: 12, padding: "12px 16px", marginTop: 10,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Extras</div>
              {(extras?.seats ?? 0) > 0 && <ExtraRow label="Seats" value={extras.seats} />}
              {(extras?.baggage ?? 0) > 0 && <ExtraRow label="Baggage" value={extras.baggage} />}
              {(extras?.meals ?? 0) > 0 && <ExtraRow label="Meals" value={extras.meals} />}
              <div style={{
                display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6,
                borderTop: `1px solid ${T.cardBorder}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Extras Total</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>₹{extrasTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div style={{
            background: '#00477f', borderRadius: 12, padding: "14px 16px",
            marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Grand Total</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#ffffff' }}>
              ₹{((priceChanged && newFare ? newFare : totalFare) + extrasTotal).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Confirm button */}
          <button onClick={handlePayment} disabled={booking} style={{
            width: "100%", marginTop: 14, padding: "16px 32px",
            background: booking ? '#94a3b8' : '#00477f',
            color: '#ffffff', border: "none", borderRadius: 16,
            fontWeight: 900, fontSize: 17, cursor: booking ? "not-allowed" : "pointer",
            letterSpacing: "0.04em", boxShadow: '0 4px 16px rgba(0,71,127,0.35)',
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {booking && (
              <div style={{
                width: 16, height: 16, border: '2px solid #ffffff',
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            )}
            {booking
              ? paymentStatus === "paying" ? "Awaiting Payment..." : "Processing Booking..."
              : "Pay & Book →"}
          </button>
          {booking && <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color, background: bg,
      padding: "3px 10px", borderRadius: 20,
    }}>
      {label}
    </span>
  );
}

function ExtraRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>₹{value.toLocaleString("en-IN")}</span>
    </div>
  );
}
