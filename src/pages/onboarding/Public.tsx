// apps/frontend/src/pages/onboarding/Public.tsx
import { useEffect, useMemo, useRef, useState, DragEvent } from "react";
import { useParams } from "react-router-dom";
import api from "../../lib/api";

/** ------------------ Types ------------------ */
type OnboardingType = "Vendor" | "Business" | "Employee";
type Upload = { name?: string; key?: string; file?: File; docType?: string };

type InviteMeta = {
  ok?: boolean;
  token: string;
  type: OnboardingType | string;
  status: string;
  email?: string;
  inviteeEmail?: string;
  name?: string;
  inviteeName?: string;
  expiresAt?: string | null;
  draftUrl: string;
  submitUrl: string;
  detailsUrl: string;
  message?: string;
  turnaroundHours?: number;
};

type EmployeeCore = {
  fullName?: string;
  fatherOrHusbandName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: { current?: string; permanent?: string };
  contact?: { personalMobile?: string; personalEmail?: string; altMobile?: string; altEmail?: string };
  emergency?: { name?: string; relationship?: string; mobile?: string; address?: string };
  ids?: { aadhaar?: string; pan?: string; voterId?: string; rationCard?: string; others?: string };
  bank?: { accountNumber?: string; bankName?: string; branch?: string; ifsc?: string };
  education?: { highestDegree?: string; institution?: string; year?: string };
  previousEmployer?: { organization?: string; position?: string; tenure?: string };
  employment?: { dateOfJoining?: string; casteCategory?: string; maritalStatus?: string };
  pf?: { nominationDetails?: string };
  esi?: { applicable?: boolean | string; number?: string };
  tax?: { form12bb?: string };
  photoKey?: string;

  // good-to-have
  dependents?: string;
  passport?: string;
  drivingLicense?: string;
  certifications?: string;
  medicalFitness?: string;
  gratuityNominee?: string;
  insuranceBeneficiary?: string;
  preferredName?: string;
  languages?: string;
  hobbies?: string;
  previousAddress?: string;
  otherGovtIds?: string;
};

type DraftPayload = { core: EmployeeCore | Record<string, any>; attachments: Upload[] };

/** ------------------ Small UI helpers (AI-styled) ------------------ */
function Label({ children, required = false, hint }: { children: any; required?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[13px] font-medium text-zinc-700 tracking-wide">
        {children} {required && <span className="text-red-500">*</span>}
      </label>
      {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        "placeholder:text-zinc-400 " +
        (props.className || "")
      }
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none min-h-[96px] " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        "placeholder:text-zinc-400 " +
        (props.className || "")
      }
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        (props.className || "")
      }
    />
  );
}

function AIBadge({ text = "AI hint" }: { text?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-gradient-to-r
                 from-[#b8b3ff] via-[#9ef0ff] to-[#4cffb0] text-[#0b1130] shadow-sm"
    >
      ✨ {text}
    </span>
  );
}

function AITip({ children }: { children: any }) {
  return (
    <div className="text-[11px] text-zinc-500 bg-white/60 border border-zinc-200 rounded-lg px-3 py-2">
      <span className="mr-1">🤖</span>
      {children}
    </div>
  );
}

/** ------------------ Pretty review helpers ------------------ */
function Section({ title, children, right }: { title: string; children: any; right?: any }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 backdrop-blur">
      <div className="px-4 py-2 border-b bg-zinc-50/70 text-sm font-semibold text-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00477f]/70 shadow-[0_0_10px_rgba(0,71,127,.45)]" />
          {title}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value?: any }) {
  const v = value === undefined || value === null || value === "" ? "—" : String(value);
  return (
    <div className="grid grid-cols-12 gap-3 py-1.5">
      <div className="col-span-12 md:col-span-4 text-xs text-zinc-500">{label}</div>
      <div className="col-span-12 md:col-span-8 text-sm text-zinc-800">{v}</div>
    </div>
  );
}

/** ------------------ Utils ------------------ */
function normalizeType(raw?: string): "employee" | "vendor" | "business" {
  const s = (raw || "employee").toString().trim().toLowerCase();
  if (s === "vendor") return "vendor";
  if (s === "business") return "business";
  return "employee";
}
function titleCase(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

type StepMeta = {
  key: string;
  label: string;
  category: string;
  aiBadge: string;
  tip: string;
  docStats?: {
    required: number;
    attached: number;
  };
};

function computeDocStats(kind: "employee" | "vendor" | "business", files: Upload[]): StepMeta["docStats"] {
  const slots =
    kind === "employee"
      ? (EMPLOYEE_DOC_SLOTS as readonly Slot[])
      : kind === "vendor"
      ? (VENDOR_DOC_SLOTS as readonly Slot[])
      : (BUSINESS_DOC_SLOTS as readonly Slot[]);

  const requiredKeys = slots.filter((s) => s.required).map((s) => s.key);
  if (!requiredKeys.length) return undefined;

  const attached = new Set<string>();
  for (const f of files) {
    if (f.docType && requiredKeys.includes(f.docType)) {
      attached.add(f.docType);
    }
  }

  return {
    required: requiredKeys.length,
    attached: attached.size,
  };
}

function getStepMeta(kind: "employee" | "vendor" | "business", stepKey: string | undefined, files: Upload[]): StepMeta {
  const base: StepMeta = {
    key: stepKey || "welcome",
    label: "Overview",
    category: "Overview",
    aiBadge: "AI-guided flow",
    tip: "This onboarding is broken into small steps with auto-save and basic validation. You can leave and resume anytime.",
  };

  if (!stepKey || stepKey === "welcome") return base;

  if (kind === "employee") {
    if (stepKey === "identity") {
      return {
        ...base,
        category: "Identity",
        label: "Identity details",
        aiBadge: "Smart validation: name & DOB",
        tip: "Match your name and date of birth exactly as per Aadhaar/PAN to avoid payroll and compliance mismatches.",
      };
    }
    if (stepKey === "contact") {
      return {
        ...base,
        category: "Contact",
        label: "Contact & address",
        aiBadge: "Reachability checks",
        tip: "Share a reachable mobile and email you check often. Use the copy chip if permanent address matches current.",
      };
    }
    if (stepKey === "emergency") {
      return {
        ...base,
        category: "Safety",
        label: "Emergency contact",
        aiBadge: "Safety first",
        tip: "Choose someone who stays reachable during working hours and preferably lives in the same city.",
      };
    }
    if (stepKey === "ids") {
      return {
        ...base,
        category: "Compliance",
        label: "Government IDs",
        aiBadge: "ID coverage",
        tip: "Enter Aadhaar and PAN carefully. Typos delay background checks and payroll creation.",
      };
    }
    if (stepKey === "bank") {
      return {
        ...base,
        category: "Payouts",
        label: "Bank details",
        aiBadge: "Payout readiness",
        tip: "Cross-check IFSC and account number with your cancelled cheque to avoid payout failures.",
      };
    }
    if (stepKey === "education") {
      return {
        ...base,
        category: "Profile",
        label: "Education",
        aiBadge: "Profile depth",
        tip: "Share your highest qualification so HR can match you to the right band and role level.",
      };
    }
    if (stepKey === "employment") {
      return {
        ...base,
        category: "Profile",
        label: "Work history",
        aiBadge: "Context for role",
        tip: "Last organization, role and tenure help us understand your experience trajectory.",
      };
    }
    if (stepKey === "statutory") {
      return {
        ...base,
        category: "Compliance",
        label: "PF / ESI / Tax",
        aiBadge: "Statutory setup",
        tip: "Nomination and statutory details are used only for compliance and benefits configuration.",
      };
    }
    if (stepKey === "good") {
      return {
        ...base,
        category: "Preferences",
        label: "Good-to-have info",
        aiBadge: "Personalisation",
        tip: "Optional details like languages, hobbies and dependents help us personalise your PlumTrips experience.",
      };
    }
    if (stepKey === "docs") {
      return {
        ...base,
        category: "Documents",
        label: "Upload checklist",
        aiBadge: "Document coverage",
        tip: "Attach clear scans or PDFs. Prefer single combined PDFs for education and experience, if possible.",
        docStats: computeDocStats(kind, files),
      };
    }
    if (stepKey === "review") {
      return {
        ...base,
        category: "Review",
        label: "Final review",
        aiBadge: "AI-style summary",
        tip: "Quickly scan all sections. If something looks off, go back using the steps above before submitting.",
        docStats: computeDocStats(kind, files),
      };
    }
  }

  if (kind === "vendor" || kind === "business") {
    if (stepKey === "vendor-basic" || stepKey === "biz-basic") {
      return {
        ...base,
        category: "Identity",
        label: "Business basics",
        aiBadge: "KYC overview",
        tip: "Registered name, entity type and core identifiers form the backbone of vendor KYC.",
      };
    }
    if (stepKey === "vendor-contacts" || stepKey === "key-contacts") {
      return {
        ...base,
        category: "Contacts",
        label: "Key contacts",
        aiBadge: "Single source of truth",
        tip: "Add at least one fully filled contact so we always know whom to reach for approvals and escalations.",
      };
    }
    if (stepKey === "vendor-addresses") {
      return {
        ...base,
        category: "Addresses",
        label: "Registered & operational addresses",
        aiBadge: "Geo clarity",
        tip: "Mention where your registered office is and if operations run from a different address.",
      };
    }
    if (stepKey === "vendor-tax") {
      return {
        ...base,
        category: "Compliance",
        label: "Tax & registrations",
        aiBadge: "GST / PAN mapping",
        tip: "GST and PAN details are used for invoicing and compliance checks.",
      };
    }
    if (stepKey === "vendor-bank" || stepKey === "bank") {
      return {
        ...base,
        category: "Payouts",
        label: "Bank details",
        aiBadge: "Payout readiness",
        tip: "Bank details are used for vendor payments and refunds, wherever applicable.",
      };
    }
    if (stepKey === "vendor-services") {
      return {
        ...base,
        category: "Scope",
        label: "Services & experience",
        aiBadge: "Fitment view",
        tip: "Describe the scope of work and experience so we can route the right mandates to you.",
      };
    }
    if (stepKey === "docs") {
      return {
        ...base,
        category: "Documents",
        label: "Upload checklist",
        aiBadge: "Document coverage",
        tip: "Upload crisp documents for registrations, bank details and profiles. This speeds up empanelment.",
        docStats: computeDocStats(kind, files),
      };
    }
    if (stepKey === "review") {
      return {
        ...base,
        category: "Review",
        label: "Final review",
        aiBadge: "Console view",
        tip: "The summary below behaves like a console log of your KYC. Scan it once before submitting.",
        docStats: computeDocStats(kind, files),
      };
    }
  }

  return base;
}

/** ------------------ Doc Slot Presets ------------------ */
type Slot = { key: string; label: string; accept?: string; required?: boolean; multiple?: boolean; hint?: string };

const EMPLOYEE_DOC_SLOTS = [
  { key: "photo", label: "Passport-size Photograph", accept: ".jpg,.jpeg,.png,.webp,.heic", required: true },
  { key: "aadhaar", label: "Aadhaar Card", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "pan", label: "PAN Card", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "address", label: "Address Proof", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "bank", label: "Cancelled Cheque / Bank Proof", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "resume", label: "Resume / CV", accept: ".pdf", required: true },
  { key: "education", label: "Education Certificates", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
  { key: "experience", label: "Experience Letters", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
  { key: "offer", label: "Offer/Appointment Letter", accept: ".pdf", multiple: true },
  { key: "others", label: "Others", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
] as const;

const VENDOR_DOC_SLOTS: Slot[] = [
  { key: "company_reg", label: "Company Registration Copy (COI/Partnership Deed)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "gst", label: "GST Registration Certificate", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "pan", label: "PAN (Business/Owner)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "cancelled_cheque", label: "Cancelled Cheque (Bank Verification)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "non_blacklist", label: "Signed Non-Blacklisting Declaration", accept: ".pdf", required: true },
  { key: "nda", label: "Signed NDA / Confidentiality", accept: ".pdf", required: true },
  { key: "compliance", label: "Compliance Certificates (ISO/FSSAI/etc.)", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "tax_compliance", label: "Tax Compliance (GST/TDS challans if asked)", accept: ".pdf" },
  { key: "statutory", label: "Statutory (Shop & Establishment / PF / ESI if applicable)", accept: ".pdf" },
  { key: "profile", label: "Company Profile / Brochure", accept: ".pdf" },
  { key: "directors", label: "List of Directors/Partners with KYC", accept: ".pdf,.xlsx,.xls,.csv" },
  { key: "financials", label: "Audited Financial Statements / Turnover (3 yrs)", accept: ".pdf" },
  { key: "office_photos", label: "Office Photos", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
  { key: "awards", label: "Awards / Recognitions", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "insurance", label: "Insurance Coverage (liability / WC)", accept: ".pdf" },
  { key: "esg", label: "ESG / CSR Initiatives", accept: ".pdf" },
  { key: "assets", label: "List of Major Assets / Equipment", accept: ".pdf,.xlsx,.xls,.csv" },
  { key: "litigation", label: "Pending Litigation / Legal Cases Declaration", accept: ".pdf" },
  { key: "references", label: "Feedback / References from Previous Clients", accept: ".pdf" },
  { key: "others", label: "Others", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
];

const BUSINESS_DOC_SLOTS: Slot[] = [
  { key: "pan", label: "PAN Card (Business)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "gst", label: "GST Registration Certificate", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "coi", label: "Certificate of Incorporation / Registration", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "cancelled_cheque", label: "Cancelled Cheque (Bank Verification)", accept: ".pdf,.jpg,.jpeg,.png", required: true },
  { key: "directors_list", label: "List of Directors/Partners/Proprietor (with KYC)", accept: ".pdf,.xlsx,.xls,.csv" },
  { key: "profile_brochure", label: "Business Profile / Corporate Brochure", accept: ".pdf" },
  { key: "financials", label: "Annual Turnover / Financial Statements (2–3 yrs)", accept: ".pdf" },
  { key: "msme", label: "MSME Registration (if applicable)", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "awards", label: "Awards / Recognitions / Certifications", accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "references", label: "References from Clients/Vendors", accept: ".pdf" },
  { key: "social", label: "Social Handles (PDF/Note)", accept: ".pdf" },
  { key: "portfolio", label: "Product/Service Portfolio", accept: ".pdf" },
  { key: "group_tree", label: "Parent/Subsidiary Details", accept: ".pdf" },
  { key: "purchase_officer", label: "Authorized Purchase Officer Contact", accept: ".pdf" },
  { key: "sales_tax", label: "Sales Tax Registration (if applicable)", accept: ".pdf" },
  { key: "declarations", label: "Legal/Compliance Declarations", accept: ".pdf" },
  { key: "pref_lang", label: "Preferred Communication Language (note)", accept: ".pdf" },
  { key: "tax_exempt", label: "Tax Exemption Certificates (if applicable)", accept: ".pdf" },
  { key: "insurance", label: "Insurance Coverage Details", accept: ".pdf" },
  { key: "others", label: "Others", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
];

/** ------------------ Component ------------------ */
export default function PublicOnboarding() {
  const { token } = useParams<{ token: string }>();

  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const [files, setFiles] = useState<Upload[]>([]);
  const [core, setCore] = useState<EmployeeCore | Record<string, any>>({
    address: {},
    contact: {},
    emergency: {},
    ids: {},
    bank: {},
    education: {},
    previousEmployer: {},
    employment: {},
    pf: {},
    esi: {},
    tax: {},
  });

  const draftTimer = useRef<number | null>(null);

  /** -------- Fetch invite meta -------- */
  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      setErr(null);
      try {
        const res = await api.get(`/onboarding/invite/${token}`);
        const m: InviteMeta = res;
        (m as any).turnaroundHours = m?.turnaroundHours ?? 72;
        setMeta(m);
      } catch (e: any) {
        setErr(e?.message ?? "Invite not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  /** -------- Derived type & steps -------- */
  const kind = normalizeType(meta?.type);
  const displayKind = titleCase(kind);

  const steps = useMemo(() => {
    if (kind === "vendor") {
      return [
        { key: "welcome", title: "Welcome" },
        { key: "vendor-basic", title: "Identity & Entity" },
        { key: "vendor-contacts", title: "Primary Contact" },
        { key: "vendor-addresses", title: "Addresses" },
        { key: "vendor-tax", title: "Tax & Registrations" },
        { key: "vendor-bank", title: "Bank Details" },
        { key: "vendor-services", title: "Services & Experience" },
        { key: "docs", title: "Documents" },
        { key: "review", title: "Review & Submit" },
      ];
    }
    if (kind === "business") {
      return [
        { key: "welcome", title: "Welcome" },
        { key: "entity-type", title: "Select Entity Type" }, // ✅ NEW FIRST STEP
        { key: "biz-basic", title: "Business Basics" },
        { key: "key-contacts", title: "Key Contacts" },
        { key: "bank", title: "Bank Details" },
        { key: "docs", title: "Documents" },
        { key: "review", title: "Review & Submit" },
      ];
    }
    return [
      { key: "welcome", title: "Welcome" },
      { key: "identity", title: "Identity" },
      { key: "contact", title: "Contact & Address" },
      { key: "emergency", title: "Emergency" },
      { key: "ids", title: "Government IDs" },
      { key: "bank", title: "Bank Details" },
      { key: "education", title: "Education" },
      { key: "employment", title: "Employment" },
      { key: "statutory", title: "Statutory (PF/ESI/Tax)" },
      { key: "good", title: "Good to Have" },
      { key: "docs", title: "Documents" },
      { key: "review", title: "Review & Submit" },
    ];
  }, [kind]);

  const currentKey = steps[Math.min(step, steps.length - 1)]?.key;

    const stepMeta = useMemo(
    () => getStepMeta(kind, currentKey, files),
    [kind, currentKey, files]
  );


  /** -------- Draft -------- */
  const canDraft = !!meta?.draftUrl && !!token;
  function scheduleDraft() {
    if (!canDraft) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(saveDraft, 500);
  }
  async function saveDraft() {
    if (!canDraft) return;
    setSaving(true);
    try {
      const payload: DraftPayload = { core, attachments: files };
      await api.post(`/onboarding/draft/${token}`, payload);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  /** -------- Validation (Employee + Vendor + Business) -------- */
  function missingForStep(): string[] {
    const key = currentKey;

    // ---- Employee
    if (kind === "employee") {
      const c = core as EmployeeCore;
      const req: Record<string, any[]> = {
        identity: [
          ["fullName", c.fullName],
          ["fatherOrHusbandName", c.fatherOrHusbandName],
          ["dateOfBirth", c.dateOfBirth],
          ["gender", c.gender],
        ],
        contact: [
          ["address.current", c.address?.current],
          ["address.permanent", c.address?.permanent],
          ["contact.personalMobile", c.contact?.personalMobile],
          ["contact.personalEmail", c.contact?.personalEmail],
        ],
        emergency: [
          ["emergency.name", c.emergency?.name],
          ["emergency.relationship", c.emergency?.relationship],
          ["emergency.mobile", c.emergency?.mobile],
        ],
        ids: [
          ["ids.aadhaar", c.ids?.aadhaar],
          ["ids.pan", c.ids?.pan],
        ],
        bank: [
          ["bank.accountNumber", c.bank?.accountNumber],
          ["bank.bankName", c.bank?.bankName],
          ["bank.ifsc", c.bank?.ifsc],
        ],
        education: [
          ["education.highestDegree", c.education?.highestDegree],
          ["education.institution", c.education?.institution],
          ["education.year", c.education?.year],
        ],
        employment: [["employment.dateOfJoining", c.employment?.dateOfJoining]],
      };
      const forStep = req[key as string] || [];
      return forStep
        .filter(([, v]) => v === undefined || v === null || (typeof v === "string" && v.trim() === ""))
        .map(([k]) => k);
    }

    // ---- Business
if (kind === "business") {
  const b = core as Record<string, any>;

  // 🚨 Entity type must be selected first
  if (key === "entity-type" && !b.entityType) {
  return ["entityType"];
}
if (key !== "entity-type" && !b.entityType) {
  return ["entityType"];
}
  
      const reqByStep: Record<string, string[]> = {
        "biz-basic": [
  "legalName",
  "registeredAddress",
  "signatory.name",
  "signatory.designation",
  "contacts.primaryPhone",
  "officialEmail",
  "gstNumber",
  "panNumber",
  "industry",
  "employeesCount",
  "description",
  "incorporationDate",
],
        "key-contacts": [],
        bank: ["bank.accountNumber", "bank.bankName", "bank.ifsc", "bank.branch"],
        docs: [],
      };

      const flatMissing: string[] = [];

// start with base required fields
let list = [...(reqByStep[key as string] || [])];

// 🔥 ENTITY-BASED RULES
// URP (Unregistered Person) does NOT require GST
if (key === "biz-basic" && b.entityType === "URP") {
  list = list.filter(
    (f) => f !== "gstNumber" && f !== "incorporationDate"
  );
}


for (const path of list) {
  const parts = path.split(".");
  let ref: any = b;
  for (let i = 0; i < parts.length; i++) {
    if (ref == null) {
      ref = undefined;
      break;
    }
    ref = ref[parts[i]];
  }
  if (ref === undefined || ref === null || (typeof ref === "string" && ref.trim() === "")) {
    flatMissing.push(path);
  }
}

if (key === "key-contacts") {
        const arr = Array.isArray(b.keyContacts) ? b.keyContacts : [];
        const first = arr[0] || {};
        const fields = ["name", "designation", "email", "mobile"];
        const incomplete = fields.filter((f) => !String(first[f] || "").trim());
        if (incomplete.length) flatMissing.push("keyContacts[0].name/email/mobile/designation");
      }

      if (key === "docs") {
        let need = BUSINESS_DOC_SLOTS.filter((s) => s.required).map((s) => s.key);

// URP relaxation
if (b.entityType === "URP") {
  need = need.filter((k) => k !== "gst" && k !== "coi");
}
        const have = (files || []).map((f) => f.docType || "");
        const missingDocs = need.filter((k) => !have.includes(k));
        if (missingDocs.length) flatMissing.push(`documents: ${missingDocs.join(", ")}`);
      }

      return flatMissing;
    }

// ---- Vendor
if (kind === "vendor") {
  const v = core as Record<string, any>;

  // 🚨 Entity must be selected before moving ahead
  if (key !== "vendor-basic" && !v.entityType) {
    return ["entityType"];
  }

  const reqByStep: Record<string, string[]> = {
    "vendor-basic": ["companyName", "entityType"],
    "vendor-contacts": ["contactPerson.name", "contactPerson.designation", "contact.primary", "contact.email"],
    "vendor-addresses": ["address.registered"],
    "vendor-tax": ["gstNumber", "panNumber"],
    "vendor-bank": ["bank.accountNumber", "bank.bankName", "bank.ifsc", "bank.branch"],
    "vendor-services": ["services.nature", "services.scopeOfWork", "services.yearsOfExperience"],
    docs: [],
  };

  const flatMissing: string[] = [];
  let list = [...(reqByStep[key as string] || [])];

  // 🔥 ENTITY-BASED RULE: URP vendors do not require GST
  if (key === "vendor-tax" && v.entityType === "URP") {
    list = list.filter((f) => f !== "gstNumber");
  }

  for (const path of list) {
    const parts = path.split(".");
    let ref: any = v;
    for (let i = 0; i < parts.length; i++) {
      if (ref == null) {
        ref = undefined;
        break;
      }
      ref = ref[parts[i]];
    }
    if (ref === undefined || ref === null || (typeof ref === "string" && ref.trim() === "")) {
      flatMissing.push(path);
    }
  }

  if (key === "docs") {
    let need = VENDOR_DOC_SLOTS.filter((s) => s.required).map((s) => s.key);

    // 🔥 URP relaxation
    if (v.entityType === "URP") {
      need = need.filter((k) => k !== "gst");
    }

    const have = (files || []).map((f) => f.docType || "");
    const missingDocs = need.filter((k) => !have.includes(k));
    if (missingDocs.length) {
      flatMissing.push(`documents: ${missingDocs.join(", ")}`);
    }
  }

  return flatMissing;
}
    return [];
  }

  /** -------- Navigation -------- */
  function nextStep() {
    const miss = missingForStep();
    if (miss.length) {
      alert(`Please fill required fields:\n\n${miss.join("\n")}`);
      return;
    }
    setStep((s) => {
      const next = Math.min(s + 1, steps.length - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return next;
    });
    scheduleDraft();
  }
  function prevStep() {
    setStep((s) => {
      const prev = Math.max(s - 1, 0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return prev;
    });
  }

  /** -------- Submit -------- */
  async function submit() {
    if (!token || !meta) return;
    const missAll = [...missingForStep()];
    if (missAll.length) {
      alert(`Please complete required fields:\n\n${missAll.join("\n")}`);
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const payload: DraftPayload = { core, attachments: files };
      const res = await api.post(`/onboarding/submit/${token}`, payload);
      setDone(res?.message || "Submitted successfully. Our team will review your details.");
    } catch (e: any) {
      setErr(e?.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  /** -------- Field helper -------- */
  function setC(path: string, value: any) {
    setCore((s: any) => {
      const copy = { ...(s || {}) };
      const parts = path.split(".");
      let ref = copy as Record<string, any>;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        ref[p] = ref[p] ?? {};
        ref = ref[p];
      }
      ref[parts[parts.length - 1]] = value;
      return copy;
    });
    scheduleDraft();
  }

  /** -------- Animated background styles (AI nebula) -------- */
  const GradientBG = () => (
    <>
      <style>{`
        @keyframes drift {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(10px,-8px,0) scale(1.04); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
      `}</style>
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 -left-24 h-[38rem] w-[38rem] rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, #9ef0ff, transparent 70%), radial-gradient(closest-side, #b8b3ff, transparent 70%)",
            animation: "drift 10s linear infinite",
          }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-[38rem] w-[38rem] rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, #ffd35a, transparent 70%), radial-gradient(closest-side, #4cffb0, transparent 70%)",
            animation: "drift 11s linear infinite",
          }}
        />
      </div>
    </>
  );

  /** -------- Guards -------- */
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <GradientBG />
        <div className="text-zinc-600 text-sm">Loading invite…</div>
      </div>
    );
  }
  if (err || !meta) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <GradientBG />
        <div className="w-full max-w-lg p-8 text-center space-y-3 border rounded-2xl bg-white/80 backdrop-blur">
          <div className="text-2xl font-extrabold text-red-600">Unable to open invite</div>
          <p className="text-zinc-600">{err ?? "Invite not found"}</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <GradientBG />
        <div className="w-full max-w-lg p-8 text-center space-y-3 border rounded-2xl bg-white/80 backdrop-blur">
          <div className="text-3xl font-extrabold">Thank you!</div>
          <p className="text-zinc-600">{done}</p>
        </div>
      </div>
    );
  }

  /** -------- Start Screen -------- */
  if (!started || currentKey === "welcome") {
    return (
      <div className="min-h-screen p-6 grid place-items-center">
        <GradientBG />
        <div className="w-full max-w-2xl p-8 space-y-6 border rounded-2xl shadow-sm bg-white/80 backdrop-blur">
          <div
            className="text-3xl font-extrabold leading-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #b8b3ff, #9ef0ff, #4cffb0, #ffd35a)" }}
          >
            {displayKind} Onboarding
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <AIBadge text="AI-guided flow" />
            <span>
              Welcome {meta.inviteeName || meta.name || meta.inviteeEmail || meta.email}. Turnaround time:{" "}
              <span className="font-medium">{meta.turnaroundHours ?? 72} hours</span>
            </span>
          </div>
          <div className="rounded-xl p-4 border bg-gradient-to-br from-white to-[#f7fbff]">
            <div className="text-zinc-700 text-sm">
              Guided stepper, contextual validation, AI tips and auto-save drafts. You can exit anytime; your progress is
              remembered.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="bg-[#00477f] hover:bg-[#003e6e] text-white px-4 py-2 rounded-xl shadow-sm transition"
              onClick={() => {
                setStarted(true);
                setStep(1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Start Onboarding
            </button>
            <span className="text-xs text-zinc-500">{saving ? "Saving draft…" : "Draft auto-save enabled"}</span>
          </div>
        </div>
      </div>
    );
  }

  /** -------- Progress Header -------- */
  const denom = Math.max(1, steps.length - 1);
  const pct = Math.max(0, Math.min(100, Math.round((step / denom) * 100)));

  return (
    <div className="min-h-screen p-4 md:p-6">
      <GradientBG />
            <div className="w-full max-w-4xl mx-auto">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
          <div className="py-3 space-y-2">
            {/* Row 1: title + invitee + AI badge */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base sm:text-lg font-extrabold tracking-tight">
                {displayKind} Onboarding{" "}
                <span className="ml-1.5 text-[11px] sm:text-xs text-zinc-500 font-normal">
                  {meta.inviteeName || meta.name || meta.inviteeEmail || meta.email}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <AIBadge text={stepMeta.aiBadge} />
                <span className="text-[11px] text-zinc-500">
                  {saving ? "Saving draft…" : "Draft saved"}
                </span>
              </div>
            </div>

            {/* Row 2: global progress bar */}
            <div className="mt-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg,#b8b3ff,#9ef0ff,#4cffb0,#ffd35a)",
                  boxShadow: "0 0 12px rgba(0,71,127,.25)",
                }}
              />
            </div>

            {/* Row 3: step + micro stats */}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>
                Step {step} of {steps.length - 1}:{" "}
                <span className="font-medium text-zinc-700">{steps[step]?.title}</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span>🧠 {stepMeta.category}</span>
                {stepMeta.docStats && (
                  <span>
                    📎 Docs {stepMeta.docStats.attached}/{stepMeta.docStats.required}
                  </span>
                )}
                <span>⏱ Est. 7–10 min total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="border rounded-2xl shadow-sm mt-4 p-4 md:p-6 bg-white/85 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]">
            {/* Main form column */}
            <div className="space-y-6">
              {kind === "employee" ? (
                <EmployeeSteps
                  stepKey={currentKey!}
                  core={core as EmployeeCore}
                  setC={setC}
                  files={files}
                  setFiles={setFiles}
                />
              ) : kind === "vendor" ? (
                <VendorSteps
                  stepKey={currentKey!}
                  core={core}
                  setC={setC}
                  files={files}
                  setFiles={setFiles}
                />
              ) : (
                <BusinessSteps
                  stepKey={currentKey!}
                  core={core}
                  setC={setC}
                  files={files}
                  setFiles={setFiles}
                />
              )}

              {/* Nav */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border text-[#00477f] hover:bg-zinc-50 transition"
                  onClick={prevStep}
                  disabled={step <= 1}
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  {step < steps.length - 1 ? (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-[#00477f] hover:bg-[#003e6e] text-white shadow-sm transition"
                      onClick={nextStep}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-[#00477f] hover:bg-[#003e6e] text-white shadow-sm transition"
                      onClick={submit}
                      disabled={submitting}
                    >
                      {submitting ? "Submitting…" : "Submit"}
                    </button>
                  )}
                </div>
              </div>

              {err && (
                <div className="text-sm text-red-600 border rounded-lg p-3 bg-red-50">
                  {err}
                </div>
              )}
            </div>

            {/* AI side rail column */}
            <div className="mt-2 lg:mt-0">
              <AISideRail
                meta={stepMeta}
                saving={saving}
                stepIndex={step}
                totalSteps={steps.length - 1}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ------------------ Structured Docs uploader (with drag & drop) ------------------ */
function StructuredDocsStep({
  files,
  setFiles,
  slots,
}: {
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
  slots: Slot[];
}) {
  const byType: Record<string, Upload[]> = {};
  for (const f of files) {
    const t = f.docType || "others";
    (byType[t] ||= []).push(f);
  }

  function onAdd(typeKey: string, list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming: Upload[] = Array.from(list).map((f) => ({
      name: f.name,
      key: f.name,
      file: f,
      docType: typeKey,
    }));
    setFiles((s) => [...s, ...incoming]);
  }

  function onDrop(typeKey: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const list = e.dataTransfer?.files;
    onAdd(typeKey, list);
  }

  function removeAt(typeKey: string, idx: number) {
    setFiles((s) => {
      const out: Upload[] = [];
      let seen = -1;
      for (const f of s) {
        if ((f.docType || "others") !== typeKey) {
          out.push(f);
          continue;
        }
        seen += 1;
        if (seen !== idx) out.push(f);
      }
      return out;
    });
  }

  return (
    <div className="grid gap-5">
      <AITip>
        Drag & drop files into each slot or click to browse. Keep PDFs under 10&nbsp;MB where possible. Use clear file
        names (e.g., <i>GST_Certificate_2025.pdf</i>).
      </AITip>
      {slots.map((slot) => {
        const list = byType[slot.key] || [];
        return (
          <div key={slot.key} className="rounded-2xl border bg-white/80 backdrop-blur">
            <div className="px-4 py-2 border-b bg-zinc-50/70 text-sm font-semibold text-zinc-700 flex items-center gap-2">
              <span>{slot.label}</span>
              {slot.required && <span className="text-xs text-red-600 font-normal">(required)</span>}
              {slot.hint && <span className="text-[11px] text-zinc-400 ml-auto">{slot.hint}</span>}
            </div>
            <div className="p-4 grid gap-3">
              <div
                className="rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#00477f]/40 transition bg-white/60 p-4"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => onDrop(slot.key, e)}
              >
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Input
                    type="file"
                    accept={slot.accept}
                    multiple={!!slot.multiple}
                    onChange={(e) => {
                      onAdd(slot.key, e.currentTarget.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className="text-xs text-zinc-600">
                    Drop files here or use the picker{slot.multiple ? " (multiple allowed)" : ""}.
                  </div>
                </div>
              </div>

              {list.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {list.map((f, i) => (
                    <span
                      key={slot.key + "-" + i}
                      className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs"
                    >
                      <span className="max-w-[200px] truncate">{f.name}</span>
                      <button className="text-red-600" type="button" onClick={() => removeAt(slot.key, i)}>
                        remove
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** ------------------ Employee Steps (with smart helpers) ------------------ */
function EmployeeSteps({
  stepKey,
  core,
  setC,
  files,
  setFiles,
}: {
  stepKey: string;
  core: EmployeeCore;
  setC: (path: string, v: any) => void;
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
}) {
  const [sameAddress, setSameAddress] = useState(
    !!core.address?.current && core.address?.current === core.address?.permanent
  );

  function copyCurrentToPermanent() {
    setC("address.permanent", core.address?.current || "");
  }

  if (stepKey === "identity") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between">
          <div className="text-xs text-zinc-500">Enter name as per official records (Aadhaar/PAN).</div>
          <AIBadge text="Smart validation" />
        </div>
        <div className="md:col-span-2">
          <Label required>Full Name (as per official records)</Label>
          <Input
            placeholder="e.g., Rahul Dev Sharma"
            value={core.fullName || ""}
            onChange={(e) => setC("fullName", e.target.value)}
          />
        </div>
        <div>
          <Label required>Father’s / Husband’s Name</Label>
          <Input value={core.fatherOrHusbandName || ""} onChange={(e) => setC("fatherOrHusbandName", e.target.value)} />
        </div>
        <div>
          <Label required>Date of Birth</Label>
          <Input type="date" value={core.dateOfBirth || ""} onChange={(e) => setC("dateOfBirth", e.target.value)} />
        </div>
        <div>
          <Label required>Gender</Label>
          <Select value={core.gender || ""} onChange={(e) => setC("gender", e.target.value)}>
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </Select>
        </div>
      </div>
    );
  }

  if (stepKey === "contact") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between">
          <AITip>
            If your permanent address is same as current, use the <b>Copy</b> chip to auto-fill.
          </AITip>
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center justify-between">
            <Label required>Current Address</Label>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded-lg border bg-white hover:bg-zinc-50"
              onClick={() => {
                copyCurrentToPermanent();
                setSameAddress(true);
              }}
            >
              Copy to Permanent
            </button>
          </div>
          <Textarea
            placeholder="House/Flat, Street, Area, City, State, PIN"
            value={core.address?.current || ""}
            onChange={(e) => setC("address.current", e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between">
            <Label required>Permanent Address</Label>
            <label className="text-[11px] text-zinc-600 inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-[#00477f]"
                checked={sameAddress}
                onChange={(e) => {
                  setSameAddress(e.target.checked);
                  if (e.target.checked) copyCurrentToPermanent();
                }}
              />
              Same as current
            </label>
          </div>
          <Textarea
            placeholder="House/Flat, Street, Area, City, State, PIN"
            value={core.address?.permanent || ""}
            onChange={(e) => {
              setC("address.permanent", e.target.value);
              if (e.target.value !== core.address?.current) setSameAddress(false);
            }}
          />
        </div>

        <div>
          <Label required hint="Use personal mobile (WhatsApp preferred)">
            Personal Mobile
          </Label>
          <Input
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={core.contact?.personalMobile || ""}
            onChange={(e) => setC("contact.personalMobile", e.target.value)}
          />
        </div>
        <div>
          <Label required>Personal Email</Label>
          <Input
            type="email"
            placeholder="name@example.com"
            value={core.contact?.personalEmail || ""}
            onChange={(e) => setC("contact.personalEmail", e.target.value)}
          />
        </div>
        <div>
          <Label>Alternate Mobile</Label>
          <Input value={core.contact?.altMobile || ""} onChange={(e) => setC("contact.altMobile", e.target.value)} />
        </div>
        <div>
          <Label>Alternate Email</Label>
          <Input type="email" value={core.contact?.altEmail || ""} onChange={(e) => setC("contact.altEmail", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "emergency") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center justify-between">
          <AIBadge text="Safety first" />
          <span className="text-[11px] text-zinc-500">We’ll use this only in emergencies.</span>
        </div>
        <div>
          <Label required>Emergency Contact Name</Label>
          <Input value={core.emergency?.name || ""} onChange={(e) => setC("emergency.name", e.target.value)} />
        </div>
        <div>
          <Label required>Relationship</Label>
          <Input value={core.emergency?.relationship || ""} onChange={(e) => setC("emergency.relationship", e.target.value)} />
        </div>
        <div>
          <Label required>Mobile</Label>
          <Input value={core.emergency?.mobile || ""} onChange={(e) => setC("emergency.mobile", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Address</Label>
          <Textarea value={core.emergency?.address || ""} onChange={(e) => setC("emergency.address", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "ids") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AITip>We recommend masking screenshots before upload. Enter numbers carefully to avoid delays.</AITip>
        <div>
          <Label required>Aadhaar Number</Label>
          <Input value={core.ids?.aadhaar || ""} onChange={(e) => setC("ids.aadhaar", e.target.value)} />
        </div>
        <div>
          <Label required>PAN Number</Label>
          <Input value={core.ids?.pan || ""} onChange={(e) => setC("ids.pan", e.target.value)} />
        </div>
        <div>
          <Label>Voter ID</Label>
          <Input value={core.ids?.voterId || ""} onChange={(e) => setC("ids.voterId", e.target.value)} />
        </div>
        <div>
          <Label>Ration Card</Label>
          <Input value={core.ids?.rationCard || ""} onChange={(e) => setC("ids.rationCard", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Other Govt IDs</Label>
          <Input value={core.otherGovtIds || ""} onChange={(e) => setC("otherGovtIds", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "bank") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AITip>Ensure IFSC and account number match your cancelled cheque to avoid payout failures.</AITip>
        <div>
          <Label required>Account Number</Label>
          <Input value={core.bank?.accountNumber || ""} onChange={(e) => setC("bank.accountNumber", e.target.value)} />
        </div>
        <div>
          <Label required>Bank Name</Label>
          <Input value={core.bank?.bankName || ""} onChange={(e) => setC("bank.bankName", e.target.value)} />
        </div>
        <div>
          <Label>Branch</Label>
          <Input value={core.bank?.branch || ""} onChange={(e) => setC("bank.branch", e.target.value)} />
        </div>
        <div>
          <Label required>IFSC Code</Label>
          <Input value={core.bank?.ifsc || ""} onChange={(e) => setC("bank.ifsc", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "education") {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label required>Highest Degree</Label>
          <Input value={core.education?.highestDegree || ""} onChange={(e) => setC("education.highestDegree", e.target.value)} />
        </div>
        <div>
          <Label required>Institution</Label>
          <Input value={core.education?.institution || ""} onChange={(e) => setC("education.institution", e.target.value)} />
        </div>
        <div>
          <Label required>Year</Label>
          <Input value={core.education?.year || ""} onChange={(e) => setC("education.year", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "employment") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label required>Date of Joining</Label>
          <Input type="date" value={core.employment?.dateOfJoining || ""} onChange={(e) => setC("employment.dateOfJoining", e.target.value)} />
        </div>
        <div>
          <Label>Caste / Category</Label>
          <Select value={core.employment?.casteCategory || ""} onChange={(e) => setC("employment.casteCategory", e.target.value)}>
            <option value="">Select</option>
            <option>Gen</option>
            <option>SC</option>
            <option>ST</option>
            <option>OBC</option>
            <option>EWS</option>
          </Select>
        </div>
        <div>
          <Label>Marital Status</Label>
          <Select value={core.employment?.maritalStatus || ""} onChange={(e) => setC("employment.maritalStatus", e.target.value)}>
            <option value="">Select</option>
            <option>Single</option>
            <option>Married</option>
            <option>Other</option>
          </Select>
        </div>
        <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
          <div>
            <Label>Last Organization</Label>
            <Input value={core.previousEmployer?.organization || ""} onChange={(e) => setC("previousEmployer.organization", e.target.value)} />
          </div>
          <div>
            <Label>Position</Label>
            <Input value={core.previousEmployer?.position || ""} onChange={(e) => setC("previousEmployer.position", e.target.value)} />
          </div>
          <div>
            <Label>Tenure</Label>
            <Input value={core.previousEmployer?.tenure || ""} onChange={(e) => setC("previousEmployer.tenure", e.target.value)} />
          </div>
        </div>
      </div>
    );
  }

  if (stepKey === "statutory") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>PF Nomination Details</Label>
          <Textarea value={core.pf?.nominationDetails || ""} onChange={(e) => setC("pf.nominationDetails", e.target.value)} />
        </div>
        <div>
          <Label>ESI Applicable?</Label>
          <Select value={(core.esi?.applicable ?? "").toString()} onChange={(e) => setC("esi.applicable", e.target.value === "true")}>
            <option value="">Select</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </div>
        <div>
          <Label>ESI Number (if applicable)</Label>
          <Input value={core.esi?.number || ""} onChange={(e) => setC("esi.number", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Tax Declaration (Form 12BB etc.)</Label>
          <Textarea value={core.tax?.form12bb || ""} onChange={(e) => setC("tax.form12bb", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "good") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <AIBadge text="Personalize your experience" />
        </div>
        <div>
          <Label>Preferred Name for Communication</Label>
          <Input value={core.preferredName || ""} onChange={(e) => setC("preferredName", e.target.value)} />
        </div>
        <div>
          <Label>Languages Known</Label>
          <Input value={core.languages || ""} onChange={(e) => setC("languages", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Hobbies / Interests</Label>
          <Input value={core.hobbies || ""} onChange={(e) => setC("hobbies", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>List of Dependents</Label>
          <Textarea value={core.dependents || ""} onChange={(e) => setC("dependents", e.target.value)} />
        </div>
        <div>
          <Label>Passport (if travel part of job)</Label>
          <Input value={core.passport || ""} onChange={(e) => setC("passport", e.target.value)} />
        </div>
        <div>
          <Label>Driving License Number</Label>
          <Input value={core.drivingLicense || ""} onChange={(e) => setC("drivingLicense", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Professional Certifications</Label>
          <Textarea value={core.certifications || ""} onChange={(e) => setC("certifications", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Medical Fitness Certificate</Label>
          <Textarea value={core.medicalFitness || ""} onChange={(e) => setC("medicalFitness", e.target.value)} />
        </div>
        <div>
          <Label>Gratuity Nominee</Label>
          <Input value={core.gratuityNominee || ""} onChange={(e) => setC("gratuityNominee", e.target.value)} />
        </div>
        <div>
          <Label>Insurance Beneficiary</Label>
          <Input value={core.insuranceBeneficiary || ""} onChange={(e) => setC("insuranceBeneficiary", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Previous Address</Label>
          <Textarea value={core.previousAddress || ""} onChange={(e) => setC("previousAddress", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "docs")
    return <StructuredDocsStep files={files} setFiles={setFiles} slots={EMPLOYEE_DOC_SLOTS as unknown as Slot[]} />;

  if (stepKey === "review") return <ReviewEmployee core={core} files={files} />;
  return <div className="text-sm text-zinc-600">Loading section…</div>;
}

/** ------------------ Vendor Steps ------------------ */
function VendorSteps({
  stepKey,
  core,
  setC,
  files,
  setFiles,
}: {
  stepKey: string;
  core: Record<string, any>;
  setC: (path: string, v: any) => void;
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
}) {
  core.contactPerson = core.contactPerson || {};
  core.contact = core.contact || {};
  core.address = core.address || {};
  core.bank = core.bank || {};
  core.services = core.services || {};

  if (stepKey === "vendor-basic") {
    return (
      <div className="grid gap-6">
        <Section title="Identity & Entity" right={<AIBadge text="Fast fill" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label required>Company / Business Name</Label>
              <Input value={core.companyName || ""} onChange={(e) => setC("companyName", e.target.value)} />
            </div>
            <div>
              <Label required>Type of Entity</Label>
<Select
  value={core.entityType || ""}
  onChange={(e) => {
    setC("entityType", e.target.value);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 100);
  }}
>
  <option value="">Select</option>
  <option value="SOLE_PROP">Sole Proprietorship</option>
  <option value="PARTNERSHIP">Partnership</option>
  <option value="OPC">One Person Company (OPC)</option>
  <option value="LLP">Limited Liability Partnership (LLP)</option>
  <option value="PRIVATE_LTD">Private Limited Company</option>
  <option value="PUBLIC_LTD">Public Limited Company</option>
  <option value="URP">URP – Unregistered Person</option>
</Select>
            </div>
            <div>
              <Label>MSME Registration Number (if applicable)</Label>
              <Input value={core.msme || ""} onChange={(e) => setC("msme", e.target.value)} />
            </div>
            <div>
              <Label>CIN (for Companies)</Label>
              <Input value={core.cin || ""} onChange={(e) => setC("cin", e.target.value)} />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "vendor-contacts") {
    return (
      <div className="grid gap-6">
        <Section title="Primary Contact">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label required>Contact Person Name</Label>
              <Input value={core.contactPerson.name || ""} onChange={(e) => setC("contactPerson.name", e.target.value)} />
            </div>
            <div>
              <Label required>Designation</Label>
              <Input
                value={core.contactPerson.designation || ""}
                onChange={(e) => setC("contactPerson.designation", e.target.value)}
              />
            </div>
            <div>
              <Label required>Primary Contact Number</Label>
              <Input value={core.contact.primary || ""} onChange={(e) => setC("contact.primary", e.target.value)} />
            </div>
            <div>
              <Label>Alternate Contact Number</Label>
              <Input value={core.contact.alternate || ""} onChange={(e) => setC("contact.alternate", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label required>Email ID</Label>
              <Input type="email" value={core.contact.email || ""} onChange={(e) => setC("contact.email", e.target.value)} />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "vendor-addresses") {
    return (
      <div className="grid gap-6">
        <Section title="Addresses">
          <div className="grid gap-4">
            <div>
              <Label required>Registered Address</Label>
              <Textarea value={core.address.registered || ""} onChange={(e) => setC("address.registered", e.target.value)} />
            </div>
            <div>
              <Label>Operational Address (if different)</Label>
              <Textarea
                value={core.address.operational || ""}
                onChange={(e) => setC("address.operational", e.target.value)}
              />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "vendor-tax") {
    return (
      <div className="grid gap-6">
        <Section title="Tax & Registrations">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label required>GST Number</Label>
              <Input value={core.gstNumber || ""} onChange={(e) => setC("gstNumber", e.target.value)} />
            </div>
            <div>
              <Label required>PAN Number</Label>
              <Input value={core.panNumber || ""} onChange={(e) => setC("panNumber", e.target.value)} />
            </div>
            <div>
              <Label>Website (optional)</Label>
              <Input type="url" value={core.website || ""} onChange={(e) => setC("website", e.target.value)} />
            </div>
            <div>
              <Label>Years in Business (optional)</Label>
              <Input type="number" value={core.yearsInBusiness || ""} onChange={(e) => setC("yearsInBusiness", e.target.value)} />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "vendor-bank") {
    return (
      <div className="grid gap-6">
        <Section title="Bank Details">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label required>Account Number</Label>
              <Input value={core.bank.accountNumber || ""} onChange={(e) => setC("bank.accountNumber", e.target.value)} />
            </div>
            <div>
              <Label required>Bank Name</Label>
              <Input value={core.bank.bankName || ""} onChange={(e) => setC("bank.bankName", e.target.value)} />
            </div>
            <div>
              <Label required>IFSC Code</Label>
              <Input value={core.bank.ifsc || ""} onChange={(e) => setC("bank.ifsc", e.target.value)} />
            </div>
            <div>
              <Label required>Branch Name</Label>
              <Input value={core.bank.branch || ""} onChange={(e) => setC("bank.branch", e.target.value)} />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "vendor-services") {
    return (
      <div className="grid gap-6">
        <Section title="Services & Experience">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label required>Nature of Services/Products Provided</Label>
              <Textarea value={core.services.nature || ""} onChange={(e) => setC("services.nature", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label required>Scope of Work</Label>
              <Textarea value={core.services.scopeOfWork || ""} onChange={(e) => setC("services.scopeOfWork", e.target.value)} />
            </div>
            <div>
              <Label required>Years of Experience</Label>
              <Input
                type="number"
                value={core.services.yearsOfExperience || ""}
                onChange={(e) => setC("services.yearsOfExperience", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Key Clients / References</Label>
              <Textarea value={core.services.keyClients || ""} onChange={(e) => setC("services.keyClients", e.target.value)} />
            </div>
          </div>
        </Section>
      </div>
    );
  }

  if (stepKey === "docs")
    return <StructuredDocsStep files={files} setFiles={setFiles} slots={VENDOR_DOC_SLOTS as unknown as Slot[]} />;
  if (stepKey === "review") return <ReviewVendor core={core} files={files} />;
  return <div className="text-sm text-zinc-600">Loading section…</div>;
}

/** ------------------ Business Steps ------------------ */
function BusinessSteps({
  stepKey,
  core,
  setC,
  files,
  setFiles,
}: {
  stepKey: string;
  core: Record<string, any>;
  setC: (path: string, v: any) => void;
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
}) {
  core.signatory = core.signatory || {};
  core.contacts = core.contacts || {};
  core.bank = core.bank || {};
  core.keyContacts = Array.isArray(core.keyContacts) ? core.keyContacts : [];

  function upsertContact(idx: number, field: string, value: string) {
    setC(
      "keyContacts",
      (() => {
        const arr = Array.isArray(core.keyContacts) ? [...core.keyContacts] : [];
        while (arr.length <= idx) arr.push({ name: "", designation: "", email: "", mobile: "" });
        arr[idx] = { ...(arr[idx] || {}), [field]: value };
        return arr;
      })() as any
    );
  }
  function addContact() {
    setC("keyContacts", [
      ...(Array.isArray(core.keyContacts) ? core.keyContacts : []),
      { name: "", designation: "", email: "", mobile: "" },
    ] as any);
  }
  function removeContact(i: number) {
    const arr = Array.isArray(core.keyContacts) ? [...core.keyContacts] : [];
    arr.splice(i, 1);
    setC("keyContacts", arr as any);
  }

  if (stepKey === "entity-type") {
  return (
    <div className="grid gap-6">
      <Section title="Choose Entity Type" right={<AIBadge text="Required to continue" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 text-sm text-zinc-600">
            Select your legal entity type. This will automatically customise the entire onboarding form,
            validations, and required documents.
          </div>

          <div className="md:col-span-1">
            <Label required>Type of Entity</Label>
            <Select
              value={core.entityType || ""}
              onChange={(e) => {
                setC("entityType", e.target.value);
                setTimeout(() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }, 150);
              }}
            >
              <option value="">Select</option>
              <option value="SOLE_PROP">Sole Proprietorship</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="OPC">One Person Company (OPC)</option>
              <option value="LLP">Limited Liability Partnership (LLP)</option>
              <option value="PRIVATE_LTD">Private Limited Company</option>
              <option value="PUBLIC_LTD">Public Limited Company</option>
              <option value="URP">URP – Unregistered Person</option>
            </Select>
          </div>
        </div>
      </Section>
    </div>
  );
}

  if (stepKey === "biz-basic") {
    return (
      <div className="grid gap-6">
        <Section title="Organization Identity" right={<AIBadge text="AI-styled" />}>
        {core.entityType && (
  <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
    Entity Type selected: <b>{core.entityType}</b>
  </div>
)}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label required>Registered Business Name</Label>
              <Input value={core.legalName || ""} onChange={(e) => setC("legalName", e.target.value)} />
            </div>
            
            <div>
              <Label>Business Website URL</Label>
              <Input type="url" placeholder="https://example.com" value={core.website || ""} onChange={(e) => setC("website", e.target.value)} />
            </div>
            <div>
              <Label required>Nature of Business / Industry</Label>
              <Input value={core.industry || ""} onChange={(e) => setC("industry", e.target.value)} />
            </div>
            <div>
              <Label required>Number of Employees</Label>
              <Input type="number" value={core.employeesCount || ""} onChange={(e) => setC("employeesCount", e.target.value)} />
            </div>
            <div>
              <Label>CIN (if Company)</Label>
              <Input value={core.cin || ""} onChange={(e) => setC("cin", e.target.value)} />
            </div>
            <div>
              <Label required>Date of Incorporation / Establishment</Label>
              <Input type="date" value={core.incorporationDate || ""} onChange={(e) => setC("incorporationDate", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Addresses">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label required>Corporate / Registered Address</Label>
              <Textarea value={core.registeredAddress || ""} onChange={(e) => setC("registeredAddress", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Operational Address (if different)</Label>
              <Textarea value={core.operationalAddress || ""} onChange={(e) => setC("operationalAddress", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Authorised Signatory & Business Contact">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label required>Authorised Signatory Name</Label>
              <Input value={core.signatory.name || ""} onChange={(e) => setC("signatory.name", e.target.value)} />
            </div>
            <div>
              <Label required>Designation</Label>
              <Input value={core.signatory.designation || ""} onChange={(e) => setC("signatory.designation", e.target.value)} />
            </div>
            <div>
              <Label required>Business Contact Number (Primary)</Label>
              <Input value={core.contacts.primaryPhone || ""} onChange={(e) => setC("contacts.primaryPhone", e.target.value)} />
            </div>
            <div>
              <Label>Business Contact Number (Alternate)</Label>
              <Input value={core.contacts.altPhone || ""} onChange={(e) => setC("contacts.altPhone", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label required>Official Email ID</Label>
              <Input type="email" value={core.officialEmail || ""} onChange={(e) => setC("officialEmail", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Tax Identifiers">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {core.entityType !== "URP" && (
  <>
    <Label required>GST Number</Label>
    <Input
      value={core.gstNumber || ""}
      onChange={(e) => setC("gstNumber", e.target.value)}
    />
  </>
)}
            </div>
            <div>
              <Label required>PAN Number (Business)</Label>
              <Input value={core.panNumber || ""} onChange={(e) => setC("panNumber", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Business Description">
          <Textarea placeholder="Brief business description..." value={core.description || ""} onChange={(e) => setC("description", e.target.value)} />
        </Section>
      </div>
    );
  }

  if (stepKey === "key-contacts") {
    const list: any[] = Array.isArray(core.keyContacts) ? core.keyContacts : [];
    return (
      <div className="grid gap-4">
        <AITip>Add at least one fully filled key contact so we can reach you swiftly.</AITip>
        <div className="grid gap-3">
          {list.map((row, i) => (
            <div key={i} className="rounded-xl border p-3 bg-white/70">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">Contact #{i + 1}</div>
                <button type="button" className="text-xs text-red-600" onClick={() => removeContact(i)}>Remove</button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label>Name</Label>
                  <Input value={row.name || ""} onChange={(e) => upsertContact(i, "name", e.target.value)} />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={row.designation || ""} onChange={(e) => upsertContact(i, "designation", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={row.email || ""} onChange={(e) => upsertContact(i, "email", e.target.value)} />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={row.mobile || ""} onChange={(e) => upsertContact(i, "mobile", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="px-3 py-2 rounded-xl border bg-white hover:bg-zinc-50" onClick={addContact}>+ Add Contact</button>
      </div>
    );
  }

  if (stepKey === "bank") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label required>Account Number</Label>
          <Input value={core.bank.accountNumber || ""} onChange={(e) => setC("bank.accountNumber", e.target.value)} />
        </div>
        <div>
          <Label required>Bank Name</Label>
          <Input value={core.bank.bankName || ""} onChange={(e) => setC("bank.bankName", e.target.value)} />
        </div>
        <div>
          <Label required>IFSC Code</Label>
          <Input value={core.bank.ifsc || ""} onChange={(e) => setC("bank.ifsc", e.target.value)} />
        </div>
        <div>
          <Label required>Branch Name</Label>
          <Input value={core.bank.branch || ""} onChange={(e) => setC("bank.branch", e.target.value)} />
        </div>
      </div>
    );
  }

  if (stepKey === "docs") {
    return <StructuredDocsStep files={files} setFiles={setFiles} slots={BUSINESS_DOC_SLOTS as unknown as Slot[]} />;
  }

  if (stepKey === "review") {
    return <ReviewBusiness core={core} files={files} />;
  }

  return <div className="text-sm text-zinc-600">Loading section…</div>;
}

function AISideRail({
  meta,
  saving,
  stepIndex,
  totalSteps,
}: {
  meta: StepMeta;
  saving: boolean;
  stepIndex: number;
  totalSteps: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((stepIndex / Math.max(1, totalSteps)) * 100)));
  const stepLabel = stepIndex <= 0 ? "Getting started" : `Step ${stepIndex} of ${totalSteps}`;

  return (
    <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur p-4 lg:p-5 text-xs lg:text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-zinc-600 tracking-wide uppercase">
          {meta.category}
        </span>
        <AIBadge text={meta.aiBadge} />
      </div>

      <div className="text-sm font-semibold text-zinc-800">{meta.label}</div>
      <p className="text-[11px] leading-relaxed text-zinc-600">{meta.tip}</p>

      <div className="space-y-1 pt-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>{stepLabel}</span>
          <span>{pct}% ready</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg,#b8b3ff,#9ef0ff,#4cffb0,#ffd35a)",
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/60 px-3 py-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">Draft status</span>
          <span className="text-[11px] font-medium text-zinc-700">
            {saving ? "Saving…" : "Draft saved"}
          </span>
        </div>
        <div className="text-[10px] text-zinc-500">
          You can close this tab anytime. When you come back later, we’ll resume from the same step.
        </div>
      </div>

      {meta.docStats && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-900">Document checklist</span>
            <span className="text-[11px] text-emerald-800">
              {meta.docStats.attached}/{meta.docStats.required} key docs
            </span>
          </div>
          <div className="text-[10px] text-emerald-900/80">
            Attach all required documents to avoid back-and-forth on email during verification.
          </div>
        </div>
      )}
    </aside>
  );
}


/** ------------------ Review (Employee) ------------------ */
function ReviewEmployee({ core, files }: { core: EmployeeCore; files: Upload[] }) {
  const groups: Record<string, Upload[]> = {};
  for (const f of files) (groups[f.docType || "others"] ||= []).push(f);

  return (
    <div className="space-y-4">
      <Section title="Identity">
        <Row label="Full name" value={core.fullName} />
        <Row label="Father’s / Husband’s name" value={core.fatherOrHusbandName} />
        <Row label="Date of birth" value={core.dateOfBirth} />
        <Row label="Gender" value={core.gender} />
      </Section>

      <Section title="Contact & Address">
        <Row label="Current address" value={core.address?.current} />
        <Row label="Permanent address" value={core.address?.permanent} />
        <Row label="Personal mobile" value={core.contact?.personalMobile} />
        <Row label="Personal email" value={core.contact?.personalEmail} />
        <Row label="Alternate mobile" value={core.contact?.altMobile} />
        <Row label="Alternate email" value={core.contact?.altEmail} />
      </Section>

      <Section title="Emergency Contact">
        <Row label="Name" value={core.emergency?.name} />
        <Row label="Relationship" value={core.emergency?.relationship} />
        <Row label="Mobile" value={core.emergency?.mobile} />
        <Row label="Address" value={core.emergency?.address} />
      </Section>

      <Section title="Government IDs">
        <Row label="Aadhaar" value={core.ids?.aadhaar} />
        <Row label="PAN" value={core.ids?.pan} />
        <Row label="Voter ID" value={core.ids?.voterId} />
        <Row label="Ration Card" value={core.ids?.rationCard} />
        <Row label="Other IDs" value={core.otherGovtIds} />
      </Section>

      <Section title="Bank Details">
        <Row label="Account number" value={core.bank?.accountNumber} />
        <Row label="Bank name" value={core.bank?.bankName} />
        <Row label="Branch" value={core.bank?.branch} />
        <Row label="IFSC" value={core.bank?.ifsc} />
      </Section>

      <Section title="Education">
        <Row label="Highest degree" value={core.education?.highestDegree} />
        <Row label="Institution" value={core.education?.institution} />
        <Row label="Year" value={core.education?.year} />
      </Section>

      <Section title="Employment">
        <Row label="Date of joining" value={core.employment?.dateOfJoining} />
        <Row label="Caste/Category" value={core.employment?.casteCategory} />
        <Row label="Marital status" value={core.employment?.maritalStatus} />
        <Row label="Last organization" value={core.previousEmployer?.organization} />
        <Row label="Position" value={core.previousEmployer?.position} />
        <Row label="Tenure" value={core.previousEmployer?.tenure} />
      </Section>

      <Section title="Statutory (PF/ESI/Tax)">
        <Row label="PF nomination details" value={core.pf?.nominationDetails} />
        <Row label="ESI applicable" value={String(core.esi?.applicable ?? "").replace(/^$/, "—")} />
        <Row label="ESI number" value={core.esi?.number} />
        <Row label="Tax declaration" value={core.tax?.form12bb} />
      </Section>

      <Section title="Good to have">
        <Row label="Preferred name" value={core.preferredName} />
        <Row label="Languages" value={core.languages} />
        <Row label="Hobbies / Interests" value={core.hobbies} />
        <Row label="Dependents" value={core.dependents} />
        <Row label="Passport" value={core.passport} />
        <Row label="Driving license" value={core.drivingLicense} />
        <Row label="Certifications" value={core.certifications} />
        <Row label="Medical fitness" value={core.medicalFitness} />
        <Row label="Gratuity nominee" value={core.gratuityNominee} />
        <Row label="Insurance beneficiary" value={core.insuranceBeneficiary} />
        <Row label="Previous address" value={core.previousAddress} />
      </Section>

      <Section title="Documents">
        {files.length === 0 ? (
          <div className="text-sm text-zinc-600">No documents attached.</div>
        ) : (
          <div className="grid gap-3">
            {(EMPLOYEE_DOC_SLOTS as readonly Slot[]).map((s) => {
              const list = groups[s.key] || [];
              if (!list.length) return null;
              return (
                <div key={s.key}>
                  <div className="text-xs font-semibold text-zinc-600 mb-1">{s.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((f, i) => (
                      <span key={s.key + "-" + i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {Object.entries(groups)
              .filter(([k]) => !(EMPLOYEE_DOC_SLOTS as readonly Slot[]).some((s) => s.key === k))
              .map(([k, list]) => (
                <div key={k}>
                  <div className="text-xs font-semibold text-zinc-600 mb-1">Others</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((f, i) => (
                      <span key={k + "-" + i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/** ------------------ Vendor Review ------------------ */
function ReviewVendor({ core, files }: { core: Record<string, any>; files: Upload[] }) {
  const groups: Record<string, Upload[]> = {};
  for (const f of files) (groups[f.docType || "others"] ||= []).push(f);

  return (
    <div className="space-y-4">
      <Section title="Identity & Entity">
        <Row label="Company / Business Name" value={core.companyName} />
        <Row label="Type of Entity" value={core.entityType} />
        <Row label="MSME Registration No." value={core.msme} />
        <Row label="CIN" value={core.cin} />
        <Row label="Website" value={core.website} />
        <Row label="Years in Business" value={core.yearsInBusiness} />
      </Section>

      <Section title="Primary Contact">
        <Row label="Name" value={core.contactPerson?.name} />
        <Row label="Designation" value={core.contactPerson?.designation} />
        <Row label="Primary Phone" value={core.contact?.primary} />
        <Row label="Alternate Phone" value={core.contact?.alternate} />
        <Row label="Email" value={core.contact?.email} />
      </Section>

      <Section title="Addresses">
        <Row label="Registered Address" value={core.address?.registered} />
        <Row label="Operational Address" value={core.address?.operational} />
      </Section>

      <Section title="Tax & Registrations">
        <Row label="GST Number" value={core.gstNumber} />
        <Row label="PAN Number" value={core.panNumber} />
      </Section>

      <Section title="Bank Details">
        <Row label="Account Number" value={core.bank?.accountNumber} />
        <Row label="Bank Name" value={core.bank?.bankName} />
        <Row label="IFSC" value={core.bank?.ifsc} />
        <Row label="Branch" value={core.bank?.branch} />
      </Section>

      <Section title="Services & Experience">
        <Row label="Nature of Services/Products" value={core.services?.nature} />
        <Row label="Scope of Work" value={core.services?.scopeOfWork} />
        <Row label="Years of Experience" value={core.services?.yearsOfExperience} />
        <Row label="Key Clients / References" value={core.services?.keyClients} />
      </Section>

      <Section title="Documents">
        {files.length === 0 ? (
          <div className="text-sm text-zinc-600">No documents attached.</div>
        ) : (
          <div className="grid gap-3">
            {(VENDOR_DOC_SLOTS as readonly Slot[]).map((s) => {
              const list = groups[s.key] || [];
              if (!list.length) return null;
              return (
                <div key={s.key}>
                  <div className="text-xs font-semibold text-zinc-600 mb-1">{s.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((f, i) => (
                      <span key={s.key + "-" + i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/** ------------------ Business Review ------------------ */
function ReviewBusiness({ core, files }: { core: Record<string, any>; files: Upload[] }) {
  const groups: Record<string, Upload[]> = {};
  for (const f of files) (groups[f.docType || "others"] ||= []).push(f);

  const contacts: any[] = Array.isArray(core.keyContacts) ? core.keyContacts : [];

  return (
    <div className="space-y-4">
      <Section title="Organization Identity">
        <Row label="Registered Business Name" value={core.legalName} />
        <Row label="Type of Entity" value={core.entityType} />
        <Row label="Business Website" value={core.website} />
        <Row label="Nature of Business / Industry" value={core.industry} />
        <Row label="Number of Employees" value={core.employeesCount} />
        <Row label="CIN" value={core.cin} />
        <Row label="Date of Incorporation / Establishment" value={core.incorporationDate} />
      </Section>

      <Section title="Addresses">
        <Row label="Corporate/Registered Address" value={core.registeredAddress} />
        <Row label="Operational Address" value={core.operationalAddress} />
      </Section>

      <Section title="Authorised Signatory & Business Contact">
        <Row label="Authorised Signatory" value={core.signatory?.name} />
        <Row label="Designation" value={core.signatory?.designation} />
        <Row label="Primary Phone" value={core.contacts?.primaryPhone} />
        <Row label="Alternate Phone" value={core.contacts?.altPhone} />
        <Row label="Official Email" value={core.officialEmail} />
      </Section>

      <Section title="Tax Identifiers">
        {core.entityType !== "URP" && (
  <Row label="GST Number" value={core.gstNumber} />
)}
        <Row label="PAN (Business)" value={core.panNumber} />
      </Section>

      <Section title="Business Description">
        <Row label="About the Business" value={core.description} />
      </Section>

      <Section title="Key Contacts">
        {contacts.length === 0 ? (
          <div className="text-sm text-zinc-600">No key contacts added.</div>
        ) : (
          <div className="grid gap-2">
            {contacts.map((c, i) => (
              <div key={i} className="rounded-lg border p-3 bg-white/70">
                <div className="text-sm font-semibold mb-1">Contact #{i + 1}</div>
                <div className="grid md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-zinc-500">Name:</span> {c.name || "—"}</div>
                  <div><span className="text-zinc-500">Designation:</span> {c.designation || "—"}</div>
                  <div><span className="text-zinc-500">Email:</span> {c.email || "—"}</div>
                  <div><span className="text-zinc-500">Mobile:</span> {c.mobile || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Bank Details">
        <Row label="Account Number" value={core.bank?.accountNumber} />
        <Row label="Bank Name" value={core.bank?.bankName} />
        <Row label="IFSC Code" value={core.bank?.ifsc} />
        <Row label="Branch Name" value={core.bank?.branch} />
      </Section>

      <Section title="Documents">
        {files.length === 0 ? (
          <div className="text-sm text-zinc-600">No documents attached.</div>
        ) : (
          <div className="grid gap-3">
            {(BUSINESS_DOC_SLOTS as readonly Slot[]).map((s) => {
              const list = groups[s.key] || [];
              if (!list.length) return null;
              return (
                <div key={s.key}>
                  <div className="text-xs font-semibold text-zinc-600 mb-1">{s.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {list.map((f, i) => (
                      <span key={s.key + "-" + i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/** ------------------ Generic Review (fallback) ------------------ */
function ReviewGeneric({ core, files }: { core: Record<string, any>; files: Upload[] }) {
  const groups: Record<string, Upload[]> = {};
  for (const f of files) (groups[f.docType || "others"] ||= []).push(f);

  return (
    <div className="space-y-4">
      <Section title="Details">
        {Object.entries(core || {}).map(([k, v]) => (
          <Row key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : (v as any)} />
        ))}
      </Section>
      <Section title="Documents">
        {files.length === 0 ? (
          <div className="text-sm text-zinc-600">No documents attached.</div>
        ) : (
          <div className="grid gap-3">
            {Object.entries(groups).map(([k, list]) => (
              <div key={k}>
                <div className="text-xs font-semibold text-zinc-600 mb-1">{titleCase(k)}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map((f, i) => (
                    <span key={k + "-" + i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-white text-xs">
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
