// apps/frontend/src/pages/admin/vouchers/AdminVouchers.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  adminGetAllVouchers,
  getVoucherById,
  adminPatchVoucher,
  getVoucherOpenUrl,
  getVoucherOpenRenderedUrl,
  adminRenderVoucher,
  type VoucherExtractionRow,
} from "../../../lib/vouchersApi";

type Row = VoucherExtractionRow;
type Tab = "ALL" | "SUCCESS" | "FAILED" | "PROCESSING";

function safe(v: any) {
  return v == null ? "" : String(v);
}

function fmtDate(v: any) {
  try {
    return v ? new Date(v).toLocaleString() : "-";
  } catch {
    return "-";
  }
}

function formatBytes(n?: number) {
  const x = Number(n || 0);
  if (!x) return "-";
  const kb = x / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function statusTone(status?: string) {
  const s = safe(status).toUpperCase();
  if (s === "SUCCESS") return { label: "Success", chip: "chip chip-success" };
  if (s === "FAILED") return { label: "Failed", chip: "chip chip-danger" };
  if (s === "PROCESSING") return { label: "Processing", chip: "chip chip-warn" };
  return { label: s || "Unknown", chip: "chip chip-muted" };
}

function docTone(docType?: string) {
  const d = safe(docType).toLowerCase();
  if (d === "hotel") return "chip chip-dark";
  if (d === "flight") return "chip chip-blue";
  return "chip chip-muted";
}

function normalizeErrMessage(e: any): string {
  const apiMsg =
    e?.response?.data?.message ||
    e?.data?.message ||
    e?.response?.message ||
    e?.message;
  return typeof apiMsg === "string" && apiMsg.trim()
    ? apiMsg
    : "Something went wrong";
}

// Optional: if backend stores richer details in errorDetails, surface a small hint
function getRenderHint(row: any): string | null {
  const d = row?.errorDetails;
  if (!d) return null;
  const stage = safe(d?.stage).toUpperCase();
  if (!stage.includes("RENDER")) return null;
  const msg = safe(d?.message);
  if (!msg) return "Render failed (see errorDetails)";
  return msg;
}

export default function AdminVouchers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");

  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);

  const [editJsonText, setEditJsonText] = useState("");
  const [originalJsonText, setOriginalJsonText] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Auto-refresh while any record is PROCESSING
  const pollRef = useRef<number | null>(null);

  // Prevent list polling from overwriting admin edits
  const isEditingRef = useRef(false);

  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  async function loadList(opts?: { keepSelection?: boolean }) {
    setLoading(true);
    setError(null);

    try {
      const data = await adminGetAllVouchers();
      const list = Array.isArray(data) ? (data as Row[]) : [];

      // Sort newest first
      list.sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });

      setRows(list);

      // Polling management
      const hasProcessing = list.some(
        (r) => safe(r.status).toUpperCase() === "PROCESSING"
      );
      if (hasProcessing && !pollRef.current) {
        pollRef.current = window.setInterval(() => {
          loadList({ keepSelection: true });
        }, 2500);
      }
      if (!hasProcessing) stopPolling();

      // keep selection in sync if requested (but do NOT clobber edits)
      if (opts?.keepSelection && selectedId) {
        const found = list.find((r) => String(r._id) === String(selectedId));
        if (found && selected) {
          if (!isEditingRef.current) {
            setSelected((prev) => ({ ...(prev || ({} as any)), ...found }));
          } else {
            // only update lightweight fields while editing
            setSelected((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: found.status ?? prev.status,
                error: found.error ?? prev.error,
                renderedS3: found.renderedS3 ?? prev.renderedS3,
                renderedAt: (found as any).renderedAt ?? (prev as any).renderedAt,
                renderedVersion:
                  (found as any).renderedVersion ?? (prev as any).renderedVersion,
                updatedAt: found.updatedAt ?? prev.updatedAt,
                errorDetails: (found as any).errorDetails ?? (prev as any).errorDetails,
              } as any;
            });
          }
        }
      }
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Failed to load voucher extractions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function openRecord(id: string) {
    setSelectedId(id);
    setSelected(null);
    setEditJsonText("");
    setOriginalJsonText("");
    setError(null);

    try {
      const data = await getVoucherById(id);
      setSelected(data);

      const next = JSON.stringify((data as any)?.extractedJson || {}, null, 2);
      setEditJsonText(next);
      setOriginalJsonText(next);

      isEditingRef.current = false;
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Failed to open record");
    }
  }

  async function openSignedSource(id: string) {
    setOpening(true);
    setError(null);
    try {
      const resp = await getVoucherOpenUrl(id);
      if (!resp?.url) throw new Error("Signed URL not available");
      window.open(resp.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Unable to open source file");
    } finally {
      setOpening(false);
    }
  }

  async function openSignedRendered(id: string) {
    setOpening(true);
    setError(null);
    try {
      const resp = await getVoucherOpenRenderedUrl(id);
      if (!resp?.url) throw new Error("Rendered signed URL not available");
      window.open(resp.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Unable to open rendered PDF");
    } finally {
      setOpening(false);
    }
  }

  async function saveCorrection() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(editJsonText || "{}");
      } catch {
        throw new Error("Invalid JSON. Please correct it before saving.");
      }

      const updated = await adminPatchVoucher(selectedId, { extractedJson: parsed });
      setSelected(updated);

      const next = JSON.stringify((updated as any)?.extractedJson || {}, null, 2);
      setEditJsonText(next);
      setOriginalJsonText(next);

      isEditingRef.current = false;

      loadList({ keepSelection: true });
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function renderNow() {
    if (!selectedId) return;
    setRendering(true);
    setError(null);

    try {
      await adminRenderVoucher(selectedId);

      // Pull latest full record (so the right pane reflects the final row)
      const fresh = await getVoucherById(selectedId);
      setSelected(fresh);

      // Refresh list too
      loadList({ keepSelection: true });
    } catch (e: any) {
      setError(normalizeErrMessage(e) || "Render failed");
    } finally {
      setRendering(false);
    }
  }

  useEffect(() => {
    loadList();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const success = rows.filter((r) => safe(r.status).toUpperCase() === "SUCCESS").length;
    const failed = rows.filter((r) => safe(r.status).toUpperCase() === "FAILED").length;
    const processing = rows.filter((r) => safe(r.status).toUpperCase() === "PROCESSING").length;
    return { total, success, failed, processing };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows.filter((r: any) => {
      const s = safe(r.status).toUpperCase();
      if (tab !== "ALL" && s !== tab) return false;
      if (!query) return true;

      const hay = [
        safe(r._id),
        safe(r.docType),
        safe(r.status),
        safe(r.createdBy),
        safe(r.customerId),
        safe(r.file?.originalName),
        safe(r.file?.mime),
        safe(r.renderedS3?.key),
        safe(r.renderedVersion),
        safe(getRenderHint(r)),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q, tab]);

  const selectedStatus = statusTone(selected?.status);
  const canAct = Boolean(selected && selectedId);

  const jsonLooksValid = useMemo(() => {
    try {
      JSON.parse(editJsonText || "{}");
      return true;
    } catch {
      return false;
    }
  }, [editJsonText]);

  const isDirty = useMemo(
    () => (editJsonText || "") !== (originalJsonText || ""),
    [editJsonText, originalJsonText],
  );

  const renderedAvailable = Boolean((selected as any)?.renderedS3?.key);

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 1440 }}>
      <style>{`
        .vx-page { font-family: inherit; }
        .vx-top {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:16px; flex-wrap:wrap; margin-bottom:14px;
        }
        .vx-title { display:flex; gap:12px; align-items:center; }
        .vx-icon {
          width:44px; height:44px; border-radius:14px;
          border:1px solid rgba(15,23,42,.12);
          background: linear-gradient(180deg, rgba(15,23,42,.04), rgba(15,23,42,.02));
          display:flex; align-items:center; justify-content:center;
        }
        .vx-sub { color: rgba(15,23,42,.6); font-size: 13px; }
        .vx-kpi {
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:12px;
          margin-bottom:14px;
        }
        @media (max-width: 1100px) { .vx-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .vx-kpi { grid-template-columns: 1fr; } }

        .vx-card {
          border:1px solid rgba(15,23,42,.10);
          border-radius:18px;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 6px 20px rgba(15,23,42,.06);
        }
        .vx-card-body { padding: 14px; }
        .vx-k { color: rgba(15,23,42,.6); font-size: 12px; }
        .vx-v { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; }

        .vx-main {
          display:grid;
          grid-template-columns: 420px minmax(0, 1fr);
          gap:12px;
        }
        @media (max-width: 1100px) { .vx-main { grid-template-columns: 1fr; } }

        .vx-toolbar {
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; flex-wrap:wrap;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(15,23,42,.08);
        }
        .vx-tabs { display:flex; gap:8px; flex-wrap:wrap; }
        .vx-tab {
          border:1px solid rgba(15,23,42,.12);
          padding: 6px 10px;
          border-radius: 999px;
          background:#fff;
          font-size: 13px;
          cursor:pointer;
        }
        .vx-tab.active {
          background: rgba(15,23,42,.92);
          color:#fff;
          border-color: rgba(15,23,42,.92);
        }
        .vx-search {
          width: 320px;
          max-width: 100%;
          border:1px solid rgba(15,23,42,.12);
          border-radius: 14px;
          padding: 10px 12px;
          outline: none;
        }

        .vx-list { max-height: 680px; overflow:auto; padding: 12px; }
        .vx-item {
          width:100%;
          text-align:left;
          border: 1px solid rgba(15,23,42,.10);
          background:#fff;
          border-radius: 16px;
          padding: 12px;
          cursor:pointer;
          transition: transform .06s ease, border-color .12s ease, background .12s ease;
        }
        .vx-item:hover { transform: translateY(-1px); border-color: rgba(59,130,246,.30); }
        .vx-item.active { background: rgba(59,130,246,.05); border-color: rgba(59,130,246,.45); }
        .vx-item + .vx-item { margin-top: 10px; }

        .vx-item-top { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
        .vx-fn { font-weight: 700; letter-spacing: -.01em; }
        .vx-meta { color: rgba(15,23,42,.62); font-size: 12px; margin-top: 4px; }

        .chip {
          display:inline-flex; align-items:center; gap:6px;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          border:1px solid rgba(15,23,42,.12);
          white-space: nowrap;
        }
        .chip-success { background: rgba(16,185,129,.10); border-color: rgba(16,185,129,.22); color: rgba(4,120,87,1); }
        .chip-danger { background: rgba(239,68,68,.10); border-color: rgba(239,68,68,.22); color: rgba(153,27,27,1); }
        .chip-warn { background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.26); color: rgba(146,64,14,1); }
        .chip-blue { background: rgba(59,130,246,.10); border-color: rgba(59,130,246,.22); color: rgba(29,78,216,1); }
        .chip-dark { background: rgba(15,23,42,.08); border-color: rgba(15,23,42,.14); color: rgba(15,23,42,.92); }
        .chip-muted { background: rgba(100,116,139,.10); border-color: rgba(100,116,139,.18); color: rgba(71,85,105,1); }

        .vx-detail-head {
          display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
          padding: 14px;
          border-bottom: 1px solid rgba(15,23,42,.08);
        }
        .vx-detail-title { font-weight: 800; letter-spacing: -.02em; }
        .vx-detail-sub { color: rgba(15,23,42,.6); font-size: 12px; margin-top: 3px; }

        .vx-actions {
          display:flex; gap:8px; flex-wrap:wrap; align-items:center;
        }
        .vx-btn {
          border: 1px solid rgba(15,23,42,.14);
          background:#fff;
          border-radius: 12px;
          padding: 8px 10px;
          font-size: 13px;
          cursor:pointer;
        }
        .vx-btn.primary {
          background: rgba(15,23,42,.92);
          color:#fff;
          border-color: rgba(15,23,42,.92);
        }
        .vx-btn:disabled { opacity: .6; cursor: not-allowed; }

        .vx-detail-body { padding: 14px; }
        .vx-grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        @media (max-width: 640px) { .vx-grid2 { grid-template-columns: 1fr; } }

        .vx-panel {
          border: 1px solid rgba(15,23,42,.10);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,.96);
        }
        .vx-panel .k { color: rgba(15,23,42,.6); font-size: 12px; }
        .vx-panel .v { font-weight: 700; margin-top: 2px; }
        .vx-json {
          margin-top: 12px;
          border: 1px solid rgba(15,23,42,.12);
          border-radius: 16px;
          background: rgba(15,23,42,.03);
          padding: 10px;
        }
        .vx-textarea {
          width:100%;
          min-height: 560px;
          border: none;
          outline: none;
          resize: vertical;
          background: transparent;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12.5px;
          line-height: 1.45;
        }
        .vx-hint { color: rgba(15,23,42,.6); font-size: 12px; margin-top: 8px; }

        .vx-error {
          border-radius: 14px;
          border: 1px solid rgba(239,68,68,.20);
          background: rgba(239,68,68,.06);
          padding: 12px 14px;
          margin-bottom: 12px;
        }
      `}</style>

      <div className="vx-page">
        <div className="vx-top">
          <div className="vx-title">
            <div className="vx-icon">🧾</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>
                Admin Vouchers
              </div>
              <div className="vx-sub">
                Audit extraction quality • Open source/rendered • Correct normalized JSON • Re-render
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="chip chip-muted">🔄 Auto-refresh on Processing</span>
            <button className="vx-btn" onClick={() => loadList()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="vx-error">
            <div style={{ fontWeight: 800 }}>Error</div>
            <div style={{ color: "rgba(15,23,42,.75)", wordBreak: "break-word" }}>
              {error}
            </div>
          </div>
        )}

        <div className="vx-kpi">
          <div className="vx-card">
            <div className="vx-card-body">
              <div className="vx-k">Total</div>
              <div className="vx-v">{stats.total}</div>
            </div>
          </div>
          <div className="vx-card">
            <div className="vx-card-body">
              <div className="vx-k">Success</div>
              <div className="vx-v">{stats.success}</div>
            </div>
          </div>
          <div className="vx-card">
            <div className="vx-card-body">
              <div className="vx-k">Failed</div>
              <div className="vx-v">{stats.failed}</div>
            </div>
          </div>
          <div className="vx-card">
            <div className="vx-card-body">
              <div className="vx-k">Processing</div>
              <div className="vx-v">{stats.processing}</div>
            </div>
          </div>
        </div>

        <div className="vx-main">
          {/* Left */}
          <div className="vx-card">
            <div className="vx-toolbar">
              <div>
                <div style={{ fontWeight: 900 }}>Extractions</div>
                <div className="vx-sub">
                  Showing <span style={{ fontWeight: 800 }}>{filtered.length}</span>
                </div>
              </div>

              <div className="vx-tabs">
                {(["ALL", "SUCCESS", "FAILED", "PROCESSING"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    className={`vx-tab ${tab === t ? "active" : ""}`}
                    onClick={() => setTab(t)}
                  >
                    {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              <input
                className="vx-search"
                placeholder="Search by file, user, customer, id…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="vx-list">
              {loading ? (
                <div className="vx-sub" style={{ padding: 10 }}>
                  Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="vx-sub" style={{ padding: 10 }}>
                  No records found.
                </div>
              ) : (
                filtered.map((r: any) => {
                  const id = String(r._id || "");
                  const active = selectedId === id;
                  const st = statusTone(r.status);
                  const hasRendered = Boolean(r?.renderedS3?.key);
                  const renderHint = getRenderHint(r);

                  return (
                    <button
                      key={id}
                      className={`vx-item ${active ? "active" : ""}`}
                      onClick={() => openRecord(id)}
                    >
                      <div className="vx-item-top">
                        <div className="vx-fn">
                          {safe(r.file?.originalName) || "Untitled Voucher"}
                        </div>
                        <span className={st.chip}>{st.label}</span>
                      </div>

                      <div className="vx-meta">
                        <span className={docTone(r.docType)} style={{ marginRight: 8 }}>
                          {safe(r.docType) || "—"}
                        </span>

                        <span
                          className={`chip ${hasRendered ? "chip-success" : "chip-muted"}`}
                          style={{ marginRight: 8 }}
                        >
                          {hasRendered ? "Rendered" : "Not Rendered"}
                        </span>

                        {fmtDate(r.createdAt)}
                      </div>

                      <div className="vx-meta" style={{ marginTop: 6 }}>
                        User: {safe(r.createdBy)} • Customer: {safe(r.customerId || "default")}
                      </div>

                      <div className="vx-meta" style={{ marginTop: 6 }}>
                        {safe(r.file?.mime) || "-"} • {formatBytes(r.file?.size)}
                      </div>

                      {renderHint ? (
                        <div
                          className="vx-meta"
                          style={{ marginTop: 6, color: "rgba(153,27,27,1)" }}
                        >
                          Render: {renderHint}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right */}
          <div className="vx-card">
            {!selected ? (
              <div className="vx-detail-body">
                <div style={{ fontWeight: 900, fontSize: 16 }}>Select an extraction</div>
                <div className="vx-sub" style={{ marginTop: 6 }}>
                  Pick a record from the left to open source/rendered PDFs and review the normalized JSON.
                </div>
              </div>
            ) : (
              <>
                <div className="vx-detail-head">
                  <div>
                    <div className="vx-detail-title">
                      {safe(selected?.file?.originalName) || "Voucher"}
                    </div>
                    <div className="vx-detail-sub">
                      ID: <span style={{ fontWeight: 800 }}>{safe(selected._id)}</span>
                    </div>
                  </div>

                  <div className="vx-actions">
                    <span className={selectedStatus.chip}>{selectedStatus.label}</span>
                    <span className={docTone(selected?.docType)}>{safe(selected?.docType) || "—"}</span>

                    <span className={`chip ${renderedAvailable ? "chip-success" : "chip-muted"}`}>
                      {renderedAvailable ? "Rendered" : "Not Rendered"}
                    </span>

                    <button
                      className="vx-btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(selected._id));
                        } catch {}
                      }}
                    >
                      Copy ID
                    </button>

                    <button
                      className="vx-btn"
                      onClick={() => openSignedSource(String(selected._id))}
                      disabled={opening}
                    >
                      {opening ? "Opening…" : "Open Source"}
                    </button>

                    <button
                      className="vx-btn"
                      onClick={() => openSignedRendered(String(selected._id))}
                      disabled={opening || !renderedAvailable}
                      title={!renderedAvailable ? "Rendered PDF not available yet" : "Open rendered PDF"}
                    >
                      {opening ? "Opening…" : "Open Rendered"}
                    </button>

                    <button
                      className="vx-btn"
                      onClick={renderNow}
                      disabled={!canAct || rendering}
                      title="Regenerate PDF from current extractedJson"
                    >
                      {rendering ? "Rendering…" : "Re-render"}
                    </button>

                    <button
                      className="vx-btn primary"
                      onClick={saveCorrection}
                      disabled={!canAct || saving || !jsonLooksValid || !isDirty}
                      title={
                        !jsonLooksValid
                          ? "Fix JSON before saving"
                          : !isDirty
                          ? "No changes to save"
                          : "Save corrected extractedJson"
                      }
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                <div className="vx-detail-body">
                  <div className="vx-grid2">
                    <div className="vx-panel">
                      <div className="k">File</div>
                      <div className="v">{safe(selected?.file?.originalName) || "-"}</div>
                      <div className="vx-sub" style={{ marginTop: 4 }}>
                        {safe(selected?.file?.mime) || "-"} • {formatBytes(selected?.file?.size)}
                      </div>
                      <div className="vx-sub" style={{ marginTop: 6 }}>
                        Created: {fmtDate(selected?.createdAt)} • Updated: {fmtDate(selected?.updatedAt)}
                      </div>
                    </div>

                    <div className="vx-panel">
                      <div className="k">Render</div>
                      <div className="v">{renderedAvailable ? "Available" : "Not available"}</div>
                      <div className="vx-sub" style={{ marginTop: 4 }}>
                        Rendered At: {fmtDate((selected as any)?.renderedAt)}
                      </div>
                      <div className="vx-sub" style={{ marginTop: 4 }}>
                        Version: {safe((selected as any)?.renderedVersion) || "-"}
                      </div>

                      {getRenderHint(selected as any) ? (
                        <div
                          className="vx-sub"
                          style={{
                            marginTop: 8,
                            color: "rgba(153,27,27,1)",
                            wordBreak: "break-word",
                          }}
                        >
                          Render error: {getRenderHint(selected as any)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selected?.error ? (
                    <div
                      className="vx-panel"
                      style={{
                        marginTop: 12,
                        borderColor: "rgba(245,158,11,.35)",
                        background: "rgba(245,158,11,.06)",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>Extraction Error</div>
                      <div className="vx-sub" style={{ marginTop: 6, wordBreak: "break-word" }}>
                        {safe(selected.error)}
                      </div>
                    </div>
                  ) : null}

                  <div className="vx-json">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>Normalized Voucher JSON</div>
                        <div className="vx-sub">Edit extractedJson only. Must stay valid JSON.</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className={`chip ${jsonLooksValid ? "chip-success" : "chip-danger"}`}>
                          {jsonLooksValid ? "Valid JSON" : "Invalid JSON"}
                        </span>

                        <span className={`chip ${isDirty ? "chip-warn" : "chip-muted"}`}>
                          {isDirty ? "Unsaved changes" : "Saved"}
                        </span>

                        <button
                          className="vx-btn"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(editJsonText || "{}");
                              const next = JSON.stringify(parsed ?? {}, null, 2);
                              setEditJsonText(next);
                              isEditingRef.current = true;
                            } catch {}
                          }}
                          disabled={!jsonLooksValid}
                          title="Prettify JSON"
                        >
                          Format
                        </button>

                        <button
                          className="vx-btn"
                          onClick={() => {
                            setEditJsonText(originalJsonText || "{}");
                            isEditingRef.current = false;
                          }}
                          disabled={!isDirty}
                          title="Discard unsaved changes"
                        >
                          Reset
                        </button>

                        <button
                          className="vx-btn"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(editJsonText || "");
                            } catch {}
                          }}
                        >
                          Copy JSON
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="vx-textarea"
                      value={editJsonText}
                      onChange={(e) => {
                        setEditJsonText(e.target.value);
                        isEditingRef.current = true;
                      }}
                    />
                  </div>

                  <div className="vx-hint">
                    Source + rendered PDFs are private in S3. Buttons use short-lived signed URLs (RBAC protected). Auto-refresh
                    runs while any extraction is Processing — but it will not overwrite your JSON edits.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}