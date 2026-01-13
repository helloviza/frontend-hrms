// apps/frontend/src/pages/profile/MyProfileVendor.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PasswordCard from "../../components/profile/PasswordCard";

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
  payload?: any; // structured form / master payload
};

type ServiceCapability = {
  _id?: string;
  serviceType?: string; // e.g. Flights, Hotels, Visa
  enabled?: boolean;
  notes?: string;
};

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

/** Map a /vendors/me document into our OnboardingVendor shape */
function buildProfileFromSelf(vendor: any): OnboardingVendor {
  const payload =
    vendor.payload || vendor.formPayload || vendor.meta || vendor.master || {};

  return {
    _id: String(
      vendor.onboardingId ||
        vendor.onboardingToken ||
        vendor.masterId ||
        vendor._id,
    ),
    type: vendor.type || "Vendor",
    status: vendor.status || payload.status,
    isActive:
      typeof vendor.isActive === "boolean"
        ? vendor.isActive
        : String(vendor.status || payload.status || "ACTIVE").toUpperCase() ===
          "ACTIVE",
    name: vendor.name || payload.name,
    companyName:
      vendor.companyName || vendor.businessName || payload.companyName,
    businessName: vendor.businessName || payload.businessName,
    inviteeName: vendor.inviteeName || payload.inviteeName,
    email: vendor.email || payload.email,
    officialEmail: vendor.officialEmail || payload.officialEmail,
    vendorCode: vendor.vendorCode || payload.vendorCode,
    segment: vendor.segment || payload.segment,
    industry: vendor.industry || payload.industry,
    gstin: vendor.gstin || payload.gstin,
    pan: vendor.pan || payload.pan,
    billingAddress: vendor.billingAddress || payload.billingAddress,
    creditLimit: vendor.creditLimit || payload.creditLimit,
    paymentTerms: vendor.paymentTerms || payload.paymentTerms,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt || vendor.modifiedAt,
    documents: vendor.documents || payload.documents || [],
    payload,
  };
}

/* --------------------------------- Page ---------------------------------- */

export default function MyProfileVendor() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [profile, setProfile] = useState<OnboardingVendor | null>(null);
  const [services, setServices] = useState<ServiceCapability[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // If HR/Admin passes ?id=<onboardingId>, treat that as canonical.
  const onboardingIdFromQuery = useMemo(() => {
    return (
      searchParams.get("id") ||
      searchParams.get("onboardingId") ||
      searchParams.get("token") ||
      ""
    );
  }, [searchParams]);

  /* ---------------------- helpers to hit the backend --------------------- */

  async function fetchServices(owner: string) {
    try {
      setLoadingServices(true);
      const res = await api.get(`/vendor-services/${owner}`);
      const raw =
        (res.capabilities as ServiceCapability[]) ||
        (res.items as ServiceCapability[]) ||
        (res.services as ServiceCapability[]) ||
        [];
      setServices(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.warn("Failed to load vendor services", err);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }

  async function fetchFromOnboarding(key: string) {
    setLoadingProfile(true);
    try {
      const res = await api.get(`/onboarding/${key}/details`);
      const doc = res as OnboardingVendor;
      setProfile(doc);
      setOwnerId(key);
      await fetchServices(key);
    } catch (err: any) {
      console.error("Failed to load vendor from onboarding", err);
      alert(err?.message || "Failed to load vendor profile");
      setProfile(null);
      setOwnerId(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  /** Primary: resolve from /vendors/me, then optionally hop to onboarding */
  async function fetchFromSelf() {
    setLoadingProfile(true);
    try {
      const res = await api.get("/vendors/me");
      const vendor = (res as any)?.vendor;

      if (!vendor) {
        // nothing linked to this login
        setProfile(null);
        setOwnerId(null);
        return;
      }

      const onboardingKey =
        vendor.onboardingId ||
        vendor.onboardingToken ||
        vendor.token ||
        vendor.masterId;

      if (onboardingKey) {
        await fetchFromOnboarding(String(onboardingKey));
        return;
      }

      const mapped = buildProfileFromSelf(vendor);
      setProfile(mapped);
      const owner = mapped._id || String(vendor._id);
      setOwnerId(owner);
      await fetchServices(owner);
    } catch (err: any) {
      console.error("Failed to load vendor via /vendors/me", err);
      alert(err?.message || "Failed to load vendor profile");
      setProfile(null);
      setOwnerId(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  /* ------------------------------ bootstrap ------------------------------ */

  useEffect(() => {
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

  /* ------------------------------ derived data --------------------------- */

  const payload = profile?.payload || {};
  const displayName = pickDisplayName(profile);

  const primaryEmail =
    profile?.officialEmail ||
    payload.officialEmail ||
    profile?.email ||
    payload.email ||
    "";

  const contactBlock = payload.contact || {};
  const gstin = payload.gstin || profile?.gstin || "";
  const pan = payload.pan || profile?.pan || "";
  const billingAddress =
    payload.billingAddress || profile?.billingAddress || "";
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

  /* -------------------------- empty / fallback view ---------------------- */

  if (bootstrapDone && !loadingProfile && !profile && !ownerId) {
    return (
      <div className="p-6 bg-slate-50 min-h-[calc(100vh-80px)]">
        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-6 text-sm text-slate-600">
          <h1 className="text-lg font-bold text-[#00477f] mb-2">
            Vendor Experience Centre
          </h1>
          <p>
            No vendor account is currently linked to your login. For HR/Admin
            testing, open this page from <strong>Vendor Profiles</strong> with
            an onboarding id, for example:{" "}
            <code className="bg-slate-100 px-1 rounded">
              /profile/vendor?id=&lt;onboardingId&gt;
            </code>
            .
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Once vendor logins are enabled, this page will automatically resolve
            the vendor from the signed-in vendor user.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------ main view ------------------------------ */

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-[calc(100vh-80px)]">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-[#00477f] via-[#00477f] to-[#d06549] text-white p-5 md:p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Vendor Experience Centre
          </h1>
          <p className="mt-1 text-sm md:text-[13px] text-slate-100/90 max-w-xl">
            A single pane of glass for{" "}
            <span className="font-semibold">your vendor account</span> – brand,
            legal, contacts and services, all aligned with PlumTrips.
          </p>
          {displayEmail && (
            <p className="mt-2 text-[11px] text-slate-100/90">
              Signed in as{" "}
              <span className="font-semibold">{displayEmail}</span>
            </p>
          )}
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
              <span className="text-sm font-semibold">
                {profile.vendorCode}
              </span>
            </div>
          )}
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Status
            </span>
            <span className="mt-1">
              {statusBadge(
                profile?.isActive ?? true,
                profile?.status || "ACTIVE",
              )}
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
          {/* Left column: identity & contacts */}
          <div className="lg:col-span-2 space-y-4">
            {/* Brand & legal */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Brand & Legal Identity
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-medium text-slate-600">
                    Registered / Brand Name
                  </dt>
                  <dd className="text-slate-900">
                    {displayName || "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">Official Email</dt>
                  <dd className="text-slate-900">
                    {primaryEmail || "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Industry / Segment
                  </dt>
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
                  <dt className="font-medium text-slate-600">
                    Billing Address
                  </dt>
                  <dd className="text-slate-900 whitespace-pre-line">
                    {billingAddress || "Not captured yet"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Credit Limit (if any)
                  </dt>
                  <dd className="text-slate-900">
                    {creditLimit || "As per agreement"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Payment Terms
                  </dt>
                  <dd className="text-slate-900">
                    {paymentTerms || "Standard PlumTrips terms"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Contacts & escalation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Primary Contact & Escalation Matrix
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-medium text-slate-600">
                    Primary Contact
                  </dt>
                  <dd className="text-slate-900">
                    {contactBlock.name || "Not captured"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Primary Contact Email
                  </dt>
                  <dd className="text-slate-900">
                    {contactBlock.email || primaryEmail || "Not captured"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Primary Contact Mobile
                  </dt>
                  <dd className="text-slate-900">
                    {contactBlock.mobile || "Not captured"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-600">
                    Escalation Path
                  </dt>
                  <dd className="text-slate-900">
                    As per contracted SLA. Additional contacts (if captured)
                    will appear here in the next iteration.
                  </dd>
                </div>
              </dl>
            </div>

            {/* Raw form snapshot */}
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

          {/* Right column: services & password */}
          <div className="space-y-4">
            {/* Services */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Services Enabled
                </h2>
                {loadingServices && (
                  <span className="text-[11px] text-slate-500">
                    Loading…
                  </span>
                )}
              </div>
              {services.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No services are configured yet. Your HR / PlumTrips admin can
                  enable Flights, Hotels, Visa and other modules from the Vendor
                  Profiles console.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const label = s.serviceType || "Service";
                    const enabled = s.enabled ?? true;
                    return (
                      <span
                        key={s._id || label}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border ${
                          enabled
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-slate-50 text-slate-500 border-slate-200 line-through"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Documents */}
            {profile.documents && profile.documents.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">
                  Documents & KYC
                </h2>
                <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                  {profile.documents.map((d, idx) => (
                    <li key={idx}>
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00477f] hover:underline break-all"
                        >
                          {d.name || d.url}
                        </a>
                      ) : (
                        d.name
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Password change */}
            <PasswordCard />

            {/* Meta */}
            {lastUpdated && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-500 shadow-sm">
                Last updated in HRMS on{" "}
                <span className="font-medium text-slate-700">
                  {lastUpdated}
                </span>
                .
              </div>
            )}
          </div>
        </div>
      )}

      {!loadingProfile && !profile && ownerId && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-sm text-slate-600 shadow-sm">
          No vendor profile found for this id. Please verify the link or refresh
          from the Vendor Profiles list.
        </div>
      )}
    </div>
  );
}

/* Helper to render key-value data nicely */
function renderFormData(data: any): JSX.Element {
  if (!data || typeof data !== "object")
    return (
      <p className="italic text-xs text-gray-500">No form data available.</p>
    );

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
