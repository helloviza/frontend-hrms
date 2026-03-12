import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

function unwrap(res: any) {
  return res?.data ?? res;
}

function describeOption(type: string, opt: any, params: any): string {
  if (type === "flight") {
    const seg = opt?.Segments?.[0]?.[0] || {};
    const orig = seg?.Origin?.Airport?.CityName || params?.origin || "";
    const dest = seg?.Destination?.Airport?.CityName || params?.destination || "";
    return orig || dest ? `${orig} → ${dest}` : "Flight";
  }
  return opt?.HotelName || opt?.hotelName || params?.hotelName || "Hotel";
}

function travelDate(type: string, params: any): string {
  if (type === "flight") {
    return params?.departDate || params?.DepartDate || params?.PreferredDepartureTime || "";
  }
  return params?.CheckIn || params?.checkIn || "";
}

function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fare(opt: any): number {
  return (
    opt?.Fare?.TotalFare ||
    opt?.totalFare ||
    opt?.TotalFare ||
    opt?.Rooms?.[0]?.TotalFare ||
    0
  );
}

export default function SBTInbox() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [bookedRequests, setBookedRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Reject modal
  const [rejectReq, setRejectReq] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [alternativeSuggestion, setAlternativeSuggestion] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pendingRes, bookedRes] = await Promise.all([
        unwrap(api.get("/sbt/requests/inbox")),
        unwrap(api.get("/sbt/requests/inbox?status=BOOKED")),
      ]);
      setRequests(pendingRes?.requests || []);
      setBookedRequests(bookedRes?.requests || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleProceedToBook(req: any) {
    if (req.type === "flight") {
      navigate(`/sbt/flights?requestId=${req._id}`);
    } else {
      navigate(`/sbt/hotels?requestId=${req._id}`);
    }
  }

  async function handleReject() {
    if (!rejectReq) return;
    if (!rejectionReason.trim()) return;
    setRejectLoading(true);
    try {
      await api.post(`/sbt/requests/${rejectReq._id}/reject`, {
        rejectionReason: rejectionReason.trim(),
        alternativeSuggestion: alternativeSuggestion.trim() || null,
      });
      setRequests((prev) => prev.filter((r) => r._id !== rejectReq._id));
      setToast("Request rejected");
      setRejectReq(null);
      setRejectionReason("");
      setAlternativeSuggestion("");
    } catch (e: any) {
      setToast(e?.response?.data?.error || "Rejection failed");
    } finally {
      setRejectLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  function renderRequestCard(req: any, showActions: boolean) {
    const desc = describeOption(req.type, req.selectedOption, req.searchParams);
    const date = travelDate(req.type, req.searchParams);
    const requester = req.requesterId;
    const initials = (requester?.name || requester?.email || "?")
      .charAt(0)
      .toUpperCase();
    const totalFare = fare(req.selectedOption);

    return (
      <div
        key={req._id}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition"
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#00477f] to-[#0066b3] text-white text-sm font-bold flex items-center justify-center">
            {initials}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">
                {requester?.name || requester?.email || "Unknown"}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  req.type === "flight"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-purple-50 text-purple-700 border-purple-200"
                }`}
              >
                {req.type === "flight" ? "Flight" : "Hotel"}
              </span>
              {req.status === "BOOKED" && (
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                  Booked
                </span>
              )}
              <span className="text-[11px] text-gray-400">
                {relativeTime(req.status === "BOOKED" ? req.actedAt : req.requestedAt)}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-800 mb-1">{desc}</p>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              {date && <span>Travel: {date}</span>}
              {totalFare > 0 && (
                <span>Fare: INR {totalFare.toLocaleString()}</span>
              )}
            </div>

            {req.requesterNotes && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-100">
                {req.requesterNotes}
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleProceedToBook(req)}
                className="px-4 py-2 bg-[#00477f] text-white rounded-xl text-xs font-semibold hover:opacity-90 transition cursor-pointer"
              >
                Proceed to Book
              </button>
              <button
                type="button"
                onClick={() => setRejectReq(req)}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition cursor-pointer"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Booking Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">
          Travel requests from your assigned team members.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pending requests */}
      {requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-400 text-sm">No pending requests. You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => renderRequestCard(req, true))}
        </div>
      )}

      {/* Booked requests */}
      {bookedRequests.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recently Booked</h2>
          <div className="space-y-4">
            {bookedRequests.map((req) => renderRequestCard(req, false))}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectReq && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg mx-4 w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reject Request</h3>

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Why is this request being rejected?"
              className="w-full h-20 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15 outline-none resize-none mb-3"
            />

            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Suggest an alternative (optional)
            </label>
            <textarea
              value={alternativeSuggestion}
              onChange={(e) => setAlternativeSuggestion(e.target.value)}
              placeholder="Suggest an alternative flight/hotel..."
              className="w-full h-16 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15 outline-none resize-none mb-4"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectLoading || !rejectionReason.trim()}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {rejectLoading ? "Submitting..." : "Submit Rejection"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectReq(null);
                  setRejectionReason("");
                  setAlternativeSuggestion("");
                }}
                className="px-5 py-2.5 text-gray-600 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg bg-emerald-600 text-white">
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-white/80 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
