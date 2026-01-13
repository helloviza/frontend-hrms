// apps/frontend/src/components/widgets/PunchCard.tsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type Geo = { lat: number; lng: number } | null;

async function getGeo(): Promise<Geo> {
  try {
    if (!("geolocation" in navigator)) return null;
    return await new Promise<Geo>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    );
  } catch {
    return null;
  }
}

export default function PunchCard() {
  const { user } = useAuth(); // ✅ token removed
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  async function punch(type: "in" | "out") {
    if (busy) return;
    setBusy(type);

    try {
      const geo = await getGeo();
      const path =
        type === "in" ? "/attendance/punch-in" : "/attendance/punch-out";

      // ✅ unified call — token handled by api layer
      await api.post(path, { geo });

      alert(`Punch ${type} recorded successfully.`);
    } catch (e: any) {
      alert(e?.message || "Failed to record punch");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        onClick={() => punch("in")}
        disabled={busy !== null}
        className="rounded-xl py-3 bg-[--accent] text-white font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {busy === "in" ? "Punching in…" : "Punch In"}
      </button>

      <button
        onClick={() => punch("out")}
        disabled={busy !== null}
        className="rounded-xl py-3 bg-[#00477f] text-white font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {busy === "out" ? "Punching out…" : "Punch Out"}
      </button>

      <p className="text-xs text-zinc-500">
        Tip: enable location access for richer attendance logs.
      </p>
    </div>
  );
}
