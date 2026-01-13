// src/pages/vendors/MasterData.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";

type RecordType = {
  id: string;
  // possible name shapes coming from different sources
  name?: string;
  inviteeName?: string;
  fullName?: string;
  contactName?: string;
  businessName?: string;

  email: string;
  type: string;
  status: string;
  isActive: boolean;
  updatedAt?: string;
  submittedAt?: string;
  token?: string;
};

function prettifyFromEmail(email?: string): string {
  if (!email) return "";
  const local = email.split("@")[0] || "";
  if (!local) return "";
  // turn "ali.imran-hr" → "Ali Imran Hr"
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickDisplayName(r: Partial<RecordType>): string {
  const candidate =
    r.name ||
    r.inviteeName ||
    r.fullName ||
    r.contactName ||
    r.businessName ||
    "";

  const trimmed = String(candidate).trim();
  if (trimmed) return trimmed;

  const fromEmail = prettifyFromEmail(r.email);
  return fromEmail || "—";
}

/** Small badge helpers for type & status */
function typeBadge(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("employee")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#00477f]/10 text-[#00477f]">
        Employee
      </span>
    );
  }
  if (t.includes("vendor")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
        Vendor
      </span>
    );
  }
  if (t.includes("business") || t.includes("customer")) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#d06549]/10 text-[#d06549]">
        Customer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
      {type || "Unknown"}
    </span>
  );
}

function statusBadge(isActive: boolean, rawStatus: string) {
  const s = (rawStatus || "").toUpperCase();
  const label = !s ? (isActive ? "APPROVED" : "INACTIVE") : s;

  if (!isActive || s === "INACTIVE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        {label}
    </span>
  );
}

export default function MasterData() {
  const [items, setItems] = useState<RecordType[]>([]);
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  // Employee promotion dialog state
  const [promotionTarget, setPromotionTarget] = useState<RecordType | null>(
    null,
  );
  const [promotionEmail, setPromotionEmail] = useState("");
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);

  // Smart search (AI-like filter)
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (type !== "All") q.append("type", type);
      if (status !== "All") q.append("status", status);

      const res = await api.get(`/master-data?${q.toString()}`);
const list: RecordType[] = (res.items || []).map((it: any) => {
  // Normalize TYPE (onboarding + live entities)
  let normalizedType = String(it.type || "").toUpperCase();

  if (normalizedType === "CUSTOMER") normalizedType = "Business";
  if (normalizedType === "VENDOR") normalizedType = "Vendor";
  if (normalizedType === "EMPLOYEE") normalizedType = "Employee";

  // Normalize STATUS
  const normalizedStatus = String(it.status || "").toUpperCase();

  return {
    id: String(it.id ?? it._id ?? ""),
    name: it.name,
    inviteeName: it.inviteeName,
    fullName: it.fullName,
    contactName: it.contactName,
    businessName: it.businessName,
    email: it.email || "",
    type: normalizedType,
    status: normalizedStatus,
    isActive:
      typeof it.isActive === "boolean"
        ? it.isActive
        : normalizedStatus === "ACTIVE",
    updatedAt:
      it.updatedAt ||
      it.updated_at ||
      it.modifiedAt ||
      it.modified_at,
    submittedAt: it.submittedAt,
    token: it.token,
  };
});


      setItems(list);
    } catch (e: any) {
      alert(e?.message || "Failed to load master data");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await api.patch(`/master-data/${id}/status`, {
        status: isActive ? "Inactive" : "Active",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update status");
    }
  }

  async function loadDetails(rec: RecordType) {
    setDetailLoading(true);
    try {
      const key = rec.token || rec.id;
      const res = await api.get(`/onboarding/${key}/details`);
      setSelected(res);
    } catch (e: any) {
      alert(e?.message || "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  }

  // ───────────────── EMPLOYEE PROMOTION ─────────────────

  function openCreateEmployeeDialog(rec: RecordType) {
    setPromotionTarget(rec);
    setPromotionEmail(rec.email || "");
    setPromotionError(null);
  }

  async function confirmCreateEmployee() {
    if (!promotionTarget) return;

    const email = promotionEmail.trim();

    if (!email) {
      setPromotionError("Official company email is required.");
      return;
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      setPromotionError("Please enter a valid official email address.");
      return;
    }

    try {
      setPromotionLoading(true);
      setCreatingId(promotionTarget.id);

      const res = await api.post(
        `/master-data/${promotionTarget.id}/promote-employee`,
        {
          officialEmail: email,
        },
      );

      const code =
        res?.employeeCode ||
        res?.user?.employeeCode ||
        res?.employee?.employeeCode ||
        "—";

      alert(
        `Employee created successfully in HRMS${
          code !== "—" ? ` (ID: ${code})` : ""
        }.`,
      );

      await load();

      setPromotionTarget(null);
      setPromotionEmail("");
      setPromotionError(null);
    } catch (e: any) {
      setPromotionError(e?.message || "Failed to create employee record");
    } finally {
      setPromotionLoading(false);
      setCreatingId(null);
    }
  }

  // ───────────────── VENDOR & CUSTOMER PROMOTION ─────────────────

  async function promoteVendor(rec: RecordType) {
    try {
      setCreatingId(rec.id);
      const res = await api.post(
        `/master-data/${rec.id}/promote-vendor`,
        {},
      );

      const code =
        res?.vendorCode ||
        res?.vendor?.vendorCode ||
        (res?.vendor && res.vendor.code) ||
        "—";

      alert(
        `Vendor profile created successfully${
          code !== "—" ? ` (Code: ${code})` : ""
        }.`,
      );
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to create vendor profile");
    } finally {
      setCreatingId(null);
    }
  }

  async function promoteCustomer(rec: RecordType) {
    try {
      setCreatingId(rec.id);
      const res = await api.post(
        `/master-data/${rec.id}/promote-customer`,
        {},
      );

      const code =
        res?.customerCode ||
        res?.customer?.customerCode ||
        (res?.customer && res.customer.code) ||
        "—";

      alert(
        `Customer profile created successfully${
          code !== "—" ? ` (Code: ${code})` : ""
        }.`,
      );
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to create customer profile");
    } finally {
      setCreatingId(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  // ───────────────── Derived metrics & filtered list ─────────────────

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((r) => {
      const name = pickDisplayName(r).toLowerCase();
      const email = (r.email || "").toLowerCase();
      const t = (r.type || "").toLowerCase();
      const statusText = (r.status || "").toLowerCase();
      return (
        name.includes(s) ||
        email.includes(s) ||
        t.includes(s) ||
        statusText.includes(s)
      );
    });
  }, [items, search]);

  const counts = useMemo(() => {
    let employees = 0;
    let vendors = 0;
    let customers = 0;
    let active = 0;

    for (const r of items) {
      const t = (r.type || "").toLowerCase();
      if (t.includes("employee")) employees += 1;
      else if (t.includes("vendor")) vendors += 1;
      else if (t.includes("business") || t.includes("customer"))
        customers += 1;
      if (r.isActive) active += 1;
    }

    return {
      total: items.length,
      employees,
      vendors,
      customers,
      active,
    };
  }, [items]);

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-[calc(100vh-80px)]">
      {/* Hero / Heading */}
      <div className="rounded-2xl bg-gradient-to-r from-[#00477f] via-[#00477f] to-[#d06549] text-white p-5 md:p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-white/20">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Master Data Hub
          </h1>
          <p className="mt-1 text-sm md:text-[13px] text-slate-100/90 max-w-xl">
            One place to orchestrate all{" "}
            <span className="font-semibold">Employees</span>,{" "}
            <span className="font-semibold">Vendors</span> and{" "}
            <span className="font-semibold">Customers</span>. Curated for an
            AI-ready HRMS & vendor ecosystem – data is persistent, never hard
            deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs md:text-[11px]">
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Total Records
            </span>
            <span className="text-lg font-bold">{counts.total}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Employees
            </span>
            <span className="text-lg font-semibold">{counts.employees}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Vendors
            </span>
            <span className="text-lg font-semibold">{counts.vendors}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Customers
            </span>
            <span className="text-lg font-semibold">{counts.customers}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 flex flex-col min-w-[90px]">
            <span className="uppercase tracking-wide text-[10px] text-slate-100/80">
              Active
            </span>
            <span className="text-lg font-semibold">{counts.active}</span>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="grid grid-cols-1 md:grid-cols-[auto,auto,1fr,auto] gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Entity Type
          </label>
          <select
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/40"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>All</option>
            <option>Vendor</option>
            <option>Business</option>
            <option>Employee</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">
            Status
          </label>
          <select
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/40"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Smart search by name, email, type or status…"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={load}
            className="inline-flex items-center gap-1 bg-[#00477f] text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:bg-[#003866] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="inline-block h-3 w-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <span>↻</span>
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {filteredItems.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-slate-400 text-sm">
            No records found. Try adjusting filters or inviting a new Vendor /
            Customer / Employee.
          </div>
        )}

        {filteredItems.map((r) => {
          const displayName = pickDisplayName(r);
          const updated =
            r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—";

          const typeLower = String(r.type || "").toLowerCase();
          const isEmployee = typeLower.includes("employee");
          const isVendor = typeLower.includes("vendor");
          const isCustomer =
            typeLower.includes("business") || typeLower.includes("customer");

          const isCreatingThis = creatingId === r.id;

          return (
            <div
              key={r.id}
              className="group bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm hover:shadow-md hover:border-[#00477f]/40 transition-all duration-150"
            >
              {/* Left: identity */}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-[#00477f]/10 flex items-center justify-center text-[13px] font-semibold text-[#00477f] uppercase">
                  {displayName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p.charAt(0))
                    .join("") || "?"}
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                      {displayName}
                    </span>
                    {typeBadge(r.type)}
                    {statusBadge(r.isActive, r.status)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.email || "No email specified"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Last updated:{" "}
                    <span className="font-medium text-slate-500">
                      {updated}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex flex-wrap gap-2 justify-start md:justify-end text-xs">
                <button
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => loadDetails(r)}
                  disabled={detailLoading}
                >
                  {detailLoading ? "Loading…" : "View Details"}
                </button>

                <button
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => toggleActive(r.id, r.isActive)}
                >
                  {r.isActive ? "Set Inactive" : "Set Active"}
                </button>

                {isEmployee && (
                  <button
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#00477f]/90 text-white hover:bg-[#00477f]"
                    onClick={() => openCreateEmployeeDialog(r)}
                    disabled={isCreatingThis}
                  >
                    {isCreatingThis ? "Creating…" : "Create Employee"}
                  </button>
                )}

                {isVendor && (
                  <button
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-500/90 text-white hover:bg-amber-600"
                    onClick={() => promoteVendor(r)}
                    disabled={isCreatingThis}
                  >
                    {isCreatingThis ? "Creating…" : "Create Vendor"}
                  </button>
                )}

                {isCustomer && (
                  <button
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#d06549]/90 text-white hover:bg-[#c0563c]"
                    onClick={() => promoteCustomer(r)}
                    disabled={isCreatingThis}
                  >
                    {isCreatingThis ? "Creating…" : "Create Customer"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer for Details */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 pt-5 overflow-y-auto rounded-l-3xl border-l border-slate-200">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#00477f]">
                  {selected.type || "Record"} Details
                </h2>
                <p className="text-xs text-slate-500">
                  Structured view of onboarding payload for this entity.
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-800 rounded-full h-7 w-7 flex items-center justify-center hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-slate-700">Name:</span>{" "}
                {pickDisplayName(selected)}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Email:</span>{" "}
                {selected.email || "—"}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Type:</span>{" "}
                {selected.type || "—"}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Status:</span>{" "}
                <span className="text-emerald-600 font-medium">
                  {selected.status}
                </span>
              </div>

              {selected.documents?.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold mb-1 text-slate-700">
                    Documents
                  </div>
                  <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                    {selected.documents.map((d: any, i: number) => (
                      <li key={i}>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00477f] hover:underline break-all"
                          >
                            {d.name}
                          </a>
                        ) : (
                          d.name
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.payload && (
                <div className="mt-4">
                  <div className="font-semibold mb-1 text-slate-700">
                    Form Data
                  </div>
                  <div className="bg-gray-50 border border-slate-200 p-3 rounded-xl text-sm">
                    {renderFormData(selected.payload)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Employee – Official Email dialog */}
      {promotionTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-lg font-bold text-[#00477f]">
                  Create Employee
                </h2>
                <p className="text-xs text-slate-500">
                  Promote this approved onboarding into a live HRMS employee
                  profile.
                </p>
              </div>
              <button
                onClick={() => {
                  if (promotionLoading) return;
                  setPromotionTarget(null);
                  setPromotionEmail("");
                  setPromotionError(null);
                }}
                className="text-gray-500 hover:text-gray-800 rounded-full h-7 w-7 flex items-center justify-center hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              You are about to create an employee profile for{" "}
              <span className="font-semibold">
                {pickDisplayName(promotionTarget)}
              </span>
              .
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Official Email Address (Company){" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00477f]/40"
              value={promotionEmail}
              onChange={(e) => setPromotionEmail(e.target.value)}
              placeholder="e.g. jane.doe@plumtrips.com"
            />

            {promotionError && (
              <div className="mt-2 text-xs text-red-600">
                {promotionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  if (promotionLoading) return;
                  setPromotionTarget(null);
                  setPromotionEmail("");
                  setPromotionError(null);
                }}
                disabled={promotionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-1.5 text-sm rounded-lg bg-[#00477f] text-white hover:bg-[#003866] disabled:opacity-60"
                onClick={confirmCreateEmployee}
                disabled={promotionLoading}
              >
                {promotionLoading ? "Creating…" : "Create Employee"}
              </button>
            </div>
          </div>
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
