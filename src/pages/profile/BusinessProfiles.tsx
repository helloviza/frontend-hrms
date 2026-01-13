// apps/frontend/src/pages/master-data/BusinessProfiles.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type MasterRecord = {
  id: string;
  name?: string;
  inviteeName?: string;
  email?: string;
  type: string;
  status: string;
  isActive: boolean;
  updatedAt?: string;
  submittedAt?: string;
  token?: string;

  // for proper business/customer code display
  businessCode?: string;
  customerCode?: string;
  onboardingId?: string;
};

type DetailRecord = any;

type ServiceOwnerType = "VENDOR" | "BUSINESS";

type ServiceKind =
  | "FLIGHT"
  | "HOTEL"
  | "CAB"
  | "VISA"
  | "MICE"
  | "FOREX"
  | "ESIM"
  | "HOLIDAY"
  | "CORPORATE_GIFTING"
  | "DECOR";

type ServiceCapabilityMeta = {
  notes?: string;
  priorityLevel?: number;
  destinations?: string[];
  visaCountries?: string[];
  maxGroupSize?: number;
};

type ServiceCapability = {
  id?: string;
  _id?: string;
  ownerType: ServiceOwnerType;
  ownerId: string;
  kind: ServiceKind;
  enabled: boolean;
  meta?: ServiceCapabilityMeta;
  createdAt?: string;
  updatedAt?: string;
};

type EditMode = "none" | "create" | "edit";

const BUSINESS_SERVICE_DEFS: {
  kind: ServiceKind;
  label: string;
  emoji: string;
  blurb: string;
}[] = [
  {
    kind: "FLIGHT",
    label: "Flight",
    emoji: "✈️",
    blurb: "Domestic & international corporate flight programme.",
  },
  {
    kind: "HOTEL",
    label: "Hotel",
    emoji: "🏨",
    blurb: "Preferred hotels, negotiated rates and long-stay options.",
  },
  {
    kind: "CAB",
    label: "Cab",
    emoji: "🚕",
    blurb: "Local commute, airport transfers and intercity travel.",
  },
  {
    kind: "VISA",
    label: "Visa",
    emoji: "🛂",
    blurb: "Visa assistance for employee and leadership travel.",
  },
  {
    kind: "MICE",
    label: "MICE & Events",
    emoji: "🎪",
    blurb: "Offsites, townhalls, rewards trips and client events.",
  },
  {
    kind: "FOREX",
    label: "Forex",
    emoji: "💱",
    blurb: "Forex cards, travel cards and multi-currency support.",
  },
  {
    kind: "ESIM",
    label: "eSIM",
    emoji: "📶",
    blurb: "Travel connectivity – roaming packs and global eSIM.",
  },
  {
    kind: "HOLIDAY",
    label: "Holiday Packages",
    emoji: "🏝",
    blurb: "Employee holidays, rewards trips and family packages.",
  },
  {
    kind: "CORPORATE_GIFTING",
    label: "Corporate Gifting",
    emoji: "🎁",
    blurb: "Festive hampers, milestone gifts and team swag.",
  },
  {
    kind: "DECOR",
    label: "Décor",
    emoji: "🎀",
    blurb: "Branding, booth décor and event ambience design.",
  },
];

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function prettifyFromEmail(email?: string): string {
  if (!email) return "";
  const local = email.split("@")[0] || "";
  if (!local) return "";
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickDisplayName(r: Partial<MasterRecord>): string {
  const candidate = r.name || r.inviteeName || "";
  const trimmed = String(candidate).trim();
  if (trimmed) return trimmed;
  const fromEmail = prettifyFromEmail(r.email);
  return fromEmail || "—";
}

function renderFormData(data: any): JSX.Element {
  if (!data || typeof data !== "object") {
    return (
      <p className="italic text-xs text-gray-500">No form data available.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="bg-white p-3 rounded border">
          <div className="font-semibold text-gray-600 text-sm mb-1">
            {key.replace(/_/g, " ")}
          </div>
          {val && typeof val === "object" && !Array.isArray(val) ? (
            <div className="pl-2 border-l-2 border-amber-400 text-xs text-gray-700">
              {Object.entries(val).map(([k, v]) => (
                <div key={k}>
                  <span className="font-medium">{k}:</span>{" "}
                  <span>{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-900 text-sm">{String(val ?? "—")}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function getMasterOwnerId(rec: MasterRecord | null): string {
  if (!rec) return "";
  // Prefer onboardingId if present (this is what business-services uses)
  return (
    (rec.onboardingId && String(rec.onboardingId)) ||
    String(rec.id || "") ||
    String((rec as any)._id || "") ||
    String(rec.token || "")
  );
}

/* ---------- Business field resolvers (master + details + payload) --------- */

function bCompanyName(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  return (
    base.companyName ||
    base.businessName ||
    base.name ||
    p.companyName ||
    p.businessName ||
    p.customerName ||
    p.accountName ||
    prettifyFromEmail(base.email) ||
    ""
  );
}

function bOfficialEmail(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  return (
    base.officialEmail ||
    base.official_email ||
    base.billingEmail ||
    base.companyEmail ||
    base.email ||
    p.officialEmail ||
    p.official_email ||
    p.billingEmail ||
    p.email ||
    ""
  );
}

function bContactName(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const contacts = p.contacts || {};
  const billing = p.billing || {};
  const account = p.account || {};

  return (
    base.contact?.name ||
    base.contactName ||
    base.primaryContactName ||
    base.accountOwner ||
    base.accountManager ||
    p.contact?.name ||
    p.contactPersonName ||
    p.contactPerson?.name ||
    contacts.primary?.name ||
    contacts.owner?.name ||
    billing.contactName ||
    account.ownerName ||
    ""
  );
}

function bContactEmail(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const contacts = p.contacts || {};
  const billing = p.billing || {};
  const account = p.account || {};

  return (
    base.contact?.email ||
    base.contactEmail ||
    base.billingEmail ||
    base.companyEmail ||
    p.contact?.email ||
    p.contactEmail ||
    contacts.primary?.email ||
    contacts.owner?.email ||
    billing.contactEmail ||
    account.ownerEmail ||
    ""
  );
}

function bContactMobile(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const contacts = p.contacts || {};
  const billing = p.billing || {};
  const account = p.account || {};

  return (
    base.contact?.mobile ||
    base.contactMobile ||
    base.phone ||
    base.billingPhone ||
    p.contact?.mobile ||
    p.contactMobile ||
    p.phone ||
    p.billingPhone ||
    contacts.primary?.mobile ||
    contacts.owner?.mobile ||
    billing.contactMobile ||
    account.ownerMobile ||
    ""
  );
}

function bIndustry(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  return (
    base.industry ||
    base.segment ||
    p.industry ||
    p.segment ||
    p.customerSegment ||
    ""
  );
}

function bGstin(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  return (
    base.gstin ||
    base.gstNumber ||
    base.tax?.gst ||
    p.gstNumber ||
    p.gstin ||
    ""
  );
}

function bPan(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  return base.pan || base.tax?.pan || p.panNumber || p.pan || "";
}

function bBillingAddress(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const addr = p.address || {};
  const billing = p.billing || {};

  return (
    base.address?.billing ||
    base.billingAddress ||
    base.address?.registered ||
    base.address ||
    p.billingAddress ||
    p.registeredAddress ||
    addr.billing ||
    addr.registered ||
    addr.fullAddress ||
    billing.address ||
    ""
  );
}

function bCreditLimit(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const billing = p.billing || {};
  const finance = p.finance || {};
  const credit = p.credit || {};

  const val =
    base.creditLimit ||
    p.creditLimit ||
    p.credit_limit ||
    billing.creditLimit ||
    finance.creditLimit ||
    credit.limit ||
    "";
  return val != null ? String(val) : "";
}

function bPaymentTerms(base: any): string {
  if (!base) return "";
  const p = base.payload || base.formPayload || base.extras_json || {};
  const billing = p.billing || {};
  const finance = p.finance || {};

  const val =
    base.paymentTerms ||
    base.payment_terms ||
    p.paymentTerms ||
    p.payment_terms ||
    billing.paymentTerms ||
    billing.payment_terms ||
    finance.paymentTerms ||
    finance.payment_terms ||
    "";
  return val != null ? String(val) : "";
}

function bCode(base: any, ownerId: string): string {
  if (!base) {
    // last resort – but avoid leaking raw ObjectId if possible
    if (ownerId && !/^[0-9a-f]{24}$/i.test(ownerId)) return ownerId;
    return "";
  }

  const p = base.payload || base.formPayload || base.extras_json || {};
  const direct =
    base.businessCode ||
    base.customerCode ||
    base.code ||
    p.businessCode ||
    p.customerCode;

  if (direct) return String(direct);

  // fallback to ownerId if it does NOT look like a Mongo ObjectId
  if (ownerId && !/^[0-9a-f]{24}$/i.test(ownerId)) {
    return ownerId;
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function BusinessProfiles() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<MasterRecord[]>([]);
  const [selected, setSelected] = useState<DetailRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [activeMaster, setActiveMaster] = useState<MasterRecord | null>(null);
  const [services, setServices] = useState<ServiceCapability[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [savingKind, setSavingKind] = useState<ServiceKind | null>(null);

  const [editMode, setEditMode] = useState<EditMode>("none");
  const [draft, setDraft] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    (user as any)?.email ||
    "there";

  const canEdit = useMemo(() => {
    const u: any = user || {};
    const roles: string[] = [];

    if (Array.isArray(u.roles)) roles.push(...u.roles);
    if (u.role) roles.push(u.role);
    if (u.hrmsAccessRole) roles.push(u.hrmsAccessRole);

    const upper = roles.map((r) => String(r).toUpperCase());
    const isAdmin = upper.includes("ADMIN");
    const isSuperAdmin =
      upper.includes("SUPERADMIN") || upper.includes("SUPER_ADMIN");
    const isHrAdmin = upper.includes("HR_ADMIN");

    return isAdmin || isSuperAdmin || isHrAdmin;
  }, [user]);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/customers");
      const list: MasterRecord[] = (res.items || []).map((it: any) => ({
        id: String(it.id ?? it._id ?? ""),
        name: it.name,
        inviteeName: it.inviteeName,
        email: it.email || "",
        type: (it.type || "").toString(),
        status: (it.status || "").toString(),
        isActive:
          typeof it.isActive === "boolean"
            ? it.isActive
            : String(it.status || "").toLowerCase() === "active",
        updatedAt:
          it.updatedAt || it.updated_at || it.modifiedAt || it.modified_at,
        submittedAt: it.submittedAt,
        token: it.token,

        businessCode: it.businessCode || it.customerCode || it.code,
        customerCode: it.customerCode,
        onboardingId:
          (it.onboardingId && String(it.onboardingId)) ||
          (it.onboarding_id && String(it.onboarding_id)) ||
          undefined,
      }));

      setRows(list);

      if (list.length > 0) {
        handleSelect(list[0]);
      } else {
        setSelected(null);
        setActiveMaster(null);
        setServices([]);
      }
    } catch (e: any) {
      alert(e?.message || "Failed to load business master data");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(rec: MasterRecord) {
    try {
      setDetailLoading(true);
      //const key = rec.token || rec.id;
      //const res = await api.get(`/onboarding/${key}/details`);
      setSelected(rec);
    } catch (e: any) {
      alert(e?.message || "Failed to load business details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadBusinessServices(rec: MasterRecord) {
    const ownerId = getMasterOwnerId(rec);
    if (!ownerId) {
      setServices([]);
      return;
    }

    try {
      setServicesLoading(true);
      const resp = await api.get(`/business-services/${ownerId}`);

      // Normalise response into consistent ServiceCapability objects
      const rawList: any[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? (resp as any).items
        : [];

      const list: ServiceCapability[] = rawList.map((s: any) => ({
        ...s,
        id: String(s.id ?? s._id ?? ""),
      }));

      setServices(list);
    } catch (e: any) {
      console.warn("Business services not configured yet:", e?.message);
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }

  function handleSelect(
    rec: MasterRecord,
    opts?: { open360?: boolean },
  ) {
    setEditMode("none");
    setDraft(null);
    setActiveMaster(rec);
    void loadDetails(rec);
    void loadBusinessServices(rec);

    if (opts?.open360) {
      const profileId = rec.onboardingId || rec.token || rec.id;
      if (profileId) {
        navigate(`/profile/customer?id=${encodeURIComponent(profileId)}`);
      }
    }
  }

  function beginCreate() {
    if (!canEdit) return;
    setEditMode("create");
    setActiveMaster(null);
    setSelected({});
    setServices([]);
    setDraft({
      type: "Business",
      companyName: "",
      officialEmail: "",
      contactName: "",
      contactEmail: "",
      contactMobile: "",
      industry: "",
      gstin: "",
      pan: "",
      billingAddress: "",
      creditLimit: "",
      paymentTerms: "",
      isActive: true,
    });
  }

  function beginEdit() {
    if (!canEdit || !selected) return;
    const base: any = selected;
    const official = bOfficialEmail(base);
    setDraft({
      type: base.type || "Business",
      companyName: bCompanyName(base),
      officialEmail: official,
      contactName: bContactName(base),
      contactEmail: bContactEmail(base),
      contactMobile: bContactMobile(base),
      industry: bIndustry(base),
      gstin: bGstin(base),
      pan: bPan(base),
      billingAddress: bBillingAddress(base),
      creditLimit: bCreditLimit(base),
      paymentTerms: bPaymentTerms(base),
      isActive: typeof base.isActive === "boolean" ? base.isActive : true,
    });
    setEditMode("edit");
  }

  function cancelEdit() {
    setEditMode("none");
    setDraft(null);
    if (activeMaster) {
      void loadDetails(activeMaster);
      void loadBusinessServices(activeMaster);
    }
  }

  async function saveBusiness() {
    if (!canEdit || editMode === "none" || !draft) return;
    try {
      setSaving(true);

      const payload: any = {
        type: "Business",
        name:
          draft.companyName ||
          draft.name ||
          prettifyFromEmail(draft.officialEmail || draft.email || "") ||
          "",
        companyName: draft.companyName || "",
        businessName: draft.companyName || "",
        email:
          draft.officialEmail || draft.contactEmail || draft.email || "",
        officialEmail: draft.officialEmail || "",
        contactName: draft.contactName || "",
        contactEmail: draft.contactEmail || "",
        contactMobile: draft.contactMobile || "",
        industry: draft.industry || "",
        segment: draft.segment || "",
        gstin: draft.gstin || "",
        pan: draft.pan || "",
        billingAddress: draft.billingAddress || "",
        creditLimit: draft.creditLimit || "",
        paymentTerms: draft.paymentTerms || "",
        isActive: draft.isActive !== false,
      };

      if (editMode === "create") {
        await api.post("/master-data", payload);
      } else if (editMode === "edit" && activeMaster?.id) {
        await api.patch(`/master-data/${activeMaster.id}`, payload);
      }

      setEditMode("none");
      setDraft(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to save business account");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownerId = getMasterOwnerId(activeMaster);
  // Prefer master.businessCode / customerCode, then fall back to details/payload, then ownerId (if not ObjectId)
  const businessCode =
    (activeMaster && (activeMaster.businessCode || activeMaster.customerCode)) ||
    bCode(selected, ownerId);

  const companyName =
    editMode !== "none" && draft && draft.companyName
      ? draft.companyName
      : bCompanyName(selected || {}) || "Business Account";

  const officialEmail =
    editMode !== "none" && draft && (draft.officialEmail || draft.email)
      ? draft.officialEmail || draft.email
      : bOfficialEmail(selected || {}) || "Not set";

  const statusLabel =
    (selected && selected.status) ||
    (selected && selected.isActive === false ? "Inactive" : "Active");

  return (
    <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
      {/* Left column – business list */}
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Business Accounts
              </div>
              <div className="mt-1 text-sm font-semibold text-[#00477f]">
                Corporate Clients & Travel Desks
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Hi {displayName}, browse your{" "}
                <span className="font-medium">business customers</span> on the
                left and view their onboarding details, services, billing
                profile and form data on the right.
              </p>
              {!canEdit && (
                <p className="mt-1 text-[10px] text-amber-700">
                  You currently have <strong>view-only</strong> access. Business
                  records and service mapping are controlled by HR / Admin.
                </p>
              )}
              {canEdit && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={beginCreate}
                    className="inline-flex items-center rounded-full bg-[#00477f] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003562]"
                  >
                    + New Business
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="p-3 text-[11px] text-slate-500">
              Loading business profiles…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="p-3 text-[11px] text-slate-500">
              No business accounts found in Master Data.
            </div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isActiveRow =
                  activeMaster &&
                  (activeMaster.id === r.id ||
                    (activeMaster as any)._id === r.id ||
                    activeMaster.token === r.token);
                const label = pickDisplayName(r);
                const updated = r.updatedAt
                  ? new Date(r.updatedAt).toLocaleDateString()
                  : "—";
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r, { open360: true })}
                      className={`flex w-full items-start gap-3 px-3 py-3 text-left text-xs transition ${
                        isActiveRow
                          ? "bg-[#00477f]/5 border-l-2 border-l-[#00477f]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00477f]/10 text-[11px] font-semibold text-[#00477f]">
                        {label.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-900">
                          {label}
                        </div>
                        <div className="mt-[2px] flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {r.email && (
                            <span className="rounded-full bg-slate-100 px-2 py-[1px]">
                              {r.email}
                            </span>
                          )}
                          <span className="rounded-full bg-slate-100 px-2 py-[1px]">
                            {r.type || "Business"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-[1px] ${
                              r.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {r.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2 py-[1px]">
                            Updated: {updated}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right column – detail / create / edit */}
      <div className="flex flex-col gap-4">
        {!selected && editMode === "none" && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm text-[13px] text-slate-600">
            Select a business account on the left to view full onboarding
            details, services, contacts and form data.
          </div>
        )}

        {(selected || editMode !== "none") && (
          <>
            {/* Header */}
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                      🏢
                    </span>
                    <span>
                      {editMode === "create"
                        ? "New Business · Master"
                        : "Business Master · HRMS"}
                    </span>
                  </div>
                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#00477f]">
                    {companyName}
                  </h1>
                  <p className="mt-1 text-[11px] text-slate-600 max-w-xl">
                    Official Email:{" "}
                    <span className="font-semibold">{officialEmail}</span>
                    {editMode === "none" && (
                      <>
                        <br />
                        Status:{" "}
                        <span className="font-semibold">
                          {statusLabel || "—"}
                        </span>{" "}
                        · Type:{" "}
                        <span className="font-semibold">
                          {(selected && selected.type) || "business"}
                        </span>
                        {selected && selected.submittedAt && (
                          <>
                            {" "}
                            · Onboarded on:{" "}
                            <span className="font-semibold">
                              {new Date(
                                selected.submittedAt,
                              ).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {businessCode && (
                          <>
                            {" "}
                            · Business Code:{" "}
                            <span className="font-mono text-[10px]">
                              {businessCode}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </p>

                  {canEdit && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      {editMode === "none" && selected && (
                        <button
                          type="button"
                          onClick={beginEdit}
                          className="rounded-full border border-[#00477f] px-3 py-1 font-semibold text-[#00477f] hover:bg-[#00477f] hover:text-white"
                        >
                          Edit Business
                        </button>
                      )}
                      {editMode !== "none" && (
                        <>
                          <button
                            type="button"
                            onClick={saveBusiness}
                            disabled={saving}
                            className="rounded-full bg-[#00477f] px-3 py-1 font-semibold text-white hover:bg-[#003562] disabled:opacity-60"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Documents block if present & not creating */}
                {editMode === "none" &&
                  selected &&
                  Array.isArray(selected.documents) &&
                  selected.documents.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm text-[11px] text-slate-700 max-w-xs">
                      <div className="font-medium text-slate-700 mb-1">
                        Documents
                      </div>
                      <ul className="space-y-[2px]">
                        {selected.documents.map((d: any, idx: number) => (
                          <li key={idx}>
                            {d.url ? (
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#00477f] hover:underline break-all"
                              >
                                {d.name || d.key || "Document"}
                              </a>
                            ) : (
                              <span>{d.name || d.key || "Document"}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {detailLoading && editMode === "none" && (
                <div className="mt-2 text-[10px] text-slate-500">
                  Loading business details…
                </div>
              )}

              <div className="mt-4 text-[11px] text-slate-500">
                {editMode === "none" ? (
                  <>
                    This is a read-only view of the business customer’s
                    onboarding record, with a dedicated{" "}
                    <span className="font-semibold">services matrix</span> below
                    for travel & MICE scope mapping.
                  </>
                ) : (
                  <>
                    Fill in the key master fields for this business account.
                    Once saved, you can manage travel scope and onboarding data
                    via the sections below.
                  </>
                )}
              </div>
            </div>

            {/* Sections */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-5 py-5">
              <div className="space-y-5">
                <SectionGrid
                  title="Core Business Details"
                  description="Identity, billing, and key contact information for this business account."
                >
                  <EditableField
                    label="Company Name"
                    readValue={companyName}
                    editKey="companyName"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Official Email"
                    readValue={officialEmail}
                    editKey="officialEmail"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Primary Contact Name"
                    readValue={bContactName(selected || {}) || "—"}
                    editKey="contactName"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Primary Contact Email"
                    readValue={bContactEmail(selected || {}) || "—"}
                    editKey="contactEmail"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Primary Contact Mobile"
                    readValue={bContactMobile(selected || {}) || "—"}
                    editKey="contactMobile"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Industry / Segment"
                    readValue={bIndustry(selected || {}) || "—"}
                    editKey="industry"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="GSTIN"
                    readValue={bGstin(selected || {}) || "—"}
                    editKey="gstin"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="PAN"
                    readValue={bPan(selected || {}) || "—"}
                    editKey="pan"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Billing Address"
                    readValue={bBillingAddress(selected || {}) || "—"}
                    editKey="billingAddress"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                    multiline
                  />
                  <EditableField
                    label="Credit Limit"
                    readValue={bCreditLimit(selected || {}) || "—"}
                    editKey="creditLimit"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                  <EditableField
                    label="Payment Terms"
                    readValue={bPaymentTerms(selected || {}) || "—"}
                    editKey="paymentTerms"
                    editMode={editMode}
                    draft={draft}
                    setDraft={setDraft}
                  />
                </SectionGrid>

                {/* Only show services + payload once record exists */}
                {editMode !== "create" && (
                  <>
                    <BusinessServicesSection
                      services={services}
                      loading={servicesLoading}
                      savingKind={savingKind}
                      canEdit={canEdit}
                      onToggle={handleToggleService}
                    />

                    <SectionGrid
                      title="Onboarding Form Data"
                      description="Complete structured payload as captured during onboarding (for audit & reference)."
                    >
                      <div className="col-span-1 md:col-span-2">
                        {renderFormData(selected?.payload)}
                      </div>
                    </SectionGrid>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  async function handleToggleService(kind: ServiceKind) {
    if (!canEdit) return;
    const rec = activeMaster;
    const ownerIdInner = getMasterOwnerId(rec);
    if (!ownerIdInner) {
      alert("Owner ID not available for this business account.");
      return;
    }

    const existing = services.find((s) => s.kind === kind);
    setSavingKind(kind);

    try {
      if (!existing) {
        await api.post(`/business-services/${ownerIdInner}`, {
          kind,
          enabled: true,
        });
      } else {
        await api.patch(`/business-services/${ownerIdInner}/${existing.id}`, {
          enabled: !existing.enabled,
        });
      }

      await loadBusinessServices(rec!);
    } catch (e: any) {
      alert(e?.message || "Failed to update business services");
    } finally {
      setSavingKind(null);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* UI helpers                                                                 */
/* -------------------------------------------------------------------------- */

function SectionGrid(props: {
  title: string;
  description?: string;
  children: any;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#00477f]">
          {props.title}
        </h2>
        {props.description && (
          <p className="mt-1 text-[11px] text-slate-500">
            {props.description}
          </p>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{props.children}</div>
    </div>
  );
}

function Field(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <div className="flex flex-col gap-1 text-[11px] text-slate-600">
      <span className="font-medium">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-[6px] text-[11px] text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function EditableField(props: {
  label: string;
  readValue: string;
  editKey: string;
  editMode: EditMode;
  draft: any;
  setDraft: (updater: (prev: any) => any) => void;
  multiline?: boolean;
}) {
  const { label, readValue, editKey, editMode, draft, setDraft, multiline } =
    props;
  const isEditing = editMode !== "none";

  if (!isEditing) {
    return <Field label={label} value={readValue} />;
  }

  const value =
    draft && typeof draft[editKey] !== "undefined"
      ? String(draft[editKey] ?? "")
      : "";

  const handleChange = (e: any) => {
    const val = e.target.value;
    setDraft((prev) => ({ ...(prev || {}), [editKey]: val }));
  };

  return (
    <div className="flex flex-col gap-1 text-[11px] text-slate-600">
      <span className="font-medium">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-[6px] text-[11px] text-slate-800 outline-none focus:ring-1 focus:ring-[#00477f]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-[6px] text-[11px] text-slate-800 outline-none focus:ring-1 focus:ring-[#00477f]"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Business services section UI                                               */
/* -------------------------------------------------------------------------- */

function BusinessServicesSection(props: {
  services: ServiceCapability[];
  loading: boolean;
  savingKind: ServiceKind | null;
  canEdit: boolean;
  onToggle: (kind: ServiceKind) => void;
}) {
  const { services, loading, savingKind, canEdit, onToggle } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#00477f]">
            Business Services Matrix
          </h2>
          <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
            Capture the scope of services enabled for this business account.
            This drives reporting, SLAs and future automation in the{" "}
            <span className="font-medium">Admin Dashboard</span>.
          </p>
        </div>
        {loading && (
          <span className="text-[10px] text-slate-500">
            Loading services…
          </span>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {BUSINESS_SERVICE_DEFS.map((def) => {
          const record = services.find((s) => s.kind === def.kind);
          const enabled = record?.enabled ?? false;
          const isSaving = savingKind === def.kind;

          return (
            <button
              key={def.kind}
              type="button"
              onClick={() => onToggle(def.kind)}
              disabled={!canEdit || isSaving}
              className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left text-[11px] transition ${
                enabled
                  ? "border-emerald-500/70 bg-emerald-50/60 shadow-sm"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100/80"
              } ${!canEdit ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <div
                className={`mt-[2px] flex h-8 w-8 items-center justify-center rounded-full text-base ${
                  enabled
                    ? "bg-emerald-500 text-white"
                    : "bg-[#00477f]/10 text-[#00477f]"
                }`}
              >
                {def.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold text-slate-900">
                    {def.label}
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium ${
                      enabled
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isSaving
                      ? "Saving…"
                      : enabled
                      ? "Enabled"
                      : "Disabled"}
                  </div>
                </div>
                <p className="mt-[3px] text-[10px] text-slate-600">
                  {def.blurb}
                </p>
                {record?.meta?.notes && (
                  <p className="mt-[3px] text-[10px] text-slate-500 italic">
                    Notes: {record.meta.notes}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!canEdit && (
        <p className="text-[10px] text-slate-500">
          Only{" "}
          <span className="font-semibold">HR / Admin / Super Admin</span> can
          adjust the service scope. This view is read-only for you.
        </p>
      )}
    </div>
  );
}
