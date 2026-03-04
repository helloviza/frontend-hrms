// apps/frontend/src/pages/approvals/ApprovalsInbox.tsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

type CartItem = {
  _id?: string;
  id?: string;
  type?: string; // flight/hotel/cab/visa/etc
  title?: string;
  description?: string;
  qty?: number;
  price?: number;
  meta?: Record<string, any>;
};

type ApprovalRow = {
  _id: string;
  ticketId?: string;
  customerName?: string;
  frontlinerEmail?: string;
  managerEmail?: string;
  managerName?: string;
  status?: string;
  comments?: string;
  updatedAt?: string;
  cartItems?: CartItem[];
};

function unwrapApi<T = any>(res: any): T {
  if (res && typeof res === "object") return (res as any).data ?? res;
  return res as T;
}

function inr(n: any): string {
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

function kv(label: string, value: any) {
  const v = value === undefined || value === null || value === "" ? "—" : String(value);
  return (
    <div className="text-[12px] text-ink/80">
      <span className="text-ink/50">{label}</span>
      <span className="mx-1">:</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function renderMeta(it: CartItem) {
  const m = it.meta || {};
  const t = String(it.type || "").toLowerCase();

  if (t === "flight") {
    return (
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
        {kv("Trip", m.tripType)}
        {kv("From", m.origin)}
        {kv("To", m.destination)}
        {kv("Depart", m.departDate)}
        {kv("Return", m.returnDate)}
        {kv("Cabin", m.cabinClass)}
        {kv("Preferred Airline", m.preferredAirline)}
        {kv("Preferred Time", m.preferredTime)}
        {kv("Direct Only", m.directOnly ? "Yes" : "No")}
        {kv("Flexible Dates", m.flexibleDates ? "Yes" : "No")}
        {kv("Adults", m.adults)}
        {kv("Children", m.children)}
        {kv("Infants", m.infants)}
      </div>
    );
  }

  if (t === "hotel") {
    return (
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
        {kv("City", m.city)}
        {kv("Check-in", m.checkIn)}
        {kv("Check-out", m.checkOut)}
        {kv("Rooms", m.rooms)}
        {kv("Adults", m.adults)}
        {kv("Children", m.children)}
        {kv("Hotel Type", m.hotelType)}
        {kv("Star Rating", m.starRating)}
        {kv("Room Type", m.roomType)}
        {kv("Meal Plan", m.mealPlan)}
        {kv("Location Pref", m.locationPreference)}
      </div>
    );
  }

  if (t === "cab") {
    return (
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
        {kv("City", m.city)}
        {kv("Trip Type", m.tripType)}
        {kv("Pickup", m.pickup)}
        {kv("Drop", m.drop)}
        {kv("Pickup Date", m.pickupDate)}
        {kv("Pickup Time", m.pickupTime)}
        {kv("Vehicle", m.vehicleType)}
        {kv("Passengers", m.passengers)}
        {kv("Luggage", m.luggage)}
      </div>
    );
  }

  // generic: show some common meta keys
  const keys = Object.keys(m || {});
  if (keys.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
      {keys.slice(0, 12).map((k) => kv(k, m[k]))}
    </div>
  );
}

export default function ApprovalsInbox() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [msg, setMsg] = useState("");
  const [comment, setComment] = useState<string>("");

  async function load() {
    setMsg("");
    try {
      const res: any = await api.get("/approvals/requests/inbox");
      const data = unwrapApi<any>(res);
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      setMsg(
        e?.message ||
          "Failed to load inbox (you might not be the configured approver).",
      );
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "approved" | "declined" | "on_hold") {
    try {
      await api.put(`/approvals/requests/${id}/action`, { action, comment });
      setComment("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update");
    }
  }

  return (
    <div className="bg-white/70 border border-black/10 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold">Approver Inbox</div>
        <button
          onClick={load}
          className="text-xs px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3">
        <label className="text-sm text-ink/70">Comment (optional)</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Add a note for this decision…"
        />
      </div>

      {!!msg && <div className="mt-2 text-sm text-ink/70">{msg}</div>}

      <div className="mt-3 space-y-3">
        {!rows.length && (
          <div className="text-sm text-ink/60">No pending requests.</div>
        )}

        {rows.map((r) => {
          const items = Array.isArray(r.cartItems) ? r.cartItems : [];
          const totalAmount = items.reduce(
            (sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1),
            0,
          );

          return (
            <div
              key={r._id}
              className="border border-black/10 bg-white rounded-2xl p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.ticketId || r._id}</div>
                  <div className="text-xs text-ink/60">
                    By: <b>{r.frontlinerEmail || "-"}</b> · Customer:{" "}
                    <b>{r.customerName || "-"}</b>
                  </div>
                  {r.updatedAt ? (
                    <div className="text-xs text-ink/50 mt-1">
                      {new Date(r.updatedAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div className="text-xs text-ink/60 text-right">
                  <div className="font-medium uppercase">{r.status || "—"}</div>
                  <div>
                    {items.length} {items.length === 1 ? "item" : "items"} •{" "}
                    <b>{inr(totalAmount)}</b>
                  </div>
                </div>
              </div>

              {(r.comments || "") && (
                <div className="mt-2 text-sm text-ink/70 whitespace-pre-line">
                  <b>Request note:</b> {r.comments}
                </div>
              )}

              {/* ✅ FULL ITEMS */}
              <div className="mt-3 border border-black/10 rounded-2xl p-3 bg-white">
                <div className="text-[11px] tracking-[0.25em] text-ink/50 uppercase">
                  Itinerary Items
                </div>

                <div className="mt-3 space-y-2">
                  {items.map((it, idx) => {
                    const qty = Math.max(1, Number(it.qty) || 1);
                    const price = Number(it.price) || 0;
                    const note = String(it.description || it.meta?.notes || "").trim();
                    const needBy = it.meta?.needBy;
                    const priority = it.meta?.priority;

                    return (
                      <div
                        key={(it._id || it.id || `${idx}`) as string}
                        className="rounded-2xl border border-black/10 p-3"
                      >
                        <div className="text-sm font-semibold text-ink">
                          {it.title || "Item"}
                        </div>

                        <div className="mt-1 text-xs text-ink/70">
                          <span className="font-medium">
                            {String(it.type || "").toUpperCase()}
                          </span>
                          <span className="mx-1">•</span>
                          <span>Qty {qty}</span>
                          <span className="mx-1">•</span>
                          <span>{inr(price)}</span>
                          {priority ? (
                            <>
                              <span className="mx-1">•</span>
                              <span>Priority: {priority}</span>
                            </>
                          ) : null}
                          {needBy ? (
                            <>
                              <span className="mx-1">•</span>
                              <span>Need by: {needBy}</span>
                            </>
                          ) : null}
                        </div>

                        {/* ✅ ALL META DETAILS */}
                        {renderMeta(it)}

                        {/* Notes */}
                        {note ? (
                          <div className="mt-2 text-sm text-ink/80 whitespace-pre-line break-words">
                            {note}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => act(r._id, "approved")}
                  className="px-3 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:opacity-95"
                >
                  Approve
                </button>
                <button
                  onClick={() => act(r._id, "on_hold")}
                  className="px-3 py-2 rounded-xl text-sm bg-amber-600 text-white hover:opacity-95"
                >
                  On Hold
                </button>
                <button
                  onClick={() => act(r._id, "declined")}
                  className="px-3 py-2 rounded-xl text-sm bg-red-600 text-white hover:opacity-95"
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
