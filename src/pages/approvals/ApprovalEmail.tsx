import { useEffect, useMemo, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

function normAction(a: string) {
  const s = (a || "").trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "declined") return "declined";
  if (s === "on_hold" || s === "on-hold" || s === "hold") return "on_hold";
  return "";
}

function labelFor(a: string) {
  if (a === "approved") return "Approved";
  if (a === "declined") return "Rejected";
  if (a === "on_hold") return "Put On Hold";
  return "Processed";
}

function sublineFor(a: string) {
  if (a === "approved") return "This request has been approved and forwarded to Admin for processing.";
  if (a === "declined") return "This request has been rejected. The requester will be notified in the workflow.";
  if (a === "on_hold") return "This request is on hold. The requester can edit and resubmit if needed.";
  return "Your decision has been recorded.";
}

export default function ApprovalEmail() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("t") || params.get("token") || "";
  const actionRaw = params.get("a") || params.get("action") || "";
  const action = normAction(actionRaw);

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    // Basic validations
    if (!token) {
      setStatus("error");
      setMessage("Missing token in the link.");
      return;
    }
    if (!action) {
      setStatus("error");
      setMessage("Invalid action in the link.");
      return;
    }

    // Prevent multiple submits from refresh / browser prefetch
    const onceKey = `approval-email:${action}:${token.slice(0, 24)}`;
    if (sessionStorage.getItem(onceKey) === "1") {
      setStatus("success");
      setMessage("Already processed. You can close this tab.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setStatus("loading");
        setMessage("");

        const resp = await fetch("/api/approvals/email/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action }),
        });

        const data = await resp.json().catch(() => ({} as any));

        if (cancelled) return;

        if (!resp.ok) {
          setStatus("error");
          setMessage(data?.error || "Failed to process this link.");
          return;
        }

        sessionStorage.setItem(onceKey, "1");
        setStatus("success");
        setMessage(data?.message || "Decision recorded successfully.");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setMessage(e?.message || "Network error.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, action]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.brandDot} />
          <div style={styles.brandTitle}>PlumTrips HRMS</div>
        </div>

        <div style={styles.h1}>
          {status === "loading"
            ? "Recording your decision…"
            : status === "success"
              ? labelFor(action)
              : "Unable to process"}
        </div>

        <div style={styles.p}>
          {status === "loading"
            ? "Please keep this tab open for a moment."
            : status === "success"
              ? sublineFor(action)
              : message || "Something went wrong."}
        </div>

        {status === "success" && (
          <div style={styles.successBox}>
            <div style={styles.successMsg}>{message}</div>
            <div style={styles.small}>You can now close this tab.</div>
          </div>
        )}

        {status === "error" && (
          <div style={styles.errorBox}>
            <div style={styles.errorMsg}>{message}</div>
            <div style={styles.small}>
              If you think this is incorrect, ask Admin to resend the approval email.
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <span style={styles.muted}>
            Security note: Do not forward this email link.
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "linear-gradient(180deg, #f5f7fb 0%, #ffffff 100%)",
  },
  card: {
    width: "min(560px, 100%)",
    background: "#fff",
    border: "1px solid #e8eef6",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    padding: 18,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#d06549",
  },
  brandTitle: {
    fontWeight: 900,
    color: "#00477f",
    letterSpacing: ".02em",
  },
  h1: { fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 10 },
  p: { marginTop: 8, color: "#475569", lineHeight: 1.55, fontSize: 14 },
  successBox: {
    marginTop: 14,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    borderRadius: 14,
    padding: 12,
  },
  successMsg: { color: "#0f172a", fontWeight: 800, marginBottom: 6 },
  errorBox: {
    marginTop: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    borderRadius: 14,
    padding: 12,
  },
  errorMsg: { color: "#7f1d1d", fontWeight: 800, marginBottom: 6 },
  small: { fontSize: 12, color: "#64748b", lineHeight: 1.45 },
  footer: { marginTop: 14, fontSize: 12, color: "#94a3b8" },
  muted: { color: "#94a3b8" },
};
