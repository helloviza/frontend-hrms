// apps/frontend/src/pages/profile/MyProfileVendor.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PasswordCard from "../../components/profile/PasswordCard";

const PasswordCardAny = PasswordCard as unknown as React.ComponentType<any>;

type OnboardingVendor = {
  _id: string;
  type?: string;
  status?: string;
  isActive?: boolean;
  name?: string;
  companyName?: string;
  businessName?: string;
  inviteeName?: string;
  email?: string;
  officialEmail?: string;
  vendorCode?: string;
  segment?: string;
  industry?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: string;
  creditLimit?: string;
  paymentTerms?: string;
  createdAt?: string;
  updatedAt?: string;
  documents?: Array<{ name?: string; url?: string }>;
  payload?: any;

  logoKey?: string;
  logoUrl?: string;

  // optional linkage
  onboardingId?: string;
};

type ServiceCapability = {
  _id?: string;
  serviceType?: string;
  enabled?: boolean;
  notes?: string;
};

type VendorServicesMap = Record<
  string,
  { enabled?: boolean } & Record<string, any>
>;

const BACKEND_ORIGIN =
  import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8080";

/* ------------------------------ helpers ---------------------------- */

function unwrapApi<T = any>(res: any): T {
  if (res && typeof res === "object") return (res as any).data ?? res;
  return res as T;
}

function normEmail(v: any): string {
  return String(v || "").trim().toLowerCase();
}

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

function pickDisplayName(v?: Partial<OnboardingVendor> | null): string {
  if (!v) return "—";
  const candidate =
    v.companyName ||
    v.businessName ||
    v.name ||
    v.inviteeName ||
    v.payload?.companyName ||
    v.payload?.businessName ||
    "";

  const trimmed = String(candidate).trim();
  if (trimmed) return trimmed;

  const fromEmail =
    v.officialEmail || v.email
      ? prettifyFromEmail(v.officialEmail || v.email)
      : "";
  return fromEmail || "—";
}

function computeIsActive(doc: any, payload: any): boolean {
  if (typeof doc?.isActive === "boolean") return doc.isActive;

  const s = String(doc?.status || payload?.status || "").toUpperCase();

  const ACTIVE = new Set(["ACTIVE", "APPROVED", "VERIFIED", "ONBOARDED"]);
  const INACTIVE = new Set(["INACTIVE", "REJECTED", "SUSPENDED", "BLOCKED"]);

  if (INACTIVE.has(s)) return false;
  if (ACTIVE.has(s)) return true;

  // Safe default: if status is unknown but record exists, treat as active
  return true;
}

function statusBadge(isActive: boolean | undefined, rawStatus?: string) {
  const s = (rawStatus || "").toUpperCase();
  if (!isActive || s === "INACTIVE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        Active
      </span>
  );
}

function resolvePossiblyRelativeUrl(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/assets/")) return url;
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

function titleizeServiceKey(key: string): string {
  if (!key) return "Service";
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildServiceBadgesFromVendorServices(
  servicesMap: VendorServicesMap | null
): Array<{ key: string; label: string; enabled: boolean }> {
  if (!servicesMap || typeof servicesMap !== "object") return [];

  const entries = Object.entries(servicesMap)
    .filter(([k]) => k !== "__v" && k !== "_id" && k !== "id")
    .map(([key, val]) => {
      const enabled =
        typeof val?.enabled === "boolean" ? val.enabled : Boolean(val);
      return { key, label: titleizeServiceKey(key), enabled };
    });

  // Keep a consistent order (optional)
  const preferred = [
    "flights",
    "hotels",
    "visa",
    "holidays",
    "cabs",
    "forex",
    "esims",
    "miceEvents",
    "corporateGifting",
    "decor",
    "other",
  ];

  entries.sort((a, b) => {
    const ai = preferred.indexOf(a.key);
    const bi = preferred.indexOf(b.key);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return entries;
}

/**
 * Build UI profile from:
 * - Vendor doc (from /vendors/me)
 * - OR onboarding doc (from /onboarding/:id/details)
 *
 * IMPORTANT: for vendor self-login, we must NOT call onboarding if we already have onboardingSnapshot.
 */
function buildProfile(vendorOrOnboardingDoc: any): OnboardingVendor {
  const doc = vendorOrOnboardingDoc || {};
  const snapshot =
    doc.onboardingSnapshot ||
    doc.payload ||
    doc.formPayload ||
    doc.meta ||
    doc.master ||
    {};

  const payload = snapshot || {};

  const status = doc.status || payload.status;
  const isActive = computeIsActive(doc, payload);

  const logoKey =
    doc.logoKey ||
    doc.companyLogoKey ||
    payload.logoKey ||
    payload.companyLogoKey ||
    payload.brandLogoKey ||
    payload.vendorLogoKey ||
    "";

  const logoUrl =
    doc.logoUrl ||
    doc.companyLogoUrl ||
    payload.logoUrl ||
    payload.companyLogoUrl ||
    payload.brandLogoUrl ||
    payload.vendorLogoUrl ||
    "";

  const id = String(doc._id || doc.id || "").trim();

  const onboardingId =
    doc.onboardingId ||
    doc.onboardingToken ||
    doc.token ||
    payload.onboardingId ||
    payload.onboardingToken ||
    "";

  return {
    _id: id || String(onboardingId || ""),
    onboardingId: onboardingId ? String(onboardingId) : undefined,
    type: doc.type || "Vendor",
    status,
    isActive,
    name: doc.name || payload.contactPerson?.name || payload.name,
    companyName: doc.companyName || doc.businessName || payload.companyName,
    businessName: doc.businessName || payload.businessName,
    inviteeName: doc.inviteeName || payload.inviteeName,
    email: doc.email || payload.contact?.email || payload.email,
    officialEmail: doc.officialEmail || payload.officialEmail,
    vendorCode: doc.vendorCode || payload.vendorCode,
    segment: doc.segment || payload.segment,
    industry: doc.industry || payload.industry,
    gstin: doc.gstin || payload.gstNumber || payload.gstin,
    pan: doc.pan || payload.panNumber || payload.pan,
    billingAddress:
      doc.billingAddress || payload.address?.registered || payload.billingAddress,
    creditLimit: doc.creditLimit || payload.creditLimit,
    paymentTerms: doc.paymentTerms || payload.paymentTerms,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || doc.modifiedAt,
    documents: doc.documents || payload.documents || [],
    payload,
    logoKey: typeof logoKey === "string" ? logoKey : "",
    logoUrl: typeof logoUrl === "string" ? logoUrl : "",
  };
}

/**
 * Presign avatar download
 * POST /uploads/presign-avatar-download -> { url }
 */
async function presignAvatarDownload(key: string): Promise<string> {
  try {
    const resp: any = await api.post("/uploads/presign-avatar-download", { key });
    const data = unwrapApi<any>(resp);
    const url = data?.url || "";
    return typeof url === "string" ? url : "";
  } catch {
    return "";
  }
}

/* --------------------------------- Page ---------------------------------- */

type EmptyStateReason = "NONE" | "NO_VENDOR_LINKED" | "ONBOARDING_NOT_FOUND";

export default function MyProfileVendor() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [profile, setProfile] = useState<OnboardingVendor | null>(null);

  // HR/Admin capability list (legacy endpoint)
  const [services, setServices] = useState<ServiceCapability[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Vendor self-login services (from /vendors/me -> vendor.services)
  const [vendorServicesMap, setVendorServicesMap] =
    useState<VendorServicesMap | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<EmptyStateReason>("NONE");

  const [freshLogoUrl, setFreshLogoUrl] = useState<string>("");
  const lastPresignedKeyRef = useRef<string>("");
  const didBootRef = useRef(false);


  const onboardingIdFromQuery = useMemo(() => {
    return (
      searchParams.get("id") ||
      searchParams.get("onboardingId") ||
      searchParams.get("token") ||
      ""
    );
  }, [searchParams]);

  /* ---------------------- backend calls --------------------- */

  async function fetchServices(owner: string) {
    try {
      setLoadingServices(true);
      const res = await api.get(`/vendor-services/${owner}`);
      const data = unwrapApi<any>(res);

      const raw =
        (data?.capabilities as ServiceCapability[]) ||
        (data?.items as ServiceCapability[]) ||
        (data?.services as ServiceCapability[]) ||
        (data as ServiceCapability[]) ||
        [];

      setServices(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.warn("Failed to load vendor services", err);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }

  async function fetchFromOnboarding(onboardingId: string) {
    setLoadingProfile(true);
    setEmptyReason("NONE");
    setVendorServicesMap(null); // query mode uses legacy endpoint
    try {
      const res = await api.get(`/onboarding/${onboardingId}/details`);
      const data = unwrapApi<any>(res);

      const doc = (data?.vendor || data) as any;
      const mapped = buildProfile(doc);

      setProfile(mapped);
      setOwnerId(onboardingId);

      // HR/Admin testing: keep legacy capability endpoint
      await fetchServices(onboardingId);
    } catch (err: any) {
      console.error("Failed to load vendor from onboarding", err);

      const status = err?.response?.status;
      if (status === 404) {
        setEmptyReason("ONBOARDING_NOT_FOUND");
      } else {
        alert(err?.message || "Failed to load vendor profile");
      }

      setProfile(null);
      setOwnerId(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function fetchFromSelf() {
    setLoadingProfile(true);
    setEmptyReason("NONE");
    try {
      const res = await api.get("/vendors/me");
      const data = unwrapApi<any>(res);

      const vendorDoc = data?.vendor || null;

      if (!vendorDoc) {
        setProfile(null);
        setOwnerId(null);
        setVendorServicesMap(null);
        setEmptyReason("NO_VENDOR_LINKED");
        return;
      }

      const mapped = buildProfile(vendorDoc);
      setProfile(mapped);

      // Vendor self-login services come from vendorDoc.services
      setVendorServicesMap(
        vendorDoc?.services && typeof vendorDoc.services === "object"
          ? (vendorDoc.services as VendorServicesMap)
          : null
      );

      // ownerId in this page is vendor _id (profile scope), not user ownerId
      const vendorOwner = String(vendorDoc._id || "").trim();
      setOwnerId(vendorOwner || null);

      // ✅ Do NOT call legacy /vendor-services endpoint for vendor self-login.
      setServices([]);
    } catch (err: any) {
      console.error("Failed to load vendor via /vendors/me", err);
      alert(err?.message || "Failed to load vendor profile");
      setProfile(null);
      setOwnerId(null);
      setVendorServicesMap(null);
      setEmptyReason("NO_VENDOR_LINKED");
    } finally {
      setLoadingProfile(false);
    }
  }

  /* ------------------------------ bootstrap ------------------------------ */

useEffect(() => {
  if (didBootRef.current) return;
  didBootRef.current = true;

  (async () => {
    try {
      if (onboardingIdFromQuery) {
        await fetchFromOnboarding(onboardingIdFromQuery);
      } else {
        await fetchFromSelf();
      }
    } finally {
      setBootstrapDone(true);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [onboardingIdFromQuery]);


  /* ----------------------- logo presign (display only) ------------------- */

  useEffect(() => {
    const key = profile?.logoKey || profile?.payload?.logoKey || "";
    const url = profile?.logoUrl || profile?.payload?.logoUrl || "";

    if (url && typeof url === "string") {
      setFreshLogoUrl(resolvePossiblyRelativeUrl(url));
      return;
    }

    if (!key) {
      setFreshLogoUrl("");
      return;
    }

    lastPresignedKeyRef.current = key;
    let alive = true;

    (async () => {
      const signed = await presignAvatarDownload(key);
      if (!alive) return;
      if (lastPresignedKeyRef.current !== key) return;

      if (!signed) {
        setFreshLogoUrl("");
        return;
      }

      const sep = signed.includes("?") ? "&" : "?";
      setFreshLogoUrl(`${signed}${sep}v=${Date.now()}`);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.logoKey, profile?.logoUrl, profile?.payload]);

  /* ------------------------------ derived data --------------------------- */

  const payload = profile?.payload || {};
  const displayName = pickDisplayName(profile);

  const primaryEmail =
    profile?.officialEmail ||
    payload.officialEmail ||
    profile?.email ||
    payload.email ||
    "";

  const gstin = payload.gstNumber || payload.gstin || profile?.gstin || "";
  const pan = payload.panNumber || payload.pan || profile?.pan || "";
  const billingAddress =
    payload.address?.registered ||
    payload.billingAddress ||
    profile?.billingAddress ||
    "";
  const creditLimit = payload.creditLimit || profile?.creditLimit || "";
  const paymentTerms = payload.paymentTerms || profile?.paymentTerms || "";
  const industry = payload.industry || profile?.industry || "";
  const segment = payload.segment || profile?.segment || "";

  const displayEmail =
    (user as any)?.officialEmail ||
    (user as any)?.email ||
    (user as any)?.sub ||
    "";

  const lastUpdated =
    profile?.updatedAt &&
    new Date(profile.updatedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const avatarLetter = useMemo(() => {
    const n = (displayName || "").trim();
    return (n ? n[0] : "V").toUpperCase();
  }, [displayName]);

  const servicesBadges = useMemo(() => {
    // Vendor self-login: show vendor.services if present
    const fromVendor = buildServiceBadgesFromVendorServices(vendorServicesMap);
    if (fromVendor.length > 0) return fromVendor;

    // HR/Admin: fallback to legacy services array
    if (services && services.length > 0) {
      return services.map((s) => ({
        key: s._id || s.serviceType || "service",
        label: s.serviceType || "Service",
        enabled: s.enabled ?? true,
      }));
    }

    return [];
  }, [vendorServicesMap, services]);

  const showLoadingServicesLabel = useMemo(() => {
    // Only show loading indicator in HR/Admin mode
    return Boolean(onboardingIdFromQuery) && loadingServices;
  }, [onboardingIdFromQuery, loadingServices]);

  /* -------------------------- empty / fallback view ---------------------- */

  if (bootstrapDone && !loadingProfile && !profile && !ownerId) {
    return (
      <div className="p-6 bg-slate-50 min-h-[calc(100vh-80px)]">
        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          <h1 className="text-lg font-bold text-[#00477f] mb-2">
            Vendor Experience Centre
          </h1>

          {emptyReason === "ONBOARDING_NOT_FOUND" ? (
            <p>
              This onboarding id is not valid (or has been removed). Please open this
              page from <strong>Vendor Profiles</strong> with a valid onboarding id, for
              example:{" "}
              <code className="bg-slate-100 px-1 rounded">
                /profile/vendor?id=&lt;onboardingId&gt;
              </code>
              .
            </p>
          ) : (
            <p>
              No vendor account is currently linked to your login. For HR/Admin testing,
              open this page from <strong>Vendor Profiles</strong> with an onboarding id,
              for example:{" "}
              <code className="bg-slate-100 px-1 rounded">
                /profile/vendor?id=&lt;onboardingId&gt;
              </code>
              .
            </p>
          )}

          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-[12px] text-amber-900">
            <p className="font-semibold mb-1">Most common real cause</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Vendor login is valid, but no Vendor record is linked to this user.
                Ensure the vendor account is mapped in DB (by <code>vendorId</code>,{" "}
                <code>ownerId</code>, or <code>officialEmail/email</code>).
              </li>
              <li>
                If you are testing as HR/Admin, always pass{" "}
                <code>?id=&lt;onboardingId&gt;</code>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ main view ------------------------------ */

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-[calc(100vh-80px)]">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-[#00477f] via-[#00477f] to-[#d06549] text-white p-5 md:p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Avatar / Logo */}
          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center">
            {freshLogoUrl ? (
              <img
                src={freshLogoUrl}
                alt="Vendor Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full grid place-items-center font-extrabold text-lg">
                {avatarLetter}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Vendor Experience Centre
            </h1>
            <p className="mt-1 text-sm md:text-[13px] text-slate-100/90 max-w-xl">
              A single pane of glass for{" "}
              <span className="font-semibold">your vendor account</span> – brand, legal,
              contacts and services, all aligned with Plumtrips.
            </p>
            {displayEmail && (
              <p className="mt-2 text-[11px] text-slate-100/90">
                Signed in as <span className="font-semibold">{displayEmail}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs md:text-[11px]">
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[110px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Vendor Name
            </span>
            <span className="text-sm font-bold truncate max-w-[180px]">
              {displayName}
            </span>
          </div>

          {profile?.vendorCode && (
            <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[110px]">
              <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
                Vendor Code
              </span>
              <span className="text-sm font-semibold">{profile.vendorCode}</span>
            </div>
          )}

          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Status
            </span>
            <span className="mt-1">
              {statusBadge(profile?.isActive ?? true, profile?.status || "ACTIVE")}
            </span>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loadingProfile && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-600 shadow-sm">
          Loading vendor profile…
        </div>
      )}

      {!loadingProfile && profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Brand &amp; Legal Identity
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-medium text-slate-600">
                    Registered / Brand Name
                  </dt>
                  <dd className="text-slate-900">{displayName || "Not specified"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Official Email</dt>
                  <dd className="text-slate-900">{primaryEmail || "Not specified"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Industry / Segment</dt>
                  <dd className="text-slate-900">
                    {industry || segment || "Not specified"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">GSTIN</dt>
                  <dd className="text-slate-900">{gstin || "Not provided"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">PAN</dt>
                  <dd className="text-slate-900">{pan || "Not provided"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Billing Address</dt>
                  <dd className="text-slate-900 whitespace-pre-line">
                    {billingAddress || "Not captured yet"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Credit Limit (if any)</dt>
                  <dd className="text-slate-900">{creditLimit || "As per agreement"}</dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Payment Terms</dt>
                  <dd className="text-slate-900">
                    {paymentTerms || "Standard Plumtrips terms"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Primary Contact &amp; Escalation Matrix
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-medium text-slate-600">Primary Contact</dt>
                  <dd className="text-slate-900">
                    {payload?.contactPerson?.name || "Not captured"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Primary Contact Email</dt>
                  <dd className="text-slate-900">
                    {payload?.contact?.email || primaryEmail || "Not captured"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Primary Contact Mobile</dt>
                  <dd className="text-slate-900">
                    {payload?.contact?.primary ||
                      payload?.contact?.mobile ||
                      "Not captured"}
                  </dd>
                </div>

                <div>
                  <dt className="font-medium text-slate-600">Escalation Path</dt>
                  <dd className="text-slate-900">
                    As per contracted SLA. Additional contacts (if captured) will appear
                    here later.
                  </dd>
                </div>
              </dl>
            </div>

            {payload && Object.keys(payload).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">
                  Onboarding Form Snapshot
                </h2>
                <div className="bg-gray-50 border border-slate-200 p-3 rounded-xl text-sm">
                  {renderFormData(payload)}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Services */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Services Enabled
                </h2>
                {showLoadingServicesLabel && (
                  <span className="text-[11px] text-slate-500">Loading…</span>
                )}
              </div>

              {servicesBadges.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Detailed Service Dashboard is coming Soon. As of now, no services are
                  configured yet. Your HR / Plumtrips admin can enable Flights, Hotels,
                  Visa and other modules from the Vendor Profiles console.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {servicesBadges.map((s) => (
                    <span
                      key={s.key}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${
                        s.enabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-slate-50 text-slate-500 border-slate-200 line-through"
                      }`}
                      title={s.enabled ? "Enabled" : "Disabled"}
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Password change */}
            <PasswordCardAny />

            {lastUpdated && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-500 shadow-sm">
                Last updated in HRMS on{" "}
                <span className="font-medium text-slate-700">{lastUpdated}</span>.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper to render key-value data nicely */
function renderFormData(data: any): JSX.Element {
  if (!data || typeof data !== "object") {
    return <p className="italic text-xs text-gray-500">No form data available.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.entries(data).map(([key, val]) => (
        <div
          key={key}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
        >
          <div className="font-semibold text-gray-600 text-sm mb-1">
            {key.replace(/_/g, " ")}
          </div>

          {val && typeof val === "object" && !Array.isArray(val) ? (
            <div className="pl-2 border-l-2 border-amber-400 text-xs text-gray-700 space-y-0.5">
              {Object.entries(val as any).map(([k, v]) => (
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
