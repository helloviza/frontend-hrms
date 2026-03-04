// apps/frontend/src/components/vouchers/ResultView.tsx
import React, { useMemo, useRef, useState } from "react";
import type { PlumtripsVoucher, FlightSegment, LayoutType, Passenger } from "../../types/voucher";

import {
  Copy,
  Check,
  Code,
  Layout,
  Plane,
  Building2,
  Briefcase,
  Info,
  Globe,
  ShieldCheck,
  Download,
  Loader2,
  AlertCircle,
  ListChecks,
} from "lucide-react";
import Barcode from "react-barcode";
import Logo from "./Logo";

// Updated Props to support backend PDF downloading
interface ResultViewProps {
  data: PlumtripsVoucher;
  customLogo?: string | null;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeStr(x: any): string | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== "string") return String(x);
  const s = x.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "n/a" || lower === "-") return null;
  return s;
}

function segmentBarcode(segment: FlightSegment, pnr?: string | null) {
  const fromGemini = safeStr(segment?.ancillaries?.barcode_string);
  if (fromGemini) return fromGemini;

  const flightNo = safeStr(segment?.flight_no) ?? "";
  const p = safeStr(pnr) ?? "PLUM";
  // Safe fallback – scannable but not BCBP
  return `${p}${flightNo}`;
}

const FlightSegmentCard: React.FC<{
  segment: FlightSegment;
  pnr?: string | null;
  layout: LayoutType;
}> = ({ segment, pnr, layout }) => {
  const checkinBag = safeStr(segment?.ancillaries?.checkin_bag) ?? "15 KG";
  const cabinBag = safeStr(segment?.ancillaries?.cabin_bag) ?? "7 KG";
  const seat = safeStr(segment?.ancillaries?.seat);
  const barcodeVal = segmentBarcode(segment, pnr);

  return (
    <div
      className={cx(
        "bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row group animate-in fade-in slide-in-from-bottom-4 duration-700",
        layout === "SINGLE" && "ring-2 ring-[#004A8C]/5"
      )}
    >
      <div className="flex-grow p-6 md:p-8 flex flex-col justify-between">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#004A8C] text-white p-2 rounded-xl shadow-md">
              <Plane size={16} />
            </div>
            <div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">
                Carrier
              </span>
              <span className="text-sm font-black text-[#004A8C] uppercase">
                {safeStr(segment?.airline) ?? "Airline"} • {safeStr(segment?.flight_no) ?? "---"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">
              Service Class
            </span>
            <span className="text-[10px] font-black text-slate-900 uppercase">
              {safeStr(segment?.class) ?? "ECONOMY"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 items-center mb-6">
          <div className="col-span-4">
            <h3 className="text-3xl md:text-4xl font-black text-[#004A8C] tracking-tighter leading-none">
              {safeStr(segment?.origin?.code) ?? "---"}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
              {safeStr(segment?.origin?.city) ?? "Origin"}
            </p>
            <div className="mt-4">
              <p className="text-xl font-black text-slate-900 leading-none">
                {safeStr(segment?.origin?.time) ?? "--:--"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                {safeStr(segment?.origin?.date) ?? "N/A"}
              </p>
              {safeStr(segment?.origin?.terminal) && (
                <p className="text-[8px] font-black text-[#E86B43] uppercase mt-0.5 bg-orange-50 inline-block px-1.5 rounded">
                  T{safeStr(segment?.origin?.terminal)}
                </p>
              )}
            </div>
          </div>

          <div className="col-span-4 flex flex-col items-center justify-center px-2">
            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">
              {safeStr(segment?.duration) ?? "--:--"}
            </div>
            <div className="w-full flex items-center gap-2">
              <div className="h-[2px] flex-1 bg-slate-100 rounded-full"></div>
              <div className="text-slate-200">
                <Plane size={14} fill="currentColor" />
              </div>
              <div className="h-[2px] flex-1 bg-slate-100 rounded-full"></div>
            </div>
            {safeStr(segment?.layover_duration) && (
              <div className="mt-2 text-[8px] font-black text-[#E86B43] bg-orange-50 px-3 py-1 rounded-full uppercase tracking-tighter text-center">
                Layover {safeStr(segment?.layover_duration)}
              </div>
            )}
          </div>

          <div className="col-span-4 text-right">
            <h3 className="text-3xl md:text-4xl font-black text-[#004A8C] tracking-tighter leading-none">
              {safeStr(segment?.destination?.code) ?? "---"}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
              {safeStr(segment?.destination?.city) ?? "Destination"}
            </p>
            <div className="mt-4">
              <p className="text-xl font-black text-slate-900 leading-none">
                {safeStr(segment?.destination?.time) ?? "--:--"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                {safeStr(segment?.destination?.date) ?? "N/A"}
              </p>
              {safeStr(segment?.destination?.terminal) && (
                <p className="text-[8px] font-black text-[#E86B43] uppercase mt-0.5 bg-orange-50 inline-block px-1.5 rounded text-right">
                  T{safeStr(segment?.destination?.terminal)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-6 items-center pt-6 border-t border-slate-50">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
              Check-in
            </span>
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
              <Briefcase size={12} className="text-[#004A8C]" /> {checkinBag}
            </div>
          </div>
          <div className="flex flex-col border-l border-slate-100 pl-6">
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
              Cabin
            </span>
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
              <Info size={12} className="text-[#E86B43]" /> {cabinBag}
            </div>
          </div>
          {seat && (
            <div className="flex flex-col border-l border-slate-100 pl-6">
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
                Seat
              </span>
              <div className="text-xs font-black text-[#004A8C] uppercase">{seat}</div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-[170px] bg-[#F8FAFC] border-t md:border-t-0 md:border-l border-dashed border-slate-200 p-6 flex flex-row md:flex-col justify-between items-center gap-6 relative shrink-0">
        <div className="hidden md:block absolute -top-3 -left-3 w-6 h-6 bg-[#F8FAFC] md:bg-white rounded-full border border-slate-200"></div>
        <div className="hidden md:block absolute -bottom-3 -left-3 w-6 h-6 bg-[#F8FAFC] md:bg-white rounded-full border border-slate-200"></div>

        <div className="flex flex-col items-center w-full">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 text-center">
            Security
          </span>
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center w-full max-w-[120px] overflow-hidden">
            <div className="flex justify-center w-full scale-110">
              <Barcode
                value={barcodeVal}
                height={35}
                width={0.85}
                displayValue={false}
                background="transparent"
                margin={0}
              />
            </div>
          </div>
          <span className="text-[6px] font-bold text-slate-300 uppercase tracking-[0.1em] mt-2 whitespace-nowrap text-center">
            OCR BCBP STRING
          </span>
        </div>

        <div className="flex flex-col items-center md:items-end w-full md:mt-auto border-l md:border-l-0 md:border-t border-slate-200 pl-6 md:pl-0 md:pt-4">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            PNR
          </span>
          <span className="text-xs md:text-sm font-mono font-black text-[#004A8C] tracking-widest leading-none text-center md:text-right break-all">
            {safeStr(pnr) ?? "---"}
          </span>
          <div className="mt-3 flex items-center gap-1 text-[8px] font-black text-green-600 uppercase">
            <ShieldCheck size={10} strokeWidth={3} /> Verified
          </div>
        </div>
      </div>
    </div>
  );
};

const PassengerRow: React.FC<{ passenger: Passenger }> = ({ passenger }) => {
  const barcodeValue =
    safeStr((passenger as any).barcode_string) ??
    safeStr((passenger as any).ticket_no) ??
    "PLUM_UNKN";

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-8 py-5">
        <div className="font-black text-slate-900 uppercase tracking-tight text-base">
          {safeStr((passenger as any).name) ?? "Unnamed Passenger"}
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          {(safeStr((passenger as any).type) ?? "Adult")} •{" "}
          {safeStr((passenger as any).seat) ? `Seat ${(passenger as any).seat}` : "Unassigned"}
        </div>
      </td>
      <td className="px-8 py-5 font-mono text-sm text-[#004A8C] font-black text-center tracking-widest bg-slate-50/30">
        {safeStr((passenger as any).ticket_no) ?? "TICKET_REF_000"}
      </td>
      <td className="px-8 py-5 text-right flex justify-end items-center gap-4">
        <div className="flex flex-col items-end">
          <div className="bg-white px-1.5 py-1 rounded border border-slate-200 shadow-sm mb-1 scale-90 origin-right">
            <Barcode value={barcodeValue} height={18} width={0.65} displayValue={false} margin={0} />
          </div>
          <span className="inline-flex items-center gap-2 text-[8px] font-black text-green-600 bg-green-50 border border-green-100 px-3 py-1 rounded-full uppercase">
            <ShieldCheck size={10} strokeWidth={3} /> Digital OCR
          </span>
        </div>
      </td>
    </tr>
  );
};

const ResultView: React.FC<ResultViewProps> = ({ data, customLogo, onDownloadPdf, isDownloadingPdf }) => {
  const [viewMode, setViewMode] = useState<"json" | "preview">("preview");
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const persistentLogo = data?.booking_info?.custom_logo || customLogo || null;

  const computedLayout: LayoutType = useMemo(() => {
    const explicit = (data as any)?.layout_type as LayoutType | undefined;
    if (explicit) return explicit;
    const paxCount = Array.isArray((data as any)?.passengers) ? (data as any).passengers.length : 0;
    if (paxCount <= 1) return "SINGLE";
    if (paxCount === 2) return "DUAL";
    return "GROUP";
  }, [data]);

  const containerClass = useMemo(() => {
    if (computedLayout === "SINGLE") return "max-w-5xl mx-auto";
    return "w-full";
  }, [computedLayout]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHotelPreview = () => (
    <div className={cx("bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in duration-500", computedLayout === "SINGLE" && "max-w-4xl mx-auto")}>
      <div className="bg-[#F8FAFC] border-b border-slate-100 p-8 grid grid-cols-2 gap-8">
        <div>
          <Logo customUrl={persistentLogo} size="md" />
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold mt-2">
            Voyage Luxe, Excel
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm font-semibold text-slate-700">
            Voucher No:{" "}
            <span className="text-slate-900">
              {safeStr((data as any)?.booking_info?.voucher_no) ||
                safeStr((data as any)?.booking_info?.booking_id) ||
                "N/A"}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Booking Date: {safeStr((data as any)?.booking_info?.booking_date) || "N/A"}
          </div>
          <div className="text-xs text-slate-500 font-bold">
            Supplier ID: {safeStr((data as any)?.booking_info?.supplier_conf_no) || "N/A"}
          </div>
        </div>
      </div>

      <div className="p-8 space-y-10">
        <section>
          <h4 className="text-[#004A8C] text-xs font-black uppercase tracking-[0.15em] mb-6 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building2 size={16} /> Accommodation Summary
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight">
                {safeStr((data as any)?.hotel_details?.name) || "Hotel Name"}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                {safeStr((data as any)?.hotel_details?.address) || "N/A"}
              </p>
              <p className="text-slate-600 text-sm font-bold mt-2">
                {safeStr((data as any)?.hotel_details?.city) || "City"},{" "}
                {safeStr((data as any)?.hotel_details?.country) || "Country"}
              </p>
            </div>
            <div className="space-y-4 text-sm bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  Lead Guest
                </span>
                <span className="font-black text-[#004A8C] text-base">
                  {safeStr((data as any)?.guest_details?.primary_guest) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  Room Type
                </span>
                <span className="font-bold text-slate-800">
                  {safeStr((data as any)?.room_details?.room_type) || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-[#004A8C] text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div>
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-2">
              Check-in
            </span>
            <div className="text-2xl font-black">{safeStr((data as any)?.stay_details?.check_in_date) || "N/A"}</div>
            <div className="text-xs opacity-60 mt-1">
              After {safeStr((data as any)?.stay_details?.check_in_time) || "03:00 PM"}
            </div>
          </div>
          <div className="md:border-x border-white/10 md:px-8">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-2">
              Check-out
            </span>
            <div className="text-2xl font-black">{safeStr((data as any)?.stay_details?.check_out_date) || "N/A"}</div>
            <div className="text-xs opacity-60 mt-1">
              Before {safeStr((data as any)?.stay_details?.check_out_time) || "12:00 PM"}
            </div>
          </div>
          <div className="md:pl-8">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-2">
              Duration
            </span>
            <div className="text-2xl font-black text-[#E86B43]">
              {safeStr((data as any)?.stay_details?.total_nights) || "0"} Nights
            </div>
            <div className="text-xs opacity-60 mt-1">Verified Stay</div>
          </div>
        </section>

        {Array.isArray((data as any)?.room_details?.inclusions) && (data as any).room_details.inclusions.length > 0 && (
          <section>
            <h4 className="text-[#004A8C] text-xs font-black uppercase tracking-[0.15em] mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <ListChecks size={16} /> Package Inclusions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data as any).room_details.inclusions.map((inclusion: string, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    {inclusion}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {Array.isArray((data as any)?.policies?.important_notes) && (data as any).policies.important_notes.length > 0 && (
          <section className="bg-orange-50/30 p-8 rounded-[2rem] border border-orange-100">
            <h4 className="text-[#E86B43] text-xs font-black uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
              <AlertCircle size={16} /> Important Information & Policies
            </h4>
            <ul className="space-y-3">
              {(data as any).policies.important_notes.map((note: string, i: number) => (
                <li key={i} className="text-xs font-medium text-slate-600 leading-relaxed flex gap-3">
                  <span className="shrink-0 text-[#E86B43]">•</span> {note}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <div>Plumtrips Standard • India</div>
        <div className="flex items-center gap-2">
          <Globe size={12} /> plumtrips.com
        </div>
      </div>
    </div>
  );

  const renderFlightPreview = () => {
    const segments = (data as any)?.flight_details?.segments ?? [];
    const pnr = safeStr((data as any)?.booking_info?.pnr);

    return (
      <div className={cx("space-y-8 animate-in fade-in duration-700", containerClass)}>
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-gradient-to-br from-slate-50 to-white">
            <div className="space-y-4">
              <Logo customUrl={persistentLogo} size="md" />
              <div className="flex items-center gap-3">
                <span className="bg-[#004A8C] text-white text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg">
                  Electronic Passenger Ticket
                </span>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Voyage Luxe, Excel
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl border-b-[8px] border-[#E86B43]">
                <span className="text-[9px] uppercase text-slate-400 block font-black tracking-[0.4em] mb-1">
                  Booking Ref (PNR)
                </span>
                <span className="text-3xl md:text-4xl font-mono font-black tracking-[0.1em]">
                  {pnr || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 bg-[#F8FAFC] flex flex-wrap justify-between text-[11px] font-black uppercase tracking-widest border-b border-slate-100 text-slate-500">
            <div className="flex gap-8">
              <span>
                Issue Date:{" "}
                <span className="text-slate-900 font-black">
                  {safeStr((data as any)?.booking_info?.booking_date) || "N/A"}
                </span>
              </span>
              <span className="text-slate-200">|</span>
              <span>
                Document ID:{" "}
                <span className="text-[#004A8C] font-black">
                  {safeStr((data as any)?.booking_info?.booking_id) || "N/A"}
                </span>
              </span>
            </div>
            <div
              className={cx(
                "font-black px-3 py-0.5 rounded-full border",
                (data as any)?.policies?.is_non_refundable
                  ? "text-[#E86B43] border-[#E86B43]/20 bg-orange-50"
                  : "text-green-600 border-green-100 bg-green-50"
              )}
            >
              {safeStr((data as any)?.booking_info?.fare_type) ||
                ((data as any)?.policies?.is_non_refundable ? "NON-REFUNDABLE" : "REFUNDABLE")}
            </div>
          </div>

          <div className="p-8 space-y-8 bg-slate-50/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-1.5 bg-[#004A8C] rounded-full"></div>
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">
                Flight Segments Mapping
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {segments.map((segment: FlightSegment, idx: number) => (
                <React.Fragment key={idx}>
                  <FlightSegmentCard segment={segment} pnr={pnr} layout={computedLayout} />
                  {/* Optional connector between segments (nice for multi-leg journeys) */}
                  {idx < segments.length - 1 && (
                    <div className="flex items-center justify-center">
                      <div className="px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Next Leg • Layover {safeStr((segments[idx] as any)?.layover_duration) || "—"}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="px-8 pb-10 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-1.5 bg-[#E86B43] rounded-full"></div>
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">
                Traveler Identification Registry
              </h4>
            </div>

            {/* GROUP mode: show compact cards instead of a wide table */}
            {computedLayout === "GROUP" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {((data as any)?.passengers ?? []).map((p: Passenger, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-black text-slate-900 uppercase text-base">
                          {safeStr((p as any).name) || "Unnamed Passenger"}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {safeStr((p as any).type) || "Adult"} •{" "}
                          {safeStr((p as any).seat) ? `Seat ${(p as any).seat}` : "Unassigned"}
                        </div>
                        <div className="mt-3 text-xs font-mono font-black text-[#004A8C] tracking-widest">
                          {safeStr((p as any).ticket_no) || "TICKET_REF_000"}
                        </div>
                      </div>
                      <div className="bg-white px-2 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <Barcode
                          value={safeStr((p as any).barcode_string) || safeStr((p as any).ticket_no) || "PLUM_UNKN"}
                          height={28}
                          width={0.8}
                          displayValue={false}
                          margin={0}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[2rem] border border-slate-100 shadow-xl">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-[#004A8C] text-white">
                    <tr className="text-[10px] uppercase tracking-[0.2em]">
                      <th className="px-8 py-4 font-black">Full Legal Name</th>
                      <th className="px-8 py-4 font-black text-center">Ticket No.</th>
                      <th className="px-8 py-4 font-black text-right">Digital Scan / OCR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {((data as any)?.passengers ?? []).map((p: Passenger, idx: number) => (
                      <PassengerRow key={idx} passenger={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {Array.isArray((data as any)?.policies?.important_notes) && (data as any).policies.important_notes.length > 0 && (
            <div className="px-8 pb-10">
              <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <h4 className="text-[#004A8C] text-xs font-black uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                  <AlertCircle size={16} /> Essential Travel Information
                </h4>
                <ul className="space-y-2">
                  {(data as any).policies.important_notes.map((note: string, i: number) => (
                    <li key={i} className="text-[11px] font-medium text-slate-500 leading-relaxed flex gap-3">
                      <span className="shrink-0 text-[#E86B43]">•</span> {note}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          <div className="px-8 py-6 border-t border-slate-100 bg-[#F8FAFC] flex flex-col md:flex-row justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest gap-4">
            <div className="flex items-center gap-4">
              <Logo customUrl={persistentLogo} size="sm" />
              <span className="hidden md:block h-4 w-[1px] bg-slate-200"></span>
              <span>Digital Node: INDIA-NCR</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500">
              <div className="w-2 h-2 rounded-full bg-[#004A8C] animate-pulse"></div>
              Authentic Plumtrips Standard Pipeline • 2026
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isHotel = (data as any)?.type === "hotel";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
          <button
            onClick={() => setViewMode("preview")}
            className={cx(
              "flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === "preview"
                ? "bg-white text-[#004A8C] shadow-lg border border-slate-100"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Layout size={18} strokeWidth={2.5} /> Preview
          </button>
          <button
            onClick={() => setViewMode("json")}
            className={cx(
              "flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              viewMode === "json"
                ? "bg-white text-[#004A8C] shadow-lg border border-slate-100"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Code size={18} strokeWidth={2.5} /> Raw Data
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 rounded-full border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500">
            {computedLayout} Layout
          </div>

          {viewMode === "preview" && onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf}
              className={cx(
                "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all border border-slate-200 shadow-sm hover:shadow-xl group bg-white",
                isDownloadingPdf ? "text-slate-400 cursor-not-allowed" : "text-[#004A8C] hover:border-[#004A8C]"
              )}
              title="Download Backend PDF"
            >
              {isDownloadingPdf ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} className="group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[10px]">PDF</span>
            </button>
          )}

          <button
            onClick={copyToClipboard}
            className="p-3 text-slate-500 hover:text-[#004A8C] hover:bg-white rounded-2xl transition-all border border-slate-200 hover:shadow-xl group"
            title="Copy Raw JSON"
          >
            {copied ? <Check size={22} className="text-green-500" /> : <Copy size={22} className="group-hover:scale-110 transition-transform" />}
          </button>
        </div>
      </div>

      {viewMode === "json" ? (
        <div className="relative">
          <pre className="bg-slate-900 text-indigo-200 p-10 rounded-[3rem] overflow-x-auto text-sm font-mono leading-relaxed h-[650px] border border-slate-800 shadow-2xl custom-scrollbar">
            {JSON.stringify(data, null, 2)}
          </pre>
          <div className="absolute top-4 right-10 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/80 px-4 py-1 rounded-full">
            {computedLayout} LAYOUT
          </div>
        </div>
      ) : (
        <div ref={contentRef} className="pb-12">
          <div className={containerClass}>
            {isHotel ? renderHotelPreview() : renderFlightPreview()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultView;