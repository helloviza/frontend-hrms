// apps/frontend/src/pages/vendors/Onboard.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type OnboardingType = "Vendor" | "Business" | "Employee";

type Invite = {
  id: string;
  type: OnboardingType;
  inviteeEmail: string;
  inviteeName?: string;
  status:
    | "Invited"
    | "InProgress"
    | "Submitted"
    | "Approved"
    | "Rejected"
    | "Expired";
  turnaroundHours: number;
  expiresAt: string | null;
  createdAt: string | null;
  token?: string;
};

const TYPES: OnboardingType[] = ["Vendor", "Business", "Employee"];

export default function Onboard() {
  const { user } = useAuth();

  const [type, setType] = useState<OnboardingType>("Vendor");
  const [inviteeEmail, setEmail] = useState("");
  const [inviteeName, setName] = useState("");
  const [turnaroundHours, setTAT] = useState<number>(72);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Invite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const makeLink = (tok?: string) =>
    tok ? `${window.location.origin}/onboarding/${tok}` : "";

  /* -------------------- Load Invites -------------------- */
  async function loadList(filterType?: OnboardingType) {
    setErr(null);
    try {
      const q = filterType ? `?type=${encodeURIComponent(filterType)}` : "";
      const res = await api.get(`/onboarding/invites${q}`);
      setItems(res.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load invites");
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  /* -------------------- Create Invite -------------------- */
  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const res = await api.post("/onboarding/invites", {
        type,
        inviteeEmail,
        inviteeName,
        turnaroundHours,
      });

      const link = res.link || makeLink(res.token);
      setOk(`✅ Invite created successfully. Link: ${link}`);

      setEmail("");
      setName("");
      setTAT(72);

      await loadList(type);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Resend Invite -------------------- */
  async function resendInvite(inviteId: string) {
    setErr(null);
    setOk(null);

    try {
      await api.post(`/onboarding/invites/${inviteId}/resend`);
      setOk("📨 Invite resent successfully.");
      await loadList();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resend invite");
    }
  }

  const pretty = useMemo(
    () =>
      (d?: string | null) =>
        d ? new Date(d).toLocaleString() : "—",
    []
  );

  return (
    <div className="space-y-8">
      {/* -------------------- Create Invite Card -------------------- */}
      <div className="card p-6">
        <h1 className="text-2xl font-extrabold mb-1">
          Send Onboarding Invite
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Choose the onboarding type and send an invite link. The invite expires
          after the set TAT.
        </p>

        <form onSubmit={createInvite} className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm">Type</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`chip ${type === t ? "bg-ink text-white" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Turnaround (hours)</label>
            <input
              type="number"
              min={1}
              value={turnaroundHours}
              onChange={(e) => setTAT(Number(e.target.value))}
              className="input"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Invitee Email</label>
            <input
              type="email"
              value={inviteeEmail}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="name@company.com"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Invitee Name (optional)</label>
            <input
              value={inviteeName}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Display name"
            />
          </div>

          <div className="md:col-span-2 flex gap-3 pt-2">
            <button className="btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create Invite"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => loadList(type)}
            >
              Refresh List
            </button>
          </div>

          {err && (
            <div className="md:col-span-2 text-red-600 text-sm">{err}</div>
          )}
          {ok && (
            <div className="md:col-span-2 text-emerald-700 text-sm break-all">
              {ok}
            </div>
          )}
        </form>
      </div>

      {/* -------------------- Invites Table -------------------- */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Recent Invites</h2>
          <div className="flex gap-2">
            <span className="text-sm text-zinc-500">Filter:</span>
            {TYPES.map((t) => (
              <button key={t} className="chip" onClick={() => loadList(t)}>
                {t}
              </button>
            ))}
            <button className="chip" onClick={() => loadList()}>
              All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Invitee</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Link</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map((r) => {
                const link = makeLink(r.token);

                // ✅ FINAL FIX
                const canResend =
                  r.status === "Invited" ||
                  r.status === "InProgress" ||
                  r.status === "Expired";

                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="py-2 pr-4">{r.type}</td>

                    <td className="py-2 pr-4">
                      <div className="font-medium">
                        {r.inviteeName || r.inviteeEmail}
                      </div>
                      <div className="text-zinc-500">{r.inviteeEmail}</div>
                    </td>

                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">{pretty(r.expiresAt)}</td>
                    <td className="py-2 pr-4">{pretty(r.createdAt)}</td>

                    <td className="py-2 pr-4">
                      {r.token ? (
                        <div className="flex gap-2 items-center">
                          <input
                            className="input w-56 md:w-72 text-xs"
                            readOnly
                            value={link}
                          />
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(link)
                            }
                          >
                            Copy
                          </button>
                          <a
                            className="btn-ghost"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="py-2">
                      {canResend && (
                        <button
                          className="btn-ghost text-xs"
                          type="button"
                          onClick={() => resendInvite(r.id)}
                        >
                          Resend
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    No invites yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
