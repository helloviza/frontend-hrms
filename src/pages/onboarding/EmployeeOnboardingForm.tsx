// src/pages/onboarding/EmployeeOnboardingForm.tsx
import { useMemo, useState } from "react";
import api from "../../lib/api";

type Props = {
  token: string;
  inviteEmail?: string;
  defaultName?: string;
  onSubmitted?: (ticket: string) => void;
};

type Address = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type FormState = {
  // Personal + Identity
  fullName: string;
  fatherOrHusbandName?: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string; // Male/Female/Other
  maritalStatus?: string; // Single/Married/...
  casteCategory?: string; // Gen/SC/ST/OBC/EWS

  // Contact
  contact: {
    personalMobile: string;
    personalEmail: string;
    alternateMobile?: string;
    alternateEmail?: string;
  };

  // Address
  address: {
    current: Address;
    permanent: Address;
    sameAsCurrent?: boolean;
  };

  // Emergency
  emergency: {
    name: string;
    relationship: string;
    mobile: string;
    address?: string;
  };

  // Government IDs
  ids: {
    aadhaar: string;
    pan: string;
    voterId?: string;
    rationCard?: string;
    passportNo?: string;
    drivingLicense?: string;
  };

  // Banking
  bank: {
    accountNumber: string;
    bankName: string;
    branch?: string;
    ifsc: string;
  };

  // Education + Employment
  education: {
    highestDegree: string;
    institution?: string;
    year?: string;
    certifications?: string;
  };
  previousEmployer?: {
    organization?: string;
    position?: string;
    tenure?: string;
  };
  employment: {
    dateOfJoining: string; // YYYY-MM-DD
  };

  // Statutory
  pf?: {
    nomineeName?: string;
    nomineeRelationship?: string;
    nomineeSharePercent?: string;
  };
  esi?: {
    applicable?: boolean;
    ipNumber?: string;
  };
  tax?: {
    declarationSubmitted?: boolean; // Form 12BB etc.
  };

  // Optional
  dependents?: string; // list/CSV
  gratuityNominee?: string;
  insuranceBeneficiary?: string;
  preferredName?: string;
  languagesKnown?: string;
  hobbies?: string;
  previousAddress?: string;

  // Documents/Uploads
  photoKey?: string; // S3 object key for passport photo
  attachments: Array<{ kind: string; key: string; name: string }>;
};

const EMPTY_ADDRESS: Address = {
  line1: "",
  city: "",
  state: "",
  zip: "",
  country: "India",
};

const REQUIRED_FIELDS: Array<(f: FormState) => [string, boolean]> = [
  (f) => ["Full Name", !!f.fullName?.trim()],
  (f) => ["Date of Birth", !!f.dateOfBirth],
  (f) => ["Gender", !!f.gender],
  (f) => ["Personal Mobile", !!f.contact?.personalMobile?.trim()],
  (f) => ["Personal Email", !!f.contact?.personalEmail?.trim()],
  (f) => ["Current Address Line1", !!f.address?.current?.line1?.trim()],
  (f) => ["Current City", !!f.address?.current?.city?.trim()],
  (f) => ["Current State", !!f.address?.current?.state?.trim()],
  (f) => ["Current ZIP", !!f.address?.current?.zip?.trim()],
  (f) => ["Permanent Address Line1", !!f.address?.permanent?.line1?.trim()],
  (f) => ["Permanent City", !!f.address?.permanent?.city?.trim()],
  (f) => ["Permanent State", !!f.address?.permanent?.state?.trim()],
  (f) => ["Permanent ZIP", !!f.address?.permanent?.zip?.trim()],
  (f) => ["Aadhaar", !!f.ids?.aadhaar?.trim()],
  (f) => ["PAN", !!f.ids?.pan?.trim()],
  (f) => ["Account Number", !!f.bank?.accountNumber?.trim()],
  (f) => ["Bank Name", !!f.bank?.bankName?.trim()],
  (f) => ["IFSC", !!f.bank?.ifsc?.trim()],
  (f) => ["Highest Degree", !!f.education?.highestDegree?.trim()],
  (f) => ["Date of Joining", !!f.employment?.dateOfJoining],
  (f) => ["Emergency Contact Name", !!f.emergency?.name?.trim()],
  (f) => ["Emergency Relationship", !!f.emergency?.relationship?.trim()],
  (f) => ["Emergency Mobile", !!f.emergency?.mobile?.trim()],
];

/* ---------------- Helpers to match legacy submit shape ---------------- */
function compactJoin(parts: (string | undefined)[], sep: string) {
  return parts.filter((s) => !!(s && s.toString().trim())).join(sep);
}
function formatAddress(a: Address): string {
  // Single-line address string the backend legacy validator can read
  return compactJoin(
    [a.line1, a.line2, a.city, a.state, a.zip, a.country || "India"],
    ", "
  );
}

/**
 * Build the legacy, minimal top-level payload + extras blob.
 * The backend validator expects these fields present at top-level objects,
 * with address.current/permanent as strings (not structured objects).
 */
function buildLegacySubmitPayload(form: FormState) {
  const payload = {
    // minimal required by legacy validator
    fullName: form.fullName,
    fatherOrHusbandName: form.fatherOrHusbandName || "",
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,

    address: {
      current: formatAddress(form.address.current),
      permanent: formatAddress(form.address.permanent),
    },

    contact: {
      personalMobile: form.contact.personalMobile,
      personalEmail: form.contact.personalEmail,
      altMobile: form.contact.alternateMobile || "",
      altEmail: form.contact.alternateEmail || "",
    },

    emergency: {
      name: form.emergency.name,
      relationship: form.emergency.relationship,
      mobile: form.emergency.mobile,
      address: form.emergency.address || "",
    },

    ids: {
      aadhaar: form.ids.aadhaar,
      pan: form.ids.pan,
      voterId: form.ids.voterId || "",
      rationCard: form.ids.rationCard || "",
      passportNo: form.ids.passportNo || "",
      drivingLicense: form.ids.drivingLicense || "",
    },

    bank: {
      accountNumber: form.bank.accountNumber,
      bankName: form.bank.bankName,
      branch: form.bank.branch || "",
      ifsc: form.bank.ifsc,
    },

    education: {
      highestDegree: form.education.highestDegree,
      institution: form.education.institution || "",
      year: form.education.year || "",
      certifications: form.education.certifications || "",
    },

    previousEmployer: {
      organization: form.previousEmployer?.organization || "",
      position: form.previousEmployer?.position || "",
      tenure: form.previousEmployer?.tenure || "",
    },

    employment: {
      dateOfJoining: form.employment.dateOfJoining,
      // move these two where your backend expects; they’re optional by validator
      casteCategory: form.casteCategory || "",
      maritalStatus: form.maritalStatus || "",
    },

    pf: {
      nomineeName: form.pf?.nomineeName || "",
      nomineeRelationship: form.pf?.nomineeRelationship || "",
      nomineeSharePercent: form.pf?.nomineeSharePercent || "",
    },

    esi: {
      applicable: !!form.esi?.applicable,
      ipNumber: form.esi?.ipNumber || "",
    },

    tax: {
      declarationSubmitted: !!form.tax?.declarationSubmitted,
    },

    photoKey: form.photoKey || "",

    // the entire original form as extras for rich mapping
    extras: form,

    // attachments: same as you were sending
    attachments: form.attachments || [],
  };

  return payload;
}

/* ---------------- Component ---------------- */
export default function EmployeeOnboardingForm({
  token,
  inviteEmail,
  defaultName,
  onSubmitted,
}: Props) {
  const [tab, setTab] = useState<"details" | "documents" | "review">("details");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    fullName: defaultName || "",
    fatherOrHusbandName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    casteCategory: "",
    contact: {
      personalMobile: "",
      personalEmail: inviteEmail || "",
      alternateMobile: "",
      alternateEmail: "",
    },
    address: {
      current: { ...EMPTY_ADDRESS },
      permanent: { ...EMPTY_ADDRESS },
      sameAsCurrent: false,
    },
    emergency: { name: "", relationship: "", mobile: "", address: "" },
    ids: { aadhaar: "", pan: "", voterId: "", rationCard: "", passportNo: "", drivingLicense: "" },
    bank: { accountNumber: "", bankName: "", branch: "", ifsc: "" },
    education: { highestDegree: "", institution: "", year: "", certifications: "" },
    previousEmployer: { organization: "", position: "", tenure: "" },
    employment: { dateOfJoining: "" },
    pf: { nomineeName: "", nomineeRelationship: "", nomineeSharePercent: "" },
    esi: { applicable: false, ipNumber: "" },
    tax: { declarationSubmitted: false },
    dependents: "",
    gratuityNominee: "",
    insuranceBeneficiary: "",
    preferredName: "",
    languagesKnown: "",
    hobbies: "",
    previousAddress: "",
    photoKey: "",
    attachments: [],
  });

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function update(path: string, value: any) {
    setForm((prev) => {
      const next: any = structuredClone(prev);
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next as FormState;
    });
  }

  function copyCurrentToPermanent(checked: boolean) {
    if (!checked) return;
    setForm((p) => ({
      ...p,
      address: { ...p.address, permanent: { ...p.address.current }, sameAsCurrent: true },
    }));
  }

  async function saveDraft() {
    try {
      setSaving(true);
      await api.post(`/onboarding/draft/${token}`, { core: form, attachments: form.attachments });
    } finally {
      setSaving(false);
    }
  }

  function validateAll(): string[] {
    const list: string[] = [];
    for (const rule of REQUIRED_FIELDS) {
      const [label, ok] = rule(form);
      if (!ok) list.push(label);
    }
    return list;
  }

  /* ---------- FIX: build legacy+extras payload for submit ---------- */
  async function handleSubmit() {
    const missing = validateAll();
    if (missing.length) {
      setErrors(missing);
      setTab("details");
      return;
    }
    try {
      setSubmitting(true);

      // Build the minimal legacy payload + extras blob the backend expects
      const payload = buildLegacySubmitPayload(form);

      // Send directly (not nested under { core }) to satisfy legacy validator
      const res = await api.post(`/onboarding/submit/${token}`, payload);

      onSubmitted?.(res.ticket || res.message || "submitted");
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function presignAndUpload(file: File, kind: string): Promise<{ key: string }> {
    const presign = await api.post(`/onboarding/employees/upload-doc`, {
      type: "employees",
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });

    if (presign?.upload?.method === "POST") {
      const { url, fields } = presign.upload;
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, String(v)));
      formData.append("Content-Type", file.type);
      formData.append("file", file);
      await fetch(url, { method: "POST", body: formData });
      return { key: presign.objectKey };
    }

    if (presign?.upload?.method === "PUT") {
      await fetch(presign.upload.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      return { key: presign.objectKey };
    }

    throw new Error("Presign failed");
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { key } = await presignAndUpload(file, "photo");
    set("photoKey", key);
  }

  const banner = useMemo(() => {
    if (!errors.length) return null;
    return (
      <div className="border border-red-300 bg-red-50 text-red-800 rounded px-3 py-2 mb-3">
        <div className="font-semibold mb-1">Please fill all required fields:</div>
        <ul className="list-disc list-inside text-sm">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }, [errors]);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#00477f]">Employee Onboarding</h1>
        <button
          onClick={saveDraft}
          className="px-3 py-1 rounded bg-gray-900 text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 text-sm border-b">
        {(["details", "documents", "review"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-1 pb-2 -mb-px ${
              tab === t ? "border-b-2 border-[#00477f] font-semibold text-[#00477f]" : "text-gray-500"
            }`}
          >
            {t === "details" ? "Details" : t === "documents" ? "Documents" : "Review"}
          </button>
        ))}
      </div>

      {banner}

      {tab === "details" && (
        <div className="grid gap-6">
          {/* Personal */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Personal Details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="fullName"
                label="Full Name (as per official records) *"
                value={form.fullName}
                onChange={(v) => set("fullName", v)}
                required
              />
              <Text
                id="father"
                label="Father’s/Husband’s Name"
                value={form.fatherOrHusbandName || ""}
                onChange={(v) => set("fatherOrHusbandName", v)}
              />
              <Text
                id="dob"
                label="Date of Birth *"
                type="date"
                value={form.dateOfBirth}
                onChange={(v) => set("dateOfBirth", v)}
                required
              />
              <Select
                id="gender"
                label="Gender *"
                value={form.gender}
                onChange={(v) => set("gender", v)}
                options={["Male", "Female", "Other"]}
                required
              />
              <Select
                id="marital"
                label="Marital Status"
                value={form.maritalStatus || ""}
                onChange={(v) => set("maritalStatus", v)}
                options={["Single", "Married", "Other"]}
              />
              <Select
                id="caste"
                label="Caste/Category"
                value={form.casteCategory || ""}
                onChange={(v) => set("casteCategory", v)}
                options={["Gen", "SC", "ST", "OBC", "EWS"]}
              />
            </div>
          </section>

          {/* Contact */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Contact</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="pmobile"
                label="Personal Mobile Number *"
                value={form.contact.personalMobile}
                onChange={(v) => update("contact.personalMobile", v)}
                required
              />
              <Text
                id="pemail"
                label="Personal Email ID *"
                value={form.contact.personalEmail}
                onChange={(v) => update("contact.personalEmail", v)}
                required
              />
              <Text
                id="amobile"
                label="Alternate Contact Number"
                value={form.contact.alternateMobile || ""}
                onChange={(v) => update("contact.alternateMobile", v)}
              />
              <Text
                id="aemail"
                label="Alternate Email ID"
                value={form.contact.alternateEmail || ""}
                onChange={(v) => update("contact.alternateEmail", v)}
              />
            </div>
          </section>

          {/* Address */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Residential Address</h2>
            <h3 className="font-semibold mb-1">Current Address *</h3>
            <AddressBlock
              value={form.address.current}
              onChange={(a) => update("address.current", a)}
              required
            />
            <div className="mt-3 flex items-center gap-2">
              <input
                id="same"
                type="checkbox"
                checked={!!form.address.sameAsCurrent}
                onChange={(e) => {
                  update("address.sameAsCurrent", e.target.checked);
                  copyCurrentToPermanent(e.target.checked);
                }}
              />
              <label htmlFor="same">Permanent address is same as current</label>
            </div>
            <h3 className="font-semibold mt-4 mb-1">Permanent Address *</h3>
            <AddressBlock
              value={form.address.permanent}
              onChange={(a) => update("address.permanent", a)}
              required
            />
          </section>

          {/* Emergency */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Emergency Contact Details *</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="ename"
                label="Name *"
                value={form.emergency.name}
                onChange={(v) => update("emergency.name", v)}
                required
              />
              <Text
                id="erel"
                label="Relationship *"
                value={form.emergency.relationship}
                onChange={(v) => update("emergency.relationship", v)}
                required
              />
              <Text
                id="emob"
                label="Mobile *"
                value={form.emergency.mobile}
                onChange={(v) => update("emergency.mobile", v)}
                required
              />
              <Text
                id="eaddr"
                label="Address"
                value={form.emergency.address || ""}
                onChange={(v) => update("emergency.address", v)}
              />
            </div>
          </section>

          {/* IDs */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Government IDs</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="aadhaar"
                label="Aadhaar Card Number *"
                value={form.ids.aadhaar}
                onChange={(v) => update("ids.aadhaar", v)}
                required
              />
              <Text
                id="pan"
                label="PAN Card Number *"
                value={form.ids.pan}
                onChange={(v) => update("ids.pan", v)}
                required
              />
              <Text
                id="voter"
                label="Voter ID"
                value={form.ids.voterId || ""}
                onChange={(v) => update("ids.voterId", v)}
              />
              <Text
                id="ration"
                label="Ration Card"
                value={form.ids.rationCard || ""}
                onChange={(v) => update("ids.rationCard", v)}
              />
              <Text
                id="passport"
                label="Passport Number"
                value={form.ids.passportNo || ""}
                onChange={(v) => update("ids.passportNo", v)}
              />
              <Text
                id="dl"
                label="Driving License Number"
                value={form.ids.drivingLicense || ""}
                onChange={(v) => update("ids.drivingLicense", v)}
              />
            </div>
          </section>

          {/* Banking */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Bank Account Details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="acct"
                label="Account Number *"
                value={form.bank.accountNumber}
                onChange={(v) => update("bank.accountNumber", v)}
                required
              />
              <Text
                id="bname"
                label="Bank Name *"
                value={form.bank.bankName}
                onChange={(v) => update("bank.bankName", v)}
                required
              />
              <Text
                id="branch"
                label="Branch"
                value={form.bank.branch || ""}
                onChange={(v) => update("bank.branch", v)}
              />
              <Text
                id="ifsc"
                label="IFSC Code *"
                value={form.bank.ifsc}
                onChange={(v) => update("bank.ifsc", v)}
                required
              />
            </div>
          </section>

          {/* Education / Employment */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Education & Employment</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="degree"
                label="Highest Degree *"
                value={form.education.highestDegree}
                onChange={(v) => update("education.highestDegree", v)}
                required
              />
              <Text
                id="inst"
                label="Institution"
                value={form.education.institution || ""}
                onChange={(v) => update("education.institution", v)}
              />
              <Text
                id="year"
                label="Year of Completion"
                value={form.education.year || ""}
                onChange={(v) => update("education.year", v)}
              />
              <Text
                id="cert"
                label="Professional Certifications"
                value={form.education.certifications || ""}
                onChange={(v) => update("education.certifications", v)}
              />
              <Text
                id="org"
                label="Previous Organization"
                value={form.previousEmployer?.organization || ""}
                onChange={(v) => update("previousEmployer.organization", v)}
              />
              <Text
                id="pos"
                label="Position"
                value={form.previousEmployer?.position || ""}
                onChange={(v) => update("previousEmployer.position", v)}
              />
              <Text
                id="tenure"
                label="Tenure"
                value={form.previousEmployer?.tenure || ""}
                onChange={(v) => update("previousEmployer.tenure", v)}
              />
              <Text
                id="doj"
                label="Date of Joining *"
                type="date"
                value={form.employment.dateOfJoining}
                onChange={(v) => update("employment.dateOfJoining", v)}
                required
              />
            </div>
          </section>

          {/* Statutory */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Statutory</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text
                id="pfname"
                label="PF Nominee Name"
                value={form.pf?.nomineeName || ""}
                onChange={(v) => update("pf.nomineeName", v)}
              />
              <Text
                id="pfrel"
                label="PF Nominee Relationship"
                value={form.pf?.nomineeRelationship || ""}
                onChange={(v) => update("pf.nomineeRelationship", v)}
              />
              <Text
                id="pfshare"
                label="PF Nominee Share (%)"
                value={form.pf?.nomineeSharePercent || ""}
                onChange={(v) => update("pf.nomineeSharePercent", v)}
              />
              <div className="flex items-center gap-2">
                <input
                  id="esi"
                  type="checkbox"
                  checked={!!form.esi?.applicable}
                  onChange={(e) => update("esi.applicable", e.target.checked)}
                />
                <label htmlFor="esi">ESI Applicable (salary &lt; ₹21,000)</label>
              </div>
              {form.esi?.applicable && (
                <Text
                  id="ip"
                  label="ESI IP Number"
                  value={form.esi?.ipNumber || ""}
                  onChange={(v) => update("esi.ipNumber", v)}
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  id="tax"
                  type="checkbox"
                  checked={!!form.tax?.declarationSubmitted}
                  onChange={(e) => update("tax.declarationSubmitted", e.target.checked)}
                />
                <label htmlFor="tax">Tax Declaration Submitted (Form 12BB etc.)</label>
              </div>
            </div>
          </section>

          {/* Optional */}
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Optional</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <Text id="deps" label="List of Dependents" value={form.dependents || ""} onChange={(v) => set("dependents", v)} />
              <Text id="grat" label="Gratuity Nominee Details" value={form.gratuityNominee || ""} onChange={(v) => set("gratuityNominee", v)} />
              <Text id="ins" label="Insurance Beneficiary" value={form.insuranceBeneficiary || ""} onChange={(v) => set("insuranceBeneficiary", v)} />
              <Text id="pname" label="Preferred Name for Communication" value={form.preferredName || ""} onChange={(v) => set("preferredName", v)} />
              <Text id="lang" label="Languages Known" value={form.languagesKnown || ""} onChange={(v) => set("languagesKnown", v)} />
              <Text id="hobby" label="Hobbies/Interests" value={form.hobbies || ""} onChange={(v) => set("hobbies", v)} />
              <Text id="prevaddr" label="Previous Address" value={form.previousAddress || ""} onChange={(v) => set("previousAddress", v)} />
            </div>
          </section>
        </div>
      )}

      {tab === "documents" && (
        <div className="grid gap-6">
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Photo for ID Card *</h2>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
            {form.photoKey ? (
              <p className="text-sm text-green-700 mt-2">Uploaded ✓ (key: {form.photoKey})</p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Upload a passport-size photo on plain background.</p>
            )}
          </section>

          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Other Documents</h2>
            <UploadAndCollect
              onUploaded={(u) => setForm((p) => ({ ...p, attachments: [...p.attachments, u] }))}
              presign={presignAndUpload}
            />
          </section>
        </div>
      )}

      {tab === "review" && (
        <div className="grid gap-6">
          <section className="p-4 rounded-2xl border shadow-sm">
            <h2 className="font-bold text-lg mb-3">Review & Submit</h2>
            <p className="text-sm text-gray-600 mb-3">Please verify your details. Required items are marked with *</p>
            <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto">
{JSON.stringify(form, null, 2)}
            </pre>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setTab("details")} className="px-4 py-2 rounded border">Back to Details</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded bg-[#00477f] text-white">
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Sticky footer nav */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur border-t py-3 flex justify-between">
        <div className="text-xs text-gray-500">AI-Trailblazer layout • Smooth 3-step flow</div>
        <div className="flex gap-2">
          {tab !== "details" && (
            <button
              className="px-3 py-1 rounded border"
              onClick={() => setTab(tab === "documents" ? "details" : "documents")}
            >
              Back
            </button>
          )}
          {tab !== "review" && (
            <button
              className="px-3 py-1 rounded bg-[#00477f] text-white"
              onClick={() => setTab(tab === "details" ? "documents" : "review")}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------ Basic UI atoms (Trailblazer clean look) ------------ */
function Text({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00477f]/40"
      />
    </label>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        required={required}
        className="rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00477f]/40 bg-white"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddressBlock({
  value,
  onChange,
  required = false,
}: {
  value: Address;
  onChange: (a: Address) => void;
  required?: boolean;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Text
        id="l1"
        label={`Address Line 1${required ? " *" : ""}`}
        value={value.line1}
        onChange={(v) => onChange({ ...value, line1: v })}
        required={required}
      />
      <Text id="l2" label="Address Line 2" value={value.line2 || ""} onChange={(v) => onChange({ ...value, line2: v })} />
      <Text
        id="city"
        label={`City${required ? " *" : ""}`}
        value={value.city}
        onChange={(v) => onChange({ ...value, city: v })}
        required={required}
      />
      <Text
        id="state"
        label={`State${required ? " *" : ""}`}
        value={value.state}
        onChange={(v) => onChange({ ...value, state: v })}
        required={required}
      />
      <Text
        id="zip"
        label={`PIN/ZIP${required ? " *" : ""}`}
        value={value.zip}
        onChange={(v) => onChange({ ...value, zip: v })}
        required={required}
      />
      <Text
        id="country"
        label={`Country${required ? " *" : ""}`}
        value={value.country}
        onChange={(v) => onChange({ ...value, country: v })}
        required={required}
      />
    </div>
  );
}

function UploadAndCollect({
  presign,
  onUploaded,
}: {
  presign: (file: File, kind: string) => Promise<{ key: string }>;
  onUploaded: (u: { kind: string; key: string; name: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("other");

  async function go() {
    if (!file) return;
    setBusy(true);
    try {
      const { key } = await presign(file, kind);
      onUploaded({ kind, key, name: file.name });
      setFile(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="border rounded px-2 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="id">ID Proof</option>
        <option value="address">Address Proof</option>
        <option value="edu">Education</option>
        <option value="offer">Offer/Relieving</option>
        <option value="other">Other</option>
      </select>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={go} disabled={busy || !file} className="px-3 py-1 rounded bg-gray-900 text-white disabled:opacity-60">
        {busy ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}
