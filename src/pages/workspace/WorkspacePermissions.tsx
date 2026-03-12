import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { hasAnyRole, AnyUser, detectUserKind } from "../../lib/rbac";

/* =========================================================
 * Helpers
 * ======================================================= */
function unwrap(res: any) {
  return res?.data ?? res;
}
function extractErr(e: any): string {
  const msg =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Failed";
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}
function norm(v: any) {
  return String(v ?? "").trim().toUpperCase().replace(/[\s\-_]/g, "");
}
function normStr(v: any) {
  return String(v ?? "").trim();
}

function collectRoles(u: any): string[] {
  const out: string[] = [];
  if (Array.isArray(u?.roles)) out.push(...u.roles);
  if (u?.role) out.push(u.role);
  if (u?.hrmsAccessRole) out.push(u.hrmsAccessRole);
  if (u?.hrmsAccessLevel) out.push(u.hrmsAccessLevel);
  if (u?.accountType) out.push(u.accountType);
  if (u?.userType) out.push(u.userType);
  return out.map(norm).filter(Boolean);
}
function isStaffPrivileged(u: any) {
  const r = collectRoles(u);
  return r.some(
    (x) => x.includes("HR") || x.includes("ADMIN") || x.includes("SUPERADMIN"),
  );
}

type PermissionKey = "sbtEnabled" | "canRaiseRequest" | "canViewBilling" | "canManageUsers" | "sbtRole" | "sbtAssignedBookerId";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  sbtEnabled: boolean;
  sbtRole: string | null;
  sbtAssignedBookerId: string | null;
  canRaiseRequest: boolean;
  canViewBilling: boolean;
  canManageUsers: boolean;
  isWorkspaceLeader?: boolean;
};

type WorkspaceInfo = {
  customerId: string;
  travelMode: string;
  allowedDomains: string[];
  totalUsers: number;
};

type BusinessOption = {
  id: string;
  name: string;
  email?: string;
  domains: string[];
  raw?: any;
};

/* =========================================================
 * Toggle Switch
 * ======================================================= */
function Toggle({
  checked,
  disabled,
  loading: busy,
  tooltip,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  onChange: () => void;
}) {
  const btn = (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none cursor-pointer",
        disabled ? "opacity-40 cursor-not-allowed" : "",
        checked ? "bg-emerald-500" : "bg-gray-300",
      ].join(" ")}
    >
      {busy ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      ) : (
        <span
          className={[
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      )}
    </button>
  );

  if (tooltip && disabled) {
    return (
      <div className="group relative inline-flex">
        {btn}
        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {tooltip}
        </div>
      </div>
    );
  }

  return btn;
}

/* =========================================================
 * Pill
 * ======================================================= */
function Pill({ label, color }: { label: string; color: "blue" | "green" | "gray" | "amber" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${colors[color]}`}>
      {label}
    </span>
  );
}

/* =========================================================
 * Toast
 * ======================================================= */
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
        type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {message}
      <button type="button" onClick={onClose} className="ml-2 text-white/80 hover:text-white cursor-pointer">
        ✕
      </button>
    </div>
  );
}

/* =========================================================
 * Skeleton Row
 * ======================================================= */
function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
          <td className="px-4 py-3"><div className="h-4 w-36 bg-gray-200 rounded" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-6 w-11 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-6 w-11 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-6 w-11 bg-gray-200 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-6 w-11 bg-gray-200 rounded-full" /></td>
        </tr>
      ))}
    </>
  );
}

/* =========================================================
 * Lock icon for self-row
 * ======================================================= */
function LockedToggle({ checked }: { checked: boolean }) {
  return (
    <div className="group relative inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full opacity-40 cursor-not-allowed",
          checked ? "bg-emerald-500" : "bg-gray-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
        Contact Plumtrips Admin to modify your own permissions
      </div>
    </div>
  );
}

/* =========================================================
 * Main Component
 * ======================================================= */
export default function WorkspacePermissions() {
  const { user } = useAuth();
  const isAdminUser = useMemo(() => isStaffPrivileged(user as any), [user]);
  const isWorkspaceLeader = useMemo(() => {
    const r = collectRoles(user as any);
    return r.includes("WORKSPACELEADER");
  }, [user]);

  // Derive logged-in user identifiers for self-row detection
  const myId = normStr((user as any)?._id || (user as any)?.sub || (user as any)?.id);
  const myEmail = normStr((user as any)?.email).toLowerCase();

  // Business search (admin only)
  const [bizQ, setBizQ] = useState("");
  const [bizSearching, setBizSearching] = useState(false);
  const [bizOptions, setBizOptions] = useState<BusinessOption[]>([]);
  const [bizErr, setBizErr] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessOption | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const bizDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Toggle loading per-cell
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  /* ─── Business search (admin) ─── */
  function pickBusinessId(raw: any) {
    return String(raw?._id || raw?.id || raw?.customerId || "").trim();
  }
  function pickBusinessName(raw: any) {
    return (
      normStr(raw?.displayName) ||
      normStr(raw?.name) ||
      normStr(raw?.payload?.name) ||
      normStr(raw?.payload?.displayName) ||
      normStr(raw?.email) ||
      "Unnamed"
    );
  }

  async function searchBusinesses(query: string, preload = false) {
    const qq = normStr(query);
    if (!preload && (!qq || qq.length < 2)) {
      setBizOptions([]);
      return;
    }
    setBizSearching(true);
    setBizErr(null);
    try {
      const res = unwrap(await api.get(`/customer/users/workspace/search?q=${encodeURIComponent(qq)}`));
      const rawRows: any[] = Array.isArray(res?.rows) ? res.rows : [];
      if (!rawRows.length) {
        setBizOptions([]);
        setBizErr(preload ? "No businesses yet" : "No businesses found.");
        return;
      }
      const opts: BusinessOption[] = rawRows
        .map((r) => {
          const id = pickBusinessId(r);
          if (!id) return null;
          return { id, name: pickBusinessName(r), domains: [], raw: r } as BusinessOption;
        })
        .filter(Boolean) as BusinessOption[];
      const map = new Map<string, BusinessOption>();
      for (const o of opts) map.set(o.id, o);
      setBizOptions(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      setBizOptions([]);
      setBizErr(extractErr(e));
    } finally {
      setBizSearching(false);
    }
  }

  function selectBusiness(b: BusinessOption | null) {
    setSelectedBusiness(b);
    setSelectedCustomerId(b?.id || "");
    setBizOptions([]);
    setBizQ(b?.name || "");
  }

  /* ─── Load permissions ─── */
  const loadPermissions = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const res = unwrap(await api.get(`/customer/users/workspace/permissions?customerId=${encodeURIComponent(customerId)}`));
      setWorkspace(res?.workspace || null);
      setRows(Array.isArray(res?.rows) ? res.rows.map((r: any) => ({
        ...r,
        sbtRole: r.sbtRole || null,
        sbtAssignedBookerId: r.sbtAssignedBookerId || null,
      })) : []);
    } catch (e: any) {
      setLoadErr(extractErr(e));
      setRows([]);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load for workspace leader
  useEffect(() => {
    if (!isAdminUser && isWorkspaceLeader) {
      const cid = normStr((user as any)?.customerId || (user as any)?.businessId);
      if (cid) {
        setSelectedCustomerId(cid);
        loadPermissions(cid);
      }
    }
  }, [isAdminUser, isWorkspaceLeader, user, loadPermissions]);

  // Load when admin selects a business
  useEffect(() => {
    if (isAdminUser && selectedCustomerId) {
      loadPermissions(selectedCustomerId);
    }
  }, [isAdminUser, selectedCustomerId, loadPermissions]);

  /* ─── Toggle / set permission ─── */
  async function togglePermission(userId: string, permission: PermissionKey, currentValue: any, newValue?: any) {
    const key = `${userId}:${permission}`;
    setTogglingMap((m) => ({ ...m, [key]: true }));

    // For booleans, flip; for others, use provided newValue
    const val = newValue !== undefined ? newValue : !currentValue;

    // Optimistic update
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== userId) return r;
        const updated = { ...r, [permission]: val };
        // Mirror sbtEnabled → canRaiseRequest coupling in UI
        if (permission === "sbtEnabled" && val === true) updated.canRaiseRequest = false;
        if (permission === "sbtEnabled" && val === false) updated.canRaiseRequest = true;
        return updated;
      }),
    );

    try {
      const res = unwrap(
        await api.patch(`/customer/users/workspace/permissions/${userId}`, {
          permission,
          value: val,
        }),
      );
      // Apply server response
      setRows((prev) =>
        prev.map((r) => {
          if (r._id !== userId) return r;
          return {
            ...r,
            sbtEnabled: res.sbtEnabled ?? r.sbtEnabled,
            sbtRole: res.sbtRole !== undefined ? res.sbtRole : r.sbtRole,
            sbtAssignedBookerId: res.sbtAssignedBookerId !== undefined ? res.sbtAssignedBookerId : r.sbtAssignedBookerId,
            canRaiseRequest: res.canRaiseRequest ?? r.canRaiseRequest,
            canViewBilling: res.canViewBilling ?? r.canViewBilling,
            canManageUsers: res.canManageUsers ?? r.canManageUsers,
          };
        }),
      );
      setToast({ message: "Permission updated", type: "success" });
    } catch (e: any) {
      // Revert
      setRows((prev) =>
        prev.map((r) => {
          if (r._id !== userId) return r;
          const reverted = { ...r, [permission]: currentValue };
          if (permission === "sbtEnabled" && currentValue === true) reverted.canRaiseRequest = false;
          if (permission === "sbtEnabled" && currentValue === false) reverted.canRaiseRequest = true;
          return reverted;
        }),
      );
      const errMsg = extractErr(e);
      const code = e?.response?.data?.code;
      if (code === "APPROVAL_FLOW_CONFLICT") {
        setToast({ message: "Cannot enable SBT — company uses approval flow", type: "error" });
      } else {
        setToast({ message: errMsg, type: "error" });
      }
    } finally {
      setTogglingMap((m) => {
        const copy = { ...m };
        delete copy[key];
        return copy;
      });
    }
  }

  // List of L2/BOTH users + Workspace Leaders (implicit L2) for booker assignment dropdown
  const l2Bookers = useMemo(() => {
    return rows.filter((r) => r.sbtRole === "L2" || r.sbtRole === "BOTH" || r.isWorkspaceLeader);
  }, [rows]);

  const isApprovalFlow = workspace?.travelMode === "APPROVAL_FLOW";

  function rolePillColor(role: string): "blue" | "green" | "gray" | "amber" {
    const r = norm(role);
    if (r.includes("ADMIN") || r.includes("SUPERADMIN")) return "blue";
    if (r.includes("WORKSPACELEADER") || r.includes("CUSTOMER")) return "amber";
    if (r.includes("APPROVER")) return "green";
    return "gray";
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-[28px] font-black text-gray-900 tracking-tight">Workspace Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">Manage what each team member can access and do.</p>
      </div>

      {/* Admin Business Search */}
      {isAdminUser && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="text-[11px] font-semibold text-gray-800 block mb-2">Search Business</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type company name…"
              className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15"
              value={bizQ}
              onChange={(e) => {
                setBizQ(e.target.value);
                if (bizDebounceRef.current) clearTimeout(bizDebounceRef.current);
                const v = normStr(e.target.value);
                if (v.length >= 2) {
                  bizDebounceRef.current = setTimeout(() => searchBusinesses(v), 300);
                }
              }}
              onFocus={() => {
                if (!normStr(bizQ) && !bizOptions.length) searchBusinesses("", true);
              }}
              onKeyDown={(e) => e.key === "Enter" && searchBusinesses(bizQ)}
            />
            <button
              type="button"
              className="h-10 rounded-xl bg-[#00477f] px-4 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
              disabled={bizSearching || normStr(bizQ).length < 2}
              onClick={() => searchBusinesses(bizQ)}
            >
              {bizSearching ? "…" : "Search"}
            </button>
          </div>
          {bizErr && <p className="text-xs text-red-500 mt-2">{bizErr}</p>}
          {bizOptions.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50">
              {bizOptions.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#00477f]/5 transition cursor-pointer ${
                    selectedCustomerId === b.id ? "bg-[#00477f]/10 font-semibold text-[#00477f]" : "text-gray-700"
                  }`}
                  onClick={() => selectBusiness(b)}
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-[11px] text-gray-400">{b.id}</span>
                </button>
              ))}
            </div>
          )}
          {selectedBusiness && (
            <div className="mt-3 flex items-center gap-2">
              <Pill label={selectedBusiness.name} color="blue" />
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
                onClick={() => {
                  selectBusiness(null);
                  setBizQ("");
                  setRows([]);
                  setWorkspace(null);
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* WORKSPACE INFO CARD */}
      {workspace && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Travel Mode</span>
              <Pill
                label={workspace.travelMode.replace(/_/g, " ")}
                color={workspace.travelMode === "APPROVAL_FLOW" ? "amber" : "green"}
              />
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Domains</span>
              <span className="text-[13px] text-gray-700">
                {workspace.allowedDomains.length > 0
                  ? workspace.allowedDomains.join(", ")
                  : "None configured"}
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Users</span>
              <span className="text-[13px] font-semibold text-gray-900">{workspace.totalUsers}</span>
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {loadErr && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{loadErr}</div>
      )}

      {/* TABLE */}
      {(loading || rows.length > 0) && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">SBT Access</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">SBT Role</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Assigned Booker</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">View Billing</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Manage Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <SkeletonRows />
                ) : (
                  rows.map((row) => {
                    const isSelf = !isAdminUser && isWorkspaceLeader && (
                      (myId && row._id === myId) ||
                      (myEmail && row.email.toLowerCase() === myEmail)
                    );

                    return (
                    <tr key={row._id} className={isSelf ? "bg-blue-50/40" : "hover:bg-gray-50/50 transition-colors"}>
                      <td className="px-4 py-3 text-[13px] font-semibold text-gray-900 whitespace-nowrap">
                        {row.name || "—"}
                        {isSelf && (
                          <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">YOU</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-500 whitespace-nowrap">{row.email}</td>
                      <td className="px-4 py-3">
                        <Pill label={row.role} color={rolePillColor(row.role)} />
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          label={row.isActive ? "Active" : "Inactive"}
                          color={row.isActive ? "green" : "gray"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <LockedToggle checked={row.sbtEnabled} />
                        ) : (
                          <Toggle
                            checked={row.sbtEnabled}
                            disabled={isApprovalFlow}
                            loading={!!togglingMap[`${row._id}:sbtEnabled`]}
                            tooltip={isApprovalFlow ? "Company uses approval flow" : undefined}
                            onChange={() => togglePermission(row._id, "sbtEnabled", row.sbtEnabled)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-xs text-gray-400">{row.sbtRole || "—"}</span>
                        ) : (
                          <div className="group relative inline-flex">
                            <select
                              value={row.sbtRole || ""}
                              disabled={!row.sbtEnabled || !!togglingMap[`${row._id}:sbtRole`]}
                              onChange={(e) => {
                                const v = e.target.value || null;
                                togglePermission(row._id, "sbtRole", row.sbtRole, v);
                              }}
                              className={[
                                "h-7 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none cursor-pointer",
                                !row.sbtEnabled ? "opacity-40 cursor-not-allowed" : "",
                              ].join(" ")}
                            >
                              <option value="">None</option>
                              <option value="L1">L1 Requestor</option>
                              <option value="L2">L2 Booker</option>
                              <option value="BOTH">Both</option>
                            </select>
                            {!row.sbtEnabled && (
                              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                Enable SBT Access first
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (row.sbtRole === "L1" || row.sbtRole === "BOTH") ? (
                          <select
                            value={row.sbtAssignedBookerId || ""}
                            disabled={!!togglingMap[`${row._id}:sbtAssignedBookerId`]}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              togglePermission(row._id, "sbtAssignedBookerId", row.sbtAssignedBookerId, v);
                            }}
                            className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none cursor-pointer max-w-[140px]"
                          >
                            <option value="">Select L2 Booker</option>
                            {l2Bookers
                              .filter((b) => b._id !== row._id)
                              .map((b) => (
                                <option key={b._id} value={b._id}>
                                  {b.name || b.email}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <LockedToggle checked={row.canViewBilling} />
                        ) : (
                          <Toggle
                            checked={row.canViewBilling}
                            loading={!!togglingMap[`${row._id}:canViewBilling`]}
                            onChange={() => togglePermission(row._id, "canViewBilling", row.canViewBilling)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <LockedToggle checked={row.canManageUsers} />
                        ) : (
                          <div className="group relative inline-flex">
                            <Toggle
                              checked={row.canManageUsers}
                              loading={!!togglingMap[`${row._id}:canManageUsers`]}
                              onChange={() => togglePermission(row._id, "canManageUsers", row.canManageUsers)}
                            />
                            <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
                              Grants sub-leader access to this permission panel
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !loadErr && rows.length === 0 && selectedCustomerId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="text-gray-300 mb-3">
            <svg className="w-16 h-16 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No users in this workspace yet.</p>
        </div>
      )}

      {/* No selection prompt (admin) */}
      {isAdminUser && !selectedCustomerId && !loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Search and select a business above to manage permissions.</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
