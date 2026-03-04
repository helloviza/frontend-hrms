// apps/frontend/src/pages/master-data/BusinessProfiles.tsx
// FIXED: Correct data flow — fetches onboarding record for formPayload
// FIXED: Documents use presigned S3 URLs (no more AccessDenied)
// Data source: /api/customers (list) + /api/onboarding/:id/details (formPayload)

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type MasterRecord = {
  id: string;
  name?: string;
  inviteeName?: string;
  email?: string;
  phone?: string;
  type: string;
  status: string;
  isActive: boolean;
  updatedAt?: string;
  submittedAt?: string;
  token?: string;
  businessCode?: string;
  customerCode?: string;
  onboardingId?: string;
};

type DetailRecord = any;
type EditMode = "none" | "create" | "edit";

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

/* -------------------------------------------------------------------------- */
/* Service definitions                                                        */
/* -------------------------------------------------------------------------- */

const BUSINESS_SERVICE_DEFS: { kind: ServiceKind; label: string; emoji: string; blurb: string }[] = [
  { kind: "FLIGHT", label: "Flight", emoji: "✈️", blurb: "Domestic & international corporate flight programme." },
  { kind: "HOTEL", label: "Hotel", emoji: "🏨", blurb: "Preferred hotels, negotiated rates and long-stay options." },
  { kind: "CAB", label: "Cab", emoji: "🚕", blurb: "Local commute, airport transfers and intercity travel." },
  { kind: "VISA", label: "Visa", emoji: "🛂", blurb: "Visa assistance for employee and leadership travel." },
  { kind: "MICE", label: "MICE & Events", emoji: "🎪", blurb: "Offsites, townhalls, rewards trips and client events." },
  { kind: "FOREX", label: "Forex", emoji: "💱", blurb: "Forex cards, travel cards and multi-currency support." },
  { kind: "ESIM", label: "eSIM", emoji: "📶", blurb: "Travel connectivity – roaming packs and global eSIM." },
  { kind: "HOLIDAY", label: "Holiday Packages", emoji: "🏝", blurb: "Employee holidays, rewards trips and family packages." },
  { kind: "CORPORATE_GIFTING", label: "Corporate Gifting", emoji: "🎁", blurb: "Festive hampers, milestone gifts and team swag." },
  { kind: "DECOR", label: "Décor", emoji: "🎀", blurb: "Branding, booth décor and event ambience design." },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function prettifyFromEmail(email?: string): string {
  if (!email) return "";
  const local = email.split("@")[0] || "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function pickDisplayName(r: Partial<MasterRecord>): string {
  const candidate = r.name || r.inviteeName || "";
  const trimmed = String(candidate).trim();
  if (trimmed) return trimmed;
  return prettifyFromEmail(r.email) || "—";
}

function getMasterOwnerId(rec: MasterRecord | null): string {
  if (!rec) return "";
  return (
    (rec.onboardingId && String(rec.onboardingId)) ||
    String(rec.id || "") ||
    String((rec as any)._id || "") ||
    String(rec.token || "")
  );
}

function fmt(v: any): string {
  if (v == null || v === "") return "—";
  return String(v).trim() || "—";
}

/* -------------------------------------------------------------------------- */
/* Field resolvers — read from formPayload first, fallback to top-level      */
/* -------------------------------------------------------------------------- */

function fp(base: any) {
  return base?.formPayload || base?.payload || {};
}

function bCompanyName(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.legalName || p.companyName || base.name || base.companyName || prettifyFromEmail(base.email) || "";
}

function bOfficialEmail(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.officialEmail || base.email || "";
}

function bContactName(base: any): string {
  if (!base) return "";
  const p = fp(base);
  const kc = Array.isArray(p.keyContacts) ? p.keyContacts[0] : null;
  return kc?.name || p.signatory?.name || base.contactName || "";
}

function bContactDesignation(base: any): string {
  if (!base) return "";
  const p = fp(base);
  const kc = Array.isArray(p.keyContacts) ? p.keyContacts[0] : null;
  return kc?.designation || p.signatory?.designation || "";
}

function bContactEmail(base: any): string {
  if (!base) return "";
  const p = fp(base);
  const kc = Array.isArray(p.keyContacts) ? p.keyContacts[0] : null;
  return kc?.email || p.officialEmail || base.email || "";
}

function bContactMobile(base: any): string {
  if (!base) return "";
  const p = fp(base);
  const kc = Array.isArray(p.keyContacts) ? p.keyContacts[0] : null;
  return kc?.mobile || p.contacts?.primaryPhone || base.phone || "";
}

function bIndustry(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.industry || base.industry || base.segment || "";
}

function bGstin(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.gstNumber || p.gstin || base.gstin || "";
}

function bPan(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.panNumber || p.pan || base.pan || "";
}

function bCin(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.cin || base.cin || "";
}

function bEntityType(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.entityType || base.entityType || "";
}

function bWebsite(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.website || base.website || "";
}

function bEmployeesCount(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return String(p.employeesCount || base.employeesCount || "");
}

function bIncorporationDate(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.incorporationDate || base.incorporationDate || "";
}

function bRegisteredAddress(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.registeredAddress || base.registeredAddress || base.billingAddress || "";
}

function bOperationalAddress(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.operationalAddress || base.operationalAddress || "";
}

function bDescription(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.description || base.description || "";
}

function bBankName(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.bank?.bankName || base.bankName || "";
}

function bBankAccount(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.bank?.accountNumber || base.bankAccountNumber || "";
}

function bBankIfsc(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.bank?.ifsc || base.bankIfsc || "";
}

function bBankBranch(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return p.bank?.branch || base.bankBranch || "";
}

function bCreditLimit(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return String(p.creditLimit || base.creditLimit || "");
}

function bPaymentTerms(base: any): string {
  if (!base) return "";
  const p = fp(base);
  return String(p.paymentTerms || base.paymentTerms || "");
}

function bCode(base: any, ownerId: string): string {
  if (!base) {
    if (ownerId && !/^[0-9a-f]{24}$/i.test(ownerId)) return ownerId;
    return "";
  }
  const p = fp(base);
  const direct = base.businessCode || base.customerCode || base.code || p.businessCode || p.customerCode;
  if (direct) return String(direct);
  if (ownerId && !/^[0-9a-f]{24}$/i.test(ownerId)) return ownerId;
  return "";
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
      <div className="h-4 bg-slate-200 rounded w-1/4" />
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-200 rounded-xl mt-4" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function BusinessProfiles() {
  const { user } = useAuth();

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

  const [activeTab, setActiveTab] = useState<"details" | "banking" | "contacts" | "documents" | "services">("details");

  // ✅ NEW: tracks which document is currently generating a presigned link
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  const displayName =
    (user as any)?.firstName || (user as any)?.name || (user as any)?.email || "there";

  const canEdit = useMemo(() => {
    const u: any = user || {};
    const roles: string[] = [];
    if (Array.isArray(u.roles)) roles.push(...u.roles);
    if (u.role) roles.push(u.role);
    if (u.hrmsAccessRole) roles.push(u.hrmsAccessRole);
    const upper = roles.map((r) => String(r).toUpperCase());
    return upper.includes("ADMIN") || upper.includes("SUPERADMIN") || upper.includes("SUPER_ADMIN") || upper.includes("HR_ADMIN");
  }, [user]);

  /* ── Load list ─────────────────────────────────────────────────────────── */

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/customers");
      const list: MasterRecord[] = (res.items || []).map((it: any) => ({
        id: String(it.id ?? it._id ?? ""),
        name: it.name,
        inviteeName: it.inviteeName,
        email: it.email || "",
        phone: it.phone || "",
        type: (it.type || "").toString(),
        status: (it.status || "").toString(),
        isActive:
          typeof it.isActive === "boolean"
            ? it.isActive
            : String(it.status || "").toLowerCase() === "active",
        updatedAt: it.updatedAt || it.updated_at,
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
      if (list.length > 0) handleSelect(list[0]);
      else { setSelected(null); setActiveMaster(null); setServices([]); }
    } catch (e: any) {
      alert(e?.message || "Failed to load business accounts");
    } finally {
      setLoading(false);
    }
  }

  /* ── Load detail (onboarding record with formPayload) ───────────────────── */

  async function loadDetails(rec: MasterRecord) {
    try {
      setDetailLoading(true);
      const lookupKey = rec.token || rec.onboardingId || rec.id;
      if (!lookupKey) {
        setSelected(rec);
        return;
      }
      try {
        const res = await api.get(`/onboarding/${lookupKey}/details`);
        setSelected({
          ...rec,
          ...res,
          formPayload: res.formPayload || res.payload || {},
          documents: res.documents || [],
        });
      } catch {
        setSelected(rec);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  /* ── Load services ──────────────────────────────────────────────────────── */

  async function loadBusinessServices(rec: MasterRecord) {
    const ownerId = getMasterOwnerId(rec);
    if (!ownerId) { setServices([]); return; }
    try {
      setServicesLoading(true);
      const resp = await api.get(`/business-services/${ownerId}`);
      const rawList: any[] = Array.isArray(resp) ? resp : Array.isArray((resp as any).items) ? (resp as any).items : [];
      setServices(rawList.map((s: any) => ({ ...s, id: String(s.id ?? s._id ?? "") })));
    } catch {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }

  /* ── ✅ NEW: Open document via presigned S3 URL ──────────────────────────── */

  async function openDocument(doc: any) {
    const key = doc.key || doc.Key || doc.path || "";

    // No S3 key but has a direct URL — try opening directly
    if (!key && doc.url) {
      window.open(doc.url, "_blank");
      return;
    }

    if (!key) {
      alert("Document key not available — cannot generate a secure link.");
      return;
    }

    const docLabel = doc.name || key;
    setOpeningDoc(docLabel);

    try {
      const res = await api.get(
        `/onboarding/document/presign?key=${encodeURIComponent(key)}`
      );
      if (res?.url) {
        window.open(res.url, "_blank");
      } else {
        alert("Could not generate a secure document link. Please try again.");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to open document. Please try again.");
    } finally {
      setOpeningDoc(null);
    }
  }

  /* ── Select ─────────────────────────────────────────────────────────────── */

  function handleSelect(rec: MasterRecord) {
    setEditMode("none");
    setDraft(null);
    setActiveMaster(rec);
    setActiveTab("details");
    void loadDetails(rec);
    void loadBusinessServices(rec);
  }

  /* ── Create / Edit ──────────────────────────────────────────────────────── */

  function beginCreate() {
    if (!canEdit) return;
    setEditMode("create");
    setActiveMaster(null);
    setSelected({});
    setServices([]);
    setActiveTab("details");
    setDraft({
      type: "Business", companyName: "", officialEmail: "",
      contactName: "", contactEmail: "", contactMobile: "",
      industry: "", gstin: "", pan: "", cin: "", entityType: "",
      website: "", employeesCount: "", incorporationDate: "",
      registeredAddress: "", operationalAddress: "", description: "",
      bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "",
      creditLimit: "", paymentTerms: "", isActive: true,
    });
  }

  function beginEdit() {
    if (!canEdit || !selected) return;
    const base: any = selected;
    setDraft({
      type: base.type || "Business",
      companyName: bCompanyName(base),
      officialEmail: bOfficialEmail(base),
      contactName: bContactName(base),
      contactEmail: bContactEmail(base),
      contactMobile: bContactMobile(base),
      industry: bIndustry(base),
      gstin: bGstin(base),
      pan: bPan(base),
      cin: bCin(base),
      entityType: bEntityType(base),
      website: bWebsite(base),
      employeesCount: bEmployeesCount(base),
      incorporationDate: bIncorporationDate(base),
      registeredAddress: bRegisteredAddress(base),
      operationalAddress: bOperationalAddress(base),
      description: bDescription(base),
      bankName: bBankName(base),
      bankAccount: bBankAccount(base),
      bankIfsc: bBankIfsc(base),
      bankBranch: bBankBranch(base),
      creditLimit: bCreditLimit(base),
      paymentTerms: bPaymentTerms(base),
      isActive: typeof base.isActive === "boolean" ? base.isActive : true,
    });
    setEditMode("edit");
  }

  function cancelEdit() {
    setEditMode("none");
    setDraft(null);
    if (activeMaster) { void loadDetails(activeMaster); void loadBusinessServices(activeMaster); }
  }

  async function saveBusiness() {
    if (!canEdit || editMode === "none" || !draft) return;
    try {
      setSaving(true);
      const payload: any = {
        type: "Business",
        name: draft.companyName || "",
        companyName: draft.companyName || "",
        email: draft.officialEmail || draft.contactEmail || "",
        officialEmail: draft.officialEmail || "",
        phone: draft.contactMobile || "",
        contactName: draft.contactName || "",
        contactEmail: draft.contactEmail || "",
        contactMobile: draft.contactMobile || "",
        industry: draft.industry || "",
        gstin: draft.gstin || "",
        pan: draft.pan || "",
        cin: draft.cin || "",
        entityType: draft.entityType || "",
        website: draft.website || "",
        employeesCount: draft.employeesCount || "",
        incorporationDate: draft.incorporationDate || "",
        registeredAddress: draft.registeredAddress || "",
        operationalAddress: draft.operationalAddress || "",
        description: draft.description || "",
        bankName: draft.bankName || "",
        bankAccountNumber: draft.bankAccount || "",
        bankIfsc: draft.bankIfsc || "",
        bankBranch: draft.bankBranch || "",
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

  async function handleToggleService(kind: ServiceKind) {
    if (!canEdit) return;
    const ownerId = getMasterOwnerId(activeMaster);
    if (!ownerId) { alert("Owner ID not available."); return; }
    const existing = services.find((s) => s.kind === kind);
    setSavingKind(kind);
    try {
      if (!existing) {
        await api.post(`/business-services/${ownerId}`, { kind, enabled: true });
      } else {
        await api.patch(`/business-services/${ownerId}/${existing.id}`, { enabled: !existing.enabled });
      }
      await loadBusinessServices(activeMaster!);
    } catch (e: any) {
      alert(e?.message || "Failed to update service");
    } finally {
      setSavingKind(null);
    }
  }

  useEffect(() => { load(); }, []);

  /* ── Derived display values ─────────────────────────────────────────────── */

  const ownerId = getMasterOwnerId(activeMaster);
  const businessCode =
    (activeMaster && (activeMaster.businessCode || activeMaster.customerCode)) ||
    bCode(selected, ownerId);

  const companyName =
    editMode !== "none" && draft?.companyName ? draft.companyName : bCompanyName(selected || {}) || "Business Account";

  const officialEmail =
    editMode !== "none" && draft ? draft.officialEmail || draft.email : bOfficialEmail(selected || {}) || "Not set";

  const statusLabel =
    (selected && selected.status) ||
    (selected?.isActive === false ? "Inactive" : "Active");

  const keyContacts: any[] = selected?.formPayload?.keyContacts || [];
  const documents: any[] = selected?.documents || [];

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="grid gap-4 lg:grid-cols-[300px,1fr]">

      {/* ── Left: Business list ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">

        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business Accounts</div>
          <div className="mt-1 text-sm font-semibold text-[#00477f]">Corporate Clients & Travel Desks</div>
          <p className="mt-1 text-[11px] text-slate-500">
            Hi {displayName}, browse your <span className="font-medium">business customers</span> on the left
            and view their full onboarding profile on the right.
          </p>
          {!canEdit && (
            <p className="mt-1 text-[10px] text-amber-700">
              You have <strong>view-only</strong> access. Editing is restricted to Admin / Super Admin.
            </p>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={beginCreate}
              className="mt-2 inline-flex items-center rounded-full bg-[#00477f] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-[#003562]"
            >
              + New Business
            </button>
          )}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm max-h-[75vh] overflow-y-auto">
          {loading && <ProfileSkeleton />}
          {!loading && rows.length === 0 && (
            <div className="p-3 text-[11px] text-slate-500">No business accounts found.</div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isActive =
                  activeMaster && (activeMaster.id === r.id || activeMaster.token === r.token);
                const label = pickDisplayName(r);
                const updated = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—";
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      className={`flex w-full items-start gap-3 px-3 py-3 text-left text-xs transition ${
                        isActive ? "bg-[#00477f]/5 border-l-2 border-l-[#00477f]" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00477f]/10 text-[11px] font-semibold text-[#00477f]">
                        {label.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-900">{label}</div>
                        <div className="mt-[2px] flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {r.email && (
                            <span className="truncate max-w-[140px] rounded-full bg-slate-100 px-2 py-[1px]">
                              {r.email}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-[1px] ${
                              r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
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

      {/* ── Right: Detail panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">

        {/* Empty state */}
        {!selected && editMode === "none" && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm text-center text-[13px] text-slate-500">
            Select a business account on the left to view their full profile.
          </div>
        )}

        {(selected || editMode !== "none") && (
          <>
            {/* ── Header card ──────────────────────────────────────────────── */}
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                {/* Identity */}
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                    <span>🏢</span>
                    <span>{editMode === "create" ? "New Business · Master" : "Business Master · HRMS"}</span>
                  </div>

                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#00477f]">
                    {companyName}
                  </h1>

                  {editMode === "none" && (
                    <div className="mt-2 space-y-[3px] text-[11px] text-slate-600">
                      <div>
                        <span className="font-medium">Official Email:</span>{" "}
                        <span className="font-semibold">{officialEmail}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          <span className="font-medium">Status:</span>{" "}
                          <span className={`font-semibold ${statusLabel === "ACTIVE" || statusLabel === "Active" ? "text-emerald-700" : "text-rose-600"}`}>
                            {statusLabel}
                          </span>
                        </span>
                        <span>
                          <span className="font-medium">Type:</span>{" "}
                          <span className="font-semibold">{selected?.type || "Business"}</span>
                        </span>
                        {selected?.submittedAt && (
                          <span>
                            <span className="font-medium">Onboarded:</span>{" "}
                            <span className="font-semibold">
                              {new Date(selected.submittedAt).toLocaleDateString()}
                            </span>
                          </span>
                        )}
                        {businessCode && (
                          <span>
                            <span className="font-medium">Code:</span>{" "}
                            <span className="font-mono text-[10px]">{businessCode}</span>
                          </span>
                        )}
                        {selected?.ticket && (
                          <span>
                            <span className="font-medium">Ticket:</span>{" "}
                            <span className="font-mono text-[10px]">{selected.ticket}</span>
                          </span>
                        )}
                      </div>
                      {bDescription(selected) && (
                        <p className="mt-2 max-w-xl text-[11px] text-slate-500 italic leading-relaxed">
                          {bDescription(selected)}
                        </p>
                      )}
                    </div>
                  )}

                  {detailLoading && editMode === "none" && (
                    <div className="mt-2 text-[10px] text-slate-400 animate-pulse">Loading full profile…</div>
                  )}

                  {/* Action buttons */}
                  {canEdit && (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      {editMode === "none" && selected && (
                        <button
                          type="button"
                          onClick={beginEdit}
                          className="rounded-full border border-[#00477f] px-3 py-1 font-semibold text-[#00477f] hover:bg-[#00477f] hover:text-white transition"
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
                            className="rounded-full bg-[#00477f] px-4 py-1.5 font-semibold text-white hover:bg-[#003562] disabled:opacity-60"
                          >
                            {saving ? "Saving…" : editMode === "create" ? "Create Business" : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-full border border-slate-300 px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats strip */}
                {editMode === "none" && selected && (
                  <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                    {[
                      { label: "Industry", value: bIndustry(selected) },
                      { label: "Entity", value: bEntityType(selected) },
                      { label: "Employees", value: bEmployeesCount(selected) },
                    ]
                      .filter((s) => s.value)
                      .map((s) => (
                        <div
                          key={s.label}
                          className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-center shadow-sm"
                        >
                          <div className="text-[9px] uppercase tracking-wider text-slate-400">{s.label}</div>
                          <div className="mt-[2px] text-[11px] font-semibold text-slate-700">{s.value}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            {editMode === "none" && (
              <div className="flex flex-wrap gap-2 px-1 text-[11px]">
                {(
                  [
                    { key: "details", label: "Business Details" },
                    { key: "banking", label: "Banking & Finance" },
                    { key: "contacts", label: `Key Contacts${keyContacts.length ? ` (${keyContacts.length})` : ""}` },
                    { key: "documents", label: `Documents${documents.length ? ` (${documents.length})` : ""}` },
                    { key: "services", label: "Services Matrix" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`rounded-full px-3 py-[6px] font-medium transition ${
                      activeTab === t.key
                        ? "bg-[#00477f] text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Content card ─────────────────────────────────────────────── */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-5 py-5">

              {/* ── EDIT FORM (create or edit mode) ──────────────────────── */}
              {editMode !== "none" && (
                <div className="space-y-6">

                  <SectionGrid title="Identity & Registration" description="Legal name, registration numbers and company classification.">
                    <EF label="Company / Legal Name" k="companyName" draft={draft} setDraft={setDraft} />
                    <EF label="Official Email" k="officialEmail" draft={draft} setDraft={setDraft} />
                    <EF label="Primary Contact Mobile" k="contactMobile" draft={draft} setDraft={setDraft} />
                    <EF label="Industry / Segment" k="industry" draft={draft} setDraft={setDraft} />
                    <EF label="Entity Type (e.g. PRIVATE_LTD)" k="entityType" draft={draft} setDraft={setDraft} />
                    <EF label="GSTIN" k="gstin" draft={draft} setDraft={setDraft} />
                    <EF label="PAN" k="pan" draft={draft} setDraft={setDraft} />
                    <EF label="CIN" k="cin" draft={draft} setDraft={setDraft} />
                    <EF label="Website" k="website" draft={draft} setDraft={setDraft} />
                    <EF label="Employees Count" k="employeesCount" draft={draft} setDraft={setDraft} />
                    <EF label="Incorporation Date" k="incorporationDate" draft={draft} setDraft={setDraft} type="date" />
                  </SectionGrid>

                  <SectionGrid title="Addresses" description="Registered and operational address.">
                    <EF label="Registered Address" k="registeredAddress" draft={draft} setDraft={setDraft} multiline />
                    <EF label="Operational Address" k="operationalAddress" draft={draft} setDraft={setDraft} multiline />
                  </SectionGrid>

                  <SectionGrid title="Primary Contact" description="Main point of contact for this business.">
                    <EF label="Contact Name" k="contactName" draft={draft} setDraft={setDraft} />
                    <EF label="Contact Email" k="contactEmail" draft={draft} setDraft={setDraft} />
                  </SectionGrid>

                  <SectionGrid title="Banking Details" description="Bank account for invoicing and settlements.">
                    <EF label="Bank Name" k="bankName" draft={draft} setDraft={setDraft} />
                    <EF label="Account Number" k="bankAccount" draft={draft} setDraft={setDraft} />
                    <EF label="IFSC Code" k="bankIfsc" draft={draft} setDraft={setDraft} />
                    <EF label="Branch" k="bankBranch" draft={draft} setDraft={setDraft} />
                  </SectionGrid>

                  <SectionGrid title="Commercial Terms" description="Credit and payment terms for this account.">
                    <EF label="Credit Limit" k="creditLimit" draft={draft} setDraft={setDraft} />
                    <EF label="Payment Terms" k="paymentTerms" draft={draft} setDraft={setDraft} />
                  </SectionGrid>

                  <SectionGrid title="Description" description="Brief description of the business.">
                    <div className="md:col-span-2">
                      <EF label="Description" k="description" draft={draft} setDraft={setDraft} multiline />
                    </div>
                  </SectionGrid>

                </div>
              )}

              {/* ── TAB: Business Details ─────────────────────────────────── */}
              {editMode === "none" && activeTab === "details" && (
                <div className="space-y-6">

                  <SectionGrid title="Identity & Registration" description="Legal registration, tax identifiers and company classification.">
                    <RF label="Legal Name" value={bCompanyName(selected)} />
                    <RF label="Official Email" value={bOfficialEmail(selected)} />
                    <RF label="Primary Mobile" value={bContactMobile(selected)} />
                    <RF label="Industry / Segment" value={bIndustry(selected)} />
                    <RF label="Entity Type" value={bEntityType(selected)} />
                    <RF label="GSTIN" value={bGstin(selected)} />
                    <RF label="PAN" value={bPan(selected)} />
                    <RF label="CIN" value={bCin(selected)} />
                    <RF label="Website" value={bWebsite(selected)} />
                    <RF label="Employees Count" value={bEmployeesCount(selected)} />
                    <RF label="Incorporation Date" value={bIncorporationDate(selected)} />
                  </SectionGrid>

                  <SectionGrid title="Addresses" description="Registered and operational locations.">
                    <RF label="Registered Address" value={bRegisteredAddress(selected)} wide />
                    <RF label="Operational Address" value={bOperationalAddress(selected)} wide />
                  </SectionGrid>

                  <SectionGrid title="Commercial Terms" description="Credit limit and payment terms for this account.">
                    <RF label="Credit Limit" value={bCreditLimit(selected)} />
                    <RF label="Payment Terms" value={bPaymentTerms(selected)} />
                  </SectionGrid>

                </div>
              )}

              {/* ── TAB: Banking ──────────────────────────────────────────── */}
              {editMode === "none" && activeTab === "banking" && (
                <SectionGrid title="Banking Details" description="Bank account for invoicing and settlements.">
                  <RF label="Bank Name" value={bBankName(selected)} />
                  <RF label="Account Number" value={bBankAccount(selected)} />
                  <RF label="IFSC Code" value={bBankIfsc(selected)} />
                  <RF label="Branch" value={bBankBranch(selected)} />
                  <RF label="Signatory Name" value={selected?.formPayload?.signatory?.name || "—"} />
                  <RF label="Signatory Designation" value={selected?.formPayload?.signatory?.designation || "—"} />
                </SectionGrid>
              )}

              {/* ── TAB: Contacts ─────────────────────────────────────────── */}
              {editMode === "none" && activeTab === "contacts" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#00477f]">Key Contacts</h2>
                    <p className="mt-1 text-[11px] text-slate-500">Primary and additional contacts for this business account.</p>
                  </div>

                  {keyContacts.length === 0 ? (
                    <p className="text-[12px] text-slate-400 italic">No key contacts captured during onboarding.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {keyContacts.map((kc: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] space-y-1"
                        >
                          <div className="text-[13px] font-semibold text-slate-800">{fmt(kc.name)}</div>
                          <div className="text-slate-500 font-medium">{fmt(kc.designation)}</div>
                          <div className="pt-1 space-y-[2px]">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">✉</span>
                              <span className="text-[#00477f] break-all">{fmt(kc.email)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">📞</span>
                              <span>{fmt(kc.mobile)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selected?.formPayload?.signatory && (
                    <div className="mt-4">
                      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Signatory Authority</h3>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] space-y-1">
                        <div className="text-[13px] font-semibold text-slate-800">
                          {fmt(selected.formPayload.signatory.name)}
                        </div>
                        <div className="text-slate-500">{fmt(selected.formPayload.signatory.designation)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Documents ────────────────────────────────────────── */}
              {editMode === "none" && activeTab === "documents" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#00477f]">Uploaded Documents</h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Documents submitted during business onboarding. Secure links expire after 5 minutes.
                    </p>
                  </div>

                  {documents.length === 0 ? (
                    <p className="text-[12px] text-slate-400 italic">No documents uploaded for this business.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {documents.map((d: any, i: number) => {
                        const docLabel = d.name || d.key || "Document";
                        const isOpening = openingDoc === docLabel;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <span className="text-xl">📄</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-semibold text-slate-800">
                                {docLabel}
                              </div>
                              {/* ✅ FIXED: presigned URL instead of direct S3 link */}
                              <button
                                type="button"
                                onClick={() => openDocument(d)}
                                disabled={isOpening}
                                className="mt-[2px] text-[10px] text-[#00477f] hover:underline disabled:opacity-50 disabled:cursor-wait"
                              >
                                {isOpening ? "Generating secure link…" : "View / Download ↗"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: Services ─────────────────────────────────────────── */}
              {editMode === "none" && activeTab === "services" && (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-[#00477f]">Business Services Matrix</h2>
                      <p className="mt-1 text-[11px] text-slate-500 max-w-xl">
                        Enable the services scoped for this business. This drives SLAs, reporting and automation.
                      </p>
                    </div>
                    {servicesLoading && <span className="text-[10px] text-slate-400">Loading…</span>}
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
                          onClick={() => handleToggleService(def.kind)}
                          disabled={!canEdit || isSaving}
                          className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left text-[11px] transition ${
                            enabled
                              ? "border-emerald-500/70 bg-emerald-50/60 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100/80"
                          } ${!canEdit ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          <div
                            className={`mt-[2px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${
                              enabled ? "bg-emerald-500 text-white" : "bg-[#00477f]/10 text-[#00477f]"
                            }`}
                          >
                            {def.emoji}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[12px] font-semibold text-slate-900">{def.label}</div>
                              <div
                                className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium ${
                                  enabled ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {isSaving ? "Saving…" : enabled ? "Enabled" : "Disabled"}
                              </div>
                            </div>
                            <p className="mt-[3px] text-[10px] text-slate-600">{def.blurb}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {!canEdit && (
                    <p className="text-[10px] text-slate-500">
                      Only <strong>Admin / Super Admin</strong> can adjust the service scope.
                    </p>
                  )}
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UI primitives                                                              */
/* -------------------------------------------------------------------------- */

function SectionGrid(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[#00477f]">{props.title}</h2>
        {props.description && <p className="mt-1 text-[11px] text-slate-500">{props.description}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{props.children}</div>
    </div>
  );
}

// Read-only field
function RF(props: { label: string; value: string; wide?: boolean }) {
  const { label, value, wide } = props;
  return (
    <div className={`flex flex-col gap-1 text-[11px] text-slate-600 ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-medium text-slate-500">{label}</span>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-[7px] text-[11px] text-slate-800 min-h-[32px] leading-relaxed">
        {value || "—"}
      </div>
    </div>
  );
}

// Editable field
function EF(props: {
  label: string;
  k: string;
  draft: any;
  setDraft: (fn: (p: any) => any) => void;
  multiline?: boolean;
  type?: string;
  wide?: boolean;
}) {
  const { label, k, draft, setDraft, multiline, type = "text", wide } = props;
  const value = draft && typeof draft[k] !== "undefined" ? String(draft[k] ?? "") : "";
  const handleChange = (e: any) => setDraft((prev: any) => ({ ...(prev || {}), [k]: e.target.value }));

  return (
    <div className={`flex flex-col gap-1 text-[11px] text-slate-600 ${wide ? "md:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-[6px] text-[11px] text-slate-800 outline-none focus:ring-1 focus:ring-[#00477f] resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={handleChange}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-[6px] text-[11px] text-slate-800 outline-none focus:ring-1 focus:ring-[#00477f]"
        />
      )}
    </div>
  );
}