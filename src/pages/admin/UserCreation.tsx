// apps/frontend/src/pages/admin/UserCreation.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

/* =========================================================
 * Small utils
 * ======================================================= */
function norm(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");
}
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function normStr(v: any) {
  return String(v ?? "").trim();
}
function emailDomain(email: string) {
  const e = normEmail(email);
  const at = e.lastIndexOf("@");
  return at >= 0 ? e.slice(at + 1) : "";
}
function unwrap(res: any) {
  return res?.data ?? res;
}
function extractErrorMessage(e: any): string {
  const msg =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.response?.data?.details ||
    e?.message ||
    "Failed";
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}
function normalizeStringList(input: any): string[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((x) => String(x ?? "").trim())
      .flatMap((s) => s.split(/[,\n\r\t ]+/g))
      .map((x) => normEmail(x))
      .filter(Boolean);
  }

  const s = String(input).trim();
  if (!s) return [];

  // JSON list in textarea
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed))
        return parsed.map((x) => normEmail(x)).filter(Boolean);
    } catch {
      // ignore
    }
  }

  return s
    .split(/[,\n\r\t ]+/g)
    .map((x) => normEmail(x))
    .filter(Boolean);
}
function normalizeDomainList(input: any): string[] {
  const list = normalizeStringList(input)
    .map((x) => x.replace(/^@+/, "").trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(list));
}

/**
 * IMPORTANT: [] is truthy in JS, so `a || b` never falls back.
 * This helper picks the first *non-empty* list.
 */
function firstNonEmptyList(...lists: string[][]): string[] {
  for (const l of lists) {
    if (Array.isArray(l) && l.length > 0) return l;
  }
  return [];
}

function collectRoles(u: any): string[] {
  const out: string[] = [];
  if (Array.isArray(u?.roles)) out.push(...u.roles);
  if (u?.role) out.push(u.role);
  if (u?.accountType) out.push(u.accountType);
  if (u?.userType) out.push(u.userType);
  if (u?.hrmsAccessRole) out.push(u.hrmsAccessRole);
  if (u?.hrmsAccessLevel) out.push(u.hrmsAccessLevel);
  return out.map(norm).filter(Boolean);
}
function isStaffPrivileged(u: any) {
  const r = collectRoles(u);
  return r.some(
    (x) => x.includes("HR") || x.includes("ADMIN") || x.includes("SUPERADMIN")
  );
}

type MemberRole = "WORKSPACE_LEADER" | "APPROVER" | "REQUESTER";

type CustomerMember = {
  _id: string;
  customerId: string;
  name?: string;
  email: string;
  role: MemberRole;
  phone?: string;
  department?: string;
  isActive?: boolean;
  invitedAt?: string;
  lastInviteAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BusinessOption = {
  id: string; // MasterData _id
  name: string;
  email?: string;
  domains: string[];
  raw?: any;
};

type AllowlistPayload = {
  emails: string[];
  domains: string[];
  updatedBy?: string;
  updatedAt?: string;
};

const ui = {
  card: "rounded-3xl border border-zinc-200/70 bg-white/80 backdrop-blur shadow-sm",
  cardPad: "p-5 sm:p-6",
  chip: "rounded-full border px-3 py-1 text-[11px] font-semibold",
  label: "text-[11px] font-semibold text-zinc-800",
  hint: "mt-1 text-xs text-zinc-600",
  input:
    "h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-[12px] text-zinc-900 outline-none " +
    "placeholder:text-zinc-400 focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15",
  select:
    "h-10 w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-3 text-[12px] text-zinc-900 outline-none " +
    "focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15",
  textarea:
    "min-h-[90px] w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-900 outline-none " +
    "placeholder:text-zinc-400 focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15",
  btnPrimary:
    "inline-flex h-10 items-center justify-center rounded-full bg-[#00477f] px-5 text-[12px] font-semibold text-white shadow-sm " +
    "hover:opacity-95 disabled:opacity-60",
  btnDark:
    "inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-[12px] font-semibold text-white shadow-sm " +
    "hover:bg-zinc-800 disabled:opacity-60",
  btnGhost:
    "h-9 rounded-full border border-zinc-200 bg-white px-4 text-[12px] font-semibold text-zinc-800 hover:bg-zinc-50",
  btnTiny:
    "h-8 rounded-full border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-800 hover:bg-zinc-50",
};

export default function UserCreation() {
  const { user } = useAuth();
  const canUseAdminConsole = useMemo(
    () => isStaffPrivileged(user as any),
    [user]
  );

  /* =========================================================
   * Staff-only: Business selector + domain selector
   * ======================================================= */
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(""); // MasterData(Business)._id
  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessOption | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  const [bizQ, setBizQ] = useState("");
  const [bizSearching, setBizSearching] = useState(false);
  const [bizErr, setBizErr] = useState<string | null>(null);
  const [bizOptions, setBizOptions] = useState<BusinessOption[]>([]);

  // helper: append ?customerId for staff actions (no env-based default ids)
  function withCustomerId(url: string) {
    if (!canUseAdminConsole) return url;
    const cid = normStr(selectedCustomerId);
    if (!cid) return url;
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}customerId=${encodeURIComponent(cid)}`;
  }

  /* =========================================================
   * Allowlist editor + gating
   * ======================================================= */
  const [allowLoading, setAllowLoading] = useState(false);
  const [allowErr, setAllowErr] = useState<string | null>(null);
  const [allowlist, setAllowlist] = useState<AllowlistPayload | null>(null);

  const [allowEmailsText, setAllowEmailsText] = useState("");
  const [allowDomainsText, setAllowDomainsText] = useState("");

  const [allowSavingDomains, setAllowSavingDomains] = useState(false);
  const [allowSavingEmails, setAllowSavingEmails] = useState(false);
  const allowBusy = allowLoading || allowSavingDomains || allowSavingEmails;

  const [allowSavedToast, setAllowSavedToast] = useState<string | null>(null);

  /* =========================================================
   * Customer module data
   * ======================================================= */
  const [loading, setLoading] = useState(true);
  const [customerAllowed, setCustomerAllowed] = useState(false);
  const [rows, setRows] = useState<CustomerMember[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Create form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cRole, setCRole] = useState<MemberRole>("REQUESTER");
  const [cPhone, setCPhone] = useState("");
  const [cDept, setCDept] = useState("");

  // Reporting to (Approver) — used when REQUESTER
  const [cApproverEmail, setCApproverEmail] = useState<string>(""); // "" => auto (workspace default)

  // Password fields
  const [cSetPassword, setCSetPassword] = useState(false);
  const [cPassword, setCPassword] = useState("");
  const [cPassword2, setCPassword2] = useState("");

  const [cDefaultApprover, setCDefaultApprover] = useState(false);
  const [cActive, setCActive] = useState(true);
  const [cInvite, setCInvite] = useState(true);

  const [busyCreate, setBusyCreate] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Bulk
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busyBulk, setBusyBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Admin credential console (optional)
  const [aEmail, setAEmail] = useState("");
  const [aPassword, setAPassword] = useState("");
  const [busyAdmin, setBusyAdmin] = useState(false);
  const [adminResult, setAdminResult] = useState<any>(null);
  const [adminErr, setAdminErr] = useState<string | null>(null);

  // Cozy directory tools
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | MemberRole>("ALL");
  const [activeOnly, setActiveOnly] = useState(false);

  /* =========================================================
   * Allowlist fetch/save (prefers dedicated endpoint; falls back to workspace/config)
   * ======================================================= */
  async function fetchAllowlist() {
    setAllowLoading(true);
    setAllowErr(null);

    try {
      // preferred endpoint
      const resRaw = unwrap(
        await api.get(withCustomerId("/customer/users/workspace/allowlist"))
      );
      const base = resRaw?.allowlist ? resRaw.allowlist : resRaw;

      const emails = normalizeStringList(
        base?.emails ?? resRaw?.emails ?? resRaw?.data?.emails
      );
      const domains = normalizeDomainList(
        base?.domains ?? resRaw?.domains ?? resRaw?.data?.domains
      );

      const updatedBy = normStr(
        base?.updatedBy ?? resRaw?.updatedBy ?? resRaw?.meta?.updatedBy ?? ""
      );
      const updatedAt = normStr(
        base?.updatedAt ?? resRaw?.updatedAt ?? resRaw?.meta?.updatedAt ?? ""
      );

      const payload: AllowlistPayload = {
        emails,
        domains,
        updatedBy: updatedBy || undefined,
        updatedAt: updatedAt || undefined,
      };

      setAllowlist(payload);
      setAllowEmailsText(emails.join("\n"));
      setAllowDomainsText(domains.join("\n"));
      return;
    } catch (e1: any) {
      // fallback: older installs (no dedicated allowlist endpoint yet)
      try {
        const cfg = unwrap(
          await api.get(withCustomerId("/customer/users/workspace/config"))
        );
        const c = cfg?.config || cfg?.workspace || cfg;

        const emails = firstNonEmptyList(
          normalizeStringList(c?.userCreationAllowlistEmails),
          normalizeStringList(c?.allowedEmails),
          normalizeStringList(c?.emails)
        );

        const domains = firstNonEmptyList(
          normalizeDomainList(c?.userCreationAllowlistDomains),
          normalizeDomainList(c?.allowedDomains),
          normalizeDomainList(c?.domains)
        );

        const updatedBy = normStr(c?.userCreationAllowlistUpdatedBy || "");
        const updatedAt = normStr(c?.userCreationAllowlistUpdatedAt || "");

        const payload: AllowlistPayload = {
          emails,
          domains,
          updatedBy: updatedBy || undefined,
          updatedAt: updatedAt || undefined,
        };

        setAllowlist(payload);
        setAllowEmailsText(emails.join("\n"));
        setAllowDomainsText(domains.join("\n"));
      } catch (e2: any) {
        setAllowlist(null);
        setAllowErr(extractErrorMessage(e1) || extractErrorMessage(e2));
      }
    } finally {
      setAllowLoading(false);
    }
  }

  function shouldRetryWithFullPayload(msg: string, missing: "emails" | "domains") {
    const m = (msg || "").toLowerCase();
    if (!m) return false;
    if (m.includes("required") || m.includes("missing")) return true;
    if (missing === "emails" && (m.includes("email") || m.includes("emails")))
      return true;
    if (missing === "domains" && (m.includes("domain") || m.includes("domains")))
      return true;
    return false;
  }

  function normalizeAllowlistFromResponse(
    res: any,
    fallbackEmails: string[],
    fallbackDomains: string[]
  ): AllowlistPayload {
    const base = res?.allowlist ? res.allowlist : res;

    const emails = normalizeStringList(
      base?.emails ?? res?.emails ?? fallbackEmails
    );
    const domains = normalizeDomainList(
      base?.domains ?? res?.domains ?? fallbackDomains
    );

    const updatedBy = normStr(base?.updatedBy || res?.meta?.updatedBy || "");
    const updatedAt = normStr(base?.updatedAt || res?.meta?.updatedAt || "");

    return {
      emails,
      domains,
      updatedBy: updatedBy || undefined,
      updatedAt: updatedAt || undefined,
    };
  }

  async function saveAllowlistDomains() {
    setAllowErr(null);
    setAllowSavedToast(null);

    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setAllowErr("Please set Customer ID first (Business id) to load the workspace.");
      return;
    }

    const emails = normalizeStringList(allowEmailsText);
    const domains = normalizeDomainList(allowDomainsText);

    setAllowSavingDomains(true);
    try {
      // preferred endpoint: try partial first
      try {
        const res = unwrap(
          await api.post(withCustomerId("/customer/users/workspace/allowlist"), {
            domains,
          })
        );
        const payload = normalizeAllowlistFromResponse(res, emails, domains);
        setAllowlist(payload);
        setAllowEmailsText(payload.emails.join("\n"));
        setAllowDomainsText(payload.domains.join("\n"));
        setAllowSavedToast("Domains saved.");
      } catch (e1: any) {
        const msg = extractErrorMessage(e1);
        // retry with full payload if backend requires both keys
        if (shouldRetryWithFullPayload(msg, "emails")) {
          const res2 = unwrap(
            await api.post(withCustomerId("/customer/users/workspace/allowlist"), {
              emails,
              domains,
            })
          );
          const payload = normalizeAllowlistFromResponse(res2, emails, domains);
          setAllowlist(payload);
          setAllowEmailsText(payload.emails.join("\n"));
          setAllowDomainsText(payload.domains.join("\n"));
          setAllowSavedToast("Domains saved.");
        } else {
          // fallback: older installs (workspace/config)
          const patch: any = {
            userCreationAllowlistDomains: domains,
            allowedDomains: domains, // compat
          };

          try {
            const res3 = unwrap(
              await api.post(
                withCustomerId("/customer/users/workspace/config"),
                patch
              )
            );
            const c = res3?.config || res3?.workspace || res3;

            const savedEmails = firstNonEmptyList(
              normalizeStringList(c?.userCreationAllowlistEmails),
              normalizeStringList(c?.allowedEmails),
              emails
            );

            const savedDomains = firstNonEmptyList(
              normalizeDomainList(c?.userCreationAllowlistDomains),
              normalizeDomainList(c?.allowedDomains),
              domains
            );

            const payload: AllowlistPayload = {
              emails: savedEmails,
              domains: savedDomains,
              updatedBy:
                normStr(c?.userCreationAllowlistUpdatedBy || "") || undefined,
              updatedAt:
                normStr(c?.userCreationAllowlistUpdatedAt || "") || undefined,
            };

            setAllowlist(payload);
            setAllowEmailsText(payload.emails.join("\n"));
            setAllowDomainsText(payload.domains.join("\n"));
            setAllowSavedToast("Domains saved (compat mode).");
          } catch (e2: any) {
            throw e2;
          }
        }
      }

      // refresh everything (so UI + API stay consistent)
      await reload();
    } catch (e: any) {
      setAllowErr(extractErrorMessage(e));
    } finally {
      setAllowSavingDomains(false);
    }
  }

  async function saveAllowlistEmails() {
    setAllowErr(null);
    setAllowSavedToast(null);

    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setAllowErr("Please set Customer ID first (Business id) to load the workspace.");
      return;
    }

    const emails = normalizeStringList(allowEmailsText);
    const domains = normalizeDomainList(allowDomainsText);

    setAllowSavingEmails(true);
    try {
      // preferred endpoint: try partial first
      try {
        const res = unwrap(
          await api.post(withCustomerId("/customer/users/workspace/allowlist"), {
            emails,
          })
        );
        const payload = normalizeAllowlistFromResponse(res, emails, domains);
        setAllowlist(payload);
        setAllowEmailsText(payload.emails.join("\n"));
        setAllowDomainsText(payload.domains.join("\n"));
        setAllowSavedToast("Emails saved.");
      } catch (e1: any) {
        const msg = extractErrorMessage(e1);
        // retry with full payload if backend requires both keys
        if (shouldRetryWithFullPayload(msg, "domains")) {
          const res2 = unwrap(
            await api.post(withCustomerId("/customer/users/workspace/allowlist"), {
              emails,
              domains,
            })
          );
          const payload = normalizeAllowlistFromResponse(res2, emails, domains);
          setAllowlist(payload);
          setAllowEmailsText(payload.emails.join("\n"));
          setAllowDomainsText(payload.domains.join("\n"));
          setAllowSavedToast("Emails saved.");
        } else {
          // fallback: older installs (workspace/config)
          const patch: any = {
            userCreationAllowlistEmails: emails,
            allowedEmails: emails, // compat
          };

          try {
            const res3 = unwrap(
              await api.post(
                withCustomerId("/customer/users/workspace/config"),
                patch
              )
            );
            const c = res3?.config || res3?.workspace || res3;

            const savedEmails = firstNonEmptyList(
              normalizeStringList(c?.userCreationAllowlistEmails),
              normalizeStringList(c?.allowedEmails),
              emails
            );

            const savedDomains = firstNonEmptyList(
              normalizeDomainList(c?.userCreationAllowlistDomains),
              normalizeDomainList(c?.allowedDomains),
              domains
            );

            const payload: AllowlistPayload = {
              emails: savedEmails,
              domains: savedDomains,
              updatedBy:
                normStr(c?.userCreationAllowlistUpdatedBy || "") || undefined,
              updatedAt:
                normStr(c?.userCreationAllowlistUpdatedAt || "") || undefined,
            };

            setAllowlist(payload);
            setAllowEmailsText(payload.emails.join("\n"));
            setAllowDomainsText(payload.domains.join("\n"));
            setAllowSavedToast("Emails saved (compat mode).");
          } catch (e2: any) {
            throw e2;
          }
        }
      }

      // refresh everything (so UI + API stay consistent)
      await reload();
    } catch (e: any) {
      setAllowErr(extractErrorMessage(e));
    } finally {
      setAllowSavingEmails(false);
    }
  }

  /* =========================================================
   * Whitelist gating decision (frontend side)
   * ======================================================= */
  const myEmail = normEmail((user as any)?.email || "");
  const myDomain = emailDomain(myEmail);

  const isWhitelistedForUserCreation = useMemo(() => {
    if (canUseAdminConsole) return true; // staff bypass
    const emails = allowlist?.emails || [];
    const domains = allowlist?.domains || [];

    // deny-by-default if allowlist empty / not set
    if (emails.length === 0 && domains.length === 0) return false;

    if (myEmail && emails.map(normEmail).includes(myEmail)) return true;
    if (
      myDomain &&
      domains
        .map((d) => String(d || "").trim().toLowerCase())
        .includes(myDomain)
    )
      return true;
    return false;
  }, [allowlist, myEmail, myDomain, canUseAdminConsole]);

  /* =========================================================
   * Business search (best-effort, supports unknown backend shapes)
   * ======================================================= */
  function inferDomainsFromBusiness(raw: any): string[] {
    const candidates: string[] = [];

    const push = (d: any) => {
      const s = String(d || "")
        .trim()
        .toLowerCase()
        .replace(/^@+/, "");
      if (!s) return;

      if (s.includes("@")) {
        const dom = emailDomain(s);
        if (dom) candidates.push(dom);
        return;
      }

      const cleaned = s.replace(/^https?:\/\//, "").split("/")[0];
      if (cleaned && cleaned.includes(".")) candidates.push(cleaned);
    };

    if (raw?.domain) push(raw.domain);
    if (raw?.companyDomain) push(raw.companyDomain);
    if (raw?.website) push(raw.website);
    if (raw?.web) push(raw.web);
    if (raw?.email) push(raw.email);
    if (raw?.officialEmail) push(raw.officialEmail);
    if (raw?.payload?.domain) push(raw.payload.domain);
    if (raw?.payload?.website) push(raw.payload.website);
    if (raw?.payload?.email) push(raw.payload.email);

    const arrs = [raw?.domains, raw?.allowedDomains, raw?.payload?.domains];
    for (const a of arrs) {
      if (Array.isArray(a)) a.forEach(push);
    }

    return Array.from(
      new Set(candidates.map((x) => x.trim().toLowerCase()).filter(Boolean))
    );
  }

  function pickBusinessName(raw: any): string {
    return (
      normStr(raw?.name) ||
      normStr(raw?.companyName) ||
      normStr(raw?.title) ||
      normStr(raw?.payload?.name) ||
      normStr(raw?.payload?.companyName) ||
      "Unnamed Business"
    );
  }

  function pickBusinessId(raw: any): string {
    return String(raw?._id || raw?.id || raw?.customerId || "").trim();
  }

  async function searchBusinesses(query: string) {
    const qq = normStr(query);
    if (!qq || qq.length < 2) {
      setBizOptions([]);
      return;
    }

    setBizSearching(true);
    setBizErr(null);

    const endpoints = [
      `/admin/masterdata/search?type=business&query=${encodeURIComponent(qq)}`,
      `/admin/masterdata/search?type=customer&query=${encodeURIComponent(qq)}`,
      `/admin/masterdata?type=business&search=${encodeURIComponent(qq)}`,
      `/masterdata/search?type=business&query=${encodeURIComponent(qq)}`,
      `/masterdata?type=business&search=${encodeURIComponent(qq)}`,
      `/admin/businesses/search?query=${encodeURIComponent(qq)}`,
    ];

    try {
      let rawRows: any[] | null = null;

      for (const url of endpoints) {
        try {
          const res = unwrap(await api.get(url));
          const rows =
            (Array.isArray(res) ? res : null) ||
            (Array.isArray(res?.rows) ? res.rows : null) ||
            (Array.isArray(res?.items) ? res.items : null) ||
            (Array.isArray(res?.data) ? res.data : null) ||
            (Array.isArray(res?.data?.rows) ? res.data.rows : null);

          if (rows && rows.length) {
            rawRows = rows;
            break;
          }
        } catch {
          // try next endpoint
        }
      }

      if (!rawRows) {
        setBizOptions([]);
        setBizErr(
          "No business search endpoint returned results (use manual Business ID input)."
        );
        return;
      }

      const opts: BusinessOption[] = rawRows
        .map((r) => {
          const id = pickBusinessId(r);
          if (!id) return null;
          const domains = inferDomainsFromBusiness(r);
          return {
            id,
            name: pickBusinessName(r),
            email:
              normStr(r?.email || r?.officialEmail || r?.payload?.email || "") ||
              undefined,
            domains,
            raw: r,
          } as BusinessOption;
        })
        .filter(Boolean) as BusinessOption[];

      const map = new Map<string, BusinessOption>();
      for (const o of opts) map.set(o.id, o);
      const uniq = Array.from(map.values());

      uniq.sort((a, b) => a.name.localeCompare(b.name));
      setBizOptions(uniq);
    } catch (e: any) {
      setBizOptions([]);
      setBizErr(extractErrorMessage(e));
    } finally {
      setBizSearching(false);
    }
  }

  function selectBusiness(b: BusinessOption | null) {
    setSelectedBusiness(b);
    const cid = b?.id ? String(b.id) : "";
    setSelectedCustomerId(cid);

    const domains = b?.domains || [];
    const nextDomain = domains[0] || "";
    setSelectedDomain(nextDomain);
  }

  /* =========================================================
   * Reload: workspace users list (Admin can load by customerId, no env defaults)
   * ======================================================= */
  async function reload() {
    setLoading(true);
    setLoadErr(null);
    setActionErr(null);
    setToast(null);

    try {
      const url = withCustomerId("/customer/users");
      const res = unwrap(await api.get(url));
      setCustomerAllowed(true);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
      setWorkspace(res?.workspace || null);
      setLoadErr(null);
    } catch (e: any) {
      const msg = extractErrorMessage(e);

      if (canUseAdminConsole && !normStr(selectedCustomerId)) {
        setCustomerAllowed(false);
        setRows([]);
        setWorkspace(null);
        setLoadErr(
          "Please set Customer ID first (Business MasterData _id) to load the workspace."
        );
      } else {
        setCustomerAllowed(false);
        setRows([]);
        setWorkspace(null);
        setLoadErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    reload();
    fetchAllowlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // whenever staff selects a customer id, refresh workspace + allowlist
  useEffect(() => {
    if (!canUseAdminConsole) return;
    if (!normStr(selectedCustomerId)) return;
    reload();
    fetchAllowlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, canUseAdminConsole]);

  // Keep domain list updated from workspace + allowlist if business didn’t provide
  const availableDomains = useMemo(() => {
    const fromBiz = (selectedBusiness?.domains || [])
      .map((d) => String(d || "").trim().toLowerCase())
      .filter(Boolean);
    const fromAllow = (allowlist?.domains || [])
      .map((d) => String(d || "").trim().toLowerCase())
      .filter(Boolean);

    const wsDomains = firstNonEmptyList(
      normalizeDomainList(workspace?.userCreationAllowlistDomains),
      normalizeDomainList(workspace?.allowedDomains),
      normalizeDomainList(workspace?.domains)
    )
      .map((d) => String(d || "").trim().toLowerCase())
      .filter(Boolean);

    const combined = Array.from(new Set([...fromBiz, ...fromAllow, ...wsDomains]));
    combined.sort((a, b) => a.localeCompare(b));
    return combined;
  }, [selectedBusiness, allowlist, workspace]);

  useEffect(() => {
    if (selectedDomain) return;
    if (availableDomains.length > 0) setSelectedDomain(availableDomains[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDomains]);

  function defaultApproverEmails(): Set<string> {
    const list = (workspace?.defaultApproverEmails || []).map(normEmail).filter(Boolean);
    return new Set(list);
  }
  const defaultSet = useMemo(() => defaultApproverEmails(), [workspace]);

  const workspaceDefaultApprover = useMemo(() => {
    const list = (workspace?.defaultApproverEmails || []).map(normEmail).filter(Boolean);
    return list.length ? list[0] : "";
  }, [workspace]);

  const approverOptions = useMemo(() => {
    const list = rows
      .filter((r) => r.role === "APPROVER" && r.isActive !== false)
      .map((r) => ({
        email: normEmail(r.email),
        name: normStr(r.name) || normEmail(r.email),
      }))
      .filter((x) => !!x.email);

    list.sort((a, b) => {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.email.localeCompare(b.email);
    });

    return list;
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.isActive !== false).length;
    const leaders = rows.filter((r) => r.role === "WORKSPACE_LEADER").length;
    const approvers = rows.filter((r) => r.role === "APPROVER").length;
    const requesters = rows.filter((r) => r.role === "REQUESTER").length;
    const defaultApprovers = rows.filter((r) => defaultSet.has(normEmail(r.email))).length;
    return { total, active, leaders, approvers, requesters, defaultApprovers };
  }, [rows, defaultSet]);

  const filteredRows = useMemo(() => {
    const qq = normStr(q).toLowerCase();
    return rows.filter((r) => {
      if (activeOnly && r.isActive === false) return false;
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (!qq) return true;
      const hay = `${r.name || ""} ${r.email || ""} ${r.department || ""} ${r.role || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [rows, q, roleFilter, activeOnly]);

  function onRoleChange(nextRole: MemberRole) {
    setCRole(nextRole);
    if (nextRole !== "APPROVER") setCDefaultApprover(false);
    if (nextRole !== "REQUESTER") setCApproverEmail("");
  }

  /* =========================================================
   * Actions
   * ======================================================= */
  async function onCreateOne(e: React.FormEvent) {
    e.preventDefault();
    setActionErr(null);
    setToast(null);
    setBulkResult(null);

    if (!isWhitelistedForUserCreation) {
      setActionErr("Your email/domain isn’t whitelisted for User Creation. Contact HR/Admin.");
      return;
    }

    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setActionErr("Please set Customer ID first (Business MasterData _id) to load the workspace.");
      return;
    }

    if (!customerAllowed && !canUseAdminConsole) {
      setActionErr("You are not authorized to manage workspace users.");
      return;
    }

    const email = normEmail(cEmail);
    if (!email || !email.includes("@")) {
      setActionErr("Please enter a valid email.");
      return;
    }
    if (!normStr(cName)) {
      setActionErr("Please enter the name.");
      return;
    }

    if (cRole === "REQUESTER") {
      const chosen = normEmail(cApproverEmail);
      const hasDefault = !!workspaceDefaultApprover;
      if (!chosen && !hasDefault) {
        setActionErr("Reporting To is required: create an Approver first OR set workspace defaultApproverEmails.");
        return;
      }
    }

    if (cSetPassword) {
      const pw = String(cPassword || "");
      const pw2 = String(cPassword2 || "");
      if (pw.length < 8) {
        setActionErr("Password must be at least 8 characters.");
        return;
      }
      if (pw !== pw2) {
        setActionErr("Password and Confirm Password do not match.");
        return;
      }
    }

    setBusyCreate(true);
    try {
      const body: any = {
        name: cName?.trim() || undefined,
        email,
        role: cRole,
        phone: cPhone?.trim() || undefined,
        department: cDept?.trim() || undefined,
        setAsDefaultApprover: !!cDefaultApprover,
        active: !!cActive,
        sendInvite: !!cInvite,
      };

      if (cRole === "REQUESTER") {
        const ae = normEmail(cApproverEmail);
        if (ae) body.approverEmail = ae;
      }

      if (cSetPassword) body.password = String(cPassword || "");

      await api.post(withCustomerId("/customer/users"), body);

      if (cSetPassword) {
        try {
          await api.post("/auth/admin/reset-password", {
            email,
            newPassword: String(cPassword || ""),
          });
          setToast("User saved + password set successfully.");
        } catch {
          setToast("User saved. Password could not be force-set (permission/endpoint). Use Invite or Admin reset.");
        }
      } else {
        setToast("User saved successfully.");
      }

      await reload();

      setCEmail("");
      setCName("");
      setCPhone("");
      setCDept("");
      setCRole("REQUESTER");
      setCApproverEmail("");
      setCDefaultApprover(false);
      setCActive(true);
      setCInvite(true);

      setCSetPassword(false);
      setCPassword("");
      setCPassword2("");
    } catch (e2: any) {
      setActionErr(extractErrorMessage(e2));
    } finally {
      setBusyCreate(false);
    }
  }

  async function onToggleActive(row: CustomerMember) {
    setActionErr(null);
    setToast(null);

    if (!isWhitelistedForUserCreation) {
      setActionErr("Your email/domain isn’t whitelisted for User Creation. Contact HR/Admin.");
      return;
    }
    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setActionErr("Please set Customer ID first (Business MasterData _id) to load the workspace.");
      return;
    }

    try {
      const nextActive = row.isActive === false ? true : false;
      await api.patch(withCustomerId(`/customer/users/${row._id}`), { active: nextActive });
      setToast(nextActive ? "Activated." : "Deactivated.");
      await reload();
    } catch (e: any) {
      setActionErr(extractErrorMessage(e));
    }
  }

  async function onReinvite(row: CustomerMember) {
    setActionErr(null);
    setToast(null);

    if (!isWhitelistedForUserCreation) {
      setActionErr("Your email/domain isn’t whitelisted for User Creation. Contact HR/Admin.");
      return;
    }
    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setActionErr("Please set Customer ID first (Business MasterData _id) to load the workspace.");
      return;
    }

    try {
      await api.post(withCustomerId(`/customer/users/${row._id}/reinvite`), {});
      setToast("Invite sent.");
      await reload();
    } catch (e: any) {
      setActionErr(extractErrorMessage(e));
    }
  }

  async function downloadFile(url: string, filename: string) {
    try {
      const finalUrl = withCustomerId(url);
      const baseURL = (api as any)?.defaults?.baseURL || "";
      const resp = await fetch(baseURL ? `${baseURL}${finalUrl}` : finalUrl, {
        method: "GET",
        headers: {
          Authorization: (api as any)?.defaults?.headers?.common?.Authorization || "",
        },
        credentials: "include",
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Download failed (${resp.status})`);
      }

      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setActionErr(e?.message || "Download failed");
    }
  }

  async function onDownloadTemplate(format: "csv" | "xlsx") {
    setActionErr(null);
    await downloadFile(`/customer/users/template/download?format=${format}`, `customer_users_template.${format}`);
  }

  async function onExport(format: "csv" | "xlsx") {
    setActionErr(null);
    await downloadFile(`/customer/users/export/download?format=${format}`, `customer_users_export.${format}`);
  }

  async function onBulkUpload() {
    setActionErr(null);
    setToast(null);
    setBulkResult(null);

    if (!isWhitelistedForUserCreation) {
      setActionErr("Your email/domain isn’t whitelisted for User Creation. Contact HR/Admin.");
      return;
    }
    if (canUseAdminConsole && !normStr(selectedCustomerId)) {
      setActionErr("Please set Customer ID first (Business MasterData _id) to load the workspace.");
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setActionErr("Please choose a CSV/XLSX file first.");
      return;
    }

    setBusyBulk(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = unwrap(await api.post(withCustomerId("/customer/users/bulk"), fd as any));
      setBulkResult(res);
      setToast("Bulk import completed.");
      await reload();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setActionErr(extractErrorMessage(e));
    } finally {
      setBusyBulk(false);
    }
  }

  async function onAdminReset(e: React.FormEvent) {
    e.preventDefault();
    setAdminErr(null);
    setAdminResult(null);

    const email = normEmail(aEmail);
    if (!email || !email.includes("@")) {
      setAdminErr("Please enter a valid email.");
      return;
    }

    const pw = String(aPassword || "").trim();
    if (pw && pw.length < 8) {
      setAdminErr("Password must be at least 8 characters (or leave empty to auto-generate).");
      return;
    }

    setBusyAdmin(true);
    try {
      const res = unwrap(
        await api.post("/auth/admin/reset-password", {
          email,
          newPassword: pw || undefined,
        })
      );
      setAdminResult(res);
      setToast("Password reset completed.");
    } catch (e: any) {
      setAdminErr(extractErrorMessage(e));
    } finally {
      setBusyAdmin(false);
    }
  }

  /* =========================================================
   * Render guards
   * ======================================================= */
  const canSeeAnything = customerAllowed || canUseAdminConsole;

  if (!canSeeAnything) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-b from-[#00477f]/[0.06] via-white to-[#d06549]/[0.05]">
        <div className="mx-auto max-w-3xl p-6">
          <div className={`${ui.card} ${ui.cardPad}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Access</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Access restricted</div>
                <div className={ui.hint}>You don’t have permission to manage users.</div>
              </div>
              <span className={`${ui.chip} border-amber-200 bg-amber-50 text-amber-800`}>Restricted</span>
            </div>

            {loadErr && (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[12px] text-zinc-700">
                {loadErr}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const showRestrictedByAllowlist = !canUseAdminConsole && !isWhitelistedForUserCreation;

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-[#00477f]/[0.06] via-white to-[#d06549]/[0.05]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Header */}
        <div className={`mb-5 overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white/70 backdrop-blur shadow-sm`}>
          <div className="bg-gradient-to-r from-[#00477f]/10 via-white to-[#d06549]/10 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Access</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900">User Creation</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Manage workspace users (Requester / Approver / Workspace Leader), invitations, bulk imports, and allowlist controls.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`${ui.chip} border-zinc-200 bg-white text-zinc-800`}>Secure • Auditable • Workspace-scoped</span>

                <span
                  className={`${ui.chip} ${
                    customerAllowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {customerAllowed ? "Workspace Loaded" : "Workspace Not Loaded Yet"}
                </span>

                {canUseAdminConsole && (
                  <span className={`${ui.chip} border-[#00477f]/20 bg-[#00477f]/10 text-[#00477f]`}>
                    Staff Mode • Business Selector Enabled
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            {customerAllowed && !showRestrictedByAllowlist && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  ["Total", stats.total],
                  ["Active", stats.active],
                  ["Leaders", stats.leaders],
                  ["Approvers", stats.approvers],
                  ["Requesters", stats.requesters],
                  ["Default", stats.defaultApprovers],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-2xl border border-zinc-200/70 bg-white/70 px-4 py-3">
                    <div className="text-[10px] tracking-[0.22em] uppercase text-zinc-500">{k}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Load error */}
            {loadErr && !customerAllowed && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                {loadErr}
              </div>
            )}

            {allowSavedToast && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
                {allowSavedToast}
              </div>
            )}

            {toast && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
                {toast}
              </div>
            )}

            {actionErr && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
                {actionErr}
              </div>
            )}
          </div>
        </div>

        {/* Staff: Business Selector + Domain Selector + Allowlist Editor */}
        {canUseAdminConsole && (
          <div className={`mb-6 ${ui.card} ${ui.cardPad}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Internal Team</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Business selector + allowlist</div>
                <div className={ui.hint}>
                  Select a Business (MasterData _id) to load its workspace. Then configure allowlist domains/emails to enable customer-side user creation.
                </div>
              </div>
              <span className={`${ui.chip} border-zinc-200 bg-zinc-50 text-zinc-700`}>HR/Admin/SuperAdmin</span>
            </div>

            {/* Selector row */}
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {/* Search */}
              <div className="lg:col-span-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-[11px] font-semibold text-zinc-800">Business Search</div>
                <div className="mt-1 text-xs text-zinc-600">Type a name/email/domain (best-effort search) then pick.</div>

                <div className="mt-3 flex gap-2">
                  <input value={bizQ} onChange={(e) => setBizQ(e.target.value)} placeholder="Search business…" className={ui.input} />
                  <button
                    type="button"
                    className={ui.btnGhost}
                    disabled={bizSearching || normStr(bizQ).length < 2}
                    onClick={() => searchBusinesses(bizQ)}
                  >
                    {bizSearching ? "…" : "Search"}
                  </button>
                </div>

                {bizErr && (
                  <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    {bizErr}
                  </div>
                )}

                {bizOptions.length > 0 && (
                  <div className="mt-3 max-h-52 overflow-auto rounded-2xl border border-zinc-200 bg-white">
                    {bizOptions.map((b) => {
                      const active = selectedBusiness?.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#00477f]/[0.04] ${
                            active ? "bg-[#00477f]/[0.06]" : ""
                          }`}
                          onClick={() => selectBusiness(b)}
                        >
                          <div className="font-semibold text-zinc-900">{b.name}</div>
                          <div className="text-zinc-600">
                            <span className="font-mono">{b.id}</span>
                            {!!b.domains?.length && (
                              <span>
                                {" "}
                                • {b.domains.slice(0, 2).join(", ")}
                                {b.domains.length > 2 ? "…" : ""}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Manual ID */}
              <div className="lg:col-span-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-[11px] font-semibold text-zinc-800">Business MasterData _id</div>
                <div className="mt-1 text-xs text-zinc-600">Paste/enter exact Business ID (required if you don’t use search).</div>

                <div className="mt-3 grid gap-2">
                  <input
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const v = normStr(e.target.value);
                      setSelectedCustomerId(v);
                      if (!v) setSelectedBusiness(null);
                    }}
                    placeholder="e.g., 675a…"
                    className={ui.input}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ui.btnGhost} onClick={() => { reload(); fetchAllowlist(); }}>
                      Load Workspace
                    </button>
                    <button
                      type="button"
                      className={ui.btnGhost}
                      onClick={() => {
                        setSelectedCustomerId("");
                        setSelectedBusiness(null);
                        setSelectedDomain("");
                        setAllowlist(null);
                        setAllowEmailsText("");
                        setAllowDomainsText("");
                        setRows([]);
                        setWorkspace(null);
                        setCustomerAllowed(false);
                        setLoadErr("Please set Customer ID first (Business MasterData _id) to load the workspace.");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Domain selector */}
              <div className="lg:col-span-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-[11px] font-semibold text-zinc-800">Domain selector</div>
                <div className="mt-1 text-xs text-zinc-600">Optional helper (for quick allowlist entry and clarity).</div>

                <div className="mt-3 grid gap-2">
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(String(e.target.value || "").trim().toLowerCase())}
                    className={ui.select}
                    disabled={availableDomains.length === 0}
                  >
                    {availableDomains.length === 0 ? (
                      <option value="">No domains detected yet</option>
                    ) : (
                      availableDomains.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    className={ui.btnGhost}
                    disabled={!selectedDomain || allowBusy}
                    onClick={() => {
                      const next = new Set(normalizeDomainList(allowDomainsText));
                      if (selectedDomain) next.add(selectedDomain);
                      setAllowDomainsText(Array.from(next).join("\n"));
                    }}
                  >
                    Add selected domain to allowlist
                  </button>
                </div>
              </div>
            </div>

            {/* Allowlist editor */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Allowlist</div>
                    <div className="mt-1 text-base font-semibold text-zinc-900">Domains</div>
                    <div className={ui.hint}>One per line (no @). Example: helloviza.com</div>
                  </div>

                  <button
                    type="button"
                    className={ui.btnPrimary}
                    disabled={allowBusy || !normStr(selectedCustomerId)}
                    onClick={saveAllowlistDomains}
                    title={!normStr(selectedCustomerId) ? "Set Customer ID to load workspace" : "Save domains"}
                  >
                    {allowSavingDomains ? "Saving…" : "Save Domains"}
                  </button>
                </div>

                <textarea
                  value={allowDomainsText}
                  onChange={(e) => setAllowDomainsText(e.target.value)}
                  className={`${ui.textarea} mt-3`}
                  placeholder={"helloviza.com\nplumtrips.com"}
                  disabled={allowBusy}
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Allowlist</div>
                    <div className="mt-1 text-base font-semibold text-zinc-900">Emails</div>
                    <div className={ui.hint}>One per line. Example: approver@helloviza.com</div>
                  </div>

                  <button
                    type="button"
                    className={ui.btnPrimary}
                    disabled={allowBusy || !normStr(selectedCustomerId)}
                    onClick={saveAllowlistEmails}
                    title={!normStr(selectedCustomerId) ? "Set Customer ID to load workspace" : "Save emails"}
                  >
                    {allowSavingEmails ? "Saving…" : "Save Emails"}
                  </button>
                </div>

                <textarea
                  value={allowEmailsText}
                  onChange={(e) => setAllowEmailsText(e.target.value)}
                  className={`${ui.textarea} mt-3`}
                  placeholder={"approver@helloviza.com\nlead@plumtrips.com"}
                  disabled={allowBusy}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={ui.btnGhost}
                disabled={allowLoading || !normStr(selectedCustomerId)}
                onClick={fetchAllowlist}
              >
                {allowLoading ? "Loading…" : "Refresh allowlist"}
              </button>

              {allowErr && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                  {allowErr}
                </div>
              )}

              {allowlist && (
                <div className="text-[12px] text-zinc-700">
                  <span className="font-semibold">Updated by:</span> {allowlist.updatedBy || "-"}{" "}
                  <span className="mx-2">•</span>
                  <span className="font-semibold">Updated at:</span> {allowlist.updatedAt || "-"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer-side allowlist restriction card */}
        {showRestrictedByAllowlist && (
          <div className={`${ui.card} ${ui.cardPad} mb-6`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Access</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Access restricted</div>
                <div className={ui.hint}>
                  Your email/domain isn’t whitelisted for User Creation. Contact HR/Admin to whitelist your domain or email.
                </div>
                <div className="mt-2 text-[12px] text-zinc-700">
                  You are signed in as: <span className="font-semibold">{myEmail || "-"}</span>
                  {myDomain ? (
                    <>
                      <span className="mx-2">•</span>domain: <span className="font-semibold">{myDomain}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <span className={`${ui.chip} border-amber-200 bg-amber-50 text-amber-800`}>Restricted</span>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-700">
              If allowlist is empty/not set, access is denied by default (safe default).
            </div>
          </div>
        )}

        {/* Workspace User Management */}
        {customerAllowed && !showRestrictedByAllowlist && (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Create / Bulk */}
            <div className="lg:col-span-1 space-y-5">
              <div className={`${ui.card} ${ui.cardPad}`}>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Create</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Add a user</div>
                <div className={ui.hint}>
                  Creates or updates the user. Optionally sends an invite link.
                  <span className="block mt-1">
                    <b>Reporting To</b> is enforced for <b>REQUESTER</b> (uses workspace default if you don’t pick).
                  </span>
                </div>

                <form onSubmit={onCreateOne} className="mt-4 grid gap-3">
                  <label className="grid gap-1">
                    <span className={ui.label}>Name *</span>
                    <input
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder="Full name"
                      className={ui.input}
                      disabled={busyCreate || loading}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className={ui.label}>Email *</span>
                    <input
                      value={cEmail}
                      onChange={(e) => setCEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={ui.input}
                      disabled={busyCreate || loading}
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="grid gap-1 min-w-0">
                      <span className={ui.label}>Role *</span>
                      <select
                        value={cRole}
                        onChange={(e) => onRoleChange(e.target.value as MemberRole)}
                        className={ui.select}
                        disabled={busyCreate || loading}
                      >
                        <option value="REQUESTER">REQUESTER (L1)</option>
                        <option value="APPROVER">APPROVER (L2)</option>
                        <option value="WORKSPACE_LEADER">WORKSPACE_LEADER (L0)</option>
                      </select>
                    </label>

                    <label className="grid gap-1 min-w-0">
                      <span className={ui.label}>Department</span>
                      <input
                        value={cDept}
                        onChange={(e) => setCDept(e.target.value)}
                        placeholder="Finance"
                        className={ui.input}
                        disabled={busyCreate || loading}
                      />
                    </label>
                  </div>

                  {/* Reporting To dropdown for REQUESTER */}
                  {cRole === "REQUESTER" && (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <label className="grid gap-1">
                        <span className={ui.label}>Reporting To (Approver)</span>
                        <select
                          value={cApproverEmail}
                          onChange={(e) => setCApproverEmail(normEmail(e.target.value))}
                          className={ui.select}
                          disabled={busyCreate || loading}
                        >
                          <option value="">
                            Auto (use workspace default{workspaceDefaultApprover ? `: ${workspaceDefaultApprover}` : ""})
                          </option>
                          {approverOptions.map((a) => (
                            <option key={a.email} value={a.email}>
                              {a.name} • {a.email}
                            </option>
                          ))}
                        </select>

                        <div className={ui.hint}>
                          {approverOptions.length === 0 ? (
                            <span className="text-amber-800">
                              No Approvers found yet. Create an Approver first (or set workspace default approver).
                            </span>
                          ) : (
                            <span>
                              If you keep <b>Auto</b>, backend will use <b>workspace.defaultApproverEmails</b>.
                            </span>
                          )}
                        </div>

                        {!workspaceDefaultApprover && (
                          <div className="mt-2 text-[11px] text-zinc-700">
                            Workspace default approver: <b className="text-red-700">Not set</b>
                          </div>
                        )}
                      </label>
                    </div>
                  )}

                  <label className="grid gap-1">
                    <span className={ui.label}>Phone</span>
                    <input
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      placeholder="+91…"
                      className={ui.input}
                      disabled={busyCreate || loading}
                    />
                  </label>

                  {/* Password optional */}
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-800">Password</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Set a password now, or keep it empty and use Invite / Admin reset.
                        </div>
                        {!canUseAdminConsole && (
                          <div className="mt-1 text-[11px] text-amber-800">
                            If reset-password is restricted, HR/Admin may be required to force-set it.
                          </div>
                        )}
                      </div>

                      <label className="inline-flex items-center gap-2 text-[12px] text-zinc-700">
                        <input
                          type="checkbox"
                          checked={cSetPassword}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setCSetPassword(on);
                            if (!on) {
                              setCPassword("");
                              setCPassword2("");
                            }
                          }}
                          disabled={busyCreate || loading}
                        />
                        Set password
                      </label>
                    </div>

                    {cSetPassword && (
                      <div className="mt-3 grid gap-2">
                        <label className="grid gap-1">
                          <span className="text-[11px] font-semibold text-zinc-700">New Password (min 8 chars)</span>
                          <input
                            type="password"
                            value={cPassword}
                            onChange={(e) => setCPassword(e.target.value)}
                            placeholder="Enter password"
                            className={ui.input}
                            disabled={busyCreate || loading}
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[11px] font-semibold text-zinc-700">Confirm Password</span>
                          <input
                            type="password"
                            value={cPassword2}
                            onChange={(e) => setCPassword2(e.target.value)}
                            placeholder="Re-enter password"
                            className={ui.input}
                            disabled={busyCreate || loading}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 text-[12px] text-zinc-700">
                      <input
                        type="checkbox"
                        checked={cDefaultApprover}
                        onChange={(e) => setCDefaultApprover(e.target.checked)}
                        disabled={busyCreate || loading || cRole !== "APPROVER"}
                      />
                      Set as default approver
                    </label>

                    <label className="inline-flex items-center gap-2 text-[12px] text-zinc-700">
                      <input
                        type="checkbox"
                        checked={cActive}
                        onChange={(e) => setCActive(e.target.checked)}
                        disabled={busyCreate || loading}
                      />
                      Active
                    </label>

                    <label className="inline-flex items-center gap-2 text-[12px] text-zinc-700">
                      <input
                        type="checkbox"
                        checked={cInvite}
                        onChange={(e) => setCInvite(e.target.checked)}
                        disabled={busyCreate || loading}
                      />
                      Send invite email
                    </label>
                  </div>

                  <button type="submit" disabled={busyCreate || loading} className={ui.btnPrimary}>
                    {busyCreate ? "Saving…" : "Create / Update"}
                  </button>
                </form>
              </div>

              {/* Bulk */}
              <div className={`${ui.card} ${ui.cardPad}`}>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Bulk</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Import / Export</div>
                <div className={ui.hint}>Upload CSV/XLSX, or download templates & exports.</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onDownloadTemplate("csv")} className={ui.btnGhost}>
                    Download CSV Template
                  </button>
                  <button type="button" onClick={() => onDownloadTemplate("xlsx")} className={ui.btnGhost}>
                    Download Excel Template
                  </button>
                  <button type="button" onClick={() => onExport("csv")} className={ui.btnGhost}>
                    Export CSV
                  </button>
                  <button type="button" onClick={() => onExport("xlsx")} className={ui.btnGhost}>
                    Export Excel
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="block w-full text-[12px] text-zinc-700 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-[12px] file:font-semibold file:text-white hover:file:bg-zinc-800"
                    disabled={busyBulk}
                  />
                  <button type="button" onClick={onBulkUpload} disabled={busyBulk} className={ui.btnPrimary}>
                    {busyBulk ? "Uploading…" : "Upload & Import"}
                  </button>
                </div>

                {bulkResult && (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-800">
                    <div className="font-semibold">Bulk result</div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-700">View raw</summary>
                      <pre className="mt-2 overflow-auto rounded-xl bg-white p-2 text-[11px] text-zinc-700">
                        {JSON.stringify(bulkResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>

            {/* Users list */}
            <div className="lg:col-span-2">
              <div className={`${ui.card} ${ui.cardPad}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Users</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">Workspace directory</div>
                    <div className={ui.hint}>Activate/deactivate users and resend invites. Default approvers are highlighted.</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={reload} className={ui.btnGhost} disabled={loading}>
                      {loading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </div>

                {/* Cozy tools */}
                <div className="mt-4 grid gap-2 md:grid-cols-12">
                  <div className="md:col-span-6">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-semibold text-zinc-700">Search</span>
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name, email, department…"
                        className={ui.input}
                      />
                    </label>
                  </div>

                  <div className="md:col-span-4">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-semibold text-zinc-700">Role</span>
                      <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} className={ui.select}>
                        <option value="ALL">All roles</option>
                        <option value="WORKSPACE_LEADER">WORKSPACE_LEADER</option>
                        <option value="APPROVER">APPROVER</option>
                        <option value="REQUESTER">REQUESTER</option>
                      </select>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <div className="h-full flex items-end">
                      <label className="inline-flex items-center gap-2 text-[12px] text-zinc-700">
                        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                        Active only
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-auto rounded-2xl border border-zinc-200 bg-white">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Role</th>
                        <th className="px-3 py-2 font-semibold">Dept</th>
                        <th className="px-3 py-2 font-semibold">Active</th>
                        <th className="px-3 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => {
                        const isDefault = defaultSet.has(normEmail(r.email));
                        const active = r.isActive === false ? false : true;

                        return (
                          <tr key={r._id} className="border-t border-zinc-100 hover:bg-[#00477f]/[0.03]">
                            <td className="px-3 py-2 text-zinc-900">
                              <div className="font-semibold">{r.name || "-"}</div>
                              {isDefault && (
                                <div className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[2px] text-[10px] font-semibold text-emerald-800">
                                  Default Approver
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{r.email}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-[2px] text-[11px] font-semibold text-zinc-800">
                                {r.role}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{r.department || "-"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-[2px] text-[11px] font-semibold ${
                                  active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                                }`}
                              >
                                {active ? "YES" : "NO"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => onToggleActive(r)} className={ui.btnTiny}>
                                  {active ? "Deactivate" : "Activate"}
                                </button>
                                <button type="button" onClick={() => onReinvite(r)} className={ui.btnTiny}>
                                  Re-invite
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredRows.length === 0 && (
                        <tr>
                          <td className="px-3 py-8 text-center text-zinc-600" colSpan={6}>
                            {loading ? "Loading users…" : "No users found (try clearing filters)."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {workspace && (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-700">
                    <div className="font-semibold text-zinc-900">Workspace policy</div>

                    <div className="mt-1">
                      Allowlist domains:{" "}
                      <span className="font-semibold">
                        {availableDomains.length
                          ? availableDomains.join(", ")
                          : "Not set (deny-by-default for customer-side actors)"}
                      </span>
                    </div>

                    <div className="mt-1">
                      Allowlist emails:{" "}
                      <span className="font-semibold">
                        {(allowlist?.emails || []).length ? (allowlist?.emails || []).join(", ") : "Not set"}
                      </span>
                    </div>

                    <div className="mt-1">
                      Approver can create users:{" "}
                      <span className="font-semibold">{workspace.canApproverCreateUsers ? "YES" : "NO"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Staff Admin Credential Console */}
        {canUseAdminConsole && (
          <div className={`mt-6 ${ui.card} ${ui.cardPad}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">Administrative</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">Staff Credential Console</div>
                <div className={ui.hint}>
                  Reset credentials using <span className="font-semibold">/auth/admin/reset-password</span>.
                </div>
              </div>
              <span className={`${ui.chip} border-zinc-200 bg-zinc-50 text-zinc-700`}>HR/Admin/SuperAdmin</span>
            </div>

            <form onSubmit={onAdminReset} className="mt-5 grid gap-3 max-w-xl">
              <label className="grid gap-1">
                <span className={ui.label}>User Email</span>
                <input value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="name@company.com" className={ui.input} />
              </label>

              <label className="grid gap-1">
                <span className={ui.label}>Optional: Set Password (min 8 chars)</span>
                <input
                  type="password"
                  value={aPassword}
                  onChange={(e) => setAPassword(e.target.value)}
                  placeholder="Leave empty to auto-generate"
                  className={ui.input}
                />
              </label>

              {adminErr && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {adminErr}
                </div>
              )}

              <button type="submit" disabled={busyAdmin} className={ui.btnDark}>
                {busyAdmin ? "Working…" : "Reset Password"}
              </button>
            </form>

            {adminResult && (
              <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-[12px] font-semibold text-zinc-900">Result</div>

                <div className="mt-2 grid gap-2 text-[12px] text-zinc-700">
                  <div>
                    <span className="font-semibold">Email:</span> {adminResult?.email || adminResult?.user?.email || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Created:</span> {String(!!adminResult?.created)}
                  </div>
                  {!!adminResult?.tempPassword && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">Temporary Password</div>
                      <div className="mt-1 font-mono text-[13px]">{adminResult.tempPassword}</div>
                    </div>
                  )}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-semibold text-zinc-700">View raw response</summary>
                  <pre className="mt-2 overflow-auto rounded-2xl bg-white p-3 text-[11px] text-zinc-700">
                    {JSON.stringify(adminResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
