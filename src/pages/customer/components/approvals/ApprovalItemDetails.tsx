// apps/frontend/src/pages/customer/components/approvals/ApprovalItemDetails.tsx
import React from "react";

export type CartItem = {
  type?: string;
  title?: string;
  description?: string;
  qty?: number;
  price?: number;
  meta?: Record<string, any>;
};

function isEmpty(v: any) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && !v.trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function labelize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function inr(n: any) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "₹0";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${Math.round(num)}`;
  }
}

function asDate(v: any) {
  const s = String(v ?? "").trim();
  // We store dates as yyyy-mm-dd; show as-is (clean + predictable)
  // If an ISO datetime comes in, cut at 'T'
  if (!s) return "";
  const t = s.split("T")[0];
  return t;
}

function formatTripType(v: any) {
  const s = String(v ?? "").toLowerCase();
  if (!s) return "";
  if (s === "oneway") return "One Way";
  if (s === "roundtrip") return "Round Trip";
  if (s === "multicity") return "Multi City";
  if (s === "hourly") return "Hourly";
  return s;
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") return v;

  if (Array.isArray(v)) {
    // arrays of primitives
    if (v.every((x) => x == null || ["string", "number", "boolean"].includes(typeof x))) {
      return v.map((x) => (typeof x === "boolean" ? (x ? "Yes" : "No") : String(x))).join(", ");
    }
    // arrays of objects -> show count
    return `${v.length} items`;
  }

  // object fallback
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function pickNotes(item: CartItem) {
  // Most notes are stored in meta.notes (primary) and item.description (legacy/secondary)
  const metaNote = item.meta?.notes;
  const d = item.description;
  const note = !isEmpty(metaNote) ? metaNote : d;
  return String(note || "").trim();
}

function pickTravellers(item: CartItem) {
  const trs = Array.isArray(item?.meta?.travellers) ? item.meta!.travellers : [];
  // normalize
  return trs
    .map((t: any) => ({
      firstName: String(t?.firstName ?? "").trim(),
      lastName: String(t?.lastName ?? "").trim(),
      dob: String(t?.dob ?? "").trim(),
      passportNumber: String(t?.passportNumber ?? "").trim(),
      passportExpiry: String(t?.passportExpiry ?? "").trim(),
      nationality: String(t?.nationality ?? "").trim(),
    }))
    .filter((t: any) => t.firstName || t.lastName);
}

function travellersMini(trs: any[]) {
  if (!trs.length) return "";
  const names = trs
    .slice(0, 3)
    .map((t: any) => `${t.firstName || "—"} ${t.lastName || ""}`.trim())
    .filter(Boolean)
    .join(", ");
  return trs.length > 3 ? `${names} +${trs.length - 3}` : names;
}

function hotelSummary(h: any) {
  if (!h || typeof h !== "object") return "";
  const name = String(h?.name ?? "").trim();
  const address = String(h?.address ?? "").trim();
  const rating = h?.rating != null && Number.isFinite(Number(h.rating)) ? Number(h.rating) : null;
  if (!name && !address) return "";
  const r = rating ? ` ⭐${rating}` : "";
  const a = address ? ` • ${address}` : "";
  return `${name || "Hotel"}${r}${a}`;
}

function airportMini(a: any) {
  if (!a || typeof a !== "object") return "";
  const iata = String(a?.iata ?? a?.code ?? "").trim();
  const city = String(a?.city ?? a?.cityName ?? "").trim();
  const name = String(a?.name ?? a?.airportName ?? "").trim();
  const bits = [iata, city || name].filter(Boolean);
  return bits.join(" • ");
}

/**
 * ✅ Align View Details with ApprovalNew.tsx meta schema
 * - Correct field ordering per service
 * - Friendly rendering for: travellers[], hotel{}, airport meta objects
 * - Never lose fields: still shows extra meta keys (except noisy/handled keys)
 */
function metaEntries(item: CartItem) {
  const type = String(item.type || "").toLowerCase();
  const m = item.meta || {};

  // Keys to never show directly (we render them in a better way)
  const hiddenKeys = new Set([
    "notes", // shown separately as Notes
    "travellers", // shown separately as Travellers block
    "originMeta",
    "destinationMeta",
  ]);

  // Show type-specific fields in a good order (matches ApprovalNew.tsx)
  const fieldsByType: Record<string, string[]> = {
    flight: [
      "travelScope",
      "tripType",
      "origin",
      "destination",
      "departDate",
      "returnDate",
      "cabinClass",
      "preferredTime",
      "preferredAirline",
      "preferredFlightTime",
      "adults",
      "children",
      "infants",
      "directOnly",
      "flexibleDates",
      "priority",
      "needBy",
    ],
    hotel: [
      "travelScope",
      "city",
      "hotel", // special render
      "checkIn",
      "checkOut",
      "rooms",
      "adults",
      "children",
      "hotelType",
      "starRating",
      "roomType",
      "mealPlan",
      "locationPreference",
      "priority",
      "needBy",
    ],
    visa: [
      "travelScope",
      "destinationCountry",
      "visaType",
      "purpose",
      "travelDate",
      "returnDate",
      "travelers",
      "processingSpeed",
      "passportValidityMonths",
      "priority",
      "needBy",
    ],
    cab: [
      "travelScope",
      "city",
      "tripType",
      "pickup",
      "drop",
      "pickupDate",
      "pickupTime",
      "vehicleType",
      "passengers",
      "luggage",
      "priority",
      "needBy",
    ],
    forex: [
      "travelScope",
      "currency",
      "amount",
      "deliveryMode",
      "city",
      "requiredBy",
      "purpose",
      "priority",
      "needBy",
    ],
    esim: ["travelScope", "country", "startDate", "days", "dataPack", "numberOfTravellers", "priority", "needBy"],
    holiday: [
      "travelScope",
      "destination",
      "startDate",
      "days",
      "people",
      "budgetBand",
      "hotelClass",
      "inclusions",
      "interests",
      "priority",
      "needBy",
    ],
    mice: [
      "travelScope",
      "mode",
      "location",
      "startDate",
      "endDate",
      "attendees",
      "travelMode",
      "hotelType",
      "addOns",
      "foodPref",
      "servicesNeeded",
      "priority",
      "needBy",
    ],
  };

  const preferredKeys = fieldsByType[type] || [];
  const used = new Set<string>();
  const ordered: Array<{ k: string; v: any }> = [];

  // 1) preferred keys first
  for (const k of preferredKeys) {
    if (hiddenKeys.has(k)) continue;
    if (k in m && !isEmpty(m[k])) {
      ordered.push({ k, v: m[k] });
      used.add(k);
    }
  }

  // 2) append useful derived fields for flights (airport meta)
  if (type === "flight") {
    const oMeta = m.originMeta;
    const dMeta = m.destinationMeta;
    const oMini = airportMini(oMeta);
    const dMini = airportMini(dMeta);

    if (oMini) ordered.push({ k: "originDetails", v: oMini });
    if (dMini) ordered.push({ k: "destinationDetails", v: dMini });
  }

  // 3) then anything else in meta (so you NEVER lose fields)
  for (const k of Object.keys(m)) {
    if (used.has(k)) continue;
    if (hiddenKeys.has(k)) continue;
    if (isEmpty(m[k])) continue;
    ordered.push({ k, v: m[k] });
  }

  return ordered;
}

function formatValueForKey(k: string, v: any, item: CartItem) {
  // per-key friendly formatting
  if (k === "tripType") return formatTripType(v);
  if (k.toLowerCase().includes("date") || k === "needBy" || k === "checkIn" || k === "checkOut" || k === "requiredBy") {
    return asDate(v);
  }
  if (k === "hotel") {
    const s = hotelSummary(v);
    return s || safeStr(v);
  }
  if (k === "inclusions") {
    if (Array.isArray(v)) return v.filter(Boolean).join(", ");
    return safeStr(v);
  }
  if (k === "addOns") {
    if (Array.isArray(v)) return v.filter(Boolean).join(", ");
    return safeStr(v);
  }
  if (k === "travelScope") {
    const s = String(v ?? "").toLowerCase();
    return s ? s.toUpperCase() : "";
  }
  if (k === "originDetails" || k === "destinationDetails") return safeStr(v);

  // object arrays shouldn’t print [object Object]
  if (Array.isArray(v) && v.length && typeof v[0] === "object") {
    return `${v.length} items`;
  }

  // default
  return safeStr(v);
}

type Tone = "dark" | "light";

export function ApprovalItemsDetail({
  items,
  tone = "dark",
  className = "",
}: {
  items: CartItem[];
  tone?: Tone;
  className?: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];

  const total = safeItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  // ✅ Default remains "dark" to avoid changing L2 behavior.
  const ui =
    tone === "light"
      ? {
          shell: "mt-3 border border-zinc-200 rounded-2xl p-4 bg-white",
          headerLabel: "text-[11px] tracking-[0.25em] text-zinc-500 uppercase",
          headerMeta: "text-xs text-zinc-600",
          headerTotal: "text-zinc-900",
          empty: "text-sm text-zinc-500",
          card: "rounded-2xl border border-zinc-200 p-4 bg-zinc-50",
          title: "text-sm font-semibold text-zinc-900",
          sub: "mt-1 text-xs text-zinc-600",
          notes: "mt-3 text-sm text-zinc-800 whitespace-pre-line break-words",
          notesLabel: "text-zinc-500",
          metaGrid: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-2",
          metaCard: "rounded-xl border border-zinc-200 bg-white px-3 py-2",
          metaKey: "text-[10px] tracking-wide uppercase text-zinc-500",
          metaVal: "text-sm text-zinc-900 break-words",
          noMeta: "mt-3 text-xs text-zinc-500",
          travellersWrap: "mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2",
          travellersKey: "text-[10px] tracking-wide uppercase text-zinc-500",
          travellersVal: "mt-1 text-sm text-zinc-900 break-words",
          travellerChip: "inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-800 mr-2 mb-2",
        }
      : {
          shell: "mt-3 border border-white/10 rounded-2xl p-4 bg-white/5",
          headerLabel: "text-[11px] tracking-[0.25em] text-white/60 uppercase",
          headerMeta: "text-xs text-white/70",
          headerTotal: "text-white",
          empty: "text-sm text-white/60",
          card: "rounded-2xl border border-white/10 p-4 bg-black/10",
          title: "text-sm font-semibold text-white",
          sub: "mt-1 text-xs text-white/70",
          notes: "mt-3 text-sm text-white/85 whitespace-pre-line break-words",
          notesLabel: "text-white/60",
          metaGrid: "mt-3 grid grid-cols-1 md:grid-cols-2 gap-2",
          metaCard: "rounded-xl border border-white/10 bg-white/5 px-3 py-2",
          metaKey: "text-[10px] tracking-wide uppercase text-white/50",
          metaVal: "text-sm text-white break-words",
          noMeta: "mt-3 text-xs text-white/50",
          travellersWrap: "mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2",
          travellersKey: "text-[10px] tracking-wide uppercase text-white/50",
          travellersVal: "mt-1 text-sm text-white break-words",
          travellerChip: "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/85 mr-2 mb-2",
        };

  return (
    <div className={`${ui.shell} ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <div className={ui.headerLabel}>Itinerary Items</div>
        <div className={ui.headerMeta}>
          {safeItems.length} {safeItems.length === 1 ? "item" : "items"} • <b className={ui.headerTotal}>{inr(total)}</b>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {safeItems.length === 0 ? (
          <div className={ui.empty}>No items found.</div>
        ) : (
          safeItems.map((it, idx) => {
            const qty = Math.max(1, Number(it.qty) || 1);
            const price = Number(it.price) || 0;
            const type = String(it.type || "").toUpperCase();
            const entries = metaEntries(it);
            const notes = pickNotes(it);

            const scope = String(it.meta?.travelScope ?? "").trim();
            const trs = pickTravellers(it);
            const trsMini = travellersMini(trs);

            return (
              <div key={`${it.title || "item"}-${idx}`} className={ui.card}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={ui.title}>{it.title || "Item"}</div>

                    <div className={ui.sub}>
                      {type ? (
                        <>
                          <span className="font-medium">{type}</span>
                          <span className="mx-1">•</span>
                        </>
                      ) : null}
                      <span>Qty {qty}</span>
                      <span className="mx-1">•</span>
                      <span>{inr(price * qty)}</span>

                      {scope ? (
                        <>
                          <span className="mx-1">•</span>
                          <span className="font-medium">{scope.toUpperCase()}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {notes ? (
                  <div className={ui.notes}>
                    <span className={ui.notesLabel}>Notes: </span>
                    {notes}
                  </div>
                ) : null}

                {/* Travellers (from ApprovalNew.tsx) */}
                {trs.length ? (
                  <div className={ui.travellersWrap}>
                    <div className={ui.travellersKey}>Travellers</div>
                    <div className={ui.travellersVal}>
                      <div className="mb-2">{trsMini}</div>
                      <div>
                        {trs.slice(0, 12).map((t: any, i: number) => {
                          const name = `${t.firstName || "—"} ${t.lastName || ""}`.trim();
                          const extra =
                            scope?.toLowerCase() === "international"
                              ? [
                                  t.nationality ? `Nationality: ${t.nationality}` : "",
                                  t.passportNumber ? `Passport: ${t.passportNumber}` : "",
                                  t.passportExpiry ? `Expiry: ${asDate(t.passportExpiry)}` : "",
                                ]
                                  .filter(Boolean)
                                  .join(" • ")
                              : "";
                          return (
                            <div key={`${name}-${i}`} className={ui.travellerChip}>
                              <span className="font-medium">{name}</span>
                              {extra ? <span className="opacity-80">{extra}</span> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ✅ FULL META (aligned + still complete) */}
                {entries.length > 0 ? (
                  <div className={ui.metaGrid}>
                    {entries.map(({ k, v }) => (
                      <div key={k} className={ui.metaCard}>
                        <div className={ui.metaKey}>{labelize(k)}</div>
                        <div className={ui.metaVal}>{formatValueForKey(k, v, it)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={ui.noMeta}>No structured details captured for this item.</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
