// apps/frontend/src/pages/customer/vouchers/VoucherExtract.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  extractVoucher,
  getMyVouchers,
  getVoucherOpenUrl,
  getVoucherOpenRenderedUrl,
  type VoucherType,
} from "../../../lib/vouchersApi";

type Row = any;
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

function tryExtractHelpfulError(e: any): string {
  const msg = e?.message || e?.response?.data?.message || "Extraction failed";
  const dbg = e?.debug || e?.response?.data?.debug || null;
  const correlationId = e?.correlationId || e?.response?.data?.correlationId || null;

  const parts: string[] = [msg];

  if (dbg?.stage) parts.push(`Stage: ${dbg.stage}`);
  if (Array.isArray(dbg?.missing) && dbg.missing.length) {
    parts.push(`Missing: ${dbg.missing.join(", ")}`);
  }
  if (correlationId) parts.push(`Correlation: ${correlationId}`);

  return parts.join(" • ");
}

export default function VoucherExtract() {
  // upload form
  const [voucherType, setVoucherType] = useState<VoucherType>("hotel");
  const [file, setFile] = useState<File | null>(null);
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [portalHint, setPortalHint] = useState("");

  // data + UX
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openingRendered, setOpeningRendered] = useState(false);

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh while any record is PROCESSING
  const pollRef = useRef<number | null>(null);
  const stopPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const canSubmit = useMemo(() => Boolean(file) && !isLoading, [file, isLoading]);

  const fileMeta = useMemo(() => {
    if (!file) return null;
    return `${file.name} • ${formatBytes(file.size)}`;
  }, [file]);

  async function loadMy(opts?: { keepSelection?: boolean; selectId?: string | null }) {
    try {
      const data = await getMyVouchers();
      const list = Array.isArray(data) ? data : [];

      list.sort((a: any, b: any) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });

      setRows(list);

      const hasProcessing = list.some((r: any) => safe(r.status).toUpperCase() === "PROCESSING");
      if (hasProcessing && !pollRef.current) {
        pollRef.current = window.setInterval(() => loadMy({ keepSelection: true }), 2500);
      }
      if (!hasProcessing) stopPolling();

      const idToUse =
        opts?.selectId ?? (opts?.keepSelection ? selectedId : null) ?? selectedId;

      if (idToUse) {
        const found = list.find((r: any) => String(r._id) === String(idToUse));
        if (found) {
          setSelectedId(String(found._id));
          setSelected(found);
        }
      }
    } catch {
      // keep silent (page should still load)
    }
  }

  useEffect(() => {
    loadMy();
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
    return rows.filter((r) => {
      const s = safe(r.status).toUpperCase();
      if (tab !== "ALL" && s !== tab) return false;
      if (!query) return true;

      const hay = [
        safe(r._id),
        safe(r.docType),
        safe(r.status),
        safe(r.file?.originalName),
        safe(r.file?.mime),
        safe(r.customerId),
        safe(r?.renderedS3?.key),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q, tab]);

  const selectRow = (r: Row) => {
    const id = String(r?._id || "");
    setSelectedId(id || null);
    setSelected(r || null);
    setResult(null);
    setError(null);
  };

  async function onSubmit() {
    if (!file) {
      setError("Please select a PDF or image to extract.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await extractVoucher({
        file,
        voucherType,
        customLogoUrl: customLogoUrl.trim() || undefined,
        portalHint: portalHint.trim() || undefined,
      });

      setResult(data);

      const id = String(data?.id || "");
      if (id) {
        setSelectedId(id);
        await loadMy({ selectId: id });

        // ✅ UX: try to auto-open rendered PDF if already generated
        try {
          const resp = await getVoucherOpenRenderedUrl(id);
          if (resp?.url) window.open(resp.url, "_blank", "noopener,noreferrer");
        } catch {
          // Render may not be ready yet; ignore quietly
        }
      } else {
        await loadMy({ keepSelection: true });
      }
    } catch (e: any) {
      setError(tryExtractHelpfulError(e));
      await loadMy({ keepSelection: true });
    } finally {
      setIsLoading(false);
    }
  }

  async function openSignedSourceById(id: string) {
    setOpening(true);
    setError(null);
    try {
      const resp = await getVoucherOpenUrl(id);
      if (!resp?.url) throw new Error("Signed URL not available");
      window.open(resp.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "Unable to open source file");
    } finally {
      setOpening(false);
    }
  }

  async function openSignedRenderedById(id: string) {
    setOpeningRendered(true);
    setError(null);
    try {
      const resp = await getVoucherOpenRenderedUrl(id);
      if (!resp?.url) throw new Error("Rendered signed URL not available");
      window.open(resp.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "Unable to open rendered PDF");
    } finally {
      setOpeningRendered(false);
    }
  }

  const selectedStatus = statusTone(selected?.status);

  // ✅ stricter: show “Rendered” only when we actually have a key
  const hasRendered = Boolean(selected?.renderedS3?.key);

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 1440 }}>
      <style>{`
        .vx-top {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:16px; flex-wrap:wrap; margin-bottom:14px;
        }
        .vx-title { display:flex; gap:12px; align-items:center; }
        .vx-icon {
          width:44px; height:44px; border-radius:14px;
          border:1px solid rgba(15,23,42,.12);
          background: linear-gradient(180deg, rgba(99,102,241,.10), rgba(14,165,233,.06));
          display:flex; align-items:center; justify-content:center;
        }
        .vx-sub { color: rgba(15,23,42,.6); font-size: 13px; }

        .vx-card {
          border:1px solid rgba(15,23,42,.10);
          border-radius:18px;
          background: rgba(255,255,255,0.92);
          box-shadow: 0 6px 20px rgba(15,23,42,.06);
        }

        .vx-kpi {
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap:12px;
          margin-bottom:14px;
        }
        @media (max-width: 1100px) { .vx-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .vx-kpi { grid-template-columns: 1fr; } }
        .vx-k { color: rgba(15,23,42,.6); font-size: 12px; }
        .vx-v { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; }

        .vx-main {
          display:grid;
          grid-template-columns: 420px minmax(0, 1fr);
          gap:12px;
        }
        @media (max-width: 1100px) { .vx-main { grid-template-columns: 1fr; } }

        .vx-error {
          border-radius: 14px;
          border: 1px solid rgba(239,68,68,.20);
          background: rgba(239,68,68,.06);
          padding: 12px 14px;
          margin-bottom: 12px;
        }

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
          background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(14,165,233,.92));
          color:#fff;
          border-color: transparent;
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
          min-height: 520px;
          border: none;
          outline: none;
          resize: vertical;
          background: transparent;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12.5px;
          line-height: 1.45;
        }

        .vx-upload {
          padding: 14px;
          border-bottom: 1px solid rgba(15,23,42,.08);
        }
        .vx-formgrid {
          display:grid;
          grid-template-columns: 220px 1fr 260px 240px;
          gap:12px;
          align-items:end;
        }
        @media (max-width: 1100px) { .vx-formgrid { grid-template-columns: 1fr; } }

        .vx-label { font-weight: 800; font-size: 13px; margin-bottom: 6px; }
        .vx-help { color: rgba(15,23,42,.6); font-size: 12px; margin-top: 6px; }
      `}</style>

      {/* Header */}
      <div className="vx-top">
        <div className="vx-title">
          <div className="vx-icon">🧾</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>
              Voucher Extractor
            </div>
            <div className="vx-sub">
              Upload → extract → normalize into{" "}
              <span style={{ fontWeight: 800 }}>PlumTrips Voucher Format</span>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="chip chip-muted">🔒 Private S3 + Signed Open</span>
          <span className="chip chip-muted">🔄 Auto-refresh on Processing</span>
          <button
            className="vx-btn"
            onClick={() => loadMy({ keepSelection: true })}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="vx-error">
          <div style={{ fontWeight: 900 }}>Something went wrong</div>
          <div style={{ color: "rgba(15,23,42,.75)", wordBreak: "break-word" }}>{error}</div>
        </div>
      )}

      {/* KPI */}
      <div className="vx-kpi">
        <div className="vx-card">
          <div className="p-3">
            <div className="vx-k">Total</div>
            <div className="vx-v">{stats.total}</div>
          </div>
        </div>
        <div className="vx-card">
          <div className="p-3">
            <div className="vx-k">Success</div>
            <div className="vx-v">{stats.success}</div>
          </div>
        </div>
        <div className="vx-card">
          <div className="p-3">
            <div className="vx-k">Failed</div>
            <div className="vx-v">{stats.failed}</div>
          </div>
        </div>
        <div className="vx-card">
          <div className="p-3">
            <div className="vx-k">Processing</div>
            <div className="vx-v">{stats.processing}</div>
          </div>
        </div>
      </div>

      {/* Upload module */}
      <div className="vx-card mb-3">
        <div className="vx-upload">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>New Extraction</div>
              <div className="vx-sub">Choose type, upload file, and extract structured JSON.</div>
            </div>
            <div className="vx-sub">
              {fileMeta ? <span style={{ fontWeight: 800 }}>{fileMeta}</span> : "No file selected"}
            </div>
          </div>

          <div className="vx-formgrid mt-3">
            <div>
              <div className="vx-label">Voucher Type</div>
              <select
                className="form-select"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as VoucherType)}
                disabled={isLoading}
                style={{ borderRadius: 14 }}
              >
                <option value="hotel">Hotel</option>
                <option value="flight">Flight</option>
              </select>
              <div className="vx-help">Pick the correct domain.</div>
            </div>

            <div>
              <div className="vx-label">Upload File</div>
              <input
                className="form-control"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isLoading}
                style={{ borderRadius: 14 }}
              />
              <div className="vx-help">Tip: high-res PDFs/images extract better.</div>
            </div>

            <div>
              <div className="vx-label">Custom Logo URL</div>
              <input
                className="form-control"
                value={customLogoUrl}
                onChange={(e) => setCustomLogoUrl(e.target.value)}
                placeholder="https://..."
                disabled={isLoading}
                style={{ borderRadius: 14 }}
              />
              <div className="vx-help">Optional override.</div>
            </div>

            <div>
              <div className="vx-label">Portal Hint</div>
              <input
                className="form-control"
                value={portalHint}
                onChange={(e) => setPortalHint(e.target.value)}
                placeholder="Agoda / Cleartrip / TBO / Goibibo…"
                disabled={isLoading}
                style={{ borderRadius: 14 }}
              />
              <div className="vx-help">Optional — improves extraction quality.</div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 mt-3 flex-wrap">
            <button className="vx-btn primary" onClick={onSubmit} disabled={!canSubmit}>
              {isLoading ? "Extracting…" : "Extract"}
            </button>

            <button
              className="vx-btn"
              onClick={() => {
                setFile(null);
                setCustomLogoUrl("");
                setPortalHint("");
                setResult(null);
                setError(null);
              }}
              disabled={isLoading}
            >
              Reset
            </button>

            {isLoading && (
              <div className="ms-auto d-flex align-items-center gap-2 vx-sub">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                <span>Reading document & crafting structured JSON…</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Split view: list + details */}
      <div className="vx-main">
        {/* Left list */}
        <div className="vx-card">
          <div className="vx-toolbar">
            <div>
              <div style={{ fontWeight: 900 }}>My Extractions</div>
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
              placeholder="Search by file, type, status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="vx-list">
            {filtered.length === 0 ? (
              <div className="vx-sub" style={{ padding: 10 }}>
                No extractions yet. Upload a voucher above to create your first record.
              </div>
            ) : (
              filtered.map((r) => {
                const id = String(r._id || "");
                const active = selectedId === id;
                const st = statusTone(r.status);

                const rendered = Boolean(r?.renderedS3?.key);

                return (
                  <button
                    key={id}
                    className={`vx-item ${active ? "active" : ""}`}
                    onClick={() => selectRow(r)}
                  >
                    <div className="vx-item-top">
                      <div className="vx-fn">{safe(r.file?.originalName) || "Untitled Voucher"}</div>
                      <span className={st.chip}>{st.label}</span>
                    </div>

                    <div className="vx-meta">
                      <span className={docTone(r.docType)} style={{ marginRight: 8 }}>
                        {safe(r.docType) || "—"}
                      </span>
                      <span
                        className={`chip ${rendered ? "chip-success" : "chip-muted"}`}
                        style={{ marginRight: 8 }}
                      >
                        {rendered ? "Rendered" : "Not Rendered"}
                      </span>
                      {fmtDate(r.createdAt)}
                    </div>

                    <div className="vx-meta" style={{ marginTop: 6 }}>
                      Size: {formatBytes(r.file?.size)} • {safe(r.file?.mime) || "-"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right details */}
        <div className="vx-card">
          {!selected && !result ? (
            <div className="vx-detail-body">
              <div style={{ fontWeight: 900, fontSize: 16 }}>Select an extraction</div>
              <div className="vx-sub" style={{ marginTop: 6 }}>
                Pick a record from the left to open the source/rendered PDF and view the extracted JSON.
              </div>
            </div>
          ) : (
            <>
              <div className="vx-detail-head">
                <div>
                  <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>
                    {safe(selected?.file?.originalName || result?.fileName) || "Extraction Result"}
                  </div>
                  <div className="vx-sub" style={{ marginTop: 4 }}>
                    ID:{" "}
                    <span style={{ fontWeight: 800 }}>
                      {safe(selected?._id || result?.id) || "-"}
                    </span>
                  </div>
                </div>

                <div className="vx-actions">
                  {selected ? <span className={selectedStatus.chip}>{selectedStatus.label}</span> : null}
                  {selected?.docType ? (
                    <span className={docTone(selected.docType)}>{safe(selected.docType)}</span>
                  ) : null}
                  {selected ? (
                    <span className={`chip ${hasRendered ? "chip-success" : "chip-muted"}`}>
                      {hasRendered ? "Rendered" : "Not Rendered"}
                    </span>
                  ) : null}

                  <button
                    className="vx-btn"
                    onClick={async () => {
                      try {
                        const id = String(selected?._id || result?.id || "");
                        await navigator.clipboard.writeText(id);
                      } catch {}
                    }}
                  >
                    Copy ID
                  </button>

                  <button
                    className="vx-btn"
                    onClick={() => {
                      const id = String(selected?._id || result?.id || "");
                      if (id) openSignedSourceById(id);
                    }}
                    disabled={opening}
                    title="Open original uploaded file using signed URL"
                  >
                    {opening ? "Opening…" : "Open Source"}
                  </button>

                  <button
                    className="vx-btn"
                    onClick={() => {
                      const id = String(selected?._id || result?.id || "");
                      if (id) openSignedRenderedById(id);
                    }}
                    disabled={openingRendered || !hasRendered}
                    title={!hasRendered ? "Rendered PDF not available yet" : "Open rendered PDF"}
                  >
                    {openingRendered ? "Opening…" : "Open Rendered"}
                  </button>

                  <button
                    className="vx-btn primary"
                    onClick={async () => {
                      try {
                        const json = selected?.extractedJson || result?.extractedJson || {};
                        await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
                      } catch {}
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </div>

              <div className="vx-detail-body">
                <div className="vx-grid2">
                  <div className="vx-panel">
                    <div className="k">Document</div>
                    <div className="v">{safe(selected?.docType || result?.docType) || "-"}</div>
                    <div className="vx-sub" style={{ marginTop: 6 }}>
                      Created: {fmtDate(selected?.createdAt || result?.createdAt)}
                    </div>
                  </div>

                  <div className="vx-panel">
                    <div className="k">File</div>
                    <div className="v">{safe(selected?.file?.originalName) || "-"}</div>
                    <div className="vx-sub" style={{ marginTop: 6 }}>
                      {safe(selected?.file?.mime) || "-"} • {formatBytes(selected?.file?.size)}
                    </div>
                  </div>
                </div>

                <div className="vx-json">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>PlumTrips Voucher JSON</div>
                      <div className="vx-sub">Structured output generated by the extractor.</div>
                    </div>

                    {selected?.status ? (
                      <span className={statusTone(selected.status).chip}>
                        {statusTone(selected.status).label}
                      </span>
                    ) : null}
                  </div>

                  <textarea
                    className="vx-textarea"
                    value={JSON.stringify(selected?.extractedJson || result?.extractedJson || {}, null, 2)}
                    readOnly
                  />
                </div>

                <div className="vx-sub mt-3">
                  Files are stored privately in S3. Open buttons use short-lived signed URLs (RBAC protected). This page
                  auto-refreshes while processing is ongoing.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}