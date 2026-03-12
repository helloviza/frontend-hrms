import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../lib/api";

function unwrap(res: any) {
  return res?.data ?? res;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  BOOKED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
};

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

export default function SBTMyRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [rejectionModal, setRejectionModal] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(
    (location.state as any)?.toast || null,
  );

  const load = useCallback(async () => {
    try {
      const res = unwrap(await api.get("/sbt/requests/my"));
      setRequests(res?.requests || []);
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

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await api.delete(`/sbt/requests/${id}/cancel`);
      setRequests((prev) =>
        prev.map((r) =>
          r._id === id ? { ...r, status: "CANCELLED", cancelledAt: new Date().toISOString() } : r,
        ),
      );
      setToast("Request cancelled");
    } catch (e: any) {
      setToast(e?.response?.data?.error || "Failed to cancel");
    } finally {
      setCancellingId(null);
      setShowCancelModal(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Travel Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track your submitted travel requests and their status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/sbt/flights")}
          className="px-4 py-2 bg-[#00477f] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition cursor-pointer"
        >
          New Request
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-400 text-sm">
            No requests yet. Start by raising a new travel request.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Route / Hotel</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Travel Date</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => {
                  const desc = describeOption(req.type, req.selectedOption, req.searchParams);
                  const date = travelDate(req.type, req.searchParams);
                  const booker = req.assignedBookerId;

                  return (
                    <tr key={req._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            req.type === "flight"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}
                        >
                          {req.type === "flight" ? "Flight" : "Hotel"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{desc}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{date || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{relativeTime(req.requestedAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[req.status] || ""}`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {booker?.name || booker?.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => setShowCancelModal(req._id)}
                            disabled={cancellingId === req._id}
                            className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        {req.status === "BOOKED" && (
                          <button
                            type="button"
                            onClick={() => {
                              const bookingPath =
                                req.type === "flight"
                                  ? `/sbt/flights/bookings`
                                  : `/sbt/hotels/bookings`;
                              navigate(bookingPath);
                            }}
                            className="text-xs font-medium text-[#00477f] hover:text-[#003366] cursor-pointer"
                          >
                            View Ticket
                          </button>
                        )}
                        {req.status === "REJECTED" && (
                          <button
                            type="button"
                            onClick={() => setRejectionModal(req)}
                            className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            View Reason
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Request?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will cancel your pending travel request. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleCancel(showCancelModal)}
                disabled={!!cancellingId}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {cancellingId ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(null)}
                className="px-4 py-2 text-gray-600 text-sm font-medium cursor-pointer"
              >
                Keep Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Request Rejected</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reason</p>
                <p className="text-sm text-gray-900">
                  {rejectionModal.rejectionReason || "No reason provided"}
                </p>
              </div>
              {rejectionModal.alternativeSuggestion && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Suggested Alternative
                  </p>
                  <p className="text-sm text-gray-900">
                    {rejectionModal.alternativeSuggestion}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRejectionModal(null)}
              className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition cursor-pointer"
            >
              Close
            </button>
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
