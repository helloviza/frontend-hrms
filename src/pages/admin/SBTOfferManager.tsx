import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface OfferConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  bgColor: string;
}

const DEFAULT: OfferConfig = {
  enabled: false,
  title: "",
  description: "",
  ctaText: "Book Now",
  ctaUrl: "",
  bgColor: "#E86B43",
};

export default function SBTOfferManager() {
  const [form, setForm] = useState<OfferConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/admin/sbt/offer")
      .then((res) => {
        setForm({
          enabled: res.enabled ?? false,
          title: res.title ?? "",
          description: res.description ?? "",
          ctaText: res.ctaText ?? "Book Now",
          ctaUrl: res.ctaUrl ?? "",
          bgColor: res.bgColor ?? "#E86B43",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/admin/sbt/offer", form);
      setMsg("Saved successfully.");
    } catch (err: any) {
      setMsg(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function upd(patch: Partial<OfferConfig>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  if (loading) return <p className="text-sm text-zinc-400 p-8">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900 mb-1">Ticket Offer Manager</h1>
      <p className="text-sm text-zinc-400 mb-8">Manage promotional offers shown on flight e-tickets</p>

      <div className="flex gap-8 items-start flex-wrap">
        {/* Left — Form */}
        <div className="flex-1 min-w-[320px] max-w-md">
          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <div
              onClick={() => upd({ enabled: !form.enabled })}
              className={`relative w-11 h-6 rounded-full transition ${form.enabled ? "bg-emerald-500" : "bg-zinc-300"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Show offer on tickets</span>
          </label>

          {form.enabled && (
            <div className="flex flex-col gap-4">
              <Field label="Offer Title *" value={form.title} onChange={(v) => upd({ title: v })} placeholder="Arriving in Mumbai?" />
              <Field label="Offer Description *" value={form.description} onChange={(v) => upd({ description: v })} placeholder="Get 10% off airport transfer" />
              <Field label="CTA Button Text *" value={form.ctaText} onChange={(v) => upd({ ctaText: v })} placeholder="Book Now" />
              <Field label="CTA URL" value={form.ctaUrl} onChange={(v) => upd({ ctaUrl: v })} placeholder="https://plumtrips.com/transfers" />
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Background Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.bgColor}
                    onChange={(e) => upd({ bgColor: e.target.value })}
                    className="w-10 h-10 rounded border border-zinc-200 cursor-pointer p-0.5"
                  />
                  <span className="text-sm text-zinc-500 font-mono">{form.bgColor}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 bg-zinc-900 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-zinc-800 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Offer Configuration"}
          </button>
          {msg && <p className="text-sm mt-3 text-emerald-600">{msg}</p>}
        </div>

        {/* Right — Live Preview */}
        <div className="flex-1 min-w-[300px] max-w-sm">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Live Preview</p>
          {form.enabled && form.title ? (
            <div
              style={{ background: `linear-gradient(135deg, ${form.bgColor}, ${lighten(form.bgColor)})` }}
              className="rounded-xl p-5 text-white"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/><polyline points="12 3 12 15"/><path d="M8 8l4-4 4 4"/></svg>
                <span className="font-bold text-sm">{form.title || "Offer Title"}</span>
              </div>
              <p className="text-xs opacity-90 mb-3">{form.description || "Offer description here"}</p>
              <button className="bg-white/20 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-lg border border-white/30">
                {form.ctaText || "Book Now"}
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center">
              <p className="text-sm text-zinc-400">
                {form.enabled ? "Enter a title to see preview" : "Toggle on to configure an offer"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
      />
    </div>
  );
}

function lighten(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, r + 40);
    const lg = Math.min(255, g + 40);
    const lb = Math.min(255, b + 40);
    return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
  } catch {
    return "#f97316";
  }
}
