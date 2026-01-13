import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";

// ✅ explicit extensions
import ApprovalsCreate from "./ApprovalsCreate";
import ApprovalsMy from "./ApprovalsMy";
import ApprovalsInbox from "./ApprovalsInbox";
import ApprovalsAdminQueue from "./ApprovalsAdminQueue";

function normRoles(u: any) {
  const r: string[] = [];
  if (Array.isArray(u?.roles)) r.push(...u.roles);
  if (u?.role) r.push(u.role);
  if (u?.accountType) r.push(u.accountType);
  if (u?.hrmsAccessRole) r.push(u.hrmsAccessRole);
  if (u?.hrmsAccessLevel) r.push(u.hrmsAccessLevel);
  return r.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
}

function isAdmin(u: any) {
  const r = normRoles(u);
  return (
    r.includes("ADMIN") ||
    r.includes("SUPERADMIN") ||
    r.includes("SUPER_ADMIN") ||
    r.includes("HR_ADMIN")
  );
}

export default function ApprovalsHub() {
  const { user } = useAuth();
  const roles = useMemo(() => normRoles(user), [user]);
  const admin = useMemo(() => isAdmin(user), [user]);

  const tabs = useMemo(() => {
    const base = [
      { key: "create", label: "Create Request" },
      { key: "mine", label: "My Requests" },
      { key: "inbox", label: "Approver Inbox" },
    ];
    if (admin) base.push({ key: "admin", label: "Admin Queue" });
    return base;
  }, [admin]);

  const [tab, setTab] = useState<string>("create");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <div className="text-sm text-ink/60 mt-1">
            Create / Approve / Admin manage approvals.
          </div>
        </div>

        <div className="text-xs text-ink/60">
          Signed in as <b>{user?.email}</b> · Roles:{" "}
          <b>{roles.join(", ") || "-"}</b>
        </div>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-3 py-2 rounded-xl text-sm border " +
              (tab === t.key
                ? "bg-brand text-white border-brand"
                : "bg-white/70 border-black/10 hover:bg-white")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "create" && <ApprovalsCreate />}
        {tab === "mine" && <ApprovalsMy />}
        {tab === "inbox" && <ApprovalsInbox />}
        {tab === "admin" && admin && <ApprovalsAdminQueue />}
      </div>
    </div>
  );
}
