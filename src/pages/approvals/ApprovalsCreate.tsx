import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type CartItem = {
  type: string;
  title?: string;
  description?: string;
  qty?: number;
  price?: number;
};

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
  return r.includes("ADMIN") || r.includes("SUPERADMIN") || r.includes("SUPER_ADMIN") || r.includes("HR_ADMIN");
}

export default function ApprovalsCreate() {
  const { user } = useAuth();
  const admin = useMemo(() => isAdmin(user), [user]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");

  const [type, setType] = useState("flight");
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [comments, setComments] = useState("");

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
        const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res) ? res : [];
        setCustomers(rows);
      } catch {
        setCustomers([]);
      }
    })();
  }, [admin]);

  function addItem() {
    const t = String(title || "").trim();
    if (!t) return setMsg("Title is required for an item.");
    const next: CartItem = {
      type,
      title: t,
      qty: Math.max(1, Number(qty) || 1),
      price: Math.max(0, Number(price) || 0),
    };
    setItems((p) => [...p, next]);
    setTitle("");
    setQty(1);
    setPrice(0);
    setMsg("");
  }

  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!items.length) return setMsg("Add at least 1 item.");
    if (admin && !customerId) return setMsg("Select a customer (Admin).");

    setBusy(true);
    setMsg("");

    try {
      const body: any = {
        cartItems: items,
        comments,
      };
      // ✅ Admin must specify customer; WL/Approver can omit (backend resolves by identity)
      if (admin) body.customerId = customerId;

      const res: any = await api.post("/approvals/requests", body);
      const ticket = res?.request?.ticketId || "";
      setItems([]);
      setComments("");
      setMsg(ticket ? `Submitted: ${ticket}` : "Submitted for approval.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

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
                {c.businessName || c.name || c.payload?.businessName || c.payload?.name || c._id}
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
          placeholder="Item title (e.g., BOM → DEL flight)"
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

      <div className="mt-3">
        <label className="text-sm text-ink/70">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Any note for approver…"
        />
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Items</div>
        {!items.length && <div className="text-sm text-ink/60">No items added yet.</div>}

        {items.map((it, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 border border-black/10 bg-white rounded-xl px-3 py-2 mb-2"
          >
            <div className="text-sm">
              <div className="font-semibold">{it.title}</div>
              <div className="text-ink/60 text-xs">
                {it.type.toUpperCase()} · Qty {it.qty || 1} · ₹{(Number(it.price) || 0).toLocaleString("en-IN")}
              </div>
            </div>
            <button
              onClick={() => removeItem(idx)}
              className="text-xs px-2 py-1 rounded-lg border border-black/10 hover:bg-black/5"
            >
              Remove
            </button>
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
