// MyProfileCustomer.tsx (DROP-IN REPLACEMENT)
// Logo fixes added (frontend + UI):
// ✅ Shows allowed file types + max size (2MB from multer) + recommended/max px
// ✅ Reads image dimensions (px) before upload and blocks invalid files
// ✅ Shows the selected file’s size + px so user knows what they’re uploading
// ✅ Fix “torn” logo by using object-fit: contain (not cover) + proper background
// ✅ Better error message when backend returns "File too large"

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { useAuth } from "../../context/AuthContext";

/* ---------------------------------------------
  LocalStorage keys (shared with TravelSpendDashboard)
--------------------------------------------- */
const LS_CSV = "travelDash:csvUrl";

/* ---------------------------------------------
  Backend endpoints
--------------------------------------------- */
const API_ME = "/api/v1/workspace/me";
const API_UPLOAD = "/api/v1/workspace/logo";

/* ---------------------------------------------
  Logo upload constraints (MUST match backend)
  Backend: limits: { fileSize: 2 * 1024 * 1024 } // 2MB
--------------------------------------------- */
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const LOGO_RECOMMENDED_PX = 512; // best for your 92px avatar block
const LOGO_MAX_PX = 1024; // safe upper bound for quality/perf

/* ---------------------------------------------
  Services
--------------------------------------------- */
const CANON_SERVICES = ["Flights", "Hotels", "Visa", "Cabs", "Forex", "eSIM", "Holidays"] as const;
type CanonService = (typeof CANON_SERVICES)[number];

function canonicalizeService(raw: string): CanonService | string {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("flight") || s.includes("air") || s.includes("pnr") || s.includes("ticket")) return "Flights";
  if (s.includes("hotel") || s.includes("stay") || s.includes("room")) return "Hotels";
  if (s.includes("visa") || s.includes("vfs") || s.includes("embassy")) return "Visa";
  if (s.includes("cab") || s.includes("taxi") || s.includes("transfer") || s.includes("uber") || s.includes("ola"))
    return "Cabs";
  if (s.includes("forex") || s.includes("fx") || s.includes("currency") || s.includes("exchange")) return "Forex";
  if (s.includes("esim") || s.includes("e-sim") || s.includes("sim")) return "eSIM";
  if (s.includes("holiday") || s.includes("package") || s.includes("tour")) return "Holidays";
  const exact = CANON_SERVICES.find((x) => x.toLowerCase() === s);
  return exact || raw.trim();
}

const SERVICE_COLORS: Record<string, string> = {
  Flights: "#2D7DFF",
  Hotels: "#00C2A8",
  Visa: "#d06549",
  Cabs: "#7C5CFF",
  Forex: "#FFB020",
  eSIM: "#00A3FF",
  Holidays: "#FF4D8D",
  Unknown: "rgba(255,255,255,.35)",
};

/* ---------------------------------------------
  Helpers
--------------------------------------------- */
function safeGetLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function clampDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYMDDate(v: string): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const dd = Number(m[3]);
  const d = new Date(yyyy, mm, dd);
  return isNaN(d.getTime()) ? null : d;
}

function toDateOnly(v: unknown): Date | null {
  if (!v) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  if (typeof v === "number" && !isNaN(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const s = String(v).trim();
  if (!s) return null;

  const local = parseYMDDate(s);
  if (local) return local;

  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());

  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yy = Number(m[3]);
    const d2 = new Date(yy, mm, dd);
    if (!isNaN(d2.getTime())) return d2;
  }

  return null;
}

function normKey(k: unknown) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
}

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n || 0)}`;
  }
}

function looksLikeHtml(text: string) {
  const head = text.slice(0, 120).toLowerCase();
  return head.includes("<!doctype") || head.includes("<html") || head.includes("<head");
}

function getBackendOrigin(): string {
  const env =
    (import.meta as any)?.env?.VITE_BACKEND_ORIGIN ||
    (import.meta as any)?.env?.VITE_API_ORIGIN ||
    (import.meta as any)?.env?.VITE_SERVER_ORIGIN ||
    "";

  const v = String(env || "").trim().replace(/\/+$/, "");
  if (v) return v;

  try {
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" && String(port) === "5173") {
      return `${protocol}//${hostname}:8080`;
    }
  } catch {
    // ignore
  }

  return "";
}

function resolveAssetUrl(u: string) {
  const url = String(u || "").trim();
  if (!url) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(url)) return url;

  if (url.startsWith("/")) {
    const backend = getBackendOrigin();
    if (backend && !url.startsWith("/api/")) return `${backend}${url}`;
    return url;
  }

  const backend = getBackendOrigin();
  if (backend) return `${backend}/${url.replace(/^\/+/, "")}`;
  return url;
}

function withCacheBust(url: string) {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

function readAccessTokenFromSomewhere(userMaybe: any): string {
  const keys = ["accessToken", "hrms:accessToken", "pt:accessToken", "plumtrips:accessToken", "jwt", "token"];

  const fromCtx = userMaybe?.accessToken || userMaybe?.token || userMaybe?.jwt || userMaybe?.authToken || "";
  if (fromCtx && typeof fromCtx === "string") return fromCtx;

  for (const k of keys) {
    const v = safeGetLS(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function fetchJson(url: string, auth: { token?: string } = {}) {
  const token = String(auth.token || "").trim();

  const res = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(`Request failed (401) for ${url}. Session/token missing. Please logout → login again.`);
    }
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }

  if (looksLikeHtml(text) || (!ct.includes("application/json") && !text.trim().startsWith("{"))) {
    throw new Error(`Expected JSON but got HTML/text for ${url}. Fix backend route or proxy.`);
  }

  return JSON.parse(text);
}

function bytesToHuman(n: number) {
  const b = Number(n || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function isAllowedLogoMime(m: string) {
  const t = String(m || "").toLowerCase();
  return t === "image/png" || t === "image/jpeg" || t === "image/webp";
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = (img as any).naturalWidth || img.width;
      const h = (img as any).naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    img.src = url;
  });
}

/* ---------------------------------------------
  Types
--------------------------------------------- */
type RawRow = Record<string, unknown>;

type Row = {
  date: Date | null;
  service: string;
  amount: number;
  destination: string;
  traveller: string;
  travellerEmail: string;
  bookingStatus: string;
  raw: RawRow;
};

type ViewMode = "today" | "week" | "month" | "custom";

/* ---------------------------------------------
  Small UI atoms
--------------------------------------------- */
function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs transition"
      style={{
        border: "1px solid rgba(255,255,255,.14)",
        background: active ? "rgba(45,125,255,.16)" : "rgba(255,255,255,.06)",
        color: active ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.78)",
        boxShadow: active ? "0 0 0 1px rgba(45,125,255,.20) inset" : "none",
      }}
    >
      {children}
    </button>
  );
}

function Glass({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-[28px] ${className}`}
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
        boxShadow: "0 18px 50px rgba(0,0,0,.30)",
        backdropFilter: "blur(14px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------
  Main Component
--------------------------------------------- */
export default function MyProfileCustomer() {
  const navigate = useNavigate();
  const authAny = useAuth() as any;

  const user = authAny?.user;
  const refreshSession = authAny?.refreshSession as undefined | (() => Promise<void>);

  const token = useMemo(() => readAccessTokenFromSomewhere(authAny), [authAny]);

  const email = useMemo(() => {
    const fromAuth = (user as any)?.email;
    const fromLS = safeGetLS("userEmail");
    return String(fromAuth || fromLS || "—");
  }, [user]);

  const [workspaceName, setWorkspaceName] = useState<string>("Workspace Leader");
  const [logoUrl, setLogoUrl] = useState<string>("");

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);

  // NEW: show user guidance + actual chosen file info
  const [logoMeta, setLogoMeta] = useState<{ name: string; bytes: number; width: number; height: number } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const envCsv =
    (import.meta as any)?.env?.VITE_TRAVEL_SHEET_CSV_URL ||
    (globalThis as any)?.process?.env?.VITE_TRAVEL_SHEET_CSV_URL ||
    "";

  const [csvUrl] = useState<string>(() => {
    const saved = String(safeGetLS(LS_CSV) || "").trim();
    const v = String(saved || envCsv || "").trim().replace(/^['"]|['"]$/g, "");
    return v;
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [view, setView] = useState<ViewMode>("month");
  const [from, setFrom] = useState<string>(() => {
    const now = clampDate(new Date());
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    return ymd(s);
  });
  const [to, setTo] = useState<string>(() => ymd(clampDate(new Date())));

  const [servicesOpen, setServicesOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const servicesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!servicesRef.current) return;
      if (!servicesRef.current.contains(e.target as Node)) setServicesOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const now = clampDate(new Date());
    if (view === "today") {
      const d = ymd(now);
      setFrom(d);
      setTo(d);
    }
    if (view === "week") {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      setFrom(ymd(s));
      setTo(ymd(now));
    }
    if (view === "month") {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      setFrom(ymd(s));
      setTo(ymd(now));
    }
  }, [view]);

  async function loadWorkspaceProfile() {
    setLogoErr(null);
    try {
      const j = await fetchJson(API_ME, { token });

      const ws = j?.workspace || j?.data?.workspace || j?.me?.workspace || j?.business || j?.customer || j;

      const name = String(ws?.name || ws?.companyName || ws?.workspaceName || "Workspace Leader");
      const logo = String(ws?.logoUrl || ws?.logo || ws?.companyLogoUrl || ws?.companyLogo || "");

      setWorkspaceName(name);
      setLogoUrl(resolveAssetUrl(logo));
    } catch (e: any) {
      if (String(e?.message || "").includes("(401)") && typeof refreshSession === "function") {
        try {
          await refreshSession();
          const j2 = await fetchJson(API_ME, { token: readAccessTokenFromSomewhere(authAny) });
          const ws2 = j2?.workspace || j2?.data?.workspace || j2?.me?.workspace || j2?.business || j2?.customer || j2;

          const name2 = String(ws2?.name || ws2?.companyName || ws2?.workspaceName || "Workspace Leader");
          const logo2 = String(ws2?.logoUrl || ws2?.logo || ws2?.companyLogoUrl || ws2?.companyLogo || "");
          setWorkspaceName(name2);
          setLogoUrl(resolveAssetUrl(logo2));
          return;
        } catch (e2: any) {
          setLogoErr(e2?.message || "Failed to load workspace profile.");
          return;
        }
      }

      setLogoErr(e?.message || "Failed to load workspace profile.");
    }
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setLogoErr(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);

      const t = readAccessTokenFromSomewhere(authAny);

      const res = await fetch(API_UPLOAD, {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: {
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      });

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const text = await res.text();

      if (!res.ok) {
        const lower = String(text || "").toLowerCase();
        if (res.status === 401) throw new Error("Upload failed (401). Please logout → login and retry.");
        if (lower.includes("file too large")) {
          throw new Error(`Logo is too large. Max allowed is ${bytesToHuman(LOGO_MAX_BYTES)}.`);
        }
        throw new Error(`Upload failed (${res.status}).`);
      }

      if (looksLikeHtml(text) || (!ct.includes("application/json") && !text.trim().startsWith("{"))) {
        throw new Error("Upload endpoint returned HTML/text, not JSON. Fix backend route to return JSON.");
      }

      const j = JSON.parse(text);
      const nextUrl = String(j?.logoUrl || j?.url || j?.path || "");

      if (nextUrl) setLogoUrl(resolveAssetUrl(nextUrl));
      await loadWorkspaceProfile();
    } catch (e: any) {
      setLogoErr(e?.message || "Logo upload failed.");
    } finally {
      setLogoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // NEW: pre-validate + show size + px to user before upload
  async function handleLogoPicked(file: File) {
    setLogoErr(null);
    setLogoMeta(null);

    if (!file) return;

    if (!isAllowedLogoMime(file.type)) {
      setLogoErr("Only PNG, JPG, or WebP logos are allowed.");
      return;
    }

    if (file.size > LOGO_MAX_BYTES) {
      setLogoErr(`File size is ${bytesToHuman(file.size)}. Max allowed is ${bytesToHuman(LOGO_MAX_BYTES)}.`);
      return;
    }

    try {
      const dim = await readImageDimensions(file);
      setLogoMeta({ name: file.name, bytes: file.size, width: dim.width, height: dim.height });

      const maxSide = Math.max(dim.width, dim.height);
      if (maxSide > LOGO_MAX_PX) {
        setLogoErr(
          `Image is ${dim.width}×${dim.height}px. Please upload ≤ ${LOGO_MAX_PX}×${LOGO_MAX_PX}px (recommended ${LOGO_RECOMMENDED_PX}×${LOGO_RECOMMENDED_PX}px).`,
        );
        return;
      }

      await uploadLogo(file);
    } catch (e: any) {
      setLogoErr(e?.message || "Could not read logo. Please try another image.");
    }
  }

  async function loadCsv() {
    setLoading(true);
    setErr(null);
    try {
      const u = String(csvUrl || "").trim();
      if (!u)
        throw new Error(
          "No CSV source connected. Open Travel Analytics → set CSV publish link → it will auto-sync here.",
        );

      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status}). Check publish permissions / link validity.`);

      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      const looksCsv = text.includes(",") && text.split("\n").length >= 2;

      if (looksLikeHtml(text) && !ct.includes("text/csv")) {
        throw new Error(
          "CSV source returned HTML (not CSV). Fix: Google Sheet → Share → Publish to web → choose CSV → use .../pub?output=csv",
        );
      }
      if (!looksCsv) throw new Error("Response does not look like CSV. Please verify the link ends with output=csv.");

      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false }) as { data: RawRow[] };
      const data = Array.isArray(parsed?.data) ? parsed.data : [];

      const model: Row[] = data
        .map((r) => {
          const keys = Object.keys(r || {});
          const get = (wanted: string[]) => {
            const found = keys.find((k) => wanted.includes(normKey(k)));
            return found ? (r as any)[found] : undefined;
          };

          const dateVal = get(["date", "bookingdate", "traveldate", "createdat"]);
          const serviceVal = get(["service", "servicetype", "product", "module"]);
          const amountVal = get(["amount", "total", "spend", "fare", "price", "grandtotal", "totalamount"]);
          const destVal = get(["destination", "city", "to", "arrival", "place", "todestination"]);
          const travellerVal = get(["traveller", "traveler", "employee", "name", "passenger", "travellername"]);
          const travellerEmailVal = get(["travelleremail", "employeeemail", "email", "officialemail"]);
          const bookingStatusVal = get(["status", "bookingstatus", "state"]);

          const date = toDateOnly(dateVal);
          const serviceRaw = String(serviceVal ?? "Unknown").trim() || "Unknown";
          const service = String(canonicalizeService(serviceRaw));

          let amount = 0;
          if (amountVal != null && String(amountVal).trim() !== "") {
            const cleaned = String(amountVal).replace(/[₹,]/g, "").trim();
            const n = Number(cleaned);
            amount = isNaN(n) ? 0 : n;
          }

          return {
            date,
            service,
            amount,
            destination: String(destVal ?? "—").trim() || "—",
            traveller: String(travellerVal ?? "—").trim() || "—",
            travellerEmail: String(travellerEmailVal ?? "").trim(),
            bookingStatus: String(bookingStatusVal ?? "").trim(),
            raw: r,
          };
        })
        .filter((x) => x.date || x.amount || (x.service && x.service !== "Unknown"));

      setRows(model);
      setSelectedServices((prev) => (prev.length ? prev : [...CANON_SERVICES]));
    } catch (e: any) {
      setErr(e?.message || "Failed to load travel analytics CSV.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaceProfile();
    loadCsv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = from ? (parseYMDDate(from) ? clampDate(parseYMDDate(from)!) : clampDate(new Date(from))) : null;
    const e = to ? (parseYMDDate(to) ? clampDate(parseYMDDate(to)!) : clampDate(new Date(to))) : null;

    const sT = s ? s.getTime() : null;
    const eT = e ? e.getTime() : null;

    const selected = new Set((selectedServices.length ? selectedServices : [...CANON_SERVICES]).map(String));

    return rows.filter((r) => {
      if (!r.date) return false;
      const t = r.date.getTime();
      if (sT != null && t < sT) return false;
      if (eT != null && t > eT) return false;

      const svc = r.service;
      if (selectedServices.length && !selected.has(String(svc))) return false;
      return true;
    });
  }, [rows, from, to, selectedServices]);

  const kpis = useMemo(() => {
    const spend = filtered.reduce((a, b) => a + (b.amount || 0), 0);
    const trips = filtered.length;
    const travellers = new Set(filtered.map((x) => (x.travellerEmail || x.traveller || "").trim()).filter(Boolean)).size;
    const destinations = new Set(filtered.map((x) => x.destination).filter((d) => d && d !== "—")).size;
    const avg = trips ? spend / trips : 0;
    return { spend, trips, travellers, destinations, avg };
  }, [filtered]);

  const openAnalytics = () => navigate("/dashboard/travel-spend");
  const sourceLabel = csvUrl ? "Source: Travel Analytics (CSV)" : "Source: Not connected";
  const ringGradient =
    "conic-gradient(#2D7DFF, #00C2A8, #d06549, #7C5CFF, #FFB020, #00A3FF, #FF4D8D, #2D7DFF)";

  const logoSrc = useMemo(() => {
    const resolved = resolveAssetUrl(logoUrl);
    return resolved ? withCacheBust(resolved) : "";
  }, [logoUrl]);

  const logoGuidance = useMemo(() => {
    return `PNG / JPG / WebP • Max ${bytesToHuman(LOGO_MAX_BYTES)} • Recommended ${LOGO_RECOMMENDED_PX}×${LOGO_RECOMMENDED_PX}px (Max ${LOGO_MAX_PX}×${LOGO_MAX_PX}px)`;
  }, []);

  return (
    <div
      className="min-h-[calc(100vh-64px)]"
      style={{
        background:
          "radial-gradient(1000px 500px at 20% 0%, rgba(0,71,127,.08), transparent 55%), radial-gradient(900px 480px at 82% 10%, rgba(208,101,73,.08), transparent 55%), linear-gradient(180deg, rgba(250,250,252,1), rgba(244,245,248,1))",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div
          className="rounded-[34px] p-[18px]"
          style={{
            background:
              "radial-gradient(1100px 520px at 20% 10%, rgba(0,71,127,.50), transparent 62%), radial-gradient(900px 560px at 82% 18%, rgba(0,194,168,.20), transparent 60%), radial-gradient(900px 560px at 50% 110%, rgba(208,101,73,.20), transparent 62%), linear-gradient(180deg, #060812 0%, #070A12 60%, #060812 100%)",
            boxShadow: "0 26px 70px rgba(0,0,0,.22)",
          }}
        >
          <Glass className="p-6">
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Left */}
              <div className="lg:col-span-7">
                <div className="flex items-start gap-5">
                  {/* Logo block */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-[92px] w-[92px] rounded-[26px] overflow-hidden flex items-center justify-center"
                      style={{
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.06)",
                        cursor: "pointer",
                      }}
                      title="Change workspace logo"
                    >
                      {logoSrc ? (
                        <div
                          className="h-full w-full flex items-center justify-center"
                          style={{
                            background: "rgba(0,0,0,.18)",
                          }}
                        >
                          <img
                            src={logoSrc}
                            alt="Workspace logo"
                            className="h-full w-full"
                            style={{
                              objectFit: "contain", // ✅ fixes “torn / cropped” look
                              padding: 10, // gives breathing space for non-square logos
                              filter: "drop-shadow(0 8px 16px rgba(0,0,0,.28))",
                            }}
                            onError={() => {
                              setLogoUrl("");
                              setLogoErr(
                                "Logo URL is not serving an image (often it’s HTML from Vite). Fix: serve /uploads from backend origin or set VITE_BACKEND_ORIGIN.",
                              );
                            }}
                          />
                        </div>
                      ) : (
                        <div className="text-3xl font-semibold text-white">
                          {String(workspaceName || email || "W").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      className="mt-2 rounded-full px-3 py-1 text-xs"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.06)",
                        color: "rgba(255,255,255,.85)",
                      }}
                      onClick={() => fileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? "Uploading…" : "Change"}
                    </button>

                    {/* NEW: guidance + selected file meta */}
                    <div className="mt-2 text-center text-[11px]" style={{ color: "rgba(255,255,255,.58)", maxWidth: 210 }}>
                      {logoGuidance}
                      {logoMeta && (
                        <div className="mt-1" style={{ color: "rgba(255,255,255,.70)" }}>
                          Selected: {logoMeta.width}×{logoMeta.height}px • {bytesToHuman(logoMeta.bytes)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs tracking-[0.28em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      PLUMTRIPS
                    </div>
                    <div className="mt-1 text-[22px] font-semibold text-white">Customer Experience Centre</div>
                    <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.70)" }}>
                      Corporate travel profile • spend intelligence • approvals — a single command console.
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div
                        className="rounded-2xl px-4 py-3"
                        style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.18)" }}
                      >
                        <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                          WORKSPACE
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{workspaceName}</div>
                      </div>

                      <div
                        className="rounded-2xl px-4 py-3"
                        style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.18)" }}
                      >
                        <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                          EMAIL
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{email}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {[{ label: "7 services" }, { label: `${kpis.travellers || 0} travellers` }, { label: sourceLabel }].map(
                        (x, i) => (
                          <span
                            key={i}
                            className="rounded-full px-3 py-1 text-xs"
                            style={{
                              border: "1px solid rgba(255,255,255,.12)",
                              background: "rgba(255,255,255,.06)",
                              color: "rgba(255,255,255,.78)",
                            }}
                          >
                            {x.label}
                          </span>
                        ),
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap gap-2 items-center">
                      <button
                        className="rounded-full px-4 py-2 text-xs font-medium"
                        style={{
                          background: "rgba(255,255,255,.10)",
                          border: "1px solid rgba(255,255,255,.14)",
                          color: "rgba(255,255,255,.92)",
                        }}
                        type="button"
                        onClick={openAnalytics}
                      >
                        Open Travel Analytics
                      </button>

                      <button
                        className="rounded-full px-4 py-2 text-xs"
                        style={{
                          border: "1px solid rgba(255,255,255,.14)",
                          background: "rgba(255,255,255,.06)",
                          color: "rgba(255,255,255,.85)",
                        }}
                        type="button"
                        onClick={() => loadCsv()}
                        disabled={loading}
                      >
                        {loading ? "Refreshing…" : "Refresh CSV"}
                      </button>

                      {/* Upload input */}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoPicked(f);
                        }}
                      />

                      {logoErr && (
                        <span className="text-xs" style={{ color: "rgba(255,180,180,.90)" }}>
                          {logoErr}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-5 grid gap-3">
                <Glass className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                        PROFILE COMPLETENESS
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">Console readiness</div>
                      <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.70)" }}>
                        Improve this to unlock approvals, policies and analytics routing.
                      </div>
                    </div>
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{
                        border: "2px solid rgba(45,125,255,.55)",
                        color: "rgba(255,255,255,.92)",
                      }}
                    >
                      83%
                    </div>
                  </div>
                </Glass>

                <div
                  className="rounded-[26px] p-4"
                  style={{
                    border: "1px solid rgba(0,194,168,.28)",
                    background: "linear-gradient(135deg, rgba(0,194,168,.22), rgba(0,71,127,.20))",
                  }}
                >
                  <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.60)" }}>
                    TRAVEL APPROVALS
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">Approve employee travel requests</div>
                  <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.72)" }}>
                    Your employees raise requests — you approve before booking.
                  </div>
                  <button
                    className="mt-3 rounded-full px-4 py-2 text-xs font-medium"
                    style={{
                      background: "rgba(255,255,255,.10)",
                      border: "1px solid rgba(255,255,255,.14)",
                      color: "rgba(255,255,255,.92)",
                    }}
                    type="button"
                    onClick={() => navigate("/customer/contacts")}
                  >
                    View requests
                  </button>
                </div>
              </div>
            </div>
          </Glass>

          {/* Travel Spend Widget (kept as-is) */}
          <div className="mt-5">
            <Glass className="p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white">Travel Spend &amp; Usage (Preview)</div>
                    <span
                      className="rounded-full px-2 py-1 text-[11px]"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.06)",
                        color: "rgba(255,255,255,.75)",
                      }}
                    >
                      From CSV
                    </span>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.65)" }}>
                    This is a compact preview. For exports and deep filters, use Travel Analytics.
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.06)",
                        color: "rgba(255,255,255,.75)",
                      }}
                    >
                      {sourceLabel}
                    </span>

                    <button
                      onClick={() => loadCsv()}
                      disabled={loading}
                      className="rounded-full px-3 py-1 text-xs disabled:opacity-60"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.10)",
                        color: "rgba(255,255,255,.90)",
                      }}
                    >
                      {loading ? "Refreshing…" : "Refresh"}
                    </button>

                    <button
                      onClick={openAnalytics}
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.06)",
                        color: "rgba(255,255,255,.85)",
                      }}
                    >
                      Open Analytics ↗
                    </button>
                  </div>

                  {err && (
                    <div
                      className="mt-3 rounded-2xl px-4 py-2 text-xs"
                      style={{
                        border: "1px solid rgba(239,68,68,.28)",
                        background: "rgba(239,68,68,.08)",
                        color: "rgba(255,200,200,.95)",
                      }}
                    >
                      {err}
                      <div className="mt-1" style={{ color: "rgba(255,200,200,.80)" }}>
                        Tip: Set the CSV link in Travel Analytics. This dashboard reads from{" "}
                        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{LS_CSV}</code>.
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="flex flex-wrap gap-2">
                    <Chip active={view === "today"} onClick={() => setView("today")}>
                      Today
                    </Chip>
                    <Chip active={view === "week"} onClick={() => setView("week")}>
                      Week
                    </Chip>
                    <Chip active={view === "month"} onClick={() => setView("month")}>
                      Month
                    </Chip>
                    <Chip active={view === "custom"} onClick={() => setView("custom")}>
                      Date Range
                    </Chip>

                    <div ref={servicesRef} className="relative">
                      <Chip onClick={() => setServicesOpen((v) => !v)}>
                        Services ({(selectedServices.length ? selectedServices : [...CANON_SERVICES]).length})
                      </Chip>

                      {servicesOpen && (
                        <div
                          className="absolute right-0 z-30 mt-2 w-[340px] rounded-[22px] p-3"
                          style={{
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "rgba(10,16,32,.95)",
                            boxShadow: "0 20px 40px rgba(0,0,0,.45)",
                            color: "rgba(255,255,255,.90)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold">Filter services</div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-[11px] hover:underline"
                                style={{ color: "rgba(255,255,255,.70)" }}
                                onClick={() => setSelectedServices([...CANON_SERVICES])}
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                className="text-[11px] hover:underline"
                                style={{ color: "rgba(255,255,255,.70)" }}
                                onClick={() => setSelectedServices([])}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div
                            className="mt-2 max-h-[240px] overflow-auto rounded-2xl p-2"
                            style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.20)" }}
                          >
                            {CANON_SERVICES.map((s) => {
                              const checked = (selectedServices.length ? selectedServices : [...CANON_SERVICES]).includes(s);
                              return (
                                <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedServices((prev) => {
                                        const base = prev.length ? prev : [...CANON_SERVICES];
                                        return base.includes(s) ? base.filter((x) => x !== s) : [...base, s];
                                      });
                                    }}
                                  />
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVICE_COLORS[s] }} />
                                  <span className="text-xs" style={{ color: "rgba(255,255,255,.82)" }}>
                                    {s}
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.60)" }}>
                            If a service shows ₹0, there are no rows for that service in the selected date range.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {view === "custom" && (
                    <div className="flex items-center gap-2">
                      <div className="text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                        From
                      </div>
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs outline-none"
                        style={{
                          border: "1px solid rgba(255,255,255,.14)",
                          background: "rgba(0,0,0,.22)",
                          color: "rgba(255,255,255,.92)",
                        }}
                      />
                      <div className="text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                        To
                      </div>
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs outline-none"
                        style={{
                          border: "1px solid rgba(255,255,255,.14)",
                          background: "rgba(0,0,0,.22)",
                          color: "rgba(255,255,255,.92)",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* KPI grid */}
              <div className="mt-5 grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                      TOTAL SPEND
                    </div>

                    <div className="mt-4 flex items-center justify-center">
                      <div className="h-[170px] w-[170px] rounded-full p-[10px]" style={{ background: ringGradient }}>
                        <div
                          className="h-full w-full rounded-full flex flex-col items-center justify-center text-center"
                          style={{
                            background: "linear-gradient(180deg, rgba(6,8,18,1), rgba(7,10,18,1))",
                            border: "1px solid rgba(255,255,255,.10)",
                          }}
                        >
                          <div className="text-xs" style={{ color: "rgba(255,255,255,.60)" }}>
                            Total Spend
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-white">{fmtINR(kpis.spend)}</div>
                          <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
                            {from} — {to}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 grid gap-4 md:grid-cols-2">
                  {[
                    { title: "TRIPS", value: String(kpis.trips), sub: "Records in selected period." },
                    { title: "TRAVELLERS", value: String(kpis.travellers), sub: "Employees & travellers mapped." },
                    { title: "AVG TICKET VALUE", value: fmtINR(kpis.avg), sub: "Average booking value." },
                    { title: "DESTINATIONS", value: String(kpis.destinations), sub: "Unique cities visited." },
                  ].map((c) => (
                    <div
                      key={c.title}
                      className="rounded-[26px] p-5"
                      style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                    >
                      <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                        {c.title}
                      </div>
                      <div className="mt-2 text-4xl font-semibold text-white">{c.value}</div>
                      <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.65)" }}>
                        {c.sub}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-12">
                  <div
                    className="rounded-[26px] p-5"
                    style={{ border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
                          DETAILS
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">Trips (filtered)</div>
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,.60)" }}>
                        {filtered.length} rows
                      </div>
                    </div>

                    <div
                      className="mt-4 max-h-[320px] overflow-auto rounded-2xl"
                      style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.18)" }}
                    >
                      <table className="w-full text-left text-xs">
                        <thead
                          className="sticky top-0"
                          style={{
                            background: "rgba(10,16,32,.92)",
                            color: "rgba(255,255,255,.70)",
                            borderBottom: "1px solid rgba(255,255,255,.10)",
                          }}
                        >
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Service</th>
                            <th className="px-3 py-2">Traveller</th>
                            <th className="px-3 py-2">Destination</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody style={{ color: "rgba(255,255,255,.72)" }}>
                          {filtered.slice(0, 200).map((r, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                              <td className="px-3 py-2">{r.date ? ymd(r.date) : "—"}</td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: SERVICE_COLORS[r.service] || "rgba(255,255,255,.35)" }}
                                  />
                                  {r.service}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col">
                                  <span>{r.traveller || "—"}</span>
                                  {r.travellerEmail && (
                                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
                                      {r.travellerEmail}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">{r.destination}</td>
                              <td className="px-3 py-2 text-right">{fmtINR(r.amount || 0)}</td>
                            </tr>
                          ))}

                          {!filtered.length && (
                            <tr>
                              <td className="px-3 py-4" style={{ color: "rgba(255,255,255,.55)" }} colSpan={5}>
                                No records match your filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>
                      Showing first 200 rows. Open Travel Analytics for exports and deeper analysis.
                    </div>
                  </div>
                </div>
              </div>
            </Glass>
          </div>

          {/* Workspace Console */}
          <div className="mt-5">
            <Glass className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Workspace Console</div>
                  <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                    Dedicated pages for billing, contacts, agreements and security.
                  </div>
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,.55)" }}>
                  Updated: {new Date().toLocaleString()}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {[
                  { title: "Company & Billing", sub: "Legal identity, GST/PAN, billing address & terms.", cta: "Open", to: "/customer/company" },
                  { title: "Contacts & Approvers", sub: "Travel desk contacts and approval matrix.", cta: "Open", to: "/customer/contacts" },
                  { title: "Agreements", sub: "MSA, rate sheets and commercial documents.", cta: "Open", badge: "4 docs", to: "/customer/agreements" },
                  { title: "Security", sub: "Password and access controls for this account.", cta: "Manage", to: "/customer/security" },
                  { title: "Travel Analytics", sub: "Spend insights, filters, CSV/XLS exports.", cta: "Open", accent: true, to: "/dashboard/travel-spend" },
                ].map((x) => (
                  <div
                    key={x.title}
                    className="rounded-[22px] p-4"
                    style={{
                      border: "1px solid rgba(255,255,255,.12)",
                      background: (x as any).accent
                        ? "linear-gradient(135deg, rgba(0,194,168,.20), rgba(0,71,127,.18))"
                        : "rgba(255,255,255,.06)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">{x.title}</div>
                      {(x as any).badge && (
                        <span
                          className="rounded-full px-2 py-1 text-[11px]"
                          style={{
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "rgba(255,255,255,.06)",
                            color: "rgba(255,255,255,.75)",
                          }}
                        >
                          {(x as any).badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.65)" }}>
                      {x.sub}
                    </div>
                    <button
                      type="button"
                      className="mt-3 rounded-full px-4 py-2 text-xs"
                      style={{
                        border: "1px solid rgba(255,255,255,.14)",
                        background: "rgba(255,255,255,.08)",
                        color: "rgba(255,255,255,.90)",
                      }}
                      onClick={() => navigate(x.to)}
                    >
                      {x.cta}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 text-center text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
                Travel preview reads from CSV config (<b>{LS_CSV}</b>). No broken /api/details calls.
              </div>
            </Glass>
          </div>
        </div>
      </div>
    </div>
  );
}
