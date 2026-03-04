import { useState } from "react";
import { api } from "../../lib/api";

const ROLES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
  { value: "HR", label: "HR" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERADMIN", label: "Super Admin" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddStaffModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE", department: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password || !form.role) {
      setError("Name, email, password and role are required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/admin/create-staff", form);
      onCreated();
      onClose();
      setForm({ name: "", email: "", password: "", role: "EMPLOYEE", department: "", phone: "" });
    } catch (err: any) {
      setError(err?.message || "Failed to create staff.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Team Member</h2>
            <p className="text-sm text-slate-400 mt-0.5">Create a staff account directly</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Full Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                placeholder="Imran Ali"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f] bg-white">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Email Address *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
              placeholder="imran@plumtrips.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Password *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Department</label>
              <input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))}
                placeholder="Operations"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00477f]/20 focus:border-[#00477f]" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#00477f] hover:bg-[#003d6e] disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
