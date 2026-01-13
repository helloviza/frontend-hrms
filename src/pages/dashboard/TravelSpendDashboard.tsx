// apps/frontend/src/pages/dashboard/TravelSpendDashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

/* ---------------------------------------------
  Helpers: normalize headers + safe parsing
--------------------------------------------- */
function normKey(k: unknown) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]/g, "");
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

/** IMPORTANT: avoid UTC parsing bug for YYYY-MM-DD */
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

  // If already a Date
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  // If numeric timestamp
  if (typeof v === "number" && !isNaN(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const s = String(v).trim();
  if (!s) return null;

  // If yyyy-mm-dd, parse locally (NOT UTC)
  const ymdLocal = parseYMDDate(s);
  if (ymdLocal) return ymdLocal;

  // Try native parse for general strings/ISO
  const d1 = new Date(s);
  if (!isNaN(d1.getTime())) return new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());

  // dd/mm/yyyy or dd-mm-yyyy
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

function fmtINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function fmtCompactINR(n: number) {
  // compact labels for graph (₹6.7L / ₹3.5K etc)
  const abs = Math.abs(n || 0);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n || 0)}`;
}

/* ---------------------------------------------
  Canonical services (always show these)
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
  // If the sheet already uses canonical names (Flights, Hotels, etc)
  const exact = CANON_SERVICES.find((x) => x.toLowerCase() === s);
  return exact || raw.trim();
}

/* ---------------------------------------------
  Types
--------------------------------------------- */
type RawRow = Record<string, unknown>;

type Row = {
  date: Date | null;
  service: string; // canonicalized when possible
  amount: number;
  currency: string;
  destination: string;
  traveller: string;
  travellerEmail: string;
  department: string;
  costCenter: string;
  tripType: string;
  policyStatus: string;
  bookingChannel: string;
  vendor: string;
  bookingId: string;
  bookingStatus: string;
  raw: RawRow;
};

type Preset = "today" | "7d" | "30d" | "90d" | "all" | "custom";

/** minimal safe PapaParse result type */
type PapaLikeResult<T> = {
  data: T[];
  errors?: Array<{ message?: string }>;
};

type ThemeKey = "Midnight" | "Ocean" | "Ivory" | "Frost" | "Sand";

type Theme = {
  key: ThemeKey;
  label: string;
  isLight: boolean;
  chip: string;
  background: string;
  panelBg: string; // card bg
  panelBorder: string;
  text: string;
  mutedText: string;
  softText: string;
  gridStroke: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  primary: string;
  accent: string;
  glowA: string;
  glowB: string;
  glowC: string;
  serviceColors: Record<string, string>;
};

const SERVICE_COLORS_BASE: Record<CanonService, string> = {
  Flights: "#2D7DFF",
  Hotels: "#00C2A8",
  Visa: "#d06549",
  Cabs: "#7C5CFF",
  Forex: "#FFB020",
  eSIM: "#00A3FF",
  Holidays: "#FF4D8D",
};

const THEMES: Theme[] = [
  {
    key: "Midnight",
    label: "Midnight",
    isLight: false,
    chip: "#070A12",
    background:
      "radial-gradient(900px 520px at 18% 12%, rgba(0,71,127,.50), transparent 62%), radial-gradient(900px 560px at 82% 18%, rgba(0,194,168,.20), transparent 60%), radial-gradient(900px 560px at 50% 110%, rgba(208,101,73,.22), transparent 62%), linear-gradient(180deg, #060812 0%, #070A12 60%, #060812 100%)",
    panelBg: "rgba(255,255,255,.06)",
    panelBorder: "rgba(255,255,255,.12)",
    text: "rgba(255,255,255,1)",
    mutedText: "rgba(255,255,255,.70)",
    softText: "rgba(255,255,255,.55)",
    gridStroke: "rgba(255,255,255,.12)",
    axisText: "rgba(255,255,255,.70)",
    tooltipBg: "#0b1020",
    tooltipBorder: "rgba(255,255,255,.14)",
    primary: "#00477f",
    accent: "#d06549",
    glowA: "rgba(0,71,127,.35)",
    glowB: "rgba(0,194,168,.18)",
    glowC: "rgba(208,101,73,.18)",
    serviceColors: { ...SERVICE_COLORS_BASE },
  },
  {
    key: "Ocean",
    label: "Ocean",
    isLight: false,
    chip: "#041018",
    background:
      "radial-gradient(900px 520px at 18% 12%, rgba(0,163,255,.35), transparent 62%), radial-gradient(900px 560px at 82% 18%, rgba(0,194,168,.22), transparent 60%), radial-gradient(900px 560px at 50% 110%, rgba(124,92,255,.16), transparent 62%), linear-gradient(180deg, #031018 0%, #061A22 60%, #041018 100%)",
    panelBg: "rgba(255,255,255,.06)",
    panelBorder: "rgba(255,255,255,.12)",
    text: "rgba(255,255,255,1)",
    mutedText: "rgba(255,255,255,.70)",
    softText: "rgba(255,255,255,.55)",
    gridStroke: "rgba(255,255,255,.12)",
    axisText: "rgba(255,255,255,.70)",
    tooltipBg: "#071622",
    tooltipBorder: "rgba(255,255,255,.14)",
    primary: "#00A3FF",
    accent: "#00C2A8",
    glowA: "rgba(0,163,255,.28)",
    glowB: "rgba(0,194,168,.18)",
    glowC: "rgba(124,92,255,.14)",
    serviceColors: { ...SERVICE_COLORS_BASE, Forex: "#A7FF83" },
  },
  {
    key: "Ivory",
    label: "Ivory (Light)",
    isLight: true,
    chip: "#F3EDE4",
    background:
      "radial-gradient(900px 520px at 18% 12%, rgba(0,71,127,.14), transparent 58%), radial-gradient(900px 560px at 82% 18%, rgba(208,101,73,.16), transparent 60%), linear-gradient(180deg, #FBF7F2 0%, #F2ECE3 100%)",
    panelBg: "rgba(255,255,255,.78)",
    panelBorder: "rgba(10,20,30,.10)",
    text: "rgba(12,18,28,1)",
    mutedText: "rgba(12,18,28,.72)",
    softText: "rgba(12,18,28,.55)",
    gridStroke: "rgba(10,20,30,.12)",
    axisText: "rgba(10,20,30,.70)",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(10,20,30,.12)",
    primary: "#00477f",
    accent: "#d06549",
    glowA: "rgba(0,71,127,.14)",
    glowB: "rgba(208,101,73,.14)",
    glowC: "rgba(0,194,168,.10)",
    serviceColors: { ...SERVICE_COLORS_BASE },
  },
  {
    key: "Frost",
    label: "Frost (Light)",
    isLight: true,
    chip: "#EAF2FF",
    background:
      "radial-gradient(900px 520px at 18% 12%, rgba(45,125,255,.18), transparent 58%), radial-gradient(900px 560px at 82% 18%, rgba(0,194,168,.14), transparent 60%), linear-gradient(180deg, #F8FBFF 0%, #ECF2FF 100%)",
    panelBg: "rgba(255,255,255,.80)",
    panelBorder: "rgba(10,20,30,.10)",
    text: "rgba(12,18,28,1)",
    mutedText: "rgba(12,18,28,.72)",
    softText: "rgba(12,18,28,.55)",
    gridStroke: "rgba(10,20,30,.12)",
    axisText: "rgba(10,20,30,.70)",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(10,20,30,.12)",
    primary: "#2D7DFF",
    accent: "#00C2A8",
    glowA: "rgba(45,125,255,.18)",
    glowB: "rgba(0,194,168,.14)",
    glowC: "rgba(208,101,73,.10)",
    serviceColors: { ...SERVICE_COLORS_BASE, Visa: "#FF6A3D" },
  },
  {
    key: "Sand",
    label: "Sand (Light)",
    isLight: true,
    chip: "#F5EFE6",
    background:
      "radial-gradient(900px 520px at 18% 12%, rgba(255,176,32,.18), transparent 58%), radial-gradient(900px 560px at 82% 18%, rgba(0,71,127,.12), transparent 60%), linear-gradient(180deg, #FFF9F0 0%, #F4EDE3 100%)",
    panelBg: "rgba(255,255,255,.78)",
    panelBorder: "rgba(10,20,30,.10)",
    text: "rgba(12,18,28,1)",
    mutedText: "rgba(12,18,28,.72)",
    softText: "rgba(12,18,28,.55)",
    gridStroke: "rgba(10,20,30,.12)",
    axisText: "rgba(10,20,30,.70)",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(10,20,30,.12)",
    primary: "#FFB020",
    accent: "#00477f",
    glowA: "rgba(255,176,32,.18)",
    glowB: "rgba(0,71,127,.12)",
    glowC: "rgba(208,101,73,.12)",
    serviceColors: { ...SERVICE_COLORS_BASE, Forex: "#FFB020" },
  },
];

const LS_THEME = "travelDash:theme";
const LS_CSV = "travelDash:csvUrl";

/* ---------------------------------------------
  Component
--------------------------------------------- */
export default function TravelSpendDashboard() {
  // Env (best-effort) + localStorage + manual input
  const envUrl =
    (import.meta as any)?.env?.VITE_TRAVEL_SHEET_CSV_URL ||
    (globalThis as any)?.process?.env?.VITE_TRAVEL_SHEET_CSV_URL ||
    "";

  const initialCsv = (() => {
    const saved = safeGetLS(LS_CSV);
    const v = String(saved || envUrl || "").trim().replace(/^['"]|['"]$/g, "");
    return v;
  })();

  const [csvInput, setCsvInput] = useState<string>(initialCsv);
  const [csvUrl, setCsvUrl] = useState<string>(initialCsv);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Theme
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    const saved = safeGetLS(LS_THEME) as ThemeKey | null;
    return (saved && THEMES.some((t) => t.key === saved) ? saved : "Midnight") as ThemeKey;
  });
  const theme = useMemo(() => THEMES.find((t) => t.key === themeKey)!, [themeKey]);

  // Filters
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
  const [to, setTo] = useState<string>(""); // yyyy-mm-dd
  const [serviceOpen, setServiceOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [showOnlyConfirmed, setShowOnlyConfirmed] = useState(false);
  const [showAdvancedCols, setShowAdvancedCols] = useState(false);

  const servicePanelRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = servicePanelRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setServiceOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Persist theme
  useEffect(() => {
    safeSetLS(LS_THEME, themeKey);
  }, [themeKey]);

  // Init dates: last 30 days (better than month-only for “executive”)
  useEffect(() => {
    const now = clampDate(new Date());
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    setFrom(ymd(s));
    setTo(ymd(now));
  }, []);

  function computeRange(p: Preset) {
    const now = clampDate(new Date());
    if (p === "today") return { s: now, e: now };
    if (p === "7d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { s: clampDate(s), e: now };
    }
    if (p === "30d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { s: clampDate(s), e: now };
    }
    if (p === "90d") {
      const s = new Date(now);
      s.setDate(s.getDate() - 89);
      return { s: clampDate(s), e: now };
    }
    if (p === "all") return { s: null as Date | null, e: null as Date | null };
    // custom
    const s = from ? clampDate(parseYMDDate(from) || new Date(from)) : null;
    const e = to ? clampDate(parseYMDDate(to) || new Date(to)) : null;
    return { s, e, custom: true as const };
  }

  function normalizeMaybeGoogleCsv(u: string) {
    const url = String(u || "").trim().replace(/^['"]|['"]$/g, "");
    if (!url) return "";
    // If user pastes pubhtml, try to convert it to output=csv
    if (url.includes("pubhtml")) {
      return url.replace("pubhtml", "pub").replace(/([?&])output=html(&|$)/, "$1").replace(/([?&])output=[^&]+/g, "");
    }
    return url;
  }

  function saveAndLoad() {
    const cleaned = normalizeMaybeGoogleCsv(csvInput);
    setCsvUrl(cleaned);
    safeSetLS(LS_CSV, cleaned);
  }

  function clearCsv() {
    setCsvInput("");
    setCsvUrl("");
    safeSetLS(LS_CSV, "");
    setRows([]);
    setSelectedServices([]);
    setError(null);
  }

  async function load() {
    setError(null);
    setLoading(true);

    try {
      const u = String(csvUrl || "").trim().replace(/^['"]|['"]$/g, "");
      if (!u) throw new Error("CSV URL missing. Paste your Google Sheet CSV publish link and click “Save & Load”.");

      const res = await fetch(u, { cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);

      const text = await res.text();
      const first = text.slice(0, 120).toLowerCase();

      // Guard: sometimes Google returns HTML instead of CSV
      const looksHtml = first.includes("<!doctype") || first.includes("<html") || first.includes("<head");
      const looksCsv = text.includes(",") && text.split("\n").length >= 2;
      if (looksHtml && !ct.includes("text/csv")) {
        throw new Error(
          "Google returned HTML (not CSV). Fix: Google Sheet → File → Share → Publish to web → choose CSV, then use that link.",
        );
      }
      if (!looksCsv) {
        throw new Error("Response does not look like CSV. Please verify your publish link is output=csv.");
      }

      const parsed = (Papa as any).parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // we’ll parse amounts ourselves (avoid weird auto-casts)
      }) as PapaLikeResult<RawRow>;

      const data = Array.isArray(parsed?.data) ? parsed.data : [];

      const model: Row[] = data
        .map((r: RawRow): Row => {
          const keys = Object.keys(r || {});
          const get = (wanted: string[]) => {
            const found = keys.find((k) => wanted.includes(normKey(k)));
            return found ? (r as any)[found] : undefined;
          };

          // Flexible column mapping
          const dateVal = get(["date", "bookingdate", "traveldate", "createdat"]);
          const serviceVal = get(["service", "servicetype", "product", "module"]);
          const amountVal = get(["amount", "total", "spend", "fare", "price", "grandtotal", "totalamount"]);
          const currencyVal = get(["currency", "curr", "ccy"]);
          const destVal = get(["destination", "city", "to", "arrival", "place", "todestination"]);
          const travellerVal = get(["traveller", "traveler", "employee", "name", "passenger", "travellername"]);
          const travellerEmailVal = get(["travelleremail", "employeeemail", "email", "officialemail"]);
          const deptVal = get(["department", "dept"]);
          const costCenterVal = get(["costcenter", "costcentre", "cc"]);
          const tripTypeVal = get(["triptype", "trip", "journeytype"]);
          const policyVal = get(["policystatus", "policy", "inpolicy"]);
          const channelVal = get(["bookingchannel", "channel", "source"]);
          const vendorVal = get(["vendor", "supplier"]);
          const bookingIdVal = get(["bookingid", "bookingref", "reference", "ref", "pnr"]);
          const bookingStatusVal = get(["status", "bookingstatus", "state"]);

          const d = toDateOnly(dateVal);

          const serviceRaw = String(serviceVal ?? "Unknown").trim() || "Unknown";
          const service = String(canonicalizeService(serviceRaw));

          const destination = String(destVal ?? "—").trim() || "—";
          const traveller = String(travellerVal ?? "—").trim() || "—";
          const travellerEmail = String(travellerEmailVal ?? "").trim();
          const department = String(deptVal ?? "").trim();
          const costCenter = String(costCenterVal ?? "").trim();
          const tripType = String(tripTypeVal ?? "").trim();
          const policyStatus = String(policyVal ?? "").trim();
          const bookingChannel = String(channelVal ?? "").trim();
          const vendor = String(vendorVal ?? "").trim();
          const bookingId = String(bookingIdVal ?? "").trim();
          const bookingStatus = String(bookingStatusVal ?? "").trim();

          const currency = (String(currencyVal ?? "INR").trim() || "INR").toUpperCase();

          let amount = 0;
          if (amountVal != null && String(amountVal).trim() !== "") {
            const cleaned = String(amountVal).replace(/[₹,]/g, "").trim();
            const n = Number(cleaned);
            amount = isNaN(n) ? 0 : n;
          }

          return {
            date: d,
            service,
            amount,
            currency,
            destination,
            traveller,
            travellerEmail,
            department,
            costCenter,
            tripType,
            policyStatus,
            bookingChannel,
            vendor,
            bookingId,
            bookingStatus,
            raw: r,
          };
        })
        .filter((x: Row) => x.date || x.amount || (x.service && x.service !== "Unknown"));

      setRows(model);

      // Default service selection = all canonical services that exist OR always show all canon services
      const seen = new Set(model.map((x) => x.service));
      const defaults = [
        ...CANON_SERVICES.filter((s) => seen.has(s)),
        ...Array.from(seen).filter((s) => !CANON_SERVICES.includes(s as any)),
      ];
      const uniq = Array.from(new Set(defaults)).filter(Boolean);
      setSelectedServices((prev) => (prev.length ? prev : uniq.length ? uniq : [...CANON_SERVICES]));
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (csvUrl) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply preset -> update custom date fields
  useEffect(() => {
    const r = computeRange(preset);
    if (preset !== "custom" && r.s && r.e) {
      setFrom(ymd(r.s));
      setTo(ymd(r.e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const allServices = useMemo(() => {
    const extras = Array.from(new Set(rows.map((x) => x.service))).filter(
      (s) => s && !CANON_SERVICES.includes(s as any),
    );
    return [...CANON_SERVICES, ...extras].filter(Boolean);
  }, [rows]);

  const filtered = useMemo(() => {
    const r = computeRange(preset);
    const s = r.s ? r.s.getTime() : null;
    const e = r.e ? r.e.getTime() : null;

    const q = searchText.trim().toLowerCase();
    const selectedSet = new Set(selectedServices.length ? selectedServices : allServices);

    return rows.filter((x: Row) => {
      // date filter
      if (s != null || e != null) {
        const t = x.date ? x.date.getTime() : null;
        if (t == null) return false;
        if (s != null && t < s) return false;
        if (e != null && t > e) return false;
      }

      // service filter
      if (selectedServices.length && !selectedSet.has(x.service)) return false;

      // confirmed toggle
      if (showOnlyConfirmed) {
        const st = (x.bookingStatus || "").toLowerCase();
        if (!(st.includes("confirm") || st === "confirmed" || st === "success")) return false;
      }

      // search filter
      if (q) {
        const blob = `${x.service} ${x.destination} ${x.traveller} ${x.travellerEmail} ${x.vendor} ${x.bookingId} ${x.department} ${x.bookingChannel}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [rows, preset, from, to, selectedServices, searchText, showOnlyConfirmed, allServices]);

  // KPIs
  const kpis = useMemo(() => {
    const spend = filtered.reduce((a: number, b: Row) => a + (b.amount || 0), 0);
    const trips = filtered.length;
    const travellers = new Set(
      filtered.map((x: Row) => (x.travellerEmail || x.traveller || "").trim()).filter(Boolean),
    ).size;
    const destinations = new Set(filtered.map((x: Row) => x.destination).filter((d) => d && d !== "—")).size;
    const avg = trips ? spend / trips : 0;
    return { spend, trips, travellers, destinations, avg };
  }, [filtered]);

  // Service tiles (always show canonical 7)
  const serviceTiles = useMemo(() => {
    const bySvc = new Map<string, { spend: number; trips: number }>();
    for (const s of CANON_SERVICES) bySvc.set(s, { spend: 0, trips: 0 });

    filtered.forEach((x) => {
      const key = CANON_SERVICES.includes(x.service as any) ? x.service : x.service;
      if (!bySvc.has(key)) bySvc.set(key, { spend: 0, trips: 0 });
      const o = bySvc.get(key)!;
      o.spend += x.amount || 0;
      o.trips += 1;
    });

    return [...CANON_SERVICES].map((s) => ({
      name: s,
      spend: bySvc.get(s)?.spend || 0,
      trips: bySvc.get(s)?.trips || 0,
      color: theme.serviceColors[s] || theme.accent,
      enabled: (selectedServices.length ? selectedServices : allServices).includes(s),
    }));
  }, [filtered, theme.serviceColors, selectedServices, allServices]);

  // Charts data (ensure pie shows ALL canonical services, even if 0)
  const spendByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of CANON_SERVICES) map.set(s, 0);

    filtered.forEach((x: Row) => {
      const k = CANON_SERVICES.includes(x.service as any) ? x.service : x.service;
      map.set(k, (map.get(k) || 0) + (x.amount || 0));
    });

    // keep canonical order, then extras
    const extras = Array.from(map.entries())
      .filter(([k]) => !CANON_SERVICES.includes(k as any) && k && k !== "Unknown")
      .map(([name, value]) => ({ name, value }));

    const canon = CANON_SERVICES.map((name) => ({ name, value: map.get(name) || 0 }));

    return [...canon, ...extras];
  }, [filtered]);

  const spendByDay = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((x: Row) => {
      if (!x.date) return;
      const key = ymd(x.date);
      map.set(key, (map.get(key) || 0) + (x.amount || 0));
    });
    return Array.from(map.entries())
      .map(([date, spend]) => ({ date, spend }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const topDestinations = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((x: Row) => map.set(x.destination, (map.get(x.destination) || 0) + (x.amount || 0)));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.name && x.name !== "—")
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // Export: CSV & XLSX (filtered)
  function exportCSV() {
    const exportRows = filtered.map((r: Row) => r.raw);
    const csv = (Papa as any).unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `travel_dashboard_${from || "from"}_${to || "to"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportXLSX() {
    const exportRows = filtered.map((r: Row) => r.raw);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `travel_dashboard_${from || "from"}_${to || "to"}.xlsx`);
  }

  const titleRange = useMemo(() => {
    if (!from || !to) return "Selected period";
    return `${from} → ${to}`;
  }, [from, to]);

  const showPointLabels = spendByDay.length > 0 && spendByDay.length <= 14;

  const containerTextClass = theme.isLight ? "text-slate-900" : "text-white";

  return (
    <div className={`min-h-[calc(100vh-64px)] ${containerTextClass}`} style={{ background: theme.background }}>
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: theme.glowA }} />
        <div className="absolute -right-40 top-10 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: theme.glowB }} />
        <div className="absolute left-1/3 bottom-[-140px] h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: theme.glowC }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">Travel Spend &amp; Usage</h1>
              <span
                className="rounded-full px-2.5 py-1 text-[11px]"
                style={{
                  background: theme.isLight ? "rgba(0,71,127,.10)" : "rgba(255,255,255,.10)",
                  border: `1px solid ${theme.isLight ? "rgba(0,71,127,.18)" : "rgba(255,255,255,.14)"}`,
                  color: theme.isLight ? "rgba(0,71,127,1)" : "rgba(255,255,255,.85)",
                }}
              >
                Theme Studio
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: theme.mutedText }}>
              Executive view across Flights, Hotels, Visa, Cabs, Forex, eSIM &amp; Holidays — driven by your sheet today,
              bookings API next.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: theme.softText }}>
              <span
                className="rounded-full px-3 py-1"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.isLight ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.06)" }}
              >
                Source: Google Sheet (CSV)
              </span>
              <span
                className="rounded-full px-3 py-1"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.isLight ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.06)" }}
              >
                Range: {titleRange}
              </span>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-full px-3 py-1 text-white disabled:opacity-60"
                style={{
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.isLight ? theme.primary : "rgba(255,255,255,.10)",
                  color: theme.isLight ? "#fff" : "rgba(255,255,255,.95)",
                }}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              {error && (
                <span
                  className="rounded-full px-3 py-1"
                  style={{
                    border: `1px solid ${theme.isLight ? "rgba(239,68,68,.35)" : "rgba(239,68,68,.30)"}`,
                    background: theme.isLight ? "rgba(239,68,68,.08)" : "rgba(239,68,68,.10)",
                    color: theme.isLight ? "rgba(160,30,30,1)" : "rgba(254,202,202,1)",
                  }}
                >
                  {error}
                </span>
              )}
            </div>

            {/* Theme chooser */}
            <div className="mt-3 flex flex-wrap gap-2">
              {THEMES.map((t) => {
                const active = t.key === themeKey;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setThemeKey(t.key)}
                    className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs transition"
                    style={{
                      border: `1px solid ${active ? (t.isLight ? "rgba(0,71,127,.25)" : "rgba(255,255,255,.22)") : t.panelBorder}`,
                      background: active ? (t.isLight ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.10)") : t.panelBg,
                      boxShadow: active ? "0 10px 30px rgba(0,0,0,.10)" : "none",
                      color: t.isLight ? "rgba(12,18,28,.92)" : "rgba(255,255,255,.86)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: t.chip }} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Segment value={preset} onChange={setPreset} theme={theme} />

              {/* Date range */}
              <div
                className="flex items-center gap-2 rounded-2xl px-3 py-2"
                style={{
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panelBg,
                  opacity: preset !== "custom" ? 0.85 : 1,
                  backdropFilter: "blur(10px)",
                }}
              >
                <span className="text-xs" style={{ color: theme.softText }}>
                  From
                </span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPreset("custom");
                    setFrom(e.target.value);
                  }}
                  className="rounded-lg px-2 py-1 text-xs outline-none"
                  style={{
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.isLight ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.25)",
                    color: theme.text,
                  }}
                />
                <span className="text-xs" style={{ color: theme.softText }}>
                  To
                </span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPreset("custom");
                    setTo(e.target.value);
                  }}
                  className="rounded-lg px-2 py-1 text-xs outline-none"
                  style={{
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.isLight ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.25)",
                    color: theme.text,
                  }}
                />
              </div>

              {/* Services dropdown */}
              <div ref={servicePanelRef} className="relative">
                <button
                  type="button"
                  onClick={() => setServiceOpen((v) => !v)}
                  className="rounded-2xl px-3 py-2 text-xs"
                  style={{
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelBg,
                    color: theme.mutedText,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  Services ({(selectedServices.length ? selectedServices : allServices).length})
                </button>

                {serviceOpen && (
                  <div
                    className="absolute right-0 z-30 mt-2 w-[360px] rounded-3xl p-3 shadow-2xl"
                    style={{
                      border: `1px solid ${theme.panelBorder}`,
                      background: theme.isLight ? "rgba(255,255,255,.96)" : "rgba(10,16,32,.94)",
                      backdropFilter: "blur(14px)",
                      color: theme.text,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">Filter Services</div>
                      <div className="flex gap-2">
                        <button
                          className="text-[11px] underline-offset-2 hover:underline"
                          style={{ color: theme.softText }}
                          onClick={() => setSelectedServices(allServices)}
                          type="button"
                        >
                          Select all
                        </button>
                        <button
                          className="text-[11px] underline-offset-2 hover:underline"
                          style={{ color: theme.softText }}
                          onClick={() => setSelectedServices([])}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div
                      className="mt-2 max-h-[280px] overflow-auto rounded-2xl p-2"
                      style={{
                        border: `1px solid ${theme.isLight ? "rgba(10,20,30,.10)" : "rgba(255,255,255,.10)"}`,
                        background: theme.isLight ? "rgba(10,20,30,.03)" : "rgba(0,0,0,.20)",
                      }}
                    >
                      {allServices.map((s: string) => {
                        const checked = (selectedServices.length ? selectedServices : allServices).includes(s);
                        const dot = theme.serviceColors[s] || theme.accent;
                        return (
                          <label
                            key={s}
                            className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5"
                            style={{ background: "transparent" }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedServices((prev) => {
                                  const base = prev.length ? prev : allServices;
                                  return base.includes(s) ? base.filter((x) => x !== s) : [...base, s];
                                });
                              }}
                            />
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
                            <span className="text-xs" style={{ color: theme.mutedText }}>
                              {s}
                            </span>
                          </label>
                        );
                      })}
                      {!allServices.length && (
                        <div className="p-2 text-xs" style={{ color: theme.softText }}>
                          No services found in sheet.
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-[11px]" style={{ color: theme.softText }}>
                      Tip: If a service shows ₹0, it means there are no rows for that service in the selected date range.
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={exportCSV}
                className="rounded-2xl px-3 py-2 text-xs"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.mutedText }}
              >
                Download CSV
              </button>
              <button
                onClick={exportXLSX}
                className="rounded-2xl px-3 py-2 text-xs"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.mutedText }}
              >
                Download Excel
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search traveller, email, vendor, destination, booking ID…"
                className="w-[360px] rounded-2xl px-3 py-2 text-xs outline-none"
                style={{
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panelBg,
                  color: theme.text,
                }}
              />
              <label
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.mutedText }}
              >
                <input type="checkbox" checked={showOnlyConfirmed} onChange={(e) => setShowOnlyConfirmed(e.target.checked)} />
                Confirmed only
              </label>
              <label
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
                style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.mutedText }}
              >
                <input type="checkbox" checked={showAdvancedCols} onChange={(e) => setShowAdvancedCols(e.target.checked)} />
                Advanced columns
              </label>
            </div>
          </div>
        </div>

        {/* Data source bar */}
        <GlassCard theme={theme} className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold" style={{ color: theme.mutedText }}>
                DATA SOURCE
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
                Google Sheet publish link (CSV)
              </div>
              <div className="mt-1 text-[11px]" style={{ color: theme.softText }}>
                Use: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>…/pub?gid=0&amp;single=true&amp;output=csv</span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 md:max-w-[720px]">
              <div className="flex gap-2">
                <input
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder='Paste CSV link (output=csv) then "Save & Load"'
                  className="w-full rounded-2xl px-3 py-2 text-xs outline-none"
                  style={{
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.isLight ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.20)",
                    color: theme.text,
                  }}
                />
                <button
                  onClick={() => {
                    saveAndLoad();
                    setTimeout(() => load(), 0);
                  }}
                  className="rounded-2xl px-3 py-2 text-xs"
                  style={{
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.isLight ? theme.primary : "rgba(255,255,255,.12)",
                    color: theme.isLight ? "#fff" : theme.text,
                    whiteSpace: "nowrap",
                  }}
                >
                  Save &amp; Load
                </button>
                <button
                  onClick={clearCsv}
                  className="rounded-2xl px-3 py-2 text-xs"
                  style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, color: theme.mutedText }}
                >
                  Clear
                </button>
              </div>

              <div className="text-[11px]" style={{ color: theme.softText }}>
                If you see only one service, it usually means your sheet has only that service inside the selected date range.
              </div>
            </div>
          </div>
        </GlassCard>

        {/* KPI Row */}
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <KPI theme={theme} title="Total Spend" value={fmtINR(kpis.spend)} sub="Filtered period spend" dotColor={theme.primary} />
          <KPI theme={theme} title="Trips" value={String(kpis.trips)} sub="Rows matching filter" dotColor={theme.accent} />
          <KPI theme={theme} title="Travellers" value={String(kpis.travellers)} sub="Unique travellers" dotColor={theme.serviceColors.Hotels} />
          <KPI theme={theme} title="Avg Ticket" value={fmtINR(kpis.avg)} sub="Spend per trip" dotColor={theme.serviceColors.Flights} />
        </div>

        {/* Service tiles (always show 7) */}
        <div className="mt-3 grid gap-3 md:grid-cols-7">
          {serviceTiles.map((t) => {
            const enabled = (selectedServices.length ? selectedServices : allServices).includes(t.name);
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  setSelectedServices((prev) => {
                    const base = prev.length ? prev : allServices;
                    const has = base.includes(t.name);
                    if (has) return base.filter((x) => x !== t.name);
                    return [...base, t.name];
                  });
                }}
                className="text-left transition"
                style={{ background: "transparent" }}
                title="Click to include / exclude this service"
              >
                <GlassCard theme={theme} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold" style={{ color: theme.mutedText }}>
                      {t.name}
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        border: `1px solid ${theme.panelBorder}`,
                        background: enabled ? (theme.isLight ? "rgba(0,194,168,.12)" : "rgba(0,194,168,.10)") : theme.panelBg,
                        color: enabled ? (theme.isLight ? "rgba(0,120,94,1)" : "rgba(167,255,231,1)") : theme.softText,
                      }}
                    >
                      {enabled ? "On" : "Off"}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-semibold" style={{ color: theme.text }}>
                    {fmtINR(t.spend)}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: theme.softText }}>
                    {t.trips} trip{t.trips === 1 ? "" : "s"} (filtered)
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: theme.isLight ? "rgba(10,20,30,.08)" : "rgba(255,255,255,.08)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: enabled ? "100%" : "30%", background: t.color }} />
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
          {/* Trend */}
          <GlassCard theme={theme} className="lg:col-span-7">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs tracking-[0.25em]" style={{ color: theme.softText }}>
                  SPEND TREND
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
                  Spend over time
                </div>
              </div>
              <div className="text-xs" style={{ color: theme.softText }}>
                {titleRange}
              </div>
            </div>

            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.gridStroke} />
                  <XAxis dataKey="date" tick={{ fill: theme.axisText, fontSize: 11 }} />
                  <YAxis tick={{ fill: theme.axisText, fontSize: 11 }} tickFormatter={(v) => fmtCompactINR(Number(v) || 0)} />
                  <Tooltip
                    formatter={(v: any) => fmtINR(Number(v) || 0)}
                    contentStyle={{
                      background: theme.tooltipBg,
                      border: `1px solid ${theme.tooltipBorder}`,
                      color: theme.text,
                      borderRadius: 14,
                    }}
                    labelStyle={{ color: theme.mutedText }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke={theme.primary}
                    strokeWidth={2}
                    fill={theme.primary}
                    fillOpacity={theme.isLight ? 0.12 : 0.18}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 5 }}
                  >
                    {showPointLabels && (
                      <LabelList dataKey="spend" position="top" formatter={(v: any) => fmtCompactINR(Number(v) || 0)} fill={theme.axisText} />
                    )}
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Spend mix */}
          <GlassCard theme={theme} className="lg:col-span-5">
            <div className="text-xs tracking-[0.25em]" style={{ color: theme.softText }}>
              SERVICES
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
              Spend mix
            </div>
            <div className="mt-1 text-[11px]" style={{ color: theme.softText }}>
              Each slice uses a distinct service color (not a single color).
            </div>

            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(v: any, _n: any, p: any) => {
                      const name = p?.payload?.name || "";
                      return [`${fmtINR(Number(v) || 0)}`, name];
                    }}
                    contentStyle={{
                      background: theme.tooltipBg,
                      border: `1px solid ${theme.tooltipBorder}`,
                      color: theme.text,
                      borderRadius: 14,
                    }}
                  />
                  <Legend wrapperStyle={{ color: theme.mutedText, fontSize: 11 }} />
                  <Pie
                    data={spendByService}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={98}
                    innerRadius={58}
                    paddingAngle={2}
                    labelLine={false}
                    label={({ name, value }: any) => (Number(value) > 0 ? `${name}: ${fmtCompactINR(Number(value) || 0)}` : "")}
                  >
                    {spendByService.map((entry: any, idx: number) => {
                      const color = theme.serviceColors[entry.name] || paletteFallback(idx);
                      return <Cell key={`cell-${idx}`} fill={color} />;
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Top destinations */}
          <GlassCard theme={theme} className="lg:col-span-6">
            <div className="text-xs tracking-[0.25em]" style={{ color: theme.softText }}>
              DESTINATIONS
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
              Top destinations (by spend)
            </div>

            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDestinations}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.gridStroke} />
                  <XAxis dataKey="name" tick={{ fill: theme.axisText, fontSize: 11 }} />
                  <YAxis tick={{ fill: theme.axisText, fontSize: 11 }} tickFormatter={(v) => fmtCompactINR(Number(v) || 0)} />
                  <Tooltip
                    formatter={(v: any) => fmtINR(Number(v) || 0)}
                    contentStyle={{
                      background: theme.tooltipBg,
                      border: `1px solid ${theme.tooltipBorder}`,
                      color: theme.text,
                      borderRadius: 14,
                    }}
                  />
                  <Bar dataKey="value" fill={theme.accent} radius={[10, 10, 0, 0]}>
                    <LabelList dataKey="value" position="top" formatter={(v: any) => fmtCompactINR(Number(v) || 0)} fill={theme.axisText} />
                    {topDestinations.map((_e: any, idx: number) => (
                      <Cell key={`bar-${idx}`} fill={idx % 2 === 0 ? theme.accent : theme.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Table */}
          <GlassCard theme={theme} className="lg:col-span-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs tracking-[0.25em]" style={{ color: theme.softText }}>
                  DETAILS
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
                  Trips (filtered)
                </div>
              </div>
              <div className="text-xs" style={{ color: theme.softText }}>
                {filtered.length} rows
              </div>
            </div>

            <div
              className="mt-3 max-h-[300px] overflow-auto rounded-2xl"
              style={{
                border: `1px solid ${theme.panelBorder}`,
                background: theme.isLight ? "rgba(10,20,30,.03)" : "rgba(0,0,0,.18)",
              }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="sticky top-0"
                  style={{
                    background: theme.isLight ? "rgba(255,255,255,.95)" : "rgba(10,16,32,.92)",
                    color: theme.mutedText,
                    borderBottom: `1px solid ${theme.panelBorder}`,
                  }}
                >
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Traveller</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    {showAdvancedCols && (
                      <>
                        <th className="px-3 py-2">Policy</th>
                        <th className="px-3 py-2">Channel</th>
                        <th className="px-3 py-2">Vendor</th>
                        <th className="px-3 py-2">Booking ID</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody style={{ color: theme.mutedText }}>
                  {filtered.slice(0, 200).map((r: Row, idx: number) => (
                    <tr key={idx} style={{ borderTop: `1px solid ${theme.isLight ? "rgba(10,20,30,.06)" : "rgba(255,255,255,.06)"}` }}>
                      <td className="px-3 py-2">{r.date ? ymd(r.date) : "—"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.serviceColors[r.service] || theme.accent }} />
                          {r.service}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span>{r.traveller || "—"}</span>
                          {r.travellerEmail && (
                            <span className="text-[11px]" style={{ color: theme.softText }}>
                              {r.travellerEmail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.destination}</td>
                      <td className="px-3 py-2 text-right">{fmtINR(r.amount || 0)}</td>

                      {showAdvancedCols && (
                        <>
                          <td className="px-3 py-2">{r.policyStatus || "—"}</td>
                          <td className="px-3 py-2">{r.bookingChannel || "—"}</td>
                          <td className="px-3 py-2">{r.vendor || "—"}</td>
                          <td className="px-3 py-2">{r.bookingId || "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td className="px-3 py-4" style={{ color: theme.softText }} colSpan={showAdvancedCols ? 9 : 5}>
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-[11px]" style={{ color: theme.softText }}>
              Showing first 200 rows. Downloads export the full filtered set.
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------
  UI Components
--------------------------------------------- */

function Segment({
  value,
  onChange,
  theme,
}: {
  value: Preset;
  onChange: (v: Preset) => void;
  theme: Theme;
}) {
  const items: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" },
    { key: "all", label: "All time" },
    { key: "custom", label: "Date range" },
  ];

  return (
    <div
      className="flex items-center gap-2 rounded-2xl p-1"
      style={{ border: `1px solid ${theme.panelBorder}`, background: theme.panelBg, backdropFilter: "blur(10px)" }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className="rounded-2xl px-3 py-2 text-xs transition"
            style={{
              background: active ? theme.primary : "transparent",
              color: active ? "#fff" : theme.mutedText,
              boxShadow: active ? "0 0 0 2px rgba(0,0,0,.10) inset" : "none",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function GlassCard({ children, className = "", theme }: { children: React.ReactNode; className?: string; theme: Theme }) {
  return (
    <div
      className={`rounded-[28px] p-4 ${className}`}
      style={{
        border: `1px solid ${theme.panelBorder}`,
        background: theme.panelBg,
        boxShadow: theme.isLight ? "0 10px 30px rgba(0,0,0,.08)" : "0 10px 30px rgba(0,0,0,.35)",
        backdropFilter: "blur(14px)",
      }}
    >
      {children}
    </div>
  );
}

function KPI({
  title,
  value,
  sub,
  dotColor,
  theme,
}: {
  title: string;
  value: string;
  sub: string;
  dotColor: string;
  theme: Theme;
}) {
  return (
    <div
      className="rounded-[26px] p-4"
      style={{
        border: `1px solid ${theme.panelBorder}`,
        background: theme.panelBg,
        boxShadow: theme.isLight ? "0 10px 30px rgba(0,0,0,.08)" : "0 10px 30px rgba(0,0,0,.35)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs tracking-[0.25em]" style={{ color: theme.softText }}>
          {title.toUpperCase()}
        </div>
        <div className="h-8 w-8 rounded-2xl" style={{ background: dotColor }} />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: theme.text }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.softText }}>
        {sub}
      </div>
    </div>
  );
}

/* ---------------------------------------------
  LocalStorage helpers (safe)
--------------------------------------------- */
function safeGetLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/* ---------------------------------------------
  Fallback palette for unknown services
--------------------------------------------- */
function paletteFallback(i: number) {
  const arr = ["#2D7DFF", "#00C2A8", "#d06549", "#7C5CFF", "#FFB020", "#00A3FF", "#FF4D8D", "#1FA2FF", "#22C55E", "#F59E0B"];
  return arr[i % arr.length];
}
