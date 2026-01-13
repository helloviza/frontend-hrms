// apps/frontend/src/pages/hr/OrgChart.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type RawOrgItem = Record<string, any>;

type OrgNode = {
  id: string;
  name: string;
  title?: string;
  department?: string;
  managerId?: string | null;
  avatarUrl?: string;
  raw: RawOrgItem;
  children: OrgNode[];
};

export default function OrgChartPage() {
  const { user } = useAuth();

  const [tree, setTree] = useState<OrgNode[]>([]);
  const [flat, setFlat] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingManager, setSavingManager] = useState(false);

  /* -----------------------------------------------------------
     Role detection: who can manage mappings?
  ----------------------------------------------------------- */
  const roles = useMemo(() => {
    const u: any = user || {};
    const collected: string[] = [];

    if (Array.isArray(u.roles)) collected.push(...u.roles);

    const singleCandidates = [
      u.role,
      u.roleType,
      u.roleName,
      u.userRole,
      u.profile?.role,
      u.hrmsAccessRole,
    ];

    for (const r of singleCandidates) {
      if (r) collected.push(r);
    }

    if (!collected.length) collected.push("EMPLOYEE");

    return collected
      .filter(Boolean)
      .map((r: string) => String(r).toUpperCase().trim());
  }, [user]);

  const canManageOrgChart = useMemo(
    () =>
      roles.some((r) => {
        const v = r.replace(/[\s_-]+/g, "");
        return v === "HR" || v === "ADMIN" || v === "SUPERADMIN";
      }),
    [roles],
  );

  /* -----------------------------------------------------------
     Helpers to normalise backend data
  ----------------------------------------------------------- */

  function normaliseOrg(rawList: RawOrgItem[]): { tree: OrgNode[]; flat: OrgNode[] } {
    const byId: Record<string, OrgNode> = {};
    const childrenMap: Record<string, OrgNode[]> = {};

    const flatNodes: OrgNode[] = rawList.map((item, index) => {
      const id =
        item.id ||
        item._id ||
        item.employeeId ||
        item.userId ||
        `emp-${index}`;

      const name =
        item.name ||
        item.fullName ||
        item.displayName ||
        `${item.firstName || ""} ${item.lastName || ""}`.trim() ||
        "Unnamed";

      const title =
        item.title ||
        item.designation ||
        item.role ||
        item.jobTitle ||
        undefined;

      const department =
        item.department || item.dept || item.function || undefined;

      const managerId =
        item.managerId ??
        item.reportsToId ??
        item.reportingManagerId ??
        item.manager?._id ??
        item.manager ??
        null;

      const avatarUrl =
        item.avatarUrl || item.avatar || item.photoUrl || item.profileImage;

      const node: OrgNode = {
        id: String(id),
        name: String(name),
        title: title ? String(title) : undefined,
        department: department ? String(department) : undefined,
        managerId: managerId != null ? String(managerId) : null,
        avatarUrl: avatarUrl || undefined,
        raw: item,
        children: [],
      };

      byId[node.id] = node;
      return node;
    });

    // Build children arrays
    flatNodes.forEach((node) => {
      const mgrId = node.managerId;
      if (!mgrId) return;
      if (!childrenMap[mgrId]) childrenMap[mgrId] = [];
      childrenMap[mgrId].push(node);
    });

    // Attach children onto parents
    flatNodes.forEach((node) => {
      const kids = childrenMap[node.id];
      if (kids && kids.length) {
        node.children = kids;
      }
    });

    // Roots = no manager or manager not found
    const roots = flatNodes.filter(
      (node) => !node.managerId || !byId[node.managerId],
    );

    // If nothing has root (bad data), just treat all as roots
    const treeRoots = roots.length ? roots : flatNodes;

    return { tree: treeRoots, flat: flatNodes };
  }

  function getNode(id: string | null | undefined): OrgNode | undefined {
    if (!id) return undefined;
    return flat.find((n) => n.id === id);
  }

  function getManager(node: OrgNode | undefined): OrgNode | undefined {
    if (!node?.managerId) return undefined;
    return getNode(node.managerId);
  }

  function countReports(node: OrgNode | undefined): number {
    if (!node) return 0;
    return node.children?.length ?? 0;
  }

  /* -----------------------------------------------------------
     Load org chart from backend
  ----------------------------------------------------------- */

  async function loadOrgChart() {
    setLoading(true);
    setError(null);
    try {
      const resp = (await api.get("/hr/org-chart")) as
        | RawOrgItem[]
        | { items?: RawOrgItem[] };

      const list: RawOrgItem[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? ((resp as any).items as RawOrgItem[])
        : [];

      const { tree, flat } = normaliseOrg(list);
      setTree(tree);
      setFlat(flat);

      // Default expand top-level nodes
      const initialExpanded: Record<string, boolean> = {};
      tree.forEach((root) => {
        initialExpanded[root.id] = true;
      });
      setExpanded(initialExpanded);

      // Select first root or first flat entry
      const first =
        tree[0]?.id ||
        flat[0]?.id ||
        null;
      setSelectedId(first);
    } catch (e: any) {
      console.error("Failed to load org chart:", e);
      setError(e.message || "Failed to load org chart");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrgChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -----------------------------------------------------------
     Update manager mapping (HR/Admin only)
     Expects backend route: POST /api/hr/org-chart/map
     Body: { employeeId, managerId }
  ----------------------------------------------------------- */

  async function handleManagerChange(employeeId: string, managerId: string | null) {
    if (!canManageOrgChart) return;

    const confirmed = window.confirm(
      "Update reporting manager for this employee?",
    );
    if (!confirmed) return;

    setSavingManager(true);
    try {
      await api.post("/hr/org-chart/map", {
        employeeId,
        managerId,
      });
      await loadOrgChart();
    } catch (e: any) {
      alert(e.message || "Failed to update reporting manager");
    } finally {
      setSavingManager(false);
    }
  }

  /* -----------------------------------------------------------
     Render helpers
  ----------------------------------------------------------- */

  const selectedNode = selectedId ? getNode(selectedId) : undefined;

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function renderNode(node: OrgNode, depth: number): JSX.Element {
    const isExpanded = expanded[node.id] ?? true;
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isSelected = node.id === selectedId;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center justify-between rounded-2xl border px-3 py-2 mb-1 transition ${
            isSelected
              ? "border-cyan-400 bg-slate-900"
              : "border-slate-800 bg-slate-950/70 hover:border-cyan-500/60 hover:bg-slate-900/80"
          }`}
          style={{ marginLeft: depth * 20 }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedId(node.id);
              if (hasChildren) toggleExpanded(node.id);
            }}
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
          >
            {/* toggle icon */}
            <div className="flex items-center justify-center h-6 w-6 rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-300">
              {hasChildren ? (isExpanded ? "▾" : "▸") : "•"}
            </div>

            {/* avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs text-cyan-100">
              {node.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={node.avatarUrl}
                  alt={node.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span>{node.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-50">
                {node.name}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                {node.title && <span>{node.title}</span>}
                {node.department && (
                  <span className="rounded-full bg-slate-800/80 px-2 py-[2px] text-[10px]">
                    {node.department}
                  </span>
                )}
                {depth === 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-200 px-2 py-[2px] text-[10px]">
                    Top of org
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="ml-2 text-[11px] text-slate-500">
            {countReports(node)} direct report
            {countReports(node) === 1 ? "" : "s"}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  /* -----------------------------------------------------------
     Main render
  ----------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="rounded-3xl border border-cyan-500/40 bg-[radial-gradient(circle_at_top_left,#0f172a,transparent_55%),radial-gradient(circle_at_bottom_right,#020617,transparent_55%)] px-6 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.9)] text-slate-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-400/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20">
                🧬
              </span>
              <span>PlumTrips HRMS · Org chart</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Organisation structure
            </h1>
            <p className="mt-1 text-[12px] text-slate-300 max-w-xl">
              Explore how the company is structured from the CEO downwards.
              Expand each manager to see their reporting lines.
            </p>
          </div>

          <div className="text-[11px] text-slate-300 max-w-xs">
            {canManageOrgChart ? (
              <>
                <span className="font-semibold text-emerald-300">
                  You have mapping rights.
                </span>{" "}
                You can update reporting managers for employees. Changes will
                immediately reflect in the org chart.
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-50">
                  Read-only access.
                </span>{" "}
                The reporting structure is maintained by HR/Admin. Please reach
                out to them if you spot an incorrect mapping.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content: tree + details */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
        {/* Tree pane */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_18px_60px_rgba(15,23,42,0.7)] p-5 text-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Company org chart
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {flat.length} profile{flat.length === 1 ? "" : "s"} loaded.
                Click a person to view details.
              </p>
            </div>
            {loading && (
              <span className="text-[11px] text-slate-500">Loading…</span>
            )}
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
              {error}
            </div>
          )}

          {tree.length === 0 && !loading && !error && (
            <p className="text-[11px] text-slate-500">
              No org chart data available yet. Once HR maps reporting managers,
              the structure will appear here.
            </p>
          )}

          <div className="mt-1 space-y-1 max-h-[520px] overflow-auto pr-1">
            {tree.map((root) => renderNode(root, 0))}
          </div>
        </div>

        {/* Details pane */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_18px_60px_rgba(15,23,42,0.7)] p-5 text-slate-100 flex flex-col">
          {selectedNode ? (
            <>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/25 text-base text-cyan-100">
                  {selectedNode.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedNode.avatarUrl}
                      alt={selectedNode.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span>
                      {selectedNode.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-50 truncate">
                    {selectedNode.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedNode.title || "Role not specified"}
                    {selectedNode.department && (
                      <>
                        {" · "}
                        {selectedNode.department}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-[12px] text-slate-300 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Reports to</span>
                  <span className="font-medium text-slate-100">
                    {getManager(selectedNode)?.name || "Top of org"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Direct reports</span>
                  <span className="font-medium text-slate-100">
                    {countReports(selectedNode)}
                  </span>
                </div>

                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-[11px] text-slate-500 mb-2">
                    Reporting chain (top-down):
                  </p>
                  <ol className="list-none pl-0 text-[11px] text-slate-300 space-y-1">
                    {(() => {
                      const chain: OrgNode[] = [];
                      let cursor: OrgNode | undefined = selectedNode;
                      while (cursor) {
                        chain.push(cursor);
                        cursor = getManager(cursor);
                      }
                      return chain
                        .slice()
                        .reverse()
                        .map((n, idx) => (
                          <li key={n.id} className="flex items-center gap-2">
                            <span className="text-slate-500">
                              {idx + 1}.
                            </span>
                            <span className="font-medium text-slate-100">
                              {n.name}
                            </span>
                            {n.title && (
                              <span className="text-slate-400">
                                · {n.title}
                              </span>
                            )}
                          </li>
                        ));
                    })()}
                  </ol>
                </div>
              </div>

              {/* Manager mapping controls – HR/Admin only */}
              {canManageOrgChart && (
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <p className="text-[11px] text-slate-400 mb-2">
                    Update reporting manager for this employee
                    (HR/Admin/Super Admin only).
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedNode.managerId || ""}
                      onChange={(e) =>
                        handleManagerChange(
                          selectedNode.id,
                          e.target.value || null,
                        )
                      }
                      disabled={savingManager}
                      className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">Top of org (no manager)</option>
                      {flat
                        .filter((n) => n.id !== selectedNode.id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                            {n.title ? ` · ${n.title}` : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-400 cursor-default"
                    >
                      Auto-saves on change
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-slate-500">
              Select a person from the org chart to see their details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
