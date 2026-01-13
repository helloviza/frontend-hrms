import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type OnboardingType = "Vendor" | "Business" | "Employee";
type OnboardingStatus =
  | "Invited"
  | "InProgress"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Expired";

type Card = {
  id: string;
  type: OnboardingType;
  inviteeEmail: string;
  inviteeName: string;
  expiresAt: string | null;
  turnaroundHours: number;
  updatedAt: string | null;
  token?: string;
  link?: string;
};

type Buckets = Record<OnboardingStatus, Card[]>;

const TYPES: OnboardingType[] = ["Vendor", "Business", "Employee"];
const STATUSES: OnboardingStatus[] = [
  "Invited",
  "InProgress",
  "Submitted",
  "Approved",
  "Rejected",
  "Expired",
];

const STATUS_COLORS: Record<OnboardingStatus, string> = {
  Invited: "bg-[#00477f]/10 text-[#00477f]",
  InProgress: "bg-amber-100 text-amber-700",
  Submitted: "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-gray-200 text-gray-600",
};

export default function Pipeline() {
  const { token } = useAuth() as any;
  const [type, setType] = useState<OnboardingType | "All">("All");
  const [buckets, setBuckets] = useState<Buckets>({
    Invited: [],
    InProgress: [],
    Submitted: [],
    Approved: [],
    Rejected: [],
    Expired: [],
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const prettyDateTime = useMemo(
    () => (d?: string | null) =>
      d
        ? new Date(d).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "—",
    []
  );

  const timeLeft = (expiresAt: string | null) => {
    if (!expiresAt) return "—";
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours <= 0) return "Expired";
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return `${days}d ${rem}h`;
  };

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const q = type === "All" ? "" : `?type=${encodeURIComponent(type)}`;
      const res = await api.get(`/onboarding/pipeline${q}`);
      setBuckets(res.buckets);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(tok: string) {
    try {
      const res = await api.get(`/onboarding/${tok}/details`);
      setSelected(res);
    } catch (e: any) {
      alert(e?.message || "Failed to load details");
    }
  }

  async function decide(action: "approved" | "rejected" | "hold") {
    if (!selected?.token) return;
    setActionLoading(true);
    try {
      await api.post(`/onboarding/${selected.token}/decision`, { action });
      alert(`Marked as ${action.toUpperCase()}`);
      setSelected(null);
      load();
    } catch (e: any) {
      alert(e?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-[#00477f]">
          Onboarding Pipeline
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            className={`chip ${type === "All" ? "bg-[#00477f] text-white" : ""}`}
            onClick={() => setType("All")}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              className={`chip ${type === t ? "bg-[#00477f] text-white" : ""}`}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
          <button
            className="btn-ghost border border-[#00477f]/30 text-[#00477f] hover:bg-[#00477f]/10 px-3 py-1 rounded-md text-sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {/* Columns */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {STATUSES.map((s) => (
            <div
              key={s}
              className="flex flex-col min-w-[340px] bg-[#f8fafc] border border-[#00477f]/10 rounded-2xl p-3 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3 border-b pb-1 border-[#00477f]/10">
                <h2 className="font-semibold text-[#00477f] text-sm">{s}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s]}`}
                >
                  {buckets[s]?.length ?? 0}
                </span>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
                {(buckets[s] ?? []).map((c) => {
                  const expired =
                    c.expiresAt && Date.now() > new Date(c.expiresAt).getTime();
                  return (
                    <div
                      key={c.id}
                      className={`bg-white rounded-lg border border-[#00477f]/10 p-2 hover:shadow transition flex flex-col text-[12px] ${
                        expired ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 truncate max-w-[160px]">
                          {c.inviteeName || c.inviteeEmail}
                        </div>
                        <span className="text-[10px] bg-[#00477f]/10 text-[#00477f] px-2 py-0.5 rounded-full capitalize">
                          {c.type.toLowerCase()}
                        </span>
                      </div>

                      <div className="text-gray-500 truncate">
                        {c.inviteeEmail}
                      </div>

                      <div className="flex justify-between items-center mt-1 text-[11px] text-gray-600">
                        <span
                          className={
                            expired ? "text-red-600 font-semibold" : "text-gray-700"
                          }
                        >
                          Expires: {prettyDateTime(c.expiresAt)}
                        </span>
                        <span
                          className={`ml-2 ${
                            expired ? "text-red-600" : "text-gray-500"
                          } whitespace-nowrap`}
                        >
                          {timeLeft(c.expiresAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(
                              `${window.location.origin}/onboarding/${c.token}`
                            )
                          }
                          className="text-[11px] bg-[#00477f] text-white px-2 py-0.5 rounded hover:bg-[#00345f]"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => loadDetails(c.token!)}
                          className="text-[11px] border border-[#00477f]/30 text-[#00477f] px-2 py-0.5 rounded hover:bg-[#00477f]/10"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(!buckets[s] || buckets[s].length === 0) && (
                  <div className="text-xs text-gray-400 text-center py-4">
                    No items
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* -------- Details Drawer -------- */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50">
          <div className="bg-white w-full max-w-xl h-full shadow-xl p-6 overflow-y-auto rounded-l-2xl">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-lg font-bold text-[#00477f]">
                Onboarding Details
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div><span className="font-semibold">Name:</span> {selected.name}</div>
              <div><span className="font-semibold">Email:</span> {selected.email}</div>
              <div><span className="font-semibold">Type:</span> {selected.type}</div>
              <div>
                <span className="font-semibold">Status:</span>{" "}
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[
                    (selected.status || "Invited") as OnboardingStatus
                  ]}`}
                >
                  {selected.status}
                </span>
              </div>

              {selected.documents?.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold mb-1">Documents:</div>
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

              {/* ---------- Form Data ---------- */}
              {selected.payload && (
                <div className="mt-4">
                  <div className="font-semibold mb-1">Form Data:</div>
                  <div className="form-section bg-gray-50 border p-3 rounded-md text-sm">
                    {renderFormData(selected.payload)}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-6 border-t pt-3">
              <button
                disabled={actionLoading}
                onClick={() => decide("approved")}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded py-1 text-sm"
              >
                Approve
              </button>
              <button
                disabled={actionLoading}
                onClick={() => decide("rejected")}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded py-1 text-sm"
              >
                Reject
              </button>
              <button
                disabled={actionLoading}
                onClick={() => decide("hold")}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded py-1 text-sm"
              >
                Hold
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Helpers ---------- */
function renderFormData(data: any): JSX.Element {
  if (!data || typeof data !== "object")
    return <p className="text-muted italic text-xs">No form data available.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.entries(data).map(([key, val]) => (
        <div
          key={key}
          className="p-3 bg-white rounded border border-gray-200 shadow-sm"
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
            <div className="text-gray-900 text-sm break-words">
              {String(val ?? "—")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
