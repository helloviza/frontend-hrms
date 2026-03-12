import { T, SBTFlight, AirlineLogo, formatTime, formatDur } from "./FlightResultCard";

interface Props {
  flight: SBTFlight;
  origin: { code: string; city: string };
  dest: { code: string; city: string };
  pax: { adults: number; children: number; infants: number };
  baseFare?: number;
  taxes?: number;
  totalFare?: number;
  confirmedFare?: number | null;
  extras?: { seats?: number; baggage?: number; meals?: number };
}

export default function PriceSummary({ flight, origin, dest, pax, baseFare: baseFareOverride, taxes: taxOverride, totalFare: totalOverride, confirmedFare, extras }: Props) {
  const seg0 = flight.Segments[0]?.[0];
  const segLast = flight.Segments[0]?.[flight.Segments[0].length - 1];
  const airlineCode = seg0?.Airline?.AirlineCode ?? "";
  const airlineName = seg0?.Airline?.AirlineName ?? airlineCode;
  const flightNum = `${airlineCode}-${seg0?.Airline?.FlightNumber ?? ""}`;

  const depTime = seg0?.Origin?.DepTime ?? "";
  const arrTime = segLast?.Destination?.ArrTime ?? "";
  const duration = seg0?.Duration ?? 0;
  const stops = (flight.Segments[0]?.length ?? 1) - 1;

  const totalPax = pax.adults + pax.children + pax.infants;
  const baseFare = Number(baseFareOverride ?? flight.Fare?.BaseFare ?? 0);
  const tax = Number(taxOverride ?? flight.Fare?.Tax ?? 0);
  const total = Number((confirmedFare ?? totalOverride ?? flight.Fare?.PublishedFare ?? (baseFare + tax)) || 0);
  const extrasTotal = (extras?.seats ?? 0) + (extras?.baggage ?? 0) + (extras?.meals ?? 0);
  const grandTotal = total + extrasTotal;

  return (
    <div style={{
      position: "sticky", top: 80,
      background: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 16,
      padding: 20,
      width: 300,
      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>
        Price Summary
      </div>

      {/* Flight info */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 0", borderBottom: `1px solid ${T.cardBorder}`,
        marginBottom: 12,
      }}>
        <AirlineLogo code={airlineCode} size="sm" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.ink }}>{airlineName}</div>
          <div style={{ fontSize: 10, color: T.inkMid }}>{flightNum}</div>
        </div>
      </div>

      {/* Route */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{formatTime(depTime)}</div>
          <div style={{ fontSize: 10, color: T.inkMid }}>{origin.code}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 9, color: T.inkMid }}>{formatDur(duration)}</div>
          <div style={{ height: 1, background: T.cardBorder, margin: "3px 12px" }} />
          <div style={{ fontSize: 9, color: stops ? T.amber : T.emerald }}>
            {stops ? `${stops} stop${stops > 1 ? "s" : ""}` : "Non-stop"}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{formatTime(arrTime)}</div>
          <div style={{ fontSize: 10, color: T.inkMid }}>{dest.code}</div>
        </div>
      </div>

      {/* Fare breakdown */}
      <div style={{ borderTop: `1px solid ${T.cardBorder}`, paddingTop: 12 }}>
        <Row label={`Base Fare (x${totalPax})`} value={baseFare} />
        <Row label="Taxes & Fees" value={tax} />
        {extrasTotal > 0 && (
          <>
            {(extras?.seats ?? 0) > 0 && <Row label="Seat charges" value={extras!.seats!} />}
            {(extras?.baggage ?? 0) > 0 && <Row label="Baggage" value={extras!.baggage!} />}
            {(extras?.meals ?? 0) > 0 && <Row label="Meals" value={extras!.meals!} />}
          </>
        )}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.cardBorder}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{extrasTotal > 0 ? "Grand Total" : "Total"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.gold }}>
            {flight.Fare.Currency ?? "INR"} {grandTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Pax breakdown */}
      <div style={{ marginTop: 10, fontSize: 10, color: T.inkMid }}>
        {pax.adults} Adult{pax.adults > 1 ? "s" : ""}
        {pax.children > 0 && `, ${pax.children} Child${pax.children > 1 ? "ren" : ""}`}
        {pax.infants > 0 && `, ${pax.infants} Infant${pax.infants > 1 ? "s" : ""}`}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: T.inkMid }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.ink }}>
        ₹{value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}
