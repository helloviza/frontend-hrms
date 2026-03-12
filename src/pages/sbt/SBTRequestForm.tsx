import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

interface PassengerEntry {
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  isLeadPassenger: boolean;
}

function emptyPassenger(isLead = false): PassengerEntry {
  return {
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    passportNumber: "",
    passportExpiry: "",
    nationality: "",
    isLeadPassenger: isLead,
  };
}

export default function SBTRequestForm() {
  const { user } = useAuth() as { user: any };
  const location = useLocation();
  const navigate = useNavigate();

  const preSelected = (location.state as any)?.preSelected || null;
  const preType = (location.state as any)?.type || "flight";
  const preSearchParams = (location.state as any)?.searchParams || {};

  const [type] = useState<"flight" | "hotel">(preType);
  const [selectedOption] = useState<any>(preSelected);
  const [searchParams] = useState<any>(preSearchParams);
  const [requesterNotes, setRequesterNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passenger count from search params
  const adultCount = preSearchParams?.adults || preSearchParams?.pax?.adults || 1;
  const childCount = preSearchParams?.children || preSearchParams?.pax?.children || 0;
  const infantCount = preSearchParams?.infants || preSearchParams?.pax?.infants || 0;
  const totalPax = adultCount + childCount + infantCount;

  const [passengers, setPassengers] = useState<PassengerEntry[]>(() => {
    const list: PassengerEntry[] = [];
    for (let i = 0; i < Math.max(totalPax, 1); i++) {
      list.push(emptyPassenger(i === 0));
    }
    return list;
  });

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Pre-fill from user profile on mount
  useEffect(() => {
    if (!user) return;
    const name = user.name || user.firstName || "";
    const parts = name.split(" ");
    setPassengers((prev) => {
      const next = [...prev];
      if (next.length > 0) {
        next[0] = {
          ...next[0],
          firstName: next[0].firstName || parts[0] || "",
          lastName: next[0].lastName || parts.slice(1).join(" ") || user.lastName || "",
          gender: next[0].gender || user.gender || "",
          dateOfBirth: next[0].dateOfBirth || user.dateOfBirth || "",
          passportNumber: next[0].passportNumber || user.passportNumber || "",
        };
      }
      return next;
    });
    setContactEmail((prev) => prev || user.email || "");
    setContactPhone((prev) => prev || user.phone || user.mobile || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function updatePassenger(index: number, field: keyof PassengerEntry, value: string | boolean) {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function autoFillFromProfile() {
    if (!user) return;
    const name = user.name || user.firstName || "";
    const parts = name.split(" ");
    updatePassenger(0, "firstName", parts[0] || "");
    updatePassenger(0, "lastName", parts.slice(1).join(" ") || user.lastName || "");
    if (user.gender) updatePassenger(0, "gender", user.gender);
    if (user.dateOfBirth) updatePassenger(0, "dateOfBirth", user.dateOfBirth);
    if (user.passportNumber) updatePassenger(0, "passportNumber", user.passportNumber);
  }

  async function handleSubmit() {
    setError(null);

    // Validate passengers
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.firstName.trim() || !p.lastName.trim()) {
        setError(`Passenger ${i + 1}: First name and last name are required.`);
        return;
      }
      if (!p.gender) {
        setError(`Passenger ${i + 1}: Please select a gender.`);
        return;
      }
    }
    if (!contactEmail.trim()) {
      setError("Contact email is required.");
      return;
    }
    if (!contactPhone.trim()) {
      setError("Contact phone is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/sbt/requests", {
        type,
        searchParams,
        selectedOption,
        requesterNotes: requesterNotes.trim() || null,
        passengerDetails: passengers,
        contactDetails: {
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
        },
      });
      navigate("/sbt/my-requests", {
        state: { toast: "Request submitted successfully" },
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to submit request";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!preSelected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Raise a Travel Request</h1>
        <p className="text-gray-500 mb-8">
          Search for flights or hotels first, then click "Raise Request" on the option you want.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => navigate("/sbt/flights")}
            className="px-6 py-3 bg-[#00477f] text-white rounded-xl font-semibold hover:opacity-90 transition cursor-pointer">
            Search Flights
          </button>
          <button type="button" onClick={() => navigate("/sbt/hotels")}
            className="px-6 py-3 bg-[#00477f] text-white rounded-xl font-semibold hover:opacity-90 transition cursor-pointer">
            Search Hotels
          </button>
        </div>
      </div>
    );
  }

  // Derive display info
  const desc =
    type === "flight"
      ? (() => {
          const seg = selectedOption?.Segments?.[0]?.[0] || {};
          const orig = seg?.Origin?.Airport?.CityName || searchParams?.origin || "";
          const dest = seg?.Destination?.Airport?.CityName || searchParams?.destination || "";
          return `${orig} → ${dest}`;
        })()
      : selectedOption?.HotelName || selectedOption?.hotelName || "Hotel";

  const totalFare =
    selectedOption?.Fare?.TotalFare ||
    selectedOption?.totalFare ||
    selectedOption?.TotalFare ||
    selectedOption?.Rooms?.[0]?.TotalFare ||
    0;

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 outline-none focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15";
  const labelCls = "text-xs font-medium text-gray-600";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirm Travel Request</h1>

      {/* Flight/Hotel summary */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            type === "flight"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "bg-purple-50 text-purple-700 border border-purple-200"
          }`}>
            {type === "flight" ? "Flight" : "Hotel"}
          </span>
          <span className="text-lg font-semibold text-gray-900">{desc}</span>
        </div>
        {totalFare > 0 && (
          <p className="text-sm text-gray-500">
            Estimated fare: <span className="font-semibold text-gray-900">INR {totalFare.toLocaleString()}</span>
          </p>
        )}
      </div>

      {/* Passenger details */}
      {passengers.map((pax, index) => (
        <div key={index} className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800">
              Passenger {index + 1} {index === 0 && "(You)"}
            </h4>
            {index === 0 && (
              <span className="text-xs text-blue-600 cursor-pointer hover:underline"
                onClick={autoFillFromProfile}>
                Auto-fill from my profile
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input required className={inputCls}
                value={pax.firstName}
                onChange={e => updatePassenger(index, "firstName", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last Name *</label>
              <input required className={inputCls}
                value={pax.lastName}
                onChange={e => updatePassenger(index, "lastName", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Gender *</label>
              <select required className={inputCls}
                value={pax.gender}
                onChange={e => updatePassenger(index, "gender", e.target.value)}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls}
                value={pax.dateOfBirth}
                onChange={e => updatePassenger(index, "dateOfBirth", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Passport Number</label>
              <input className={inputCls} placeholder="For international flights"
                value={pax.passportNumber}
                onChange={e => updatePassenger(index, "passportNumber", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Passport Expiry</label>
              <input type="date" className={inputCls}
                value={pax.passportExpiry}
                onChange={e => updatePassenger(index, "passportExpiry", e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      {/* Contact details */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h4 className="font-semibold text-gray-800 mb-3">Contact Details</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" required className={inputCls}
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone *</label>
            <input type="tel" required className={inputCls}
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notes for booker */}
      <textarea
        placeholder="Any special requirements, preferences, or instructions for the booker..."
        value={requesterNotes}
        onChange={e => setRequesterNotes(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-[#00477f]/40 focus:ring-2 focus:ring-[#00477f]/15 resize-none"
        rows={3}
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSubmit} disabled={submitting}
          className="px-6 py-2.5 bg-[#00477f] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 cursor-pointer">
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
        <button type="button" onClick={() => navigate(-1)}
          className="px-6 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}
