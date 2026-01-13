// apps/frontend/src/pages/hr/Policies.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";
import api, { API_BASE } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type PolicyItem = {
  _id?: string;
  title?: string;
  url?: string;
  category?: string;
  tags?: string[];
  kind?: "URL" | "FILE";
  fileName?: string;
};

export default function PoliciesPage() {
  const { user } = useAuth();

  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState(""); // comma-separated for UI
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [previewPolicy, setPreviewPolicy] = useState<PolicyItem | null>(null);

  // -------- role detection: who can manage policies? --------
  const roles = useMemo(() => {
    const u: any = user || {};
    const collected: string[] = [];

    if (Array.isArray(u.roles)) {
      collected.push(...u.roles);
    }

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

  const canManagePolicies = useMemo(
    () =>
      roles.some((r) => {
        const v = r.replace(/[\s_-]+/g, "");
        return v === "HR" || v === "ADMIN" || v === "SUPERADMIN";
      }),
    [roles],
  );

  /* -----------------------------------------------------------
     Helpers
  ----------------------------------------------------------- */

  function getAccessToken(): string {
    if (typeof window === "undefined") return "";
    return (
      localStorage.getItem("accessToken") ||
      localStorage.getItem("hrms_access_token") ||
      localStorage.getItem("hrms:accessToken") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("token") ||
      ""
    );
  }

  function resolvePolicyUrl(raw?: string): string {
    if (!raw) return "#";

    // absolute URL
    if (/^https?:\/\//i.test(raw)) return raw;

    let backendBase = API_BASE;
    try {
      const u = new URL(API_BASE);
      backendBase = u.origin + u.pathname.replace(/\/api\/?$/, "");
    } catch {
      backendBase = API_BASE.replace(/\/api\/?$/, "");
    }

    if (raw.startsWith("/")) return `${backendBase}${raw}`;
    return `${backendBase}/${raw}`;
  }

  async function load() {
    setLoading(true);
    try {
      const resp = (await api.get("/hr/policies/list")) as
        | PolicyItem[]
        | { items?: PolicyItem[] };

      const list: PolicyItem[] = Array.isArray(resp)
        ? resp
        : Array.isArray((resp as any).items)
        ? ((resp as any).items as PolicyItem[])
        : [];

      setPolicies(list);
    } catch (e: any) {
      alert(e.message || "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /* -----------------------------------------------------------
     Add / upload policy
  ----------------------------------------------------------- */

  async function handleAdd(e: FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a policy title.");
      return;
    }

    if (!file && !url.trim()) {
      alert("Please attach a PDF or provide a public/internal URL.");
      return;
    }

    setSaving(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedCategory = category.trim() || undefined;
      const tagsArray =
        tags.trim().length > 0
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

      if (file) {
        // Upload PDF → /api/hr/policies/upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", trimmedTitle);
        if (trimmedCategory) formData.append("category", trimmedCategory);
        if (tagsArray.length) formData.append("tags", tagsArray.join(","));

        const token = getAccessToken();

        const res = await fetch(`${API_BASE}/hr/policies/upload`, {
          method: "POST",
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text || `Failed to upload policy PDF (${res.status})`,
          );
        }
      } else {
        // Pure URL policy
        await api.post("/hr/policies", {
          title: trimmedTitle,
          url: url.trim(),
          category: trimmedCategory,
          tags: tagsArray,
        });
      }

      setTitle("");
      setUrl("");
      setCategory("");
      setTags("");
      setFile(null);

      await load();
    } catch (e: any) {
      alert(e.message || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------------------------------------
     Delete policy (HR/Admin only)
  ----------------------------------------------------------- */
  async function handleDelete(id?: string) {
    if (!id) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this policy? This cannot be undone.",
    );
    if (!confirmDelete) return;

    setDeletingId(id);
    try {
      await api.delete(`/hr/policies/${id}`);
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to delete policy");
    } finally {
      setDeletingId(null);
    }
  }

  const visibleCount = policies.length;

  /* -----------------------------------------------------------
     Render
  ----------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="rounded-3xl border border-cyan-500/40 bg-[radial-gradient(circle_at_top_left,#0f172a,transparent_55%),radial-gradient(circle_at_bottom_right,#020617,transparent_55%)] px-6 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.9)] text-slate-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-400/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20">
                📘
              </span>
              <span>PlumTrips HRMS · Policies</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Company policies &amp; handbooks
            </h1>
            <p className="mt-1 text-[12px] text-slate-300 max-w-xl">
              Your single source of truth for HR, IT and compliance documents —
              leave policy, code of conduct, travel policy and more.
            </p>
          </div>

          <div className="text-[11px] text-slate-300 max-w-xs">
            {canManagePolicies ? (
              <>
                <span className="font-semibold text-emerald-300">
                  You have HR/Admin access.
                </span>{" "}
                Add, upload or delete policy documents. Changes reflect
                instantly for all employees.
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-50">
                  Read-only view.
                </span>{" "}
                These documents are maintained by HR. If something looks
                outdated, please reach out to HR.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add new policy – only HR/Admin */}
      {canManagePolicies && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_18px_60px_rgba(15,23,42,0.7)] p-5 space-y-3 text-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-cyan-200">
                Add a new policy (HR / Admin)
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Paste a document link (Google Drive, PDF, Notion, etc.) or
                upload a PDF. Optionally tag it by category and keywords.
              </p>
            </div>
            <span className="hidden md:inline-block text-[10px] text-slate-500">
              Tip: keep titles short and consistent (e.g. &quot;Leave Policy
              2025&quot;).
            </span>
          </div>

          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-2 md:flex-row md:items-center"
          >
            <input
              type="text"
              placeholder="Policy title (e.g. Leave policy 2025)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <input
              type="url"
              placeholder="Public / internal URL (optional if uploading PDF)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <input
              type="text"
              placeholder="Category (e.g. HR, IT, Travel)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-40 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-40 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </form>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="inline-flex h-8 px-3 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-[11px] text-slate-100">
                  {file ? "PDF attached" : "Attach PDF"}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              {file && (
                <span className="text-slate-300">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
              )}
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="self-start md:self-auto rounded-full bg-cyan-400 px-5 py-2 text-[12px] font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save policy"}
            </button>
          </div>
        </div>
      )}

      {/* Policies list – visible to everyone */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_18px_60px_rgba(15,23,42,0.7)] p-5 text-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              All policies &amp; documents
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {visibleCount} document{visibleCount === 1 ? "" : "s"} visible.
            </p>
          </div>
          {loading && (
            <span className="text-[11px] text-slate-500">Loading…</span>
          )}
        </div>

        {policies.length === 0 && !loading && (
          <p className="text-[11px] text-slate-500">
            No policies have been configured yet. If you&apos;re HR/Admin, add
            a few key documents above.
          </p>
        )}

        <ul className="space-y-3 mt-2">
          {policies.map((p) => {
            const id = p._id || p.url || p.title || "";
            const href = resolvePolicyUrl(p.url);
            const isPdf = p.url?.toLowerCase().endsWith(".pdf") ?? false;

            return (
              <li
                key={id}
                className="flex items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-3 hover:border-cyan-500/60 hover:bg-slate-900/90 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200 text-base">
                    📄
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-50 truncate">
                      {p.title || "Untitled policy"}
                    </div>
                    <div className="mt-[2px] text-[10px] text-slate-500 flex flex-wrap gap-2 items-center">
                      {p.category && (
                        <span className="inline-flex rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
                          {p.category}
                        </span>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <span className="inline-flex gap-1 flex-wrap">
                          {p.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-400"
                            >
                              #{t}
                            </span>
                          ))}
                          {p.tags.length > 3 && (
                            <span className="text-slate-500">
                              +{p.tags.length - 3} more
                            </span>
                          )}
                        </span>
                      )}
                      {!p.category && (!p.tags || p.tags.length === 0) && p.url && (
                        <span className="truncate max-w-xs">{p.url}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPolicy(p)}
                    className="rounded-full border border-cyan-400/80 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20"
                  >
                    Open {isPdf ? "PDF" : ""}
                  </button>

                  {canManagePolicies && p._id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(p._id)}
                      disabled={deletingId === p._id}
                      className="rounded-full border border-rose-400/70 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      {deletingId === p._id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Inline viewer modal */}
      {previewPolicy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Policy document
                </p>
                <p className="text-sm font-semibold text-slate-50 truncate">
                  {previewPolicy.title || "Untitled policy"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {previewPolicy.url && (
                  <>
                    <a
                      href={resolvePolicyUrl(previewPolicy.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 hover:border-cyan-400"
                    >
                      Open in new tab ↗
                    </a>
                    <a
                      href={resolvePolicyUrl(previewPolicy.url)}
                      download
                      className="rounded-full border border-cyan-400 bg-cyan-500/10 px-3 py-1.5 text-cyan-100 hover:bg-cyan-500/20"
                    >
                      Download
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPolicy(null)}
                  className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="flex-1 bg-slate-900">
              {previewPolicy.url ? (
                <iframe
                  title={previewPolicy.title || "Policy"}
                  src={resolvePolicyUrl(previewPolicy.url)}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No URL available for this policy.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
