import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export type OnboardingCustomer = {
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
  customerCode?: string;
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
};

export type ServiceCapability = {
  _id?: string;
  serviceType?: string;
  enabled?: boolean;
  notes?: string;
};

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function unwrapDoc(res: any): any {
  if (!res) return null;
  if (Array.isArray(res)) return res;
  if (!isPlainObject(res)) return res;

  const preferKeys = [
    "item",
    "doc",
    "record",
    "row",
    "details",
    "customer",
    "profile",
    "result",
    "data",
  ] as const;

  for (const k of preferKeys) {
    const v = (res as any)[k];
    if (v && (isPlainObject(v) || Array.isArray(v))) return v;
  }
  return res;
}

function normalizeId(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  if (isPlainObject(raw)) {
    const nested =
      raw._id ?? raw.id ?? raw.ownerId ?? raw.masterId ?? raw.onboardingId ?? raw.token;
    if (nested !== undefined) return normalizeId(nested);
  }

  const s = String(raw).trim();
  if (!s || s === "undefined" || s === "null") return null;
  return s;
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

export function pickDisplayName(c?: Partial<OnboardingCustomer> | null): string {
  if (!c) return "—";
  const candidate =
    c.businessName ||
    c.companyName ||
    c.name ||
    c.inviteeName ||
    c.payload?.businessName ||
    c.payload?.companyName ||
    c.payload?.name ||
    c.payload?.inviteeName ||
    "";

  const trimmed = String(candidate).trim();
  if (trimmed) return trimmed;

  const fromEmail =
    c.officialEmail || c.email
      ? prettifyFromEmail(c.officialEmail || c.email)
      : "";
  return fromEmail || "—";
}

function pickPayload(doc: any): any {
  if (!doc) return {};
  const d = unwrapDoc(doc);

  const candidates = [
    d?.payload,
    d?.formPayload,
    d?.details?.payload,
    d?.details?.formPayload,
    d?.meta,
    d?.master,
    d?.data?.payload,
    d?.data?.formPayload,
    d?.customer?.payload,
    d?.customer?.formPayload,
  ];

  for (const c of candidates) {
    if (c && isPlainObject(c)) return c;
  }
  if (isPlainObject(d)) return d;
  return {};
}

function buildProfileFromDoc(customerRaw: any): OnboardingCustomer {
  const customer = unwrapDoc(customerRaw) || {};
  const payload = pickPayload(customer);

  const id =
    normalizeId(
      customer.onboardingId ??
        customer.onboardingToken ??
        customer.token ??
        customer.masterId ??
        customer.ownerId ??
        customer._id ??
        payload.onboardingId ??
        payload.token ??
        payload._id,
    ) || "";

  const status = customer.status ?? payload.status ?? "ACTIVE";

  return {
    _id: id,
    type: customer.type || payload.type || "Business",
    status,
    isActive:
      typeof customer.isActive === "boolean"
        ? customer.isActive
        : String(status || "ACTIVE").toUpperCase() === "ACTIVE",
    name: customer.name ?? payload.name,
    companyName:
      customer.companyName ??
      customer.businessName ??
      payload.companyName ??
      payload.businessName ??
      payload.company_name,
    businessName: customer.businessName ?? payload.businessName,
    inviteeName: customer.inviteeName ?? payload.inviteeName,
    email: customer.email ?? payload.email,
    officialEmail: customer.officialEmail ?? payload.officialEmail ?? payload.official_email,
    customerCode: customer.customerCode ?? payload.customerCode ?? payload.customer_code,
    segment: customer.segment ?? payload.segment,
    industry: customer.industry ?? payload.industry,
    gstin: customer.gstin ?? payload.gstin,
    pan: customer.pan ?? payload.pan,
    billingAddress: customer.billingAddress ?? payload.billingAddress,
    creditLimit: customer.creditLimit ?? payload.creditLimit,
    paymentTerms: customer.paymentTerms ?? payload.paymentTerms,
    createdAt: customer.createdAt ?? payload.createdAt,
    updatedAt: customer.updatedAt ?? customer.modifiedAt ?? payload.updatedAt,
    documents: customer.documents ?? payload.documents ?? [],
    payload,
  };
}

export function useCustomerContext() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [profile, setProfile] = useState<OnboardingCustomer | null>(null);
  const [services, setServices] = useState<ServiceCapability[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);

  const onboardingIdFromQuery = useMemo(() => {
    return (
      searchParams.get("id") ||
      searchParams.get("onboardingId") ||
      searchParams.get("token") ||
      ""
    );
  }, [searchParams]);

  const authEmail =
    ((user as any)?.officialEmail ||
      (user as any)?.email ||
      (user as any)?.sub ||
      "") as string;

  async function fetchServices(owner: string | null) {
    const id = normalizeId(owner);
    if (!id) {
      setServices([]);
      return;
    }
    try {
      setLoadingServices(true);
      const res = await api.get(`/business-services/${encodeURIComponent(id)}`);
      const doc = unwrapDoc(res);

      const raw =
        (doc?.capabilities as ServiceCapability[]) ||
        (doc?.items as ServiceCapability[]) ||
        (doc?.services as ServiceCapability[]) ||
        (doc as ServiceCapability[]) ||
        [];
      setServices(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.warn("Failed to load customer services", err);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }

  async function fetchFromOnboarding(key: string) {
    const id = normalizeId(key);
    if (!id) {
      setProfile(null);
      setOwnerId(null);
      setServices([]);
      return;
    }

    setLoadingProfile(true);
    try {
      const res = await api.get(`/onboarding/${encodeURIComponent(id)}/details`);
      const doc = unwrapDoc(res);

      const mapped = buildProfileFromDoc(doc);
      setProfile(mapped);

      const ownerRaw =
        mapped._id ||
        normalizeId((doc as any)?.ownerId) ||
        normalizeId((doc as any)?.masterId) ||
        normalizeId((doc as any)?.onboardingId) ||
        normalizeId((doc as any)?._id);

      const owner = normalizeId(ownerRaw);
      setOwnerId(owner);
      await fetchServices(owner);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function fetchFromMasterDataByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setProfile(null);
      setOwnerId(null);
      setServices([]);
      return;
    }

    setLoadingProfile(true);
    try {
      const res = await api.get("/master-data?type=Business&status=All");
      const doc = unwrapDoc(res);

      const list: any[] =
        (doc?.items as any[]) ||
        (doc?.rows as any[]) ||
        (doc?.data as any[]) ||
        (doc?.results as any[]) ||
        (Array.isArray(doc) ? doc : []) ||
        [];

      const match = list.find((item) => {
        const payload = pickPayload(item);
        const itemEmail = String(
          item?.officialEmail ||
            item?.email ||
            payload?.officialEmail ||
            payload?.email ||
            payload?.contact?.email ||
            payload?.contactEmail ||
            "",
        )
          .trim()
          .toLowerCase();
        return normalizedEmail && itemEmail === normalizedEmail;
      });

      if (!match) {
        setProfile(null);
        setOwnerId(null);
        setServices([]);
        return;
      }

      const onboardingFromMatch =
        match.onboardingId ||
        match.onboardingToken ||
        match.token ||
        match.masterId ||
        match.onboardingTokenId;

      const onboardingId = normalizeId(onboardingFromMatch);
      if (onboardingId) {
        await fetchFromOnboarding(onboardingId);
        return;
      }

      const mapped = buildProfileFromDoc(match);
      setProfile(mapped);

      const ownerRaw =
        match.ownerId || match._id || mapped._id || match.masterId || match.onboardingId;
      const owner = normalizeId(ownerRaw);

      setOwnerId(owner);
      await fetchServices(owner);
    } catch (err) {
      console.error("Failed to load customer via master-data", err);
      setProfile(null);
      setOwnerId(null);
      setServices([]);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function refresh() {
    if (onboardingIdFromQuery) {
      try {
        await fetchFromOnboarding(onboardingIdFromQuery);
      } catch {
        if (authEmail) await fetchFromMasterDataByEmail(authEmail);
      }
      return;
    }
    if (authEmail) {
      await fetchFromMasterDataByEmail(authEmail);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await refresh();
      } finally {
        if (alive) setBootstrapDone(true);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingIdFromQuery, authEmail]);

  return {
    profile,
    services,
    ownerId,
    loadingProfile,
    loadingServices,
    bootstrapDone,
    refresh,
    authEmail,
  };
}
