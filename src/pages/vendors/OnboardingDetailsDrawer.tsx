import { useEffect, useState } from "react";
import api from "../../lib/api";

export default function OnboardingDetailsDrawer({
  token,
  onClose,
}: {
  token: string | null;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .get(`/onboarding/${token}/details`)
      .then((res) => setDetails(res))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDecision(action: "approved" | "rejected" | "hold") {
    if (!token) return;
    setActionLoading(true);
    await api.post(`/onboarding/${token}/decision`, { action });
    setActionLoading(false);
    alert(`Submission ${action}`);
    onClose();
  }

  if (!token) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-[450px] h-full bg-white shadow-xl flex flex-col">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="font-semibold text-[#00477f]">Onboarding Details</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 text-sm">
          {loading && <p>Loading…</p>}
          {details && (
            <>
              <div className="space-y-1 mb-4">
                <div><b>Name:</b> {details.name}</div>
                <div><b>Email:</b> {details.email}</div>
                <div><b>Type:</b> {details.type}</div>
                <div><b>Status:</b> {details.status}</div>
                <div><b>Submitted:</b> {new Date(details.submittedAt).toLocaleString()}</div>
              </div>

              <h3 className="font-semibold mt-3 mb-2 text-[#00477f]">Documents</h3>
              {details.documents?.length ? (
                <ul className="list-disc ml-5 space-y-1">
                  {details.documents.map((d: any, i: number) => (
                    <li key={i}>
                      <a
                        href={`https://s3.console.aws.amazon.com/s3/object/${d.key}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {d.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No documents</p>
              )}

              <h3 className="font-semibold mt-4 mb-2 text-[#00477f]">Form Data</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-[250px]">
                {JSON.stringify(details.payload, null, 2)}
              </pre>
            </>
          )}
        </div>
        <div className="border-t p-3 flex gap-2">
          <button
            className="flex-1 bg-green-600 text-white py-1 rounded"
            onClick={() => handleDecision("approved")}
            disabled={actionLoading}
          >
            Approve
          </button>
          <button
            className="flex-1 bg-red-600 text-white py-1 rounded"
            onClick={() => handleDecision("rejected")}
            disabled={actionLoading}
          >
            Reject
          </button>
          <button
            className="flex-1 bg-yellow-500 text-white py-1 rounded"
            onClick={() => handleDecision("hold")}
            disabled={actionLoading}
          >
            Hold
          </button>
        </div>
      </div>
    </div>
  );
}
