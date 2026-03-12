import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { hasAnyRole, AnyUser } from "../../lib/rbac";

/* =========================================================
 * Helpers
 * ======================================================= */
function unwrap(res: any) {
  return res?.data ?? res;
}
function extractErr(e: any): string {
  const msg =
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Failed";
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}
function normStr(v: any) {
  return String(v ?? "").trim();
}
function fmtINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
function fmtDate(v: any): string {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* =========================================================
 * SVG Icons (inline to avoid extra deps)
 * ======================================================= */
function IconPlane({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
    </svg>
  );
}
function IconHotel({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}
function IconWallet({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}
function IconXCircle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}
function IconAlert({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
function IconSearch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconInbox({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

type BookingType = "all" | "flights" | "hotels";

type BizOption = { id: string; name: string };

type FlightRow = {
  _id: string;
  bookingId: string;
  pnr: string;
  origin: { code: string; city: string };
  destination: { code: string; city: string };
  airlineName: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  passengers: { title: string; firstName: string; lastName: string; paxType: string; isLead: boolean }[];
  baseFare: number;
  taxes: number;
  extras: number;
  totalFare: number;
  currency: string;
  status: string;
  bookedAt: string;
  customerId?: string;
  contactEmail?: string;
  contactPhone?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  _user: { name: string; email: string };
};

type HotelRow = {
  _id: string;
  bookingId: string;
  confirmationNo: string;
  hotelName: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: { Title: string; FirstName: string; LastName: string; LeadPassenger: boolean }[];
  roomName: string;
  mealType: string;
  totalFare: number;
  netAmount: number;
  currency: string;
  isRefundable: boolean;
  status: string;
  bookedAt: string;
  customerId?: string;
  paymentId?: string;
  razorpayOrderId?: string;
  _user: { name: string; email: string };
};

type Summary = {
  totalFlightBookings: number;
  totalHotelBookings: number;
  totalFlightSpend: number;
  totalHotelSpend: number;
  totalSpend: number;
  cancelledCount: number;
  failedCount: number;
  topBookers: { name: string; email: string; count: number; amount: number }[];
};

type StatusFilter = "" | "CONFIRMED" | "CANCELLED" | "FAILED" | "PENDING";

/* =========================================================
 * Component
 * ======================================================= */
export default function AdminBilling() {
  const { user } = useAuth();
  const isAdminUser = hasAnyRole(user as AnyUser, ["Admin", "SuperAdmin", "HR"]);

  // Filters
  const [type, setType] = useState<BookingType>("all");
  const [customerId, setCustomerId] = useState("");
  const [bizName, setBizName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

  // Business search
  const [bizQ, setBizQ] = useState("");
  const [bizSearching, setBizSearching] = useState(false);
  const [bizOptions, setBizOptions] = useState<BizOption[]>([]);

  // Data
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [totalFlights, setTotalFlights] = useState(0);
  const [totalHotels, setTotalHotels] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Summary
  const [summary, setSummary] = useState<Summary | null>(null);

  // Detail drawer
  const [detail, setDetail] = useState<{ type: "flight" | "hotel"; data: any } | null>(null);

  /* ---------- Business search ---------- */
  async function searchBiz() {
    const qq = normStr(bizQ);
    if (qq.length < 2) { setBizOptions([]); return; }
    setBizSearching(true);
    try {
      const res = unwrap(await api.get(`/customer/users/workspace/search?q=${encodeURIComponent(qq)}`));
      const rows: any[] = Array.isArray(res?.rows) ? res.rows : [];
      setBizOptions(
        rows
          .map((r: any) => {
            const id = String(r?.id || r?._id || "").trim();
            const name = normStr(r?.name || r?.companyName || r?.businessName || id);
            return id ? { id, name } : null;
          })
          .filter(Boolean) as BizOption[]
      );
    } catch {
      setBizOptions([]);
    } finally {
      setBizSearching(false);
    }
  }

  /* ---------- Fetch bookings ---------- */
  const fetchBookings = useCallback(async (pg: number) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set("type", type);
      params.set("page", String(pg));
      params.set("limit", "50");
      if (customerId) params.set("customerId", customerId);
      if (status) params.set("status", status);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = unwrap(await api.get(`/admin/billing/bookings?${params}`));
      setFlights(res.flights || []);
      setHotels(res.hotels || []);
      setTotalFlights(res.totalFlights || 0);
      setTotalHotels(res.totalHotels || 0);
      setTotalAmount(res.totalAmount || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (e: any) {
      setErr(extractErr(e));
    } finally {
      setLoading(false);
    }
  }, [type, customerId, status, dateFrom, dateTo]);

  /* ---------- Fetch summary ---------- */
  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerId) params.set("customerId", customerId);
      if (status) params.set("status", status);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = unwrap(await api.get(`/admin/billing/summary?${params}`));
      setSummary(res);
    } catch {
      // silent
    }
  }, [customerId, status, dateFrom, dateTo]);

  /* ---------- Apply ---------- */
  function onApply() {
    setPage(1);
    fetchBookings(1);
    fetchSummary();
  }

  // initial load
  useEffect(() => {
    fetchBookings(1);
    fetchSummary();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Export ---------- */
  async function onExport() {
    try {
      const params = new URLSearchParams();
      params.set("type", type);
      if (customerId) params.set("customerId", customerId);
      if (status) params.set("status", status);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const token = localStorage.getItem("jwt") || localStorage.getItem("hrms_accessToken") || "";
      const url = `${api.BASE}/admin/billing/bookings/export.csv?${params}`;
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `billing-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setErr(extractErr(e));
    }
  }

  /* ---------- Clear ---------- */
  function onClear() {
    setType("all");
    setStatus("");
    setCustomerId("");
    setBizName("");
    setBizQ("");
    setDateFrom("");
    setDateTo("");
    setBizOptions([]);
    setPage(1);
    fetchBookings(1);
    fetchSummary();
  }

  /* ---------- Merged table rows ---------- */
  const tableRows = useMemo(() => {
    const fRows = flights.map((f) => ({ kind: "flight" as const, id: f._id, bookingId: f.bookingId, user: f._user, customerId: f.customerId || "", route: `${f.origin?.city || f.origin?.code} → ${f.destination?.city || f.destination?.code}`, bookedAt: f.bookedAt, amount: f.totalFare, status: f.status, raw: f }));
    const hRows = hotels.map((h) => ({ kind: "hotel" as const, id: h._id, bookingId: h.bookingId, user: h._user, customerId: h.customerId || "", route: h.hotelName || h.cityName, bookedAt: h.bookedAt, amount: h.totalFare, status: h.status, raw: h }));
    return [...fRows, ...hRows];
  }, [flights, hotels]);

  /* ---------- Status pill ---------- */
  function statusPill(s: string) {
    const st = (s || "").toUpperCase();
    const cls =
      st === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
      st === "CANCELLED" ? "border-amber-200 bg-amber-50 text-amber-700" :
      st === "FAILED" ? "border-red-200 bg-red-50 text-red-700" :
      st === "PENDING" ? "border-gray-200 bg-gray-50 text-gray-500" :
      "border-gray-200 bg-gray-50 text-gray-600";
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{st || "PENDING"}</span>;
  }

  /* =========================================================
   * Render
   * ======================================================= */
  const summaryCards: { label: string; value: string; sub: string; icon: React.ReactNode; border: string; valueColor: string }[] = summary
    ? [
        { label: "Flight Bookings", value: `${summary.totalFlightBookings}`, sub: fmtINR(summary.totalFlightSpend), icon: <IconPlane className="w-5 h-5 text-[#00477f]" />, border: "border-l-[#00477f]", valueColor: "text-gray-900" },
        { label: "Hotel Bookings", value: `${summary.totalHotelBookings}`, sub: fmtINR(summary.totalHotelSpend), icon: <IconHotel className="w-5 h-5 text-sky-700" />, border: "border-l-sky-700", valueColor: "text-gray-900" },
        { label: "Total Spend", value: fmtINR(summary.totalSpend), sub: `${summary.totalFlightBookings + summary.totalHotelBookings} bookings`, icon: <IconWallet className="w-5 h-5 text-[#00477f]" />, border: "border-l-[#00477f]", valueColor: "text-[#00477f]" },
        { label: "Cancelled", value: `${summary.cancelledCount}`, sub: "across all types", icon: <IconXCircle className="w-5 h-5 text-amber-500" />, border: "border-l-amber-400", valueColor: "text-amber-600" },
        { label: "Failed", value: `${summary.failedCount ?? 0}`, sub: "booking failures", icon: <IconAlert className="w-5 h-5 text-red-500" />, border: "border-l-red-500", valueColor: "text-red-600" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-5 border-b border-gray-200">
          <div>
            <h1 className="text-[28px] font-black text-gray-900 tracking-tight">
              {isAdminUser ? "Billing Console" : "My Company Bookings"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isAdminUser
                ? "All SBT bookings across flight and hotel \u2014 by company or date range."
                : "Your company\u2019s flight and hotel bookings."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdminUser && (
              <span className="inline-flex items-center rounded-full bg-[#00477f] px-3 py-1 text-[11px] font-bold tracking-wider text-white">
                Admin Only
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
              {totalFlights + totalHotels} bookings
            </span>
          </div>
        </div>

        {/* ── SUMMARY CARDS ── */}
        {summary && (
          <div className="grid grid-cols-5 gap-4">
            {summaryCards.map((c) => (
              <div
                key={c.label}
                className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${c.border} shadow-sm p-5 hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">{c.label}</span>
                  <span className="inline-flex rounded-lg p-2 bg-gray-50">{c.icon}</span>
                </div>
                <div className={`text-4xl font-black ${c.valueColor}`}>{c.value}</div>
                <div className="mt-1 text-sm font-medium text-gray-400">{c.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {/* ROW 1 — Filters */}
          <div className="flex items-end gap-3">

            {/* Company search — admin only */}
            {isAdminUser && (
            <div className="relative flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Company</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <IconSearch className="w-4 h-4" />
                </span>
                <input
                  value={bizQ}
                  onChange={(e) => setBizQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchBiz()}
                  placeholder="Search business..."
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#00477f] focus:ring-2 focus:ring-[#00477f]/20"
                />
              </div>
              {bizName && (
                <div className="mt-1 flex items-center gap-1 text-xs text-[#00477f] font-semibold">
                  {bizName}
                  <button type="button" onClick={() => { setCustomerId(""); setBizName(""); }} className="text-gray-400 hover:text-gray-600 ml-0.5">&times;</button>
                </div>
              )}
              {bizOptions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {bizOptions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      onClick={() => { setCustomerId(b.id); setBizName(b.name); setBizOptions([]); }}
                    >
                      <div className="font-medium text-gray-900">{b.name}</div>
                      <div className="text-gray-400 font-mono text-[10px]">{b.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Type segmented control */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
              <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1">
                {(["all", "flights", "hotels"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      type === t
                        ? "bg-white shadow-sm text-[#00477f] font-semibold"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t === "all" ? "All" : t === "flights" ? "Flights" : "Hotels"}
                  </button>
                ))}
              </div>
            </div>

            {/* Status dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-900 outline-none focus:border-[#00477f] focus:ring-2 focus:ring-[#00477f]/20"
              >
                <option value="">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#00477f] focus:ring-2 focus:ring-[#00477f]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#00477f] focus:ring-2 focus:ring-[#00477f]/20" />
            </div>
          </div>

          {/* ROW 2 — Actions (right-aligned) */}
          <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={onApply} className="h-10 rounded-lg bg-[#00477f] px-5 text-sm font-medium text-white hover:bg-[#003a6b] transition-colors disabled:opacity-60">
              Apply
            </button>
            <button type="button" onClick={onExport} className="h-10 rounded-lg border border-[#00477f] px-4 text-sm font-medium text-[#00477f] hover:bg-[#00477f] hover:text-white transition-colors">
              Export CSV
            </button>
            <button type="button" onClick={onClear} className="h-10 px-2 text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 cursor-pointer">
              Clear
            </button>
          </div>
        </div>

        {/* ── ERROR ── */}
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

        {/* ── BOOKINGS TABLE ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booking ID</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Route / Hotel</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Booked On</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {/* Loading skeleton */}
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3 rounded-md bg-gray-200" style={{ width: j === 6 ? 56 : j === 0 ? 48 : 72 }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Empty state */}
                {!loading && tableRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20">
                      <div className="flex flex-col items-center justify-center">
                        <IconInbox className="w-16 h-16 text-gray-300" />
                        <div className="mt-4 text-gray-500 font-medium">No bookings found</div>
                        <div className="mt-1 text-gray-400 text-sm">Try adjusting your filters</div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {!loading && tableRows.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : "bg-white"}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${r.kind === "flight" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700"}`}>
                        {r.kind === "flight" ? "Flight" : "Hotel"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.bookingId || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-800">{r.user?.name || "-"}</div>
                      <div className="text-xs text-gray-400">{r.user?.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.customerId || <span className="text-gray-300">&mdash;</span>}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">{r.route || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(r.bookedAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">{fmtINR(r.amount || 0)}</td>
                    <td className="px-4 py-3 text-center">{statusPill(r.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetail({ type: r.kind, data: r.raw })}
                        className="text-[#00477f] text-sm font-medium hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-4 py-3">
              <button
                type="button"
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchBookings(p); }}
                disabled={page <= 1}
                className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span> of <span className="font-semibold text-gray-700">{totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchBookings(p); }}
                disabled={page >= totalPages}
                className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL DRAWER ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-center gap-2">
                {detail.type === "flight"
                  ? <IconPlane className="w-5 h-5 text-[#00477f]" />
                  : <IconHotel className="w-5 h-5 text-[#00477f]" />}
                <span className="text-lg font-semibold text-gray-900">
                  {detail.type === "flight" ? "Flight Booking" : "Hotel Booking"}
                </span>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-5">
              {detail.type === "flight" && <FlightDetail data={detail.data} />}
              {detail.type === "hotel" && <HotelDetail data={detail.data} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
 * Detail subcomponents
 * ======================================================= */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
      <span className="text-xs font-semibold text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}

function FlightDetail({ data }: { data: FlightRow }) {
  return (
    <>
      <DetailRow label="Booking ID" value={data.bookingId || "-"} />
      <DetailRow label="PNR" value={data.pnr || "-"} />
      <DetailRow label="Status" value={data.status} />
      <DetailRow label="Route" value={`${data.origin?.city} (${data.origin?.code}) \u2192 ${data.destination?.city} (${data.destination?.code})`} />
      <DetailRow label="Airline" value={`${data.airlineName} ${data.flightNumber}`} />
      <DetailRow label="Departure" value={fmtDate(data.departureTime)} />
      <DetailRow label="Arrival" value={fmtDate(data.arrivalTime)} />

      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-500 mb-1">Passengers</div>
        {(data.passengers || []).map((p, i) => (
          <div key={i} className="text-sm text-gray-900">
            {p.title} {p.firstName} {p.lastName}
            {p.isLead && <span className="ml-1 text-xs text-[#00477f] font-semibold">(Lead)</span>}
          </div>
        ))}
        {(!data.passengers || data.passengers.length === 0) && <div className="text-sm text-gray-400">-</div>}
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
        <div className="text-xs font-semibold text-gray-500 mb-1">Fare Breakdown</div>
        <DetailRow label="Base Fare" value={fmtINR(data.baseFare || 0)} />
        <DetailRow label="Taxes" value={fmtINR(data.taxes || 0)} />
        <DetailRow label="Extras" value={fmtINR(data.extras || 0)} />
        <DetailRow label="Total" value={<span className="font-semibold">{fmtINR(data.totalFare || 0)}</span>} />
      </div>

      <DetailRow label="Razorpay Payment ID" value={data.razorpayPaymentId || "-"} />
      <DetailRow label="Razorpay Order ID" value={data.razorpayOrderId || "-"} />
      <DetailRow label="Booked By" value={`${data._user?.name || "-"} (${data._user?.email || "-"})`} />
      <DetailRow label="Booked At" value={fmtDate(data.bookedAt)} />
      <DetailRow label="Customer ID" value={data.customerId || "-"} />
    </>
  );
}

function HotelDetail({ data }: { data: HotelRow }) {
  return (
    <>
      <DetailRow label="Booking ID" value={data.bookingId || "-"} />
      <DetailRow label="Confirmation No." value={data.confirmationNo || "-"} />
      <DetailRow label="Status" value={data.status} />
      <DetailRow label="Hotel" value={data.hotelName || "-"} />
      <DetailRow label="City" value={data.cityName || "-"} />
      <DetailRow label="Check-in" value={fmtDate(data.checkIn)} />
      <DetailRow label="Check-out" value={fmtDate(data.checkOut)} />
      <DetailRow label="Rooms" value={data.rooms || 1} />
      <DetailRow label="Room Type" value={data.roomName || "-"} />
      <DetailRow label="Meal Type" value={data.mealType || "-"} />
      <DetailRow label="Refundable" value={data.isRefundable ? "Yes" : "No"} />

      <div className="mt-3">
        <div className="text-xs font-semibold text-gray-500 mb-1">Guests</div>
        {(data.guests || []).map((g, i) => (
          <div key={i} className="text-sm text-gray-900">
            {g.Title} {g.FirstName} {g.LastName}
            {g.LeadPassenger && <span className="ml-1 text-xs text-[#00477f] font-semibold">(Lead)</span>}
          </div>
        ))}
        {(!data.guests || data.guests.length === 0) && <div className="text-sm text-gray-400">-</div>}
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
        <div className="text-xs font-semibold text-gray-500 mb-1">Fare</div>
        <DetailRow label="Total Fare" value={<span className="font-semibold">{fmtINR(data.totalFare || 0)}</span>} />
        <DetailRow label="Net Amount" value={fmtINR(data.netAmount || 0)} />
      </div>

      <DetailRow label="Razorpay Payment ID" value={data.paymentId || "-"} />
      <DetailRow label="Razorpay Order ID" value={data.razorpayOrderId || "-"} />
      <DetailRow label="Booked By" value={`${data._user?.name || "-"} (${data._user?.email || "-"})`} />
      <DetailRow label="Booked At" value={fmtDate(data.bookedAt)} />
      <DetailRow label="Customer ID" value={data.customerId || "-"} />
    </>
  );
}
