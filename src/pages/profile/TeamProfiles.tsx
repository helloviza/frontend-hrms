// apps/frontend/src/pages/profile/TeamProfiles.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";

type Employee = any;

type TabKey =
  | "personal"
  | "employment"
  | "compensation"
  | "attendance"
  | "learning"
  | "assets";

export default function TeamProfiles() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [isNew, setIsNew] = useState(false);

  // ───────────────── Load employees from backend ─────────────────
  useEffect(() => {
  (async () => {
    try {
      setLoading(true);

      const res = await api.get("/employees");
      // Accept both shapes: axios-style { data: [...] } and plain [...]
      const raw = (res as any)?.data ?? res;
      const list = Array.isArray(raw) ? raw : [];

      setRows(list);

      if (list.length > 0) {
        const first = list[0] || {};
        setSelected(first);
        setForm({
  ...first,
  officialEmail:
    first.officialEmail ||
    first.official_email ||
    first.workEmail ||
    first.officeEmail ||
    first.email ||
    "",
  personalEmail: first.personalEmail || first.personal_email || "",
});
        setIsNew(false);
      }
    } catch (e: any) {
      alert(e?.message || "Failed to load team profiles");
    } finally {
      setLoading(false);
    }
  })();
}, []);


  const displayName =
    (user as any)?.firstName ||
    (user as any)?.name ||
    (user as any)?.email ||
    "there";

  // 🔐 Only Admin / Super Admin can edit or create
  const canEdit = useMemo(() => {
    const u: any = user || {};
    const roles: string[] = [];

    if (Array.isArray(u.roles)) roles.push(...u.roles);
    if (u.role) roles.push(u.role);
    if (u.hrmsAccessRole) roles.push(u.hrmsAccessRole);

    const upper = roles.map((r) => String(r).toUpperCase());
    const isAdmin = upper.includes("ADMIN");
    const isSuperAdmin =
      upper.includes("SUPERADMIN") || upper.includes("SUPER_ADMIN");

    return isAdmin || isSuperAdmin;
  }, [user]);

  function handleSelect(emp: Employee) {
    const e = emp || {};
    setSelected(e);
    setForm({
  ...e,
  officialEmail:
    e.officialEmail ||
    e.official_email ||
    e.workEmail ||
    e.officeEmail ||
    e.email ||
    "",
  personalEmail: e.personalEmail || e.personal_email || "",
});

    setActiveTab("personal");
    setIsNew(false);
  }

  function handleAddNew() {
    if (!canEdit) {
      alert(
        "You have view-only access. Only Admin / Super Admin can add employees."
      );
      return;
    }

    const base: any = {
      roles: ["EMPLOYEE"],
      role: "EMPLOYEE",
      employeeType: "Permanent",
      employmentStatus: "Active",
      hrmsAccessRole: "EMPLOYEE",
      employeeCode: "",
      officialEmail: "",
      personalEmail: "",
    };

    const newEmp: any = {
      _id: null,
      ...base,
    };

    setSelected(newEmp);
    setForm(base);
    setActiveTab("personal");
    setIsNew(true);
  }

  function updateField(key: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  // ───────────────── Save (create / update) ─────────────────
  async function handleSave() {
    if (!canEdit) {
      alert(
        "You have view-only access. Only Admin / Super Admin can save changes."
      );
      return;
    }

    try {
      setSaving(true);

      // Enforce official email requirement
      const officialEmailRaw =
        form.officialEmail ||
        form.email ||
        form.workEmail ||
        form.officeEmail ||
        "";
      const officialEmail = String(officialEmailRaw).trim().toLowerCase();

      if (!officialEmail) {
        alert(
          "Official (company) email ID is mandatory. Please fill it before saving."
        );
        setSaving(false);
        return;
      }

      // Build payload: keep officialEmail + email in sync
      const payload: any = {
        ...form,
        officialEmail,
        email: officialEmail,
      };

      let result: any;

      if (isNew || !selected || !selected._id) {
        // Backend will generate employeeCode if not set
        result = await api.post("/employees", payload);
      } else {
        result = await api.put(`/employees/${selected._id}`, payload);
      }

      const updated = result || payload;

      setRows((prev) => {
        const exists = updated._id && prev.some((r) => r._id === updated._id);
        if (!exists) {
          return [...prev, updated];
        }
        return prev.map((r) => (r._id === updated._id ? updated : r));
      });

      setSelected(updated);
setForm({
  ...updated,
  officialEmail:
    updated.officialEmail ||
    updated.official_email ||
    updated.workEmail ||
    updated.officeEmail ||
    updated.email ||
    "",
  personalEmail: updated.personalEmail || updated.personal_email || "",
});

      setIsNew(false);
      alert(
        `Employee record saved${
          updated.employeeCode ? ` (ID: ${updated.employeeCode})` : ""
        }.`
      );
    } catch (e: any) {
      alert(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const reportingChain = useMemo(() => {
    const emp: any = form || {};
    const l1 =
      emp.reportingL1 ||
      emp.managerL1 ||
      emp.managerName ||
      emp.reportingManager ||
      "";
    const l2 = emp.reportingL2 || emp.managerL2 || "";
    const l3 = emp.reportingL3 || emp.managerL3 || "";
    return { l1, l2, l3 };
  }, [form]);

  function getHrmsAccessLabel(emp: any): string {
    const raw =
      emp?.hrmsAccessRole || emp?.hrmsAccess || emp?.role || "EMPLOYEE";
    const upper = String(raw).toUpperCase();

    if (upper === "SUPERADMIN" || upper === "SUPER_ADMIN") return "Super Admin";
    if (upper === "ADMIN") return "Admin";
    if (upper === "MANAGER") return "Manager";
    return "Employee";
  }

  // ───────────────── UI ─────────────────
  return (
    <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
      {/* Left column – Employee list */}
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Employee Database
              </div>
              <div className="mt-1 text-sm font-semibold text-[#00477f]">
                Team & Reporting Structure
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Hi {displayName}, browse your{" "}
                <span className="font-medium">employee records</span> on the
                left and edit full HR master details on the right – personal,
                employment, payroll, compliance, assets and more.
              </p>
              {!canEdit && (
                <p className="mt-1 text-[10px] text-amber-700">
                  You currently have <strong>view-only</strong> access to this
                  database. Editing is restricted to Admin / Super Admin.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddNew}
              disabled={!canEdit}
              className="inline-flex items-center justify-center rounded-full bg-[#00477f] px-3 py-[6px] text-[11px] font-semibold text-white shadow-sm hover:bg-[#003767] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ➕ Add employee
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="p-3 text-[11px] text-slate-500">
              Loading team profiles…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="p-3 text-[11px] text-slate-500">
              No team members found.
            </div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {rows.map((u: any) => {
                const isActive = selected && selected._id === u._id;
                const hrmsLabel = getHrmsAccessLabel(u);
                return (
                  <li key={u._id || u.email}>
                    <button
                      type="button"
                      onClick={() => handleSelect(u)}
                      className={`flex w-full items-start gap-3 px-3 py-3 text-left text-xs transition ${
                        isActive
                          ? "bg-[#00477f]/5 border-l-2 border-l-[#00477f]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00477f]/10 text-[11px] font-semibold text-[#00477f]">
                        {(u.name || u.firstName || "U")
                          .toString()
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-slate-900">
                          {u.name ||
                            [u.firstName, u.lastName]
                              .filter(Boolean)
                              .join(" ") ||
                            u.email ||
                            "—"}
                        </div>
                        <div className="mt-[2px] flex flex-wrap gap-1 text-[10px] text-slate-500">
                          {u.employeeCode && (
                            <span className="rounded-full bg-slate-100 px-2 py-[1px]">
                              ID: {u.employeeCode}
                            </span>
                          )}
                          {u.designation && (
                            <span className="rounded-full bg-slate-100 px-2 py-[1px]">
                              {u.designation}
                            </span>
                          )}
                          {u.department && (
                            <span className="rounded-full bg-slate-100 px-2 py-[1px]">
                              {u.department}
                            </span>
                          )}
                          <span className="rounded-full bg-[#00477f]/5 px-2 py-[1px] text-[#00477f]">
                            {hrmsLabel}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right column – Detail view */}
      <div className="flex flex-col gap-4">
        {!selected && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm text-[13px] text-slate-600">
            Select an employee from the left (or click “Add employee”) to view
            and edit their complete HR master record.
          </div>
        )}

        {selected && (
          <>
            {/* Header & reporting chain */}
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-[#eaf6ff] via-[#f5f4ff] to-[#e9f8ff] px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#00477f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15">
                      👤
                    </span>
                    <span>Employee Master · HR Database</span>
                  </div>
                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#00477f]">
                    {(form.firstName ||
                      form.name ||
                      selected.name ||
                      "Employee") +
                      (form.lastName ? ` ${form.lastName}` : "")}
                  </h1>
                  <p className="mt-1 text-[11px] text-slate-600 max-w-xl">
                    Employee ID:{" "}
                    <span className="font-semibold">
                      {form.employeeCode ||
                        selected.employeeCode ||
                        "Not set"}
                    </span>{" "}
                    · Department:{" "}
                    <span className="font-semibold">
                      {form.department || selected.department || "Not mapped"}
                    </span>{" "}
                    · Designation:{" "}
                    <span className="font-semibold">
                      {form.designation ||
                        selected.designation ||
                        "Not mapped"}
                    </span>{" "}
                    · HRMS Access:{" "}
                    <span className="font-semibold">
                      {getHrmsAccessLabel(form)}
                    </span>
                    <br />
                    Official Email:{" "}
<span className="font-semibold">
  {form.officialEmail ||
    form.official_email ||
    selected.officialEmail ||
    selected.official_email ||
    selected.workEmail ||
    selected.officeEmail ||
    selected.email ||
    "Not set"}
</span>

                  </p>
                  {isNew && (
                    <p className="mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-[4px] inline-block">
                      This is a <span className="font-semibold">new</span>{" "}
                      employee. When you click{" "}
                      <span className="font-semibold">Save changes</span>, the
                      backend will assign an Employee ID (e.g. PTS001031) if
                      not provided.
                    </p>
                  )}
                </div>

                {/* Reporting chain */}
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm text-[11px] text-slate-700 max-w-xs">
                  <div className="font-medium text-slate-700 mb-1">
                    Reporting hierarchy
                  </div>
                  <div className="space-y-[2px]">
                    <div>
                      <span className="font-semibold text-[#00477f]">
                        L1:
                      </span>{" "}
                      {reportingChain.l1 || "Not set"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#00477f]">
                        L2:
                      </span>{" "}
                      {reportingChain.l2 || "Not set"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#00477f]">
                        L3:
                      </span>{" "}
                      {reportingChain.l3 || "Not set"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <p className="text-slate-500 max-w-xl">
                  All sections below are editable – personal, employment,
                  compensation, attendance, learning, compliance, assets & notes.
                  Changes will be saved to the master employee record.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full bg-[#00477f] px-4 py-2 text-[11px] font-semibold text-white shadow-lg shadow-[#00477f]/40 hover:bg-[#003767] disabled:opacity-60"
                  >
                    {saving
                      ? isNew
                        ? "Creating…"
                        : "Saving…"
                      : isNew
                      ? "Create employee"
                      : "Save changes"}
                  </button>
                )}
              </div>
            </div>

            {/* Tabs + sections */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 pt-3">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <TabButton
                    label="Personal & Contact"
                    active={activeTab === "personal"}
                    onClick={() => setActiveTab("personal")}
                  />
                  <TabButton
                    label="Employment & Reporting"
                    active={activeTab === "employment"}
                    onClick={() => setActiveTab("employment")}
                  />
                  <TabButton
                    label="Compensation & Payroll"
                    active={activeTab === "compensation"}
                    onClick={() => setActiveTab("compensation")}
                  />
                  <TabButton
                    label="Attendance & Leave"
                    active={activeTab === "attendance"}
                    onClick={() => setActiveTab("attendance")}
                  />
                  <TabButton
                    label="L&D · Performance · Compliance"
                    active={activeTab === "learning"}
                    onClick={() => setActiveTab("learning")}
                  />
                  <TabButton
                    label="Assets · Notes · Misc"
                    active={activeTab === "assets"}
                    onClick={() => setActiveTab("assets")}
                  />
                </div>
              </div>

              <div className="px-5 py-5">
                {/* PERSONAL SECTION */}
                {activeTab === "personal" && (
                  <SectionGrid
                    title="Personal Details"
                    description="Foundational identity and contact information for the employee."
                  >
                    <Field
                      label="Employee ID"
                      value={form.employeeCode || ""}
                      onChange={(v) => updateField("employeeCode", v)}
                    />
                    <Field
                      label="First Name"
                      value={form.firstName || ""}
                      onChange={(v) => updateField("firstName", v)}
                    />
                    <Field
                      label="Middle Name"
                      value={form.middleName || ""}
                      onChange={(v) => updateField("middleName", v)}
                    />
                    <Field
                      label="Last Name"
                      value={form.lastName || ""}
                      onChange={(v) => updateField("lastName", v)}
                    />
                    <Field
                      label="Date of Birth"
                      type="date"
                      value={form.dateOfBirth || ""}
                      onChange={(v) => updateField("dateOfBirth", v)}
                    />
                    <SelectField
                      label="Gender"
                      value={form.gender || ""}
                      onChange={(v) => updateField("gender", v)}
                      options={[
                        { value: "", label: "Select gender…" },
                        { value: "Male", label: "Male" },
                        { value: "Female", label: "Female" },
                        { value: "Other", label: "Other" },
                        {
                          value: "Prefer not to say",
                          label: "Prefer not to say",
                        },
                      ]}
                    />
                    <SelectField
                      label="Marital Status"
                      value={form.maritalStatus || ""}
                      onChange={(v) => updateField("maritalStatus", v)}
                      options={[
                        { value: "", label: "Select marital status…" },
                        { value: "Single", label: "Single" },
                        { value: "Married", label: "Married" },
                        { value: "Divorced", label: "Divorced" },
                        { value: "Widowed", label: "Widowed" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                    <Field
                      label="Nationality"
                      value={form.nationality || ""}
                      onChange={(v) => updateField("nationality", v)}
                    />
                    <Field
                      label="Blood Group"
                      value={form.bloodGroup || ""}
                      onChange={(v) => updateField("bloodGroup", v)}
                    />
                    <Field
                      label="Permanent Address"
                      value={form.permanentAddress || ""}
                      onChange={(v) => updateField("permanentAddress", v)}
                      placeholder="Street, City, State, Zip, Country"
                    />
                    <Field
                      label="Current Address"
                      value={form.currentAddress || ""}
                      onChange={(v) => updateField("currentAddress", v)}
                    />
                    <Field
                      label="Personal Contact Number"
                      value={form.personalContact || ""}
                      onChange={(v) => updateField("personalContact", v)}
                    />
                    <Field
                      label="Emergency Contact Number"
                      value={form.emergencyContactNumber || ""}
                      onChange={(v) =>
                        updateField("emergencyContactNumber", v)
                      }
                    />
                    <Field
  label="Official Email Address (Company) *"
  value={
    form.officialEmail ||
    form.official_email ||
    form.workEmail ||
    form.officeEmail ||
    form.email ||
    ""
  }
  onChange={(v) =>
    setForm((prev: any) => ({
      ...prev,
      officialEmail: v,
      email: v,
    }))
  }
  placeholder="firstname.lastname@company.com"
/>

                    <Field
                      label="Personal Email Address"
                      value={form.personalEmail || ""}
                      onChange={(v) => updateField("personalEmail", v)}
                    />
                    <Field
                      label="Emergency Contact Name"
                      value={form.emergencyContactName || ""}
                      onChange={(v) => updateField("emergencyContactName", v)}
                    />
                    <Field
                      label="Emergency Contact Relation"
                      value={form.emergencyContactRelation || ""}
                      onChange={(v) =>
                        updateField("emergencyContactRelation", v)
                      }
                    />
                    <Field
                      label="Photograph URL"
                      value={form.photoUrl || ""}
                      onChange={(v) => updateField("photoUrl", v)}
                      placeholder="https://…"
                    />
                    <Field
                      label="PAN"
                      value={form.pan || ""}
                      onChange={(v) => updateField("pan", v)}
                    />
                    <Field
                      label="Aadhaar"
                      value={form.aadhaar || ""}
                      onChange={(v) => updateField("aadhaar", v)}
                    />
                    <Field
                      label="Passport Number"
                      value={form.passportNumber || ""}
                      onChange={(v) => updateField("passportNumber", v)}
                    />
                    <Field
                      label="Passport Expiry"
                      type="date"
                      value={form.passportExpiry || ""}
                      onChange={(v) => updateField("passportExpiry", v)}
                    />
                    <Field
                      label="Voter ID"
                      value={form.voterId || ""}
                      onChange={(v) => updateField("voterId", v)}
                    />
                    <Field
                      label="Disability Status"
                      value={form.disabilityStatus || ""}
                      onChange={(v) => updateField("disabilityStatus", v)}
                    />
                  </SectionGrid>
                )}

                {/* EMPLOYMENT SECTION */}
                {activeTab === "employment" && (
                  <SectionGrid
                    title="Employment Details"
                    description="Core employment, confirmation, contract and reporting information."
                  >
                    <Field
                      label="Date of Joining"
                      type="date"
                      value={form.dateOfJoining || ""}
                      onChange={(v) => updateField("dateOfJoining", v)}
                    />
                    <Field
                      label="Date of Confirmation"
                      type="date"
                      value={form.dateOfConfirmation || ""}
                      onChange={(v) => updateField("dateOfConfirmation", v)}
                    />
                    <SelectField
                      label="Employee Type"
                      value={form.employeeType || ""}
                      onChange={(v) => updateField("employeeType", v)}
                      options={[
                        { value: "", label: "Select type…" },
                        { value: "Permanent", label: "Permanent" },
                        { value: "Contract", label: "Contract" },
                        { value: "Temporary", label: "Temporary" },
                        { value: "Intern", label: "Intern" },
                      ]}
                    />
                    <Field
                      label="Department"
                      value={form.department || ""}
                      onChange={(v) => updateField("department", v)}
                    />
                    <Field
                      label="Designation"
                      value={form.designation || ""}
                      onChange={(v) => updateField("designation", v)}
                    />
                    <Field
                      label="Reporting Manager (Primary)"
                      value={form.reportingL1 || form.managerName || ""}
                      onChange={(v) => updateField("reportingL1", v)}
                    />
                    <Field
                      label="Reporting L2"
                      value={form.reportingL2 || ""}
                      onChange={(v) => updateField("reportingL2", v)}
                    />
                    <Field
                      label="Reporting L3"
                      value={form.reportingL3 || ""}
                      onChange={(v) => updateField("reportingL3", v)}
                    />
                    <Field
                      label="Job Location / Branch"
                      value={form.jobLocation || ""}
                      onChange={(v) => updateField("jobLocation", v)}
                    />
                    <SelectField
                      label="Employment Status"
                      value={form.employmentStatus || ""}
                      onChange={(v) => updateField("employmentStatus", v)}
                      options={[
                        { value: "", label: "Select status…" },
                        { value: "Active", label: "Active" },
                        { value: "On Leave", label: "On Leave" },
                        { value: "Resigned", label: "Resigned" },
                        { value: "Terminated", label: "Terminated" },
                      ]}
                    />
                    <Field
                      label="Work Shift Details"
                      value={form.shiftDetails || ""}
                      onChange={(v) => updateField("shiftDetails", v)}
                    />
                    <Field
                      label="Probation Period"
                      placeholder="e.g. 6 months"
                      value={form.probationPeriod || ""}
                      onChange={(v) => updateField("probationPeriod", v)}
                    />
                    <Field
                      label="Contract Start Date"
                      type="date"
                      value={form.contractStartDate || ""}
                      onChange={(v) => updateField("contractStartDate", v)}
                    />
                    <Field
                      label="Contract End Date"
                      type="date"
                      value={form.contractEndDate || ""}
                      onChange={(v) => updateField("contractEndDate", v)}
                    />
                    <Field
                      label="Exit Date"
                      type="date"
                      value={form.exitDate || ""}
                      onChange={(v) => updateField("exitDate", v)}
                    />
                    <Field
                      label="Exit Reason"
                      value={form.exitReason || ""}
                      onChange={(v) => updateField("exitReason", v)}
                    />
                    <Field
                      label="Supervisor Details"
                      value={form.supervisorDetails || ""}
                      onChange={(v) => updateField("supervisorDetails", v)}
                    />
                    <SelectField
                      label="HRMS Access Role"
                      value={
                        form.hrmsAccessRole || form.hrmsAccess || "EMPLOYEE"
                      }
                      onChange={(v) => updateField("hrmsAccessRole", v)}
                      options={[
                        { value: "EMPLOYEE", label: "Employee" },
                        { value: "MANAGER", label: "Manager" },
                        { value: "ADMIN", label: "Admin" },
                        { value: "SUPERADMIN", label: "Super Admin" },
                      ]}
                    />
                  </SectionGrid>
                )}

                {/* COMPENSATION SECTION */}
                {activeTab === "compensation" && (
                  <SectionGrid
                    title="Compensation & Payroll"
                    description="Salary structure, CTC, bank, tax, PF/ESI and related payroll settings."
                  >
                    <Field
                      label="Salary Structure"
                      placeholder="Basic, HRA, Conveyance, Medical, Special Allowance"
                      value={form.salaryStructure || ""}
                      onChange={(v) => updateField("salaryStructure", v)}
                    />
                    <Field
                      label="Pay Grade / Band"
                      value={form.payGrade || ""}
                      onChange={(v) => updateField("payGrade", v)}
                    />
                    <Field
                      label="CTC (Cost to Company)"
                      value={form.ctc || ""}
                      onChange={(v) => updateField("ctc", v)}
                    />
                    <Field
                      label="Bank Name"
                      value={form.bankName || ""}
                      onChange={(v) => updateField("bankName", v)}
                    />
                    <Field
                      label="Bank Account Number"
                      value={form.bankAccountNumber || ""}
                      onChange={(v) =>
                        updateField("bankAccountNumber", v)
                      }
                    />
                    <Field
                      label="IFSC Code"
                      value={form.bankIfsc || ""}
                      onChange={(v) => updateField("bankIfsc", v)}
                    />
                    <Field
                      label="PAN (Tax)"
                      value={form.taxPan || form.pan || ""}
                      onChange={(v) => updateField("taxPan", v)}
                    />
                    <Field
                      label="TAN / TDS Details"
                      value={form.tanOrTdsDetails || ""}
                      onChange={(v) => updateField("tanOrTdsDetails", v)}
                    />
                    <Field
                      label="PF Number"
                      value={form.pfNumber || ""}
                      onChange={(v) => updateField("pfNumber", v)}
                    />
                    <Field
                      label="ESI Number"
                      value={form.esiNumber || ""}
                      onChange={(v) => updateField("esiNumber", v)}
                    />
                    <Field
                      label="Professional Tax Number"
                      value={form.professionalTaxNumber || ""}
                      onChange={(v) =>
                        updateField("professionalTaxNumber", v)
                      }
                    />
                    <SelectField
                      label="Salary Payment Mode"
                      value={form.salaryPaymentMode || ""}
                      onChange={(v) => updateField("salaryPaymentMode", v)}
                      options={[
                        { value: "", label: "Select payment mode…" },
                        { value: "Bank Transfer", label: "Bank Transfer" },
                        { value: "Cheque", label: "Cheque" },
                        { value: "Cash", label: "Cash" },
                      ]}
                    />
                    <Field
                      label="Salary Components & Allowances"
                      value={form.salaryComponents || ""}
                      onChange={(v) => updateField("salaryComponents", v)}
                    />
                    <SelectField
                      label="Payroll Cycle"
                      value={form.payrollCycle || ""}
                      onChange={(v) => updateField("payrollCycle", v)}
                      options={[
                        { value: "", label: "Select cycle…" },
                        { value: "Monthly", label: "Monthly" },
                        { value: "Bi-Monthly", label: "Bi-Monthly" },
                        { value: "Weekly", label: "Weekly" },
                      ]}
                    />
                    <Field
                      label="Bonus / Incentive Details"
                      value={form.bonusDetails || ""}
                      onChange={(v) => updateField("bonusDetails", v)}
                    />
                    <Field
                      label="Overtime Details & Rates"
                      value={form.overtimeDetails || ""}
                      onChange={(v) => updateField("overtimeDetails", v)}
                    />
                    <Field
                      label="Leave Encashment Policies"
                      value={form.leaveEncashmentPolicy || ""}
                      onChange={(v) =>
                        updateField("leaveEncashmentPolicy", v)
                      }
                    />
                    <Field
                      label="Deductions (Loan, Advances, Insurance, etc.)"
                      value={form.deductions || ""}
                      onChange={(v) => updateField("deductions", v)}
                    />
                    <Field
                      label="Investment Declarations for Tax Saving"
                      value={form.investmentDeclarations || ""}
                      onChange={(v) =>
                        updateField("investmentDeclarations", v)
                      }
                    />
                    <Field
                      label="Tax Forms / Records (Form 16, 26AS, etc.)"
                      value={form.taxFormRecords || ""}
                      onChange={(v) => updateField("taxFormRecords", v)}
                    />
                  </SectionGrid>
                )}

                {/* ATTENDANCE SECTION */}
                {activeTab === "attendance" && (
                  <SectionGrid
                    title="Attendance & Leave Management"
                    description="Attendance patterns, leave entitlements, WFH and timesheet notes."
                  >
                    <Field
                      label="Attendance Records Notes"
                      placeholder="Any summary notes for daily logs / patterns"
                      value={form.attendanceNotes || ""}
                      onChange={(v) => updateField("attendanceNotes", v)}
                    />
                    <Field
                      label="Leave Entitlement & Balance"
                      placeholder="Sick, Casual, Paid, Maternity/Paternity"
                      value={form.leaveEntitlements || ""}
                      onChange={(v) => updateField("leaveEntitlements", v)}
                    />
                    <Field
                      label="Leave Application History Notes"
                      value={form.leaveHistoryNotes || ""}
                      onChange={(v) => updateField("leaveHistoryNotes", v)}
                    />
                    <Field
                      label="Work From Home Records"
                      value={form.wfhRecords || ""}
                      onChange={(v) => updateField("wfhRecords", v)}
                    />
                    <Field
                      label="Shift Patterns & Rotation"
                      value={form.shiftPatterns || ""}
                      onChange={(v) => updateField("shiftPatterns", v)}
                    />
                    <Field
                      label="Timesheet Submission Details"
                      value={form.timesheetDetails || ""}
                      onChange={(v) => updateField("timesheetDetails", v)}
                    />
                    <Field
                      label="Holiday Calendar Reference"
                      value={form.holidayCalendarReference || ""}
                      onChange={(v) =>
                        updateField("holidayCalendarReference", v)
                      }
                    />
                  </SectionGrid>
                )}

                {/* LEARNING / COMPLIANCE SECTION */}
                {activeTab === "learning" && (
                  <SectionGrid
                    title="Learning, Performance & Compliance"
                    description="Education, certifications, training, performance and legal/compliance records."
                  >
                    <Field
                      label="Educational Qualifications"
                      value={form.educationalQualifications || ""}
                      onChange={(v) =>
                        updateField("educationalQualifications", v)
                      }
                    />
                    <Field
                      label="Professional Certifications"
                      value={form.professionalCertifications || ""}
                      onChange={(v) =>
                        updateField("professionalCertifications", v)
                      }
                    />
                    <Field
                      label="Training Attended / Scheduled"
                      value={form.trainingHistory || ""}
                      onChange={(v) => updateField("trainingHistory", v)}
                    />
                    <Field
                      label="Skill Sets & Expertise"
                      value={form.skills || ""}
                      onChange={(v) => updateField("skills", v)}
                    />
                    <Field
                      label="Performance Appraisals & Ratings"
                      value={form.performanceAppraisals || ""}
                      onChange={(v) =>
                        updateField("performanceAppraisals", v)
                      }
                    />
                    <Field
                      label="Promotions & Transfers History"
                      value={form.promotionsTransfers || ""}
                      onChange={(v) =>
                        updateField("promotionsTransfers", v)
                      }
                    />
                    <Field
                      label="Disciplinary Records & Warnings"
                      value={form.disciplinaryRecords || ""}
                      onChange={(v) =>
                        updateField("disciplinaryRecords", v)
                      }
                    />
                    <Field
                      label="Rewards & Recognition"
                      value={form.rewardsRecognition || ""}
                      onChange={(v) =>
                        updateField("rewardsRecognition", v)
                      }
                    />
                    <Field
                      label="Employment Contract Documents (summary/links)"
                      value={form.employmentContracts || ""}
                      onChange={(v) =>
                        updateField("employmentContracts", v)
                      }
                    />
                    <Field
                      label="NDA / Non-Compete Details"
                      value={form.ndaOrNonCompete || ""}
                      onChange={(v) => updateField("ndaOrNonCompete", v)}
                    />
                    <Field
                      label="Background Verification Reports"
                      value={form.backgroundVerification || ""}
                      onChange={(v) =>
                        updateField("backgroundVerification", v)
                      }
                    />
                    <Field
                      label="Medical / Health Records (high-level reference)"
                      value={form.medicalHealthRecords || ""}
                      onChange={(v) =>
                        updateField("medicalHealthRecords", v)
                      }
                    />
                    <Field
                      label="Work Permits / Visa Details"
                      value={form.workPermits || ""}
                      onChange={(v) => updateField("workPermits", v)}
                    />
                    <Field
                      label="Legal Notices (if any)"
                      value={form.legalNotices || ""}
                      onChange={(v) => updateField("legalNotices", v)}
                    />
                  </SectionGrid>
                )}

                {/* ASSETS / MISC SECTION */}
                {activeTab === "assets" && (
                  <SectionGrid
                    title="Assets, Notes & Miscellaneous"
                    description="Company assets, notes, travel records, exit details and document repository."
                  >
                    <Field
                      label="Company Assets Issued"
                      placeholder="Laptop, Mobile, ID Card, etc."
                      value={form.companyAssets || ""}
                      onChange={(v) => updateField("companyAssets", v)}
                    />
                    <Field
                      label="Asset Return Records"
                      value={form.assetReturnRecords || ""}
                      onChange={(v) =>
                        updateField("assetReturnRecords", v)
                      }
                    />
                    <Field
                      label="Employee Notes / Remarks"
                      value={form.employeeNotes || ""}
                      onChange={(v) => updateField("employeeNotes", v)}
                    />
                    <Field
                      label="Self-Service Portal Access Details"
                      value={form.portalAccessDetails || ""}
                      onChange={(v) =>
                        updateField("portalAccessDetails", v)
                      }
                    />
                    <Field
                      label="Employee’s Bank Loan Details"
                      value={form.bankLoanDetails || ""}
                      onChange={(v) => updateField("bankLoanDetails", v)}
                    />
                    <Field
                      label="Travel & Expense Records (summary)"
                      value={form.travelExpenseRecords || ""}
                      onChange={(v) =>
                        updateField("travelExpenseRecords", v)
                      }
                    />
                    <Field
                      label="Exit Interviews & Relieving Details"
                      value={form.exitInterviewDetails || ""}
                      onChange={(v) =>
                        updateField("exitInterviewDetails", v)
                      }
                    />
                    <Field
                      label="Employee Document Repository Links / Notes"
                      value={form.documentRepository || ""}
                      onChange={(v) =>
                        updateField("documentRepository", v)
                      }
                    />
                  </SectionGrid>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI helpers                                                           */
/* -------------------------------------------------------------------------- */

function TabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full px-3 py-[6px] text-[11px] font-medium transition ${
        props.active
          ? "bg-[#00477f] text-white shadow-sm"
          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {props.label}
    </button>
  );
}

function SectionGrid(props: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#00477f]">
          {props.title}
        </h2>
        {props.description && (
          <p className="mt-1 text-[11px] text-slate-500">
            {props.description}
          </p>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{props.children}</div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const { label, value, onChange, type = "text", placeholder } = props;
  return (
    <label className="flex flex-col gap-1 text-[11px] text-slate-600">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-[6px] text-[11px] text-slate-800 shadow-sm focus:border-[#00477f] focus:bg-white focus:outline-none"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  const { label, value, onChange, options } = props;
  return (
    <label className="flex flex-col gap-1 text-[11px] text-slate-600">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-[6px] text-[11px] text-slate-800 shadow-sm focus:border-[#00477f] focus:bg-white focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value + opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
