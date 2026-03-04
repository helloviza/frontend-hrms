// apps/frontend/src/pages/customer/approvals/ApprovalNew.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  submitApprovalRequest,
  getApprovalRequest,
  updateApprovalRequest,
  type ApprovalCartItem,
  type ApprovalRequest,
} from "../../../lib/approvalsApi";
import { getWorkspaceMe } from "../../../lib/workspaceApi";
import { useNavigate, useSearchParams } from "react-router-dom";
import AirportAutocomplete from "../../../components/inputs/AirportAutocomplete";
import SearchPreviewDrawer from "../../../components/searchPreview/SearchPreviewDrawer";

type ServiceKey =
  | "flight"
  | "hotel"
  | "visa"
  | "cab"
  | "forex"
  | "esim"
  | "holiday"
  | "mice";

type TravelScope = "domestic" | "international";

type Traveller = {
  firstName: string;
  lastName: string;
  dob?: string; // yyyy-mm-dd
  passportNumber?: string;
  passportExpiry?: string; // yyyy-mm-dd
  nationality?: string;
};

const SERVICE_TYPES: Array<{
  key: ServiceKey;
  label: string;
  emoji: string;
  hint: string;
}> = [
  {
    key: "flight",
    label: "Flights",
    emoji: "✈️",
    hint: "Book flights for official travel",
  },
  {
    key: "hotel",
    label: "Hotels",
    emoji: "🏨",
    hint: "Stay details for the trip",
  },
  {
    key: "visa",
    label: "Visa",
    emoji: "🛂",
    hint: "eVisa / Sticker / Stamp visa requirements",
  },
  {
    key: "cab",
    label: "Cab",
    emoji: "🚕",
    hint: "Airport / local transfer",
  },
  {
    key: "forex",
    label: "Forex",
    emoji: "💱",
    hint: "Cash / card / travel money",
  },
  {
    key: "esim",
    label: "eSIM",
    emoji: "📶",
    hint: "International data packs",
  },
  {
    key: "holiday",
    label: "Holidays",
    emoji: "🌴",
    hint: "Leisure / incentive travel plan",
  },
  {
    key: "mice",
    label: "MICE",
    emoji: "🎤",
    hint: "Meetings / offsites / conferences",
  },
];

const PRIORITIES = ["Normal", "High", "Urgent"] as const;

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function niceMoney(n: number) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-IN");
}

function safeInt(v: any, min = 0) {
  const x = Number(v);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.floor(x));
}

function ensureStr(v: any) {
  return String(v ?? "").trim();
}

function emptyTraveller(): Traveller {
  return {
    firstName: "",
    lastName: "",
    dob: "",
    passportNumber: "",
    passportExpiry: "",
    nationality: "",
  };
}

function ensureTravellersCount(list: any, n: number): Traveller[] {
  const arr: Traveller[] = Array.isArray(list) ? list : [];
  const count = Math.max(1, safeInt(n, 1));
  const out = arr.slice(0, count).map((t) => ({
    ...emptyTraveller(),
    ...(t || {}),
    firstName: ensureStr((t || {}).firstName),
    lastName: ensureStr((t || {}).lastName),
  }));
  while (out.length < count) out.push(emptyTraveller());
  return out;
}

function validateTravellers(scope: TravelScope, travellers: Traveller[]) {
  for (let i = 0; i < travellers.length; i++) {
    const t = travellers[i] || ({} as Traveller);
    if (!ensureStr(t.firstName) || !ensureStr(t.lastName)) {
      return `Traveller ${i + 1}: First Name and Last Name are required.`;
    }
    if (scope === "international") {
      if (!ensureStr(t.dob))
        return `Traveller ${i + 1}: Date of Birth is required for international travel.`;
      if (!ensureStr(t.passportNumber))
        return `Traveller ${i + 1}: Passport Number is required for international travel.`;
      if (!ensureStr(t.passportExpiry))
        return `Traveller ${i + 1}: Passport Expiry Date is required for international travel.`;
      if (!ensureStr(t.nationality))
        return `Traveller ${i + 1}: Nationality is required for international travel.`;
    }
  }
  return "";
}

/** Compact field wrapper */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {hint ? (
          <span className="text-[11px] text-slate-400">{hint}</span>
        ) : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
        "shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]/40",
        props.className
      )}
    />
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition",
        active
          ? "bg-[#00477f] text-white border-[#00477f]"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {sub ? <div className="text-xs text-slate-500 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Pill({
  active,
  title,
  desc,
  onClick,
}: {
  active?: boolean;
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full text-left rounded-2xl border p-4 transition shadow-sm",
        active
          ? "border-[#00477f]/30 bg-[#00477f]/5"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {active ? (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#00477f] text-white">
            Selected
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-600">
            Select
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-600">{desc}</div>
    </button>
  );
}

// --- Workspace shape (supports your API returning scopeType/scopeId) ---
type WorkspaceMeResponse = {
  ok?: boolean;
  workspace?: {
    scopeType?: string;
    scopeId?: string;
    logoUrl?: string;
    customerId?: string;
    _id?: string;
    id?: string;
  } | null;
  customerId?: string;
  workspaceId?: string;
  _id?: string;
};

function pickCustomerIdFromWorkspacePayload(payload: any): {
  customerId: string;
  scopeType: string;
  scopeId: string;
} {
  const data: any = payload?.data ?? payload ?? {};
  const ws = data?.workspace ?? {};

  const scopeType = String(ws?.scopeType ?? data?.scopeType ?? "").toUpperCase();
  const scopeId = String(ws?.scopeId ?? data?.scopeId ?? "").trim();

  const legacyCustomerId =
    data?.customerId ||
    ws?.customerId ||
    ws?._id ||
    ws?.id ||
    data?.workspaceId ||
    data?._id ||
    "";

  const customerId =
    scopeType === "CUSTOMER" || scopeType === "BUSINESS"
      ? scopeId
      : String(legacyCustomerId || "").trim();

  return { customerId, scopeType, scopeId };
}

export default function ApprovalNew() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // If ?edit=<id> is present, we are editing an existing request
  const editId = (searchParams.get("edit") || "").trim();
  const editing = Boolean(editId);

  const [editingRequest, setEditingRequest] = useState<ApprovalRequest | null>(
    null
  );
  const [editLoading, setEditLoading] = useState<boolean>(false);

  // Workspace / customer context
  const [customerId, setCustomerId] = useState<string>("");
  const [scopeType, setScopeType] = useState<string>("");
  const [scopeId, setScopeId] = useState<string>("");
  const [wsLoading, setWsLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setWsLoading(true);

        const qsCustomerId =
          new URLSearchParams(window.location.search)
            .get("customerId")
            ?.trim() || "";

        const res: any = (await getWorkspaceMe()) as WorkspaceMeResponse;
        const picked = pickCustomerIdFromWorkspacePayload(res);

        if (!alive) return;

        if (qsCustomerId) {
          setCustomerId(qsCustomerId);
          setScopeType("CUSTOMER");
          setScopeId(qsCustomerId);
        } else {
          setCustomerId(picked.customerId);
          setScopeType(picked.scopeType);
          setScopeId(picked.scopeId);
        }
      } catch {
        if (!alive) return;
        setCustomerId("");
        setScopeType("");
        setScopeId("");
      } finally {
        if (!alive) return;
        setWsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const workspaceLabel = useMemo(() => {
    if (wsLoading) return "Loading…";
    if (!customerId) return "missing";
    const st = scopeType || "WORKSPACE";
    const id = scopeId || customerId;
    const short = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
    return `${st} • ${short}`;
  }, [wsLoading, customerId, scopeType, scopeId]);

  const workspaceWarning = useMemo(() => {
    if (wsLoading) return "";
    if (!customerId && !editing) {
      return "Workspace missing for this login.";
    }
    if ((scopeType || "").toUpperCase() === "USER") {
      return "You are in USER scope. If approvals must route through a Customer/Business workspace, Admin must link your login to a Customer workspace (or set DEFAULT_CUSTOMER_BUSINESS_ID on backend).";
    }
    return "";
  }, [wsLoading, customerId, scopeType, editing]);

  // Service selection
  const [type, setType] = useState<ServiceKey>("flight");

  // Common request-level fields
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(
    "Normal"
  );
  const [needBy, setNeedBy] = useState(addDaysISO(2));
  const [comments, setComments] = useState("");

  // ✅ Request-level: Domestic / International + Travellers
  const [travelScope, setTravelScope] = useState<TravelScope>("domestic");
  const [travellerCount, setTravellerCount] = useState<number>(1);
  const [travellers, setTravellers] = useState<Traveller[]>([
    emptyTraveller(),
  ]);

  // Keep travellers list synced with travellerCount
  useEffect(() => {
    setTravellers((p) => ensureTravellersCount(p, travellerCount));
  }, [travellerCount]);

  // ✅ Budget is frozen/removed — keep as 0 always (for backward compatibility)
  const estimatedBudget = 0;

  // Per-service dynamic form state (stored into meta)
  const [meta, setMeta] = useState<Record<string, any>>({
    flight: {
      tripType: "oneway",
      origin: "",
      destination: "",
      departDate: addDaysISO(5),
      returnDate: addDaysISO(8),
      cabinClass: "Economy",
      adults: 1,
      children: 0,
      infants: 0,
      preferredTime: "Any",
      preferredAirline: "",
      directOnly: false,
      flexibleDates: false,
      preferredFlightTime: "",
      notes: "",
    },
    hotel: {
      // ✅ Manual only (no Google API / no modal)
      city: "",
      checkIn: addDaysISO(5),
      checkOut: addDaysISO(8),
      rooms: 1,
      adults: 1,
      children: 0,
      hotelType: "Business",
      starRating: "Any",
      roomType: "Standard",
      mealPlan: "Breakfast",
      locationPreference: "",
      notes: "",
    },
    visa: {
      destinationCountry: "",
      visaType: "eVisa",
      purpose: "Business",
      travelDate: addDaysISO(20),
      returnDate: addDaysISO(28),
      travelers: 1,
      processingSpeed: "Standard",
      passportValidityMonths: 6,
      notes: "",
    },
    cab: {
      city: "",
      tripType: "oneway",
      pickup: "",
      drop: "",
      pickupDate: addDaysISO(5),
      pickupTime: "10:00",
      vehicleType: "Sedan",
      passengers: 1,
      luggage: "Medium",
      notes: "",
    },
    forex: {
      currency: "USD",
      amount: 0,
      deliveryMode: "Cash",
      city: "",
      requiredBy: addDaysISO(3),
      purpose: "Travel",
      notes: "",
    },
    esim: {
      country: "",
      startDate: addDaysISO(5),
      days: 7,
      dataPack: "5 GB",
      numberOfTravellers: 1,
      notes: "",
    },
    holiday: {
      destination: "",
      startDate: addDaysISO(15),
      days: 5,
      people: 2,
      budgetBand: "Premium",
      hotelClass: "4 Star",
      inclusions: ["Hotel", "Breakfast"],
      interests: "",
      notes: "",
    },
    mice: {
      mode: "Offsite",
      location: "",
      startDate: addDaysISO(30),
      endDate: addDaysISO(32),
      attendees: 25,
      travelMode: "Flights",
      hotelType: "4 Star",
      addOns: ["AV Setup", "Airport Transfers"],
      foodPref: "Veg + Non-Veg",
      servicesNeeded: "Venue + Stay + Logistics",
      notes: "",
    },
  });

  const [cart, setCart] = useState<ApprovalCartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🔍 Preview drawer state (read-only advisor)
const [previewOpen, setPreviewOpen] = useState(false);
const [previewMode, setPreviewMode] = useState<"flight" | "hotel">("flight");


  const total = useMemo(
    () =>
      cart.reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1),
        0
      ),
    [cart]
  );

  const serviceDef = useMemo(
    () => SERVICE_TYPES.find((s) => s.key === type)!,
    [type]
  );
  const m = meta[type] || {};

  function setMetaField(key: string, value: any) {
    setMeta((p) => ({ ...p, [type]: { ...(p[type] || {}), [key]: value } }));
  }

  // --- Load existing request in Edit mode ---
  useEffect(() => {
    if (!editing || !editId) return;

    let alive = true;

    (async () => {
      try {
        setEditLoading(true);

        const res = await getApprovalRequest(editId);
        if (!alive) return;

        const req = res?.request as ApprovalRequest;
        setEditingRequest(req);

        const reqCart = Array.isArray((req as any).cartItems)
          ? (((req as any).cartItems as any[]) || [])
          : [];
        setCart(reqCart as any);
        setComments((req as any).comments || "");

        // Restore travellers/scope + preselect service + hydrate meta for edit-mode UI
        if (reqCart.length > 0) {
          const firstItem: any = reqCart[0] || {};
          const firstType = (firstItem.type as ServiceKey) || "flight";
          const firstMeta = firstItem.meta || {};

          const sc = (firstMeta.travelScope as TravelScope) || "domestic";
          const trs = Array.isArray(firstMeta.travellers)
            ? firstMeta.travellers
            : null;

          if (trs && trs.length) {
            setTravelScope(sc);
            setTravellerCount(trs.length);
            setTravellers(ensureTravellersCount(trs, trs.length));
          } else {
            if (sc) setTravelScope(sc);
          }

          if (SERVICE_TYPES.some((s) => s.key === firstType)) {
            setType(firstType);
          }

          setMeta((p) => {
            const merged: any = { ...(p[firstType] || {}), ...(firstMeta || {}) };

            // ✅ If older hotel meta used google object, normalize to manual city label
            if (firstType === "hotel") {
              const cityFromOld =
                ensureStr(merged.city) ||
                ensureStr(merged?.hotel?.name) ||
                ensureStr(merged?.hotel?.address) ||
                "";
              merged.city = cityFromOld;
              delete merged.hotel;
            }

            return { ...p, [firstType]: merged };
          });
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load request for editing.");
      } finally {
        if (!alive) return;
        setEditLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [editing, editId]);

  function addItemToCart() {
    setErr(null);

    // ✅ validate travellers first (applies to ALL services)
    const syncTravellers = ensureTravellersCount(travellers, travellerCount);
    const tErr = validateTravellers(travelScope, syncTravellers);
    if (tErr) {
      setErr(tErr);
      return;
    }

    const must = (cond: any, message: string) => {
      const ok =
        typeof cond === "string" ? cond.trim().length > 0 : Boolean(cond);
      if (!ok) {
        setErr(message);
        return false;
      }
      return true;
    };

    if (type === "flight") {
      if (!must(ensureStr(m.origin), "Flight: please enter Origin.")) return;
      if (!must(ensureStr(m.destination), "Flight: please enter Destination."))
        return;
      if (
        !must(ensureStr(m.departDate), "Flight: please select Departure date.")
      )
        return;
      if (
        String(m.tripType || "").toLowerCase() === "roundtrip" &&
        !must(ensureStr(m.returnDate), "Flight: please select Return date.")
      )
        return;
    }

    if (type === "hotel") {
      if (
        !must(
          ensureStr(m.city),
          "Hotel: please enter City / Area / Hotel name."
        )
      )
        return;
      if (!must(ensureStr(m.checkIn), "Hotel: please select Check-in date."))
        return;
      if (!must(ensureStr(m.checkOut), "Hotel: please select Check-out date."))
        return;
    }

    if (type === "visa") {
      if (
        !must(
          ensureStr(m.destinationCountry),
          "Visa: please enter Destination country."
        )
      )
        return;
      if (!must(ensureStr(m.travelDate), "Visa: please select Journey date."))
        return;
    }

    if (type === "cab") {
      if (!must(ensureStr(m.city), "Cab: please enter City.")) return;
      if (!must(ensureStr(m.pickup), "Cab: please enter Pickup location."))
        return;
      if (!must(ensureStr(m.drop), "Cab: please enter Drop location.")) return;
    }

    if (type === "forex") {
      if (!must(Number(m.amount) > 0, "Forex: please enter Amount.")) return;
    }

    if (type === "esim") {
      if (!must(ensureStr(m.country), "eSIM: please enter Country.")) return;
    }

    if (type === "holiday") {
      if (
        !must(ensureStr(m.destination), "Holidays: please enter Destination.")
      )
        return;
    }

    if (type === "mice") {
      if (!must(ensureStr(m.location), "MICE: please enter Location.")) return;
      if (!must(Number(m.attendees) > 0, "MICE: please enter Attendees count."))
        return;
    }

    const title = (() => {
      if (type === "flight") {
        const tt =
          m.tripType === "roundtrip"
            ? "Round Trip"
            : m.tripType === "multicity"
            ? "Multi City"
            : "One Way";
        return `${ensureStr(m.origin)} → ${ensureStr(m.destination)} (${tt})`;
      }
      if (type === "hotel") {
        const q = ensureStr(m.city);
        return `${q || "Hotel"} • ${ensureStr(m.hotelType || "Hotel")} stay`;
      }
      if (type === "visa")
        return `${ensureStr(m.destinationCountry)} • ${ensureStr(
          m.visaType || "Visa"
        )}`;
      if (type === "cab")
        return `${ensureStr(m.city)} • ${ensureStr(m.pickup)} → ${ensureStr(
          m.drop
        )}`;
      if (type === "forex")
        return `${ensureStr(m.currency)} • ${Number(m.amount || 0)} forex`;
      if (type === "esim")
        return `${ensureStr(m.country)} • eSIM (${ensureStr(m.dataPack || "")})`;
      if (type === "holiday")
        return `${ensureStr(m.destination)} • ${Number(m.days || 0)} days`;
      if (type === "mice")
        return `${ensureStr(m.mode || "MICE")} • ${ensureStr(m.location)}`;
      return serviceDef.label;
    })();

    const qty = (() => {
      if (type === "flight")
        return (
          safeInt(m.adults, 1) + safeInt(m.children, 0) + safeInt(m.infants, 0)
        );
      if (type === "hotel") return safeInt(m.rooms, 1);
      if (type === "visa") return safeInt(m.travelers, 1);
      if (type === "cab") return 1;
      if (type === "forex") return 1;
      if (type === "esim") return safeInt(m.numberOfTravellers, 1);
      if (type === "holiday") return safeInt(m.people, 1);
      if (type === "mice") return 1;
      return 1;
    })();

    const item: ApprovalCartItem = {
      type,
      title,
      description: ensureStr(m.notes || ""),
      qty,
      // ✅ Budget frozen: keep 0
      price: 0,
      meta: {
        ...m,

        // ✅ Budget frozen: ensure no stale field persists
        estimatedBudget: undefined,

        priority,
        needBy,

        // ✅ global travellers injected into every service item
        travelScope,
        travellers: syncTravellers,
      },
    };

    // ✅ ensure "hotel" object isn't accidentally persisted
    if (type === "hotel") {
      (item.meta as any).hotel = undefined;
    }

    setCart((p) => [item, ...p]);
    setMetaField("notes", "");
    setTravellers(syncTravellers);
  }

  function remove(idx: number) {
    setCart((p) => p.filter((_, i) => i !== idx));
  }

  async function submit() {
    setErr(null);

    if (!cart.length) {
      setErr("Add at least one service item before submitting.");
      return;
    }

    // For NEW requests we still enforce workspace / customerId.
    if (!editing) {
      if (wsLoading) {
        setErr("Loading workspace… please try again in a moment.");
        return;
      }
      if (!customerId) {
        setErr(
          "Customer workspace not found for this login. Ask Admin to create/link Business workspace (MasterData) or set DEFAULT_CUSTOMER_BUSINESS_ID on backend."
        );
        return;
      }
    }

    const syncTravellers = ensureTravellersCount(travellers, travellerCount);
    const tErr = validateTravellers(travelScope, syncTravellers);
    if (tErr) {
      setErr(tErr);
      return;
    }

    const patchedCart = cart.map((c: any) => {
      const next = {
        ...c,
        price: 0, // ✅ freeze again at submit time
        meta: {
          ...(c.meta || {}),
          travelScope,
          travellers: syncTravellers,
        },
      };

      // ✅ strip legacy hotel object if present
      if (next.type === "hotel") {
        next.meta = { ...(next.meta || {}) };
        delete (next.meta as any).hotel;
      }

      // ✅ strip any accidental budget
      delete (next.meta as any).estimatedBudget;

      return next;
    });

    setSaving(true);
    try {
      if (editing && editId) {
        await updateApprovalRequest(editId, { cartItems: patchedCart, comments });
      } else {
        await submitApprovalRequest({
          customerId,
          cartItems: patchedCart,
          comments,
        });
      }
      nav("/customer/approvals/mine");
    } catch (e: any) {
      setErr(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  const scopeLabel = travelScope === "international" ? "International" : "Domestic";

  const travellersPreview = useMemo(() => {
    const list = ensureTravellersCount(travellers, travellerCount);
    return list
      .map((t) =>
        `${ensureStr(t.firstName) || "—"} ${ensureStr(t.lastName) || ""}`.trim()
      )
      .join(" • ");
  }, [travellers, travellerCount]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#00477f]/10 via-white to-[#d06549]/10 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] tracking-widest text-slate-500 uppercase">
              PlumTrips • Corporate Travel
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {editing ? "Update Travel Request" : "Raise a Travel Request"}
            </div>
            <div className="mt-1 text-sm text-slate-600 max-w-2xl">
              {editing
                ? "Adjust your itinerary and notes. Changes stay in sync with the Approver Inbox and Admin queue."
                : "Add structured travel details (flight, hotel, visa, etc.), get approvals fast, and keep every request audit-ready."}
            </div>

            <div className="mt-2 text-[11px] text-slate-500">
              Workspace:{" "}
              {wsLoading ? (
                <span className="text-slate-600">Loading…</span>
              ) : customerId ? (
                <span className="text-slate-700">{workspaceLabel}</span>
              ) : (
                <span className="text-red-600">
                  {editing ? "using existing request context" : "missing"}
                </span>
              )}
            </div>

            {editingRequest ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11px] text-indigo-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Editing request{" "}
                <b>
                  {(editingRequest as any).ticketId
                    ? (editingRequest as any).ticketId
                    : `REQ-${String((editingRequest as any)._id)
                        .slice(-6)
                        .toUpperCase()}`}
                </b>
              </div>
            ) : null}

            {!wsLoading && workspaceWarning ? (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 max-w-2xl">
                {workspaceWarning}
              </div>
            ) : null}
          </div>

          <button
            className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm shadow-sm"
            onClick={() => nav("/customer/approvals/mine")}
          >
            My Requests
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SERVICE_TYPES.map((s) => (
            <Chip
              key={s.key}
              active={type === s.key}
              onClick={() => {
                setErr(null);
                setType(s.key);
              }}
            >
              <span className="mr-1">{s.emoji}</span> {s.label}
            </Chip>
          ))}
        </div>

        <div className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{serviceDef.label}:</span>{" "}
          {serviceDef.hint}
        </div>
      </div>

      {err ? (
        <div className="mt-4 p-3 rounded-2xl bg-red-50 text-red-700 border border-red-100">
          {err}
        </div>
      ) : null}

      {editLoading ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          Loading existing request for editing…
        </div>
      ) : null}

      {/* ✅ Request-level Travel Scope + Travellers */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Traveller Details
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                This is attached to the request and flows across flights, hotels,
                visas, cabs, forex, eSIM, holidays and MICE.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                {scopeLabel}
              </span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[#00477f]/10 text-[#00477f]">
                {travellerCount} Traveller{travellerCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Pill
                  active={travelScope === "domestic"}
                  title="Domestic"
                  desc="First Name + Last Name required for each traveller."
                  onClick={() => setTravelScope("domestic")}
                />
                <Pill
                  active={travelScope === "international"}
                  title="International"
                  desc="Add DOB, Passport Number, Passport Expiry and Nationality for each traveller."
                  onClick={() => setTravelScope("international")}
                />
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-700 font-medium">
                  Quick Preview
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {travellersPreview?.trim()
                    ? travellersPreview
                    : "Add traveller names to preview here."}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-900">
                Traveller Count
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Keep this aligned with your booking needs. You can change later.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                  onClick={() => setTravellerCount((p) => Math.max(1, p - 1))}
                >
                  −
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                  onClick={() => setTravellerCount((p) => Math.min(12, p + 1))}
                >
                  +
                </button>
              </div>
              <div className="mt-2">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={travellerCount}
                  onChange={(e) =>
                    setTravellerCount(
                      Math.max(1, Math.min(12, safeInt(e.target.value, 1)))
                    )
                  }
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Tip: Max 12 per request (increase if needed).
              </div>
            </div>
          </div>

          {/* Travellers list */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Travellers
              </div>
              <div className="text-[11px] text-slate-500">
                {travelScope === "international"
                  ? "International: all passport fields required."
                  : "Domestic: only name required."}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {ensureTravellersCount(travellers, travellerCount).map(
                (t, idx) => {
                  const intl = travelScope === "international";

                  const setT = (k: keyof Traveller, v: any) => {
                    setTravellers((p) => {
                      const next = ensureTravellersCount(p, travellerCount);
                      next[idx] = { ...next[idx], [k]: v };
                      return next;
                    });
                  };

                  return (
                    <div
                      key={idx}
                      className="rounded-3xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-900">
                            Traveller {idx + 1}
                          </div>
                          <span
                            className={cx(
                              "text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border",
                              intl
                                ? "bg-[#d06549]/10 text-[#b54732] border-[#d06549]/20"
                                : "bg-[#00477f]/10 text-[#00477f] border-[#00477f]/20"
                            )}
                          >
                            {intl ? "International" : "Domestic"}
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Field label="First Name">
                            <Input
                              value={t.firstName || ""}
                              onChange={(e) =>
                                setT("firstName", e.target.value)
                              }
                              placeholder="e.g., Rahul"
                            />
                          </Field>

                          <Field label="Last Name">
                            <Input
                              value={t.lastName || ""}
                              onChange={(e) => setT("lastName", e.target.value)}
                              placeholder="e.g., Sharma"
                            />
                          </Field>
                        </div>

                        {intl ? (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Date of Birth">
                              <Input
                                type="date"
                                value={t.dob || ""}
                                onChange={(e) => setT("dob", e.target.value)}
                              />
                            </Field>

                            <Field label="Nationality">
                              <Input
                                value={t.nationality || ""}
                                onChange={(e) =>
                                  setT("nationality", e.target.value)
                                }
                                placeholder="e.g., Indian"
                              />
                            </Field>

                            <Field label="Passport Number">
                              <Input
                                value={t.passportNumber || ""}
                                onChange={(e) =>
                                  setT("passportNumber", e.target.value)
                                }
                                placeholder="e.g., K1234567"
                              />
                            </Field>

                            <Field label="Passport Expiry Date">
                              <Input
                                type="date"
                                value={t.passportExpiry || ""}
                                onChange={(e) =>
                                  setT("passportExpiry", e.target.value)
                                }
                              />
                            </Field>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                            Domestic travel typically needs only traveller names.
                            If this becomes international later, switch scope and
                            fill passport fields.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Dynamic Form */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {editing ? "Adjust Service Item" : "Add Service Item"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Fill details for <b>{serviceDef.label}</b>. These fields will
                    be stored under <b>cartItems[].meta</b>.
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full text-xs border border-slate-200 bg-slate-50 text-slate-700">
                  {String(type).toUpperCase()}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Need By" hint="Internal SLA">
                  <Input
                    type="date"
                    min={todayISO()}
                    value={needBy}
                    onChange={(e) => setNeedBy(e.target.value)}
                  />
                </Field>
              </div>

              {/* ✅ Budget frozen notice */}
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
                Estimated Budget is temporarily disabled for stability. Approvals
                will proceed based on itinerary details and notes.
              </div>
            </div>

            {/* Dynamic per-service forms */}
            <div className="p-5">
              {/* FLIGHT */}
              {type === "flight" ? (
                <>
                  <div className="flex items-center justify-between">
  <SectionTitle
    title="Flight Details"
    sub="Origin, destination, dates, cabin, passengers & preferences"
  />

  </div>
                    
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Trip Type">
                      <Select
                        value={m.tripType || "oneway"}
                        onChange={(e) => setMetaField("tripType", e.target.value)}
                      >
                        <option value="oneway">One Way</option>
                        <option value="roundtrip">Round Trip</option>
                        <option value="multicity">Multi City (notes)</option>
                      </Select>
                    </Field>

                    <Field label="Cabin Class">
                      <Select
                        value={m.cabinClass || "Economy"}
                        onChange={(e) =>
                          setMetaField("cabinClass", e.target.value)
                        }
                      >
                        <option>Economy</option>
                        <option>Premium Economy</option>
                        <option>Business</option>
                        <option>First</option>
                      </Select>
                    </Field>

                    <Field label="Preferred Time">
                      <Select
                        value={m.preferredTime || "Any"}
                        onChange={(e) =>
                          setMetaField("preferredTime", e.target.value)
                        }
                      >
                        <option>Any</option>
                        <option>Morning</option>
                        <option>Afternoon</option>
                        <option>Evening</option>
                        <option>Night</option>
                      </Select>
                    </Field>

                    <Field label="Origin" hint="Airport / City code">
                      <AirportAutocomplete
                        value={m.origin || ""}
                        onSelect={(a) => {
                          setMetaField("origin", a.iata);
                          setMetaField("originMeta", a);
                        }}
                        placeholder="From (e.g., DEL / Delhi)"
                      />
                    </Field>

                    <Field label="Destination" hint="Airport / City code">
                      <AirportAutocomplete
                        value={m.destination || ""}
                        onSelect={(a) => {
                          setMetaField("destination", a.iata);
                          setMetaField("destinationMeta", a);
                        }}
                        placeholder="To (e.g., BOM / Mumbai)"
                      />
                    </Field>

                    <Field label="Preferred Airline" hint="Optional">
                      <Input
                        value={m.preferredAirline || ""}
                        onChange={(e) =>
                          setMetaField("preferredAirline", e.target.value)
                        }
                        placeholder="e.g., Air India / IndiGo"
                      />
                    </Field>

                    <Field label="Departure Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.departDate || ""}
                        onChange={(e) =>
                          setMetaField("departDate", e.target.value)
                        }
                      />
                    </Field>

                    {String(m.tripType || "").toLowerCase() === "roundtrip" ? (
                      <Field label="Return Date">
                        <Input
                          type="date"
                          min={todayISO()}
                          value={m.returnDate || ""}
                          onChange={(e) =>
                            setMetaField("returnDate", e.target.value)
                          }
                        />
                      </Field>
                    ) : (
                      <div className="md:col-span-1" />
                    )}

                    <Field label="Preferred Flight Time" hint="Optional">
                      <Input
                        value={m.preferredFlightTime || ""}
                        onChange={(e) =>
                          setMetaField("preferredFlightTime", e.target.value)
                        }
                        placeholder="e.g., 9am–12pm"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Field label="Adults">
                      <Input
                        type="number"
                        min={1}
                        value={m.adults ?? 1}
                        onChange={(e) =>
                          setMetaField("adults", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>
                    <Field label="Children">
                      <Input
                        type="number"
                        min={0}
                        value={m.children ?? 0}
                        onChange={(e) =>
                          setMetaField("children", safeInt(e.target.value, 0))
                        }
                      />
                    </Field>
                    <Field label="Infants">
                      <Input
                        type="number"
                        min={0}
                        value={m.infants ?? 0}
                        onChange={(e) =>
                          setMetaField("infants", safeInt(e.target.value, 0))
                        }
                      />
                    </Field>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] text-slate-500">Pax Total</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {safeInt(m.adults, 1) +
                          safeInt(m.children, 0) +
                          safeInt(m.infants, 0)}
                      </div>
                    </div>
                  </div>
                  {/* Search Preview Button */}
<div className="mt-4 flex justify-end">
  <button
    type="button"
    disabled={!m.origin || !m.destination || !m.departDate}
    className={cx(
      "px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition",
      m.origin && m.destination && m.departDate
        ? "bg-[#00477f] text-white hover:opacity-95"
        : "bg-slate-200 text-slate-500 cursor-not-allowed"
    )}
    onClick={() => {
      setPreviewMode("flight");
      setPreviewOpen(true);
    }}
  >
    🔍 Search Flights (Indicative Prices)
  </button>
</div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(m.directOnly)}
                        onChange={(e) =>
                          setMetaField("directOnly", e.target.checked)
                        }
                      />
                      Direct flights only
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(m.flexibleDates)}
                        onChange={(e) =>
                          setMetaField("flexibleDates", e.target.checked)
                        }
                      />
                      Flexible dates (±1–2 days)
                    </label>
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Multi-city segments, seat prefs, baggage, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Prefer aisle seat, 15kg baggage, multi-city: DEL→BOM→BLR…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* HOTEL */}
              {type === "hotel" ? (
                <>
                  <div className="flex items-center justify-between">
  <SectionTitle
    title="Hotel Details"
    sub="Manual entry (City / Area / Preferred Hotel)"
  />

  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field
                      label="City / Area / Hotel Name"
                      hint="Manual entry (no search)"
                    >
                      <Input
                        value={m.city || ""}
                        onChange={(e) => setMetaField("city", e.target.value)}
                        placeholder="Hotel City or Locality"
                      />
                    </Field>

                    <Field label="Check-in">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.checkIn || ""}
                        onChange={(e) => setMetaField("checkIn", e.target.value)}
                      />
                    </Field>
                    <Field label="Check-out">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.checkOut || ""}
                        onChange={(e) =>
                          setMetaField("checkOut", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Rooms">
                      <Input
                        type="number"
                        min={1}
                        value={m.rooms ?? 1}
                        onChange={(e) =>
                          setMetaField("rooms", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>
                    <Field label="Adults">
                      <Input
                        type="number"
                        min={1}
                        value={m.adults ?? 1}
                        onChange={(e) =>
                          setMetaField("adults", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>
                    <Field label="Children">
                      <Input
                        type="number"
                        min={0}
                        value={m.children ?? 0}
                        onChange={(e) =>
                          setMetaField("children", safeInt(e.target.value, 0))
                        }
                      />
                    </Field>

                    <Field label="Hotel Type">
                      <Select
                        value={m.hotelType || "Business"}
                        onChange={(e) =>
                          setMetaField("hotelType", e.target.value)
                        }
                      >
                        <option>Business</option>
                        <option>Boutique</option>
                        <option>Luxury</option>
                        <option>Budget</option>
                        <option>Serviced Apartment</option>
                      </Select>
                    </Field>

                    <Field label="Star Rating">
                      <Select
                        value={m.starRating || "Any"}
                        onChange={(e) =>
                          setMetaField("starRating", e.target.value)
                        }
                      >
                        <option>Any</option>
                        <option>3 Star</option>
                        <option>4 Star</option>
                        <option>5 Star</option>
                      </Select>
                    </Field>

                    <Field label="Room Type">
                      <Select
                        value={m.roomType || "Standard"}
                        onChange={(e) =>
                          setMetaField("roomType", e.target.value)
                        }
                      >
                        <option>Standard</option>
                        <option>Deluxe</option>
                        <option>Executive</option>
                        <option>Suite</option>
                      </Select>
                    </Field>

                    <Field label="Meal Plan">
                      <Select
                        value={m.mealPlan || "Breakfast"}
                        onChange={(e) =>
                          setMetaField("mealPlan", e.target.value)
                        }
                      >
                        <option>Breakfast</option>
                        <option>Half Board</option>
                        <option>Full Board</option>
                        <option>No Meals</option>
                      </Select>
                    </Field>

                    <Field label="Location Preference" hint="Optional">
                      <Input
                        value={m.locationPreference || ""}
                        onChange={(e) =>
                          setMetaField("locationPreference", e.target.value)
                        }
                        placeholder="Near office / airport / conference venue…"
                      />
                    </Field>
                  </div>

                  {/* Search Preview Button */}
<div className="mt-4 flex justify-end">
  <button
    type="button"
    disabled={!m.city || !m.checkIn || !m.checkOut}
    className={cx(
      "px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition",
      m.city && m.checkIn && m.checkOut
        ? "bg-[#00477f] text-white hover:opacity-95"
        : "bg-slate-200 text-slate-500 cursor-not-allowed"
    )}
    onClick={() => {
      setPreviewMode("hotel");
      setPreviewOpen(true);
    }}
  >
    🔍 Search Hotels (Indicative Prices)
  </button>
</div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Early check-in, late checkout, bed type, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Early check-in 9am, king bed, quiet room…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* VISA */}
              {type === "visa" ? (
                <>
                  <SectionTitle
                    title="Visa Details"
                    sub="Destination, visa type, journey dates & processing preference"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Destination Country">
                      <Input
                        value={m.destinationCountry || ""}
                        onChange={(e) =>
                          setMetaField("destinationCountry", e.target.value)
                        }
                        placeholder="e.g., UAE / Singapore"
                      />
                    </Field>

                    <Field label="Visa Type">
                      <Select
                        value={m.visaType || "eVisa"}
                        onChange={(e) => setMetaField("visaType", e.target.value)}
                      >
                        <option value="eVisa">eVisa</option>
                        <option value="sticker">Sticker</option>
                        <option value="stamp">Stamp</option>
                      </Select>
                    </Field>

                    <Field label="Purpose">
                      <Select
                        value={m.purpose || "Business"}
                        onChange={(e) => setMetaField("purpose", e.target.value)}
                      >
                        <option>Business</option>
                        <option>Tourism</option>
                        <option>Conference</option>
                        <option>Transit</option>
                      </Select>
                    </Field>

                    <Field label="Journey Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.travelDate || ""}
                        onChange={(e) => setMetaField("travelDate", e.target.value)}
                      />
                    </Field>

                    <Field label="Return Date" hint="Optional">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.returnDate || ""}
                        onChange={(e) => setMetaField("returnDate", e.target.value)}
                      />
                    </Field>

                    <Field label="Travellers">
                      <Input
                        type="number"
                        min={1}
                        value={m.travelers ?? 1}
                        onChange={(e) =>
                          setMetaField("travelers", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="Processing Speed">
                      <Select
                        value={m.processingSpeed || "Standard"}
                        onChange={(e) =>
                          setMetaField("processingSpeed", e.target.value)
                        }
                      >
                        <option>Standard</option>
                        <option>Express</option>
                        <option>Super Express</option>
                      </Select>
                    </Field>

                    <Field label="Passport Validity (months)">
                      <Input
                        type="number"
                        min={3}
                        value={m.passportValidityMonths ?? 6}
                        onChange={(e) =>
                          setMetaField(
                            "passportValidityMonths",
                            safeInt(e.target.value, 3)
                          )
                        }
                      />
                    </Field>

                    <div className="md:col-span-1" />
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Nationality, prior visas, travel history, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Indian passport, first-time travel, need multi-entry if possible…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* CAB */}
              {type === "cab" ? (
                <>
                  <SectionTitle
                    title="Cab Details"
                    sub="Pickup/drop, date/time, vehicle & transfer type"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="City">
                      <Input
                        value={m.city || ""}
                        onChange={(e) => setMetaField("city", e.target.value)}
                        placeholder="e.g., Gurgaon"
                      />
                    </Field>

                    <Field label="Trip Type">
                      <Select
                        value={m.tripType || "oneway"}
                        onChange={(e) => setMetaField("tripType", e.target.value)}
                      >
                        <option value="oneway">One Way</option>
                        <option value="roundtrip">Round Trip</option>
                        <option value="hourly">Hourly</option>
                      </Select>
                    </Field>

                    <Field label="Vehicle Type">
                      <Select
                        value={m.vehicleType || "Sedan"}
                        onChange={(e) =>
                          setMetaField("vehicleType", e.target.value)
                        }
                      >
                        <option>Sedan</option>
                        <option>SUV</option>
                        <option>Innova / MPV</option>
                        <option>Tempo Traveller</option>
                      </Select>
                    </Field>

                    <Field label="Pickup Location">
                      <Input
                        value={m.pickup || ""}
                        onChange={(e) => setMetaField("pickup", e.target.value)}
                        placeholder="Airport / hotel / office…"
                      />
                    </Field>

                    <Field label="Drop Location">
                      <Input
                        value={m.drop || ""}
                        onChange={(e) => setMetaField("drop", e.target.value)}
                        placeholder="Hotel / venue / airport…"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Pickup Date">
                        <Input
                          type="date"
                          min={todayISO()}
                          value={m.pickupDate || ""}
                          onChange={(e) =>
                            setMetaField("pickupDate", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Pickup Time">
                        <Input
                          type="time"
                          value={m.pickupTime || "10:00"}
                          onChange={(e) =>
                            setMetaField("pickupTime", e.target.value)
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Passengers">
                      <Input
                        type="number"
                        min={1}
                        value={m.passengers ?? 1}
                        onChange={(e) =>
                          setMetaField("passengers", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="Luggage">
                      <Select
                        value={m.luggage || "Medium"}
                        onChange={(e) => setMetaField("luggage", e.target.value)}
                      >
                        <option>Light</option>
                        <option>Medium</option>
                        <option>Heavy</option>
                      </Select>
                    </Field>

                    <div className="md:col-span-1" />
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Flight number, terminal, waiting time, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Flight AI-101 arriving 8:30pm, Terminal 3 pickup…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* FOREX */}
              {type === "forex" ? (
                <>
                  <SectionTitle
                    title="Forex Details"
                    sub="Currency, amount, delivery mode & where you need it"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Currency">
                      <Input
                        value={m.currency || "USD"}
                        onChange={(e) =>
                          setMetaField("currency", e.target.value.toUpperCase())
                        }
                        placeholder="USD"
                      />
                    </Field>

                    <Field label="Amount">
                      <Input
                        type="number"
                        min={0}
                        value={m.amount ?? 0}
                        onChange={(e) =>
                          setMetaField("amount", Number(e.target.value))
                        }
                        placeholder="e.g., 500"
                      />
                    </Field>

                    <Field label="Delivery Mode">
                      <Select
                        value={m.deliveryMode || "Cash"}
                        onChange={(e) =>
                          setMetaField("deliveryMode", e.target.value)
                        }
                      >
                        <option>Cash</option>
                        <option>Forex Card</option>
                        <option>Both</option>
                      </Select>
                    </Field>

                    <Field label="Required Location">
                      <Input
                        value={m.city || ""}
                        onChange={(e) => setMetaField("city", e.target.value)}
                        placeholder="e.g., Gurgaon / Mumbai"
                      />
                    </Field>

                    <Field label="Required By">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.requiredBy || ""}
                        onChange={(e) =>
                          setMetaField("requiredBy", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Purpose">
                      <Select
                        value={m.purpose || "Travel"}
                        onChange={(e) => setMetaField("purpose", e.target.value)}
                      >
                        <option>Travel</option>
                        <option>Conference</option>
                        <option>Client Visit</option>
                        <option>Other</option>
                      </Select>
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Cash split, denomination, KYC status, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Need $200 in small denominations, KYC completed…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* ESIM */}
              {type === "esim" ? (
                <>
                  <SectionTitle
                    title="eSIM Details"
                    sub="Country, travel start date, duration & data pack"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Country">
                      <Input
                        value={m.country || ""}
                        onChange={(e) => setMetaField("country", e.target.value)}
                        placeholder="e.g., Thailand"
                      />
                    </Field>

                    <Field label="Start Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.startDate || ""}
                        onChange={(e) =>
                          setMetaField("startDate", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Duration (days)">
                      <Input
                        type="number"
                        min={1}
                        value={m.days ?? 7}
                        onChange={(e) =>
                          setMetaField("days", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="Data Pack">
                      <Select
                        value={m.dataPack || "5 GB"}
                        onChange={(e) => setMetaField("dataPack", e.target.value)}
                      >
                        <option>1 GB</option>
                        <option>3 GB</option>
                        <option>5 GB</option>
                        <option>10 GB</option>
                        <option>Unlimited</option>
                      </Select>
                    </Field>

                    <Field label="Travellers">
                      <Input
                        type="number"
                        min={1}
                        value={m.numberOfTravellers ?? 1}
                        onChange={(e) =>
                          setMetaField(
                            "numberOfTravellers",
                            safeInt(e.target.value, 1)
                          )
                        }
                      />
                    </Field>

                    <div className="md:col-span-1" />
                  </div>

                  <div className="mt-4">
                    <Field label="Item Notes (optional)" hint="Device model, hotspots, etc.">
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Need hotspot support for laptop…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* HOLIDAY */}
              {type === "holiday" ? (
                <>
                  <SectionTitle
                    title="Holiday / Incentive Trip"
                    sub="Destination, duration, people, budget band & preferences"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Destination">
                      <Input
                        value={m.destination || ""}
                        onChange={(e) =>
                          setMetaField("destination", e.target.value)
                        }
                        placeholder="e.g., Bali / Kashmir"
                      />
                    </Field>

                    <Field label="Start Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.startDate || ""}
                        onChange={(e) =>
                          setMetaField("startDate", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="No. of Days">
                      <Input
                        type="number"
                        min={1}
                        value={m.days ?? 5}
                        onChange={(e) =>
                          setMetaField("days", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="People">
                      <Input
                        type="number"
                        min={1}
                        value={m.people ?? 2}
                        onChange={(e) =>
                          setMetaField("people", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="Budget Band">
                      <Select
                        value={m.budgetBand || "Premium"}
                        onChange={(e) =>
                          setMetaField("budgetBand", e.target.value)
                        }
                      >
                        <option>Premium</option>
                        <option>Luxury</option>
                        <option>Ultra Luxury</option>
                        <option>Value</option>
                      </Select>
                    </Field>

                    <Field label="Hotel Class">
                      <Select
                        value={m.hotelClass || "4 Star"}
                        onChange={(e) =>
                          setMetaField("hotelClass", e.target.value)
                        }
                      >
                        <option>3 Star</option>
                        <option>4 Star</option>
                        <option>5 Star</option>
                        <option>Villas</option>
                      </Select>
                    </Field>

                    <Field label="Interests" hint="Optional">
                      <Input
                        value={m.interests || ""}
                        onChange={(e) => setMetaField("interests", e.target.value)}
                        placeholder="Beaches, adventure, shopping…"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Inclusions" hint="Comma separated">
                        <Input
                          value={
                            Array.isArray(m.inclusions)
                              ? m.inclusions.join(", ")
                              : ensureStr(m.inclusions)
                          }
                          onChange={(e) =>
                            setMetaField(
                              "inclusions",
                              e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean)
                            )
                          }
                          placeholder="Hotel, breakfast, sightseeing…"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Item Notes (optional)"
                      hint="Preferred resorts, activities, special occasions, etc."
                    >
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., Anniversary trip, prefer ocean-view…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              {/* MICE */}
              {type === "mice" ? (
                <>
                  <SectionTitle
                    title="MICE / Corporate Offsite"
                    sub="Mode, dates, location, attendees & services needed"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Onsite / Offsite">
                      <Select
                        value={m.mode || "Offsite"}
                        onChange={(e) => setMetaField("mode", e.target.value)}
                      >
                        <option>Onsite</option>
                        <option>Offsite</option>
                      </Select>
                    </Field>

                    <Field label="Location">
                      <Input
                        value={m.location || ""}
                        onChange={(e) => setMetaField("location", e.target.value)}
                        placeholder="e.g., Goa / Jaipur / Gurgaon"
                      />
                    </Field>

                    <Field label="Attendees">
                      <Input
                        type="number"
                        min={1}
                        value={m.attendees ?? 25}
                        onChange={(e) =>
                          setMetaField("attendees", safeInt(e.target.value, 1))
                        }
                      />
                    </Field>

                    <Field label="Start Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.startDate || ""}
                        onChange={(e) =>
                          setMetaField("startDate", e.target.value)
                        }
                      />
                    </Field>

                    <Field label="End Date">
                      <Input
                        type="date"
                        min={todayISO()}
                        value={m.endDate || ""}
                        onChange={(e) => setMetaField("endDate", e.target.value)}
                      />
                    </Field>

                    <Field label="Travel Mode">
                      <Select
                        value={m.travelMode || "Flights"}
                        onChange={(e) =>
                          setMetaField("travelMode", e.target.value)
                        }
                      >
                        <option>Flights</option>
                        <option>Train</option>
                        <option>Bus</option>
                        <option>Self Drive</option>
                        <option>Not Required</option>
                      </Select>
                    </Field>

                    <Field label="Hotel Type">
                      <Select
                        value={m.hotelType || "4 Star"}
                        onChange={(e) =>
                          setMetaField("hotelType", e.target.value)
                        }
                      >
                        <option>3 Star</option>
                        <option>4 Star</option>
                        <option>5 Star</option>
                        <option>Resort</option>
                        <option>Villa / Private</option>
                      </Select>
                    </Field>

                    <Field label="Food Preferences">
                      <Select
                        value={m.foodPref || "Veg + Non-Veg"}
                        onChange={(e) => setMetaField("foodPref", e.target.value)}
                      >
                        <option>Veg</option>
                        <option>Non-Veg</option>
                        <option>Veg + Non-Veg</option>
                        <option>Vegan</option>
                        <option>Jain</option>
                      </Select>
                    </Field>

                    <div className="md:col-span-1" />
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Services Needed" hint="What should PlumTrips manage?">
                      <Input
                        value={m.servicesNeeded || ""}
                        onChange={(e) =>
                          setMetaField("servicesNeeded", e.target.value)
                        }
                        placeholder="Venue + Stay + Logistics + Activities…"
                      />
                    </Field>

                    <Field label="Additional Add-ons" hint="Comma separated">
                      <Input
                        value={
                          Array.isArray(m.addOns)
                            ? m.addOns.join(", ")
                            : ensureStr(m.addOns)
                        }
                        onChange={(e) =>
                          setMetaField(
                            "addOns",
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)
                          )
                        }
                        placeholder="AV setup, stage, photographer, branding…"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Item Notes (optional)" hint="Agenda, sessions, speakers, rooming, etc.">
                      <Textarea
                        rows={3}
                        value={m.notes || ""}
                        onChange={(e) => setMetaField("notes", e.target.value)}
                        placeholder="e.g., 2-day leadership offsite + team activity, need 1 main hall + 3 breakout rooms…"
                      />
                    </Field>
                  </div>
                </>
              ) : null}

              <div className="mt-6 flex flex-col md:flex-row gap-3">
                <button
                  type="button"
                  onClick={addItemToCart}
                  className="w-full md:w-auto flex-1 px-5 py-3 rounded-2xl bg-[#00477f] text-white font-medium shadow-sm hover:opacity-95"
                >
                  {editing ? "Add Item to Updated Cart" : "Add Item to Cart"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMetaField("notes", "");
                    setErr(null);
                  }}
                  className="w-full md:w-auto px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Clear Notes
                </button>
              </div>

              <div className="mt-4 text-[11px] text-slate-500">
                Tip: Add enough details in notes for fast approvals (timings,
                preferences, reason/urgency).
              </div>
            </div>
          </div>
        </div>

        {/* Right: Cart + Submit */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {editing ? "Updated Cart" : "Cart"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Review before {editing ? "saving changes" : "submitting"}
                  </div>
                </div>
                <div className="text-sm text-slate-700">
                  Total: <b>₹{niceMoney(total)}</b>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                Budget is currently disabled, so totals will remain ₹0.
              </div>
            </div>

            <div className="p-5">
              {cart.length ? (
                <div className="space-y-3">
                  {cart.map((c: any, idx) => {
                    const label =
                      SERVICE_TYPES.find((s) => s.key === (c.type as ServiceKey))
                        ?.label || String(c.type);
                    const mm = (c as any).meta || {};

                    const metaLine = (() => {
                      if (c.type === "flight")
                        return `${mm.origin || "—"} → ${mm.destination || "—"} • ${
                          mm.cabinClass || "—"
                        } • ${mm.departDate || "—"}`;

                      if (c.type === "hotel") {
                        const hotelLine = mm.city || "—";
                        return `${hotelLine} • ${mm.checkIn || "—"} to ${
                          mm.checkOut || "—"
                        } • Rooms ${mm.rooms ?? 1}`;
                      }

                      if (c.type === "visa")
                        return `${mm.destinationCountry || "—"} • ${
                          mm.visaType || "—"
                        } • ${mm.travelDate || "—"}`;
                      if (c.type === "cab")
                        return `${mm.city || "—"} • ${mm.pickup || "—"} → ${
                          mm.drop || "—"
                        } • ${mm.pickupDate || "—"}`;
                      if (c.type === "forex")
                        return `${mm.currency || "—"} ${mm.amount || 0} • ${
                          mm.deliveryMode || "—"
                        } • ${mm.requiredBy || "—"}`;
                      if (c.type === "esim")
                        return `${mm.country || "—"} • ${
                          mm.dataPack || "—"
                        } • ${mm.startDate || "—"}`;
                      if (c.type === "holiday")
                        return `${mm.destination || "—"} • ${
                          mm.days || 0
                        } days • People ${mm.people || 1}`;
                      if (c.type === "mice")
                        return `${mm.mode || "—"} • ${mm.location || "—"} • Attendees ${
                          mm.attendees || 0
                        }`;
                      return "";
                    })();

                    const travellerMini = (() => {
                      const trs = Array.isArray(mm.travellers) ? mm.travellers : [];
                      if (!trs.length) return "";
                      const names = trs
                        .slice(0, 2)
                        .map((t: any) =>
                          `${ensureStr(t.firstName) || "—"} ${ensureStr(t.lastName) || ""}`.trim()
                        )
                        .join(", ");
                      return trs.length > 2 ? `${names} +${trs.length - 2}` : names;
                    })();

                    return (
                      <div key={idx} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-slate-500">{label}</div>
                              {(mm.travelScope || travelScope) ? (
                                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  {String(mm.travelScope || travelScope)}
                                </span>
                              ) : null}
                            </div>

                            <div className="font-medium text-slate-900 truncate">
                              {c.title || "Request Item"}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">{metaLine}</div>

                            {travellerMini ? (
                              <div className="text-xs text-slate-600 mt-1">
                                Travellers: <b className="text-slate-800">{travellerMini}</b>
                              </div>
                            ) : null}

                            <div className="text-xs text-slate-600 mt-1">
                              Qty <b>{c.qty || 1}</b> • ₹<b>{niceMoney(Number(c.price || 0))}</b>
                            </div>

                            {c.description ? (
                              <div className="text-sm text-slate-700 mt-2">
                                {c.description}
                              </div>
                            ) : null}
                          </div>

                          <button
                            className="shrink-0 text-sm px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50"
                            onClick={() => remove(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  Add items from the left to build the request.
                </div>
              )}

              <div className="mt-5">
                <Field label="Comment to Approver" hint="Reason, urgency, traveler details">
                  <Textarea
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Example: Client visit urgent. Traveler: Rahul (Sales). Needs morning flight and hotel near BKC…"
                  />
                </Field>
              </div>

              <button
                disabled={saving || editLoading || wsLoading || (!customerId && !editing)}
                className="mt-4 w-full px-4 py-3 rounded-2xl bg-[#d06549] text-white font-medium shadow-sm disabled:opacity-60 hover:opacity-95"
                onClick={submit}
              >
                {wsLoading && !editing
                  ? "Loading workspace…"
                  : saving
                  ? editing
                    ? "Saving changes..."
                    : "Submitting..."
                  : editing
                  ? "Save Changes"
                  : "Submit for Approval"}
              </button>

              {!wsLoading && !customerId && !editing ? (
                <div className="mt-2 text-xs text-red-600">
                  Workspace missing for this login. Ask Admin to create/link Business workspace (MasterData) or set DEFAULT_CUSTOMER_BUSINESS_ID on backend.
                </div>
              ) : null}

              <div className="mt-3 text-[11px] text-slate-500">
                Once {editing ? "saved" : "submitted"}, the same structured details will appear in{" "}
                <b>My Requests</b> and in the <b>Approver Inbox</b>.
              </div>
            </div>
          </div>
        </div>
      </div>
      <SearchPreviewDrawer
  open={previewOpen}
  mode={previewMode}
  query={
    previewMode === "flight"
      ? {
          origin: m.origin,
          destination: m.destination,
          departDate: m.departDate,
          returnDate: m.returnDate,
          adults: m.adults,
          children: m.children,
          cabinClass: m.cabinClass,
        }
      : {
          city: m.city,
          checkIn: m.checkIn,
          checkOut: m.checkOut,
          adults: m.adults,
          rooms: m.rooms,
        }
  }
  onClose={() => setPreviewOpen(false)}
  onUseHint={({ patch, note }) => {
    if (patch) {
      Object.entries(patch).forEach(([k, v]) =>
        setMetaField(k, v)
      );
    }
    setMetaField(
      "notes",
      [m.notes, note].filter(Boolean).join("\n")
    );
    setPreviewOpen(false);
  }}
/>
    </div>
  );
}
