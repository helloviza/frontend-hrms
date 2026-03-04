// apps/frontend/src/pages/approvals/ApprovalsCreate.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type TripType = "domestic" | "international";

type Traveller = {
  firstName: string;
  lastName: string;
  dob?: string; // YYYY-MM-DD
  passportNumber?: string;
  passportExpiry?: string; // YYYY-MM-DD
  nationality?: string;
};

type CartItemMeta = {
  tripType?: TripType; // for flight
  travellers?: Traveller[];
};

type CartItem = {
  type: string; // flight/hotel/visa...
  title: string;
  description?: string; // per item note
  qty: number;
  price: number;
  clientItemId: string; // stable key
  meta?: CartItemMeta; // ✅ NEW
};

function unwrapApi<T = any>(res: any): T {
  if (res && typeof res === "object") return (res as any).data ?? res;
  return res as T;
}

function normRoles(u: any) {
  const r: string[] = [];
  if (Array.isArray(u?.roles)) r.push(...u.roles);
  if (u?.role) r.push(u.role);
  if (u?.accountType) r.push(u.accountType);
  if (u?.hrmsAccessRole) r.push(u.hrmsAccessRole);
  if (u?.hrmsAccessLevel) r.push(u.hrmsAccessLevel);
  return r.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}
function isAdmin(u: any) {
  const r = normRoles(u);
  return (
    r.includes("ADMIN") ||
    r.includes("SUPERADMIN") ||
    r.includes("SUPER_ADMIN") ||
    r.includes("HR_ADMIN")
  );
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normStr(v: any) {
  return String(v ?? "").trim();
}

function cleanTraveller(t: Traveller, tripType: TripType): Traveller {
  const firstName = normStr(t.firstName);
  const lastName = normStr(t.lastName);

  const out: Traveller = { firstName, lastName };

  if (tripType === "international") {
    out.dob = normStr(t.dob);
    out.passportNumber = normStr(t.passportNumber);
    out.passportExpiry = normStr(t.passportExpiry);
    out.nationality = normStr(t.nationality);
  }

  return out;
}

function validateTravellers(travellers: Traveller[], tripType: TripType): string {
  if (!travellers.length) return "Add at least 1 traveller.";
  for (let i = 0; i < travellers.length; i++) {
    const t = travellers[i];
    const fn = normStr(t.firstName);
    const ln = normStr(t.lastName);
    if (!fn || !ln) return `Traveller ${i + 1}: First name and last name are required.`;

    if (tripType === "international") {
      if (!normStr(t.dob)) return `Traveller ${i + 1}: Date of birth is required for international travel.`;
      if (!normStr(t.passportNumber)) return `Traveller ${i + 1}: Passport number is required.`;
      if (!normStr(t.passportExpiry)) return `Traveller ${i + 1}: Passport expiry date is required.`;
      if (!normStr(t.nationality)) return `Traveller ${i + 1}: Nationality is required.`;
    }
  }
  return "";
}

export default function ApprovalsCreate() {
  const { user } = useAuth();
  const admin = useMemo(() => isAdmin(user), [user]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");

  const [type, setType] = useState("flight");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);

  // ✅ Flight-only: traveller capture
  const [tripType, setTripType] = useState<TripType>("domestic");
  const [travellers, setTravellers] = useState<Traveller[]>([
    { firstName: "", lastName: "" },
  ]);

  const [requestNote, setRequestNote] = useState("");

  const [items, setItems] = useState<CartItem[]>([]);

  const total = useMemo(
    () => items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0),
    [items]
  );

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!admin) return;
      try {
        const res: any = await api.get("/master-data?type=Business&status=All");
        const data = unwrapApi<any>(res);
        const rows = Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data)
          ? data
          : [];
        setCustomers(rows);
      } catch {
        setCustomers([]);
      }
    })();
  }, [admin]);

  function addTraveller() {
    setTravellers((p) => [...p, { firstName: "", lastName: "" }]);
  }
  function removeTraveller(ix: number) {
    setTravellers((p) => p.filter((_, i) => i !== ix));
  }
  function updateTraveller(ix: number, patch: Partial<Traveller>) {
    setTravellers((p) =>
      p.map((t, i) => (i === ix ? { ...t, ...patch } : t))
    );
  }

  function addItem() {
    const t = normStr(title);
    if (!t) return setMsg("Title is required for an item.");

    const itemType = normStr(type || "misc") || "misc";

    // ✅ Only enforce traveller rules for Flight items.
    let meta: CartItemMeta | undefined = undefined;

    if (itemType.toLowerCase() === "flight") {
      const err = validateTravellers(travellers, tripType);
      if (err) return setMsg(err);

      const cleaned = travellers.map((x) => cleanTraveller(x, tripType));
      meta = {
        tripType,
        travellers: cleaned,
      };
    }

    const next: CartItem = {
      clientItemId: makeId(),
      type: itemType,
      title: t,
      description: normStr(description) || undefined,
      qty: Math.max(1, Number(qty) || 1),
      price: Math.max(0, Number(price) || 0),
      meta,
    };

    setItems((p) => [...p, next]);

    // reset item inputs
    setTitle("");
    setDescription("");
    setQty(1);
    setPrice(0);

    // reset travellers for next flight item
    setTripType("domestic");
    setTravellers([{ firstName: "", lastName: "" }]);
    setMsg("");
  }

  function removeItem(clientItemId: string) {
    setItems((p) => p.filter((x) => x.clientItemId !== clientItemId));
  }

  async function submit() {
    if (!items.length) return setMsg("Add at least 1 item.");
    if (admin && !customerId) return setMsg("Select a customer (Admin).");

    setBusy(true);
    setMsg("");

    try {
      const body: any = {
        cartItems: items,
        comments: requestNote,
      };
      if (admin) body.customerId = customerId;

      const res: any = await api.post("/approvals/requests", body);
      const data = unwrapApi<any>(res);

      const ticket = data?.request?.ticketId || "";
      setItems([]);
      setRequestNote("");
      setMsg(ticket ? `Submitted: ${ticket}` : "Submitted for approval.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  const isFlight = String(type || "").toLowerCase() === "flight";

  return (
    <div className="bg-white/70 border border-black/10 rounded-2xl p-4 md:p-5">
      <div className="text-lg font-semibold">Create Approval Request</div>
      <div className="text-sm text-ink/60 mt-1">
        Only Workspace Leader / Approver / Admin can create.
      </div>

      {admin && (
        <div className="mt-4">
          <label className="text-sm text-ink/70">Customer (Admin only)</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.businessName ||
                  c.name ||
                  c.payload?.businessName ||
                  c.payload?.name ||
                  c._id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          <option value="flight">Flight</option>
          <option value="hotel">Hotel</option>
          <option value="visa">Visa</option>
          <option value="cab">Cab</option>
          <option value="forex">Forex</option>
          <option value="holiday">Holiday</option>
          <option value="misc">Misc</option>
        </select>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Item title (e.g., DEL → BOM flight)"
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm md:col-span-2"
        />

        <button
          onClick={addItem}
          className="rounded-xl bg-brand text-white px-3 py-2 text-sm hover:opacity-95"
        >
          Add Item
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          type="number"
          value={qty}
          min={1}
          onChange={(e) => setQty(Number(e.target.value))}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Qty"
        />
        <input
          type="number"
          value={price}
          min={0}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Price"
        />
        <div className="md:col-span-2 text-sm text-ink/70 flex items-center">
          Total (current cart): <b className="ml-2">₹{total.toLocaleString("en-IN")}</b>
        </div>
      </div>

      {/* ✅ per-item description */}
      <div className="mt-2">
        <label className="text-sm text-ink/70">Item details (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Seat preference / hotel requirements / notes for this item…"
        />
      </div>

      {/* ✅ Travellers (Flight only) */}
      {isFlight && (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-3 md:p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Travellers</div>
              <div className="text-xs text-ink/60 mt-0.5">
                Domestic: First/Last · International: + DOB, Passport, Expiry, Nationality
              </div>
            </div>

            <select
              value={tripType}
              onChange={(e) => setTripType(e.target.value as TripType)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
          </div>

          <div className="mt-3 space-y-3">
            {travellers.map((t, ix) => (
              <div key={ix} className="rounded-xl border border-black/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-ink/70">
                    Traveller {ix + 1}
                  </div>
                  <button
                    onClick={() => removeTraveller(ix)}
                    disabled={travellers.length <= 1}
                    className="text-xs px-2 py-1 rounded-lg border border-black/10 hover:bg-black/5 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={t.firstName}
                    onChange={(e) => updateTraveller(ix, { firstName: e.target.value })}
                    placeholder="First Name"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={t.lastName}
                    onChange={(e) => updateTraveller(ix, { lastName: e.target.value })}
                    placeholder="Last Name"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </div>

                {tripType === "international" && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={t.dob || ""}
                      onChange={(e) => updateTraveller(ix, { dob: e.target.value })}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={t.nationality || ""}
                      onChange={(e) => updateTraveller(ix, { nationality: e.target.value })}
                      placeholder="Nationality (e.g., Indian)"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      value={t.passportNumber || ""}
                      onChange={(e) => updateTraveller(ix, { passportNumber: e.target.value })}
                      placeholder="Passport Number"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={t.passportExpiry || ""}
                      onChange={(e) => updateTraveller(ix, { passportExpiry: e.target.value })}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button
              onClick={addTraveller}
              className="text-sm px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5"
            >
              + Add Traveller
            </button>
          </div>
        </div>
      )}

      {/* ✅ request-wide note */}
      <div className="mt-3">
        <label className="text-sm text-ink/70">Request note (optional)</label>
        <textarea
          value={requestNote}
          onChange={(e) => setRequestNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Any overall note for approver/admin…"
        />
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Items</div>
        {!items.length && <div className="text-sm text-ink/60">No items added yet.</div>}

        {items.map((it) => (
          <div
            key={it.clientItemId}
            className="border border-black/10 bg-white rounded-xl px-3 py-2 mb-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <div className="font-semibold">{it.title}</div>
                <div className="text-ink/60 text-xs mt-0.5">
                  {it.type.toUpperCase()} · Qty {it.qty} · ₹
                  {(Number(it.price) || 0).toLocaleString("en-IN")}
                </div>

                {it.meta?.tripType && (
                  <div className="mt-2 text-xs text-ink/70">
                    Trip: <b>{it.meta.tripType.toUpperCase()}</b> · Travellers:{" "}
                    <b>{it.meta.travellers?.length || 0}</b>
                  </div>
                )}

                {Array.isArray(it.meta?.travellers) && it.meta!.travellers!.length > 0 && (
                  <div className="mt-2 text-xs text-ink/70 space-y-1">
                    {it.meta!.travellers!.map((t, ix) => (
                      <div key={ix} className="text-ink/80">
                        <b>{t.firstName} {t.lastName}</b>
                        {it.meta?.tripType === "international" ? (
                          <span className="text-ink/60">
                            {" "}· DOB {t.dob || "—"} · Passport {t.passportNumber || "—"} · Exp {t.passportExpiry || "—"} · {t.nationality || "—"}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {it.description ? (
                  <div className="mt-2 text-sm text-ink/80 whitespace-pre-line break-words">
                    {it.description}
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => removeItem(it.clientItemId)}
                className="text-xs px-2 py-1 rounded-lg border border-black/10 hover:bg-black/5"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {!!msg && <div className="mt-3 text-sm text-ink/80">{msg}</div>}

      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          onClick={submit}
          className="rounded-xl bg-accent text-white px-4 py-2 text-sm hover:opacity-95 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit for Approval"}
        </button>
      </div>
    </div>
  );
}
