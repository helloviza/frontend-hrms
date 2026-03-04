// apps/frontend/src/components/inputs/HotelSearchModal.tsx
import React, { useMemo, useState } from "react";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type HotelPick = {
  id: string;
  name: string;
  formattedAddress: string;
  rating: number | null;
  photoUrl?: string;
  addressComponents?: AddressComponent[];
};

function getNeighborhood(components?: AddressComponent[]) {
  const list = Array.isArray(components) ? components : [];
  const pick =
    list.find((c) => (c.types || []).includes("sublocality_level_1")) ||
    list.find((c) => (c.types || []).includes("sublocality")) ||
    list.find((c) => (c.types || []).includes("locality"));
  return pick?.longText || pick?.shortText || "";
}

/**
 * ✅ Try multiple endpoints so it works whether router is mounted at:
 * - app.use("/api", placesRouter)                       => /api/hotels/search
 * - app.use("/api/places", placesRouter)                => /api/places/hotels/search
 *
 * We will attempt /api/places first (preferred), then fallback to /api.
 */
async function postJsonMulti(urls: string[], body: any) {
  let lastErr: any = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Search failed (${r.status})`);

      return data;
    } catch (e: any) {
      lastErr = e;
      // try next
    }
  }

  throw lastErr || new Error("Search failed");
}

export default function HotelSearchModal({
  value,
  onChangeText,
  onSelectHotel,
  disabled,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSelectHotel: (hotel: HotelPick) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [hotels, setHotels] = useState<HotelPick[]>([]);

  const canSearch = useMemo(() => value.trim().length >= 2, [value]);

  async function runSearch() {
    setErr("");

    if (!canSearch) {
      setErr("Please type at least 2 characters.");
      return;
    }

    setLoading(true);
    try {
      const data = await postJsonMulti(
        [
          "/api/places/hotels/search", // ✅ preferred
          "/api/hotels/search",        // fallback if mounted at /api
        ],
        { query: value.trim() }
      );

      setHotels(Array.isArray(data?.hotels) ? data.hotels : []);
      setOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
      setHotels([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Type city or hotel name (e.g., Mumbai / Taj)…"
          className={[
            "w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none",
            "border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
            disabled ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        />

        <button
          type="button"
          disabled={disabled || loading}
          onClick={runSearch}
          className="shrink-0 px-4 py-2 rounded-xl bg-[#00477f] text-white text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}

      {open ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="text-sm font-semibold text-slate-900">Select a Hotel</div>
                <div className="text-xs text-slate-500">Results for: “{value.trim()}”</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4 space-y-3">
              {!hotels.length ? (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                  No results.
                </div>
              ) : (
                hotels.map((h) => {
                  const neighborhood = getNeighborhood(h.addressComponents);
                  return (
                    <div key={h.id} className="rounded-2xl border p-4 flex gap-4">
                      <div className="w-28 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        {h.photoUrl ? (
                          <img
                            src={h.photoUrl}
                            alt={h.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {h.name || "Unnamed Hotel"}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {neighborhood ? <b>{neighborhood}</b> : null}
                              {neighborhood ? " • " : ""}
                              {h.formattedAddress}
                            </div>
                          </div>

                          <div className="text-xs text-slate-700 shrink-0">
                            {typeof h.rating === "number" ? `⭐ ${h.rating}` : "—"}
                          </div>
                        </div>

                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectHotel(h);
                              setOpen(false);
                            }}
                            className="px-4 py-2 rounded-xl bg-[#d06549] text-white text-sm font-medium hover:opacity-95"
                          >
                            Select Hotel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
