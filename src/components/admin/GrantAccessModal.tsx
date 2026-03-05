import { useState, useEffect } from "react";
import api from "../../lib/api";

const ROLES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
  { value: "HR", label: "HR" },
  { value: "ADMIN", label: "Admin" },
];

interface Candidate {
  _id: string;
  name: string;
  email: string;
  roles: string[];
  employeeCode?: string;
  tempPassword?: boolean;
  activatedByAdmin?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export default function GrantAccessModal({ open, onClose, onGranted }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filtered, setFiltered] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [role, setRole] = useState("EMPLOYEE");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError("");
    setSelected(null);
    setSearch("");
    setPassword("");
    setRole("EMPLOYEE");
    api
      .get("/admin/onboarded-without-access")
      .then((data: any) => {
        const list = data?.data ?? data ?? [];
        setCandidates(list);
        setFiltered(list);
      })
      .catch(() => setError("Failed to load candidates."))
      .finally(() => setFetching(false));
  }, [open]);

  useEffect(() => {
    if (!search) {
      setFiltered(candidates);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      candidates.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    );
  }, [search, candidates]);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Please select an employee.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/admin/grant-access", {
        userId: selected._id,
        role,
        password,
      });
      setSuccess(`Access granted to ${selected.name}!`);
      setTimeout(() => {
        onGranted();
        onClose();
        setSuccess("");
        setSelected(null);
        setPassword("");
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to grant access.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Grant HRMS Access
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Set login credentials for onboarded employees
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]"
          />
        </div>

        {/* Candidate list */}
        <div className="border border-slate-100 rounded-xl overflow-hidden mb-4 max-h-48 overflow-y-auto">
          {fetching ? (
            <div className="p-4 text-center text-sm text-slate-400">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              No employees pending activation found.
            </div>
          ) : (
            filtered.map((c) => (
              <div
                key={c._id}
                onClick={() => setSelected(c)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors
                  ${
                    selected?._id === c._id
                      ? "bg-[#00477f]/5 border-l-2 border-l-[#00477f]"
                      : "hover:bg-slate-50"
                  }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.email}</p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    c.activatedByAdmin
                      ? "bg-green-50 text-green-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {c.activatedByAdmin ? "Active" : "Pending Activation"}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Grant form — shown when candidate selected */}
        {selected && (
          <form
            onSubmit={handleGrant}
            className="space-y-3 border-t border-slate-100 pt-4"
          >
            <div className="bg-[#00477f]/5 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#00477f] text-white text-sm font-semibold flex items-center justify-center">
                {selected.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {selected.name}
                </p>
                <p className="text-xs text-slate-400">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            {success && (
              <p className="text-green-600 text-xs font-medium">{success}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#00477f] hover:bg-[#003d6e] disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {loading ? "Granting..." : "Grant Access"}
              </button>
            </div>
          </form>
        )}

        {/* Show error outside form when no candidate selected */}
        {!selected && error && (
          <p className="text-red-500 text-xs mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
