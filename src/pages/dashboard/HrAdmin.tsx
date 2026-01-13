// apps/frontend/src/pages/dashboard/HrAdmin.tsx
import { useEffect, useState, FormEvent, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

type AnyObj = Record<string, any>;

export default function HrAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<AnyObj | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<AnyObj[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [selectedEmployee, setSelectedEmployee] = useState<AnyObj | null>(null);

  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  // ------------------------------------------------------------
  // Load HR admin overview (/dashboard/hr-admin)
  // ------------------------------------------------------------
  useEffect(() => {
    let ignore = false;

    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await api.get("/dashboard/hr-admin");
        const raw = (res as AnyObj)?.data ?? res;
        if (!ignore) setSummary(raw || {});
      } catch (err: any) {
        if (!ignore) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load HR overview.";
          setSummaryError(msg);
        }
      } finally {
        if (!ignore) setSummaryLoading(false);
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Load full employee list (/employees) – same as TeamProfiles
  // ------------------------------------------------------------
  useEffect(() => {
    let ignore = false;

    async function loadEmployees() {
      setEmployeesLoading(true);
      setEmployeesError(null);
      try {
        const res = await api.get("/employees");
        const raw = (res as AnyObj)?.data ?? res;
        const list = Array.isArray(raw) ? raw : [];
        if (!ignore) {
          setEmployees(list);
          // Do NOT auto-select; let the user click. (Optional: select first)
        }
      } catch (err: any) {
        if (!ignore) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load employees.";
          setEmployeesError(msg);
        }
      } finally {
        if (!ignore) setEmployeesLoading(false);
      }
    }

    loadEmployees();
    return () => {
      ignore = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Derived data with defensive access
  // ------------------------------------------------------------
  const counts = useMemo(() => {
    const c = (summary as AnyObj)?.counts ?? {};
    return {
      totalEmployees:
        c.totalEmployees ??
        c.total ??
        (Array.isArray(employees) ? employees.length : 0),
      activeEmployees: c.activeEmployees ?? 0,
      inactiveEmployees: c.inactiveEmployees ?? 0,
      pendingOnboarding:
        c.pendingOnboarding ??
        ((summary as AnyObj)?.pendingOnboarding?.length ?? 0),
      openLeaveRequests: c.openLeaveRequests ?? 0,
      todaysAbsents: c.todaysAbsents ?? 0,
    };
  }, [summary, employees]);

  const onboarding: AnyObj[] = useMemo(
    () => ((summary as AnyObj)?.pendingOnboarding as AnyObj[]) ?? [],
    [summary]
  );

  const alerts: string[] = useMemo(
    () => ((summary as AnyObj)?.alerts as string[]) ?? [],
    [summary]
  );

  const welcomeName = useMemo(
    () =>
      (user as AnyObj)?.name ||
      (user as AnyObj)?.fullName ||
      (user as AnyObj)?.displayName ||
      (user as AnyObj)?.email ||
      "",
    [user]
  );

  // ------------------------------------------------------------
  // Build rich detail view purely from selectedEmployee (User model)
  // ------------------------------------------------------------
  const detailView = useMemo(() => {
    if (!selectedEmployee) return null;
    const emp = selectedEmployee as AnyObj;

    const fullName =
      emp.fullName ||
      emp.name ||
      [emp.firstName, emp.lastName].filter(Boolean).join(" ") ||
      emp.email ||
      "Employee";

    const officialEmail =
      emp.officialEmail ||
      emp.workEmail ||
      emp.companyEmail ||
      emp.corporateEmail ||
      emp.email ||
      "";

    const personalEmail =
      emp.personalEmail || emp.personalEmailId || emp.alternateEmail || "";

    const mobile =
      emp.phone ||
      emp.mobile ||
      emp.personalContact ||
      emp.contactNumber ||
      emp.emergencyContactNumber ||
      "";

    const location =
      emp.jobLocation || emp.location || emp.branch || emp.baseLocation || "";

    const department = emp.department || "";
    const designation = emp.designation || "";
    const doj =
      emp.dateOfJoining ||
      emp.joiningDate ||
      emp.doj ||
      emp.employmentStartDate ||
      "";

    const status =
      emp.employmentStatus ||
      emp.status ||
      (emp.isActive === false ? "INACTIVE" : "ACTIVE");

    const managerName =
      emp.reportingL1 ||
      emp.managerName ||
      emp.reportingManager ||
      emp.manager ||
      "";

    // IDs
    const aadhaar =
      emp.aadhaar || emp.aadhaarNumber || emp.aadhar || emp.aadharNumber || "";

    const pan =
      emp.pan ||
      emp.panNumber ||
      emp.taxPan ||
      emp.taxPanNumber ||
      emp.panCardNumber ||
      "";

    const passport =
      emp.passportNumber || emp.passport || emp.passportNo || "";

    const passportExpiry =
      emp.passportExpiry ||
      emp.passportValidTill ||
      emp.passportValidity ||
      "";

    const voterId = emp.voterId || emp.voterID || "";

    // Bank
    const bankName = emp.bankName || "";
    const bankAccountNumber =
      emp.bankAccountNumber ||
      emp.accountNumber ||
      emp.accountNo ||
      emp.bankAccNumber ||
      "";
    const bankIfsc = emp.bankIfsc || emp.ifsc || emp.ifscCode || "";

    // Emergency contact
    const emergencyName =
      emp.emergencyContactName || emp.emergencyName || emp.emergencyPerson || "";
    const emergencyRelation =
      emp.emergencyContactRelation ||
      emp.emergencyRelation ||
      emp.relationship ||
      "";
    const emergencyMobile =
      emp.emergencyContactNumber ||
      emp.emergencyMobile ||
      emp.emergencyPhone ||
      "";

    // Education (best-effort)
    const highestDegree =
      emp.highestDegree ||
      emp.educationalQualifications ||
      emp.education ||
      "";
    const institution =
      emp.institution ||
      emp.university ||
      emp.college ||
      emp.educationInstitution ||
      "";
    const educationYear =
      emp.educationYear ||
      emp.yearOfPassing ||
      emp.passingYear ||
      emp.graduationYear ||
      "";

    return {
      fullName,
      officialEmail,
      personalEmail,
      mobile,
      location,
      department,
      designation,
      doj,
      status,
      managerName,
      aadhaar,
      pan,
      passport,
      passportExpiry,
      voterId,
      bankName,
      bankAccountNumber,
      bankIfsc,
      emergencyName,
      emergencyRelation,
      emergencyMobile,
      highestDegree,
      institution,
      educationYear,
    };
  }, [selectedEmployee]);

  // ------------------------------------------------------------
  // Copilot submit
  // ------------------------------------------------------------
  async function handleAskCopilot(e: FormEvent) {
    e.preventDefault();
    const q = copilotQuestion.trim();
    if (!q) return;

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotAnswer(null);

    try {
      const payload: AnyObj = {
        question: q,
        mode: "hr-admin",
      };

      if (selectedEmployee) {
        payload.employeeId =
          selectedEmployee.id ||
          selectedEmployee.employee_id ||
          selectedEmployee._id ||
          null;
      }

      const res = await api.post("/copilot/manager", payload);
      const data = (res as AnyObj).data ?? res;
      const answer =
        data?.answer ||
        data?.message ||
        "No answer returned from the HR Copilot demo.";
      setCopilotAnswer(answer);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to ask HR Copilot.";
      setCopilotError(msg);
    } finally {
      setCopilotLoading(false);
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            HR Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Welcome{welcomeName ? `, ${welcomeName}` : ""}. Get an org-wide
            snapshot and use the HR Copilot to answer day-to-day questions.
          </p>
        </div>
      </header>

      {/* Errors */}
      {summaryError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-2">
          {summaryError}
        </div>
      )}
      {employeesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-2">
          {employeesError}
        </div>
      )}

      {/* Summary tiles */}
      <section>
        {summaryLoading && !summary ? (
          <div className="text-sm text-slate-500">Loading HR overview…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: "Total employees", value: counts.totalEmployees },
              { label: "Active", value: counts.activeEmployees },
              { label: "Inactive", value: counts.inactiveEmployees },
              {
                label: "Pending onboarding",
                value: counts.pendingOnboarding,
              },
              {
                label: "Open leave requests",
                value: counts.openLeaveRequests,
              },
              { label: "Absent today", value: counts.todaysAbsents },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  {tile.label}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {tile.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main grid: lists + details + copilot */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)] gap-4">
        {/* Left side */}
        <div className="space-y-4">
          {/* Pending onboarding block */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Pending onboarding
              </h2>
              <span className="rounded-full bg-amber-50 px-2.5 py-[3px] text-xs font-medium text-amber-700">
                {onboarding.length}
              </span>
            </div>
            <div className="max-h-72 overflow-auto divide-y divide-slate-100">
              {onboarding.length ? (
                onboarding.map((row: AnyObj) => {
                  const id =
                    row.id ||
                    row.employee_id ||
                    row._id ||
                    row.token ||
                    String(Math.random());
                  const isSelected =
                    selectedEmployee &&
                    (selectedEmployee.id ||
                      selectedEmployee.employee_id ||
                      selectedEmployee.token) ===
                      (row.id || row.employee_id || row.token);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedEmployee(row)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                        isSelected ? "bg-slate-50" : ""
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {row.fullName ||
                            row.name ||
                            row.employee_name ||
                            "Unnamed employee"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {row.jobTitle || row.designation || "Role not set"}
                          {row.location ? ` • ${row.location}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {row.joiningDate && (
                          <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[11px] text-slate-700">
                            DOJ:{" "}
                            {new Date(
                              row.joiningDate
                            ).toLocaleDateString()}
                          </span>
                        )}
                        {row.missingItemsCount != null && (
                          <span className="rounded-full bg-rose-50 px-2 py-[2px] text-[11px] text-rose-700">
                            {row.missingItemsCount} pending docs
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No pending onboarding items 🎉
                </div>
              )}
            </div>
          </div>

          {/* Alerts block */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                HR alerts
              </h2>
            </div>
            <div className="max-h-56 overflow-auto divide-y divide-slate-100">
              {alerts.length ? (
                alerts.map((msg, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2.5 text-sm text-slate-700"
                  >
                    {msg}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No critical alerts right now.
                </div>
              )}
            </div>
          </div>

          {/* Employees list – uses /employees */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                All employees (sample)
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-[3px] text-xs font-medium text-slate-700">
                {employees.length}
              </span>
            </div>
            <div className="max-h-64 overflow-auto divide-y divide-slate-100">
              {employeesLoading && employees.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  Loading employees…
                </div>
              )}
              {!employeesLoading && employees.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No employees found.
                </div>
              )}
              {employees.map((emp: AnyObj) => {
                const id =
                  emp.id ||
                  emp.employee_id ||
                  emp._id ||
                  emp.email ||
                  String(Math.random());
                const isSelected =
                  selectedEmployee &&
                  (selectedEmployee.id ||
                    selectedEmployee.employee_id ||
                    selectedEmployee._id ||
                    selectedEmployee.email) ===
                    (emp.id || emp.employee_id || emp._id || emp.email);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      isSelected ? "bg-slate-50" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {emp.fullName ||
                          emp.name ||
                          [emp.firstName, emp.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          emp.email ||
                          "Unnamed employee"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {emp.jobTitle || emp.designation || "Role not set"}
                        {emp.department ? ` • ${emp.department}` : ""}
                      </div>
                    </div>
                    {emp.location && (
                      <div className="text-xs text-slate-500">
                        {emp.location}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right side – Selected details + HR Copilot */}
        <aside className="flex flex-col gap-4">
          {/* Selected person details */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Selected person details
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Click an item in Pending onboarding or All employees to see a
                  rich HR snapshot here.
                </p>
              </div>
              {selectedEmployee && (
                <button
                  type="button"
                  onClick={() => navigate("/profile/team")}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  View in Team Profiles
                </button>
              )}
            </div>

            <div className="px-4 py-3 text-sm text-slate-800">
              {!selectedEmployee && (
                <p className="text-sm text-slate-500">
                  No person selected yet. Choose a record from the left to load
                  details.
                </p>
              )}

              {selectedEmployee && detailView && (
                <div className="space-y-3 text-[11px] text-slate-800">
                  {/* Top summary */}
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {detailView.status || "Employee / Onboarding"}
                      </div>
                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {detailView.fullName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {detailView.designation || "Role not set"}
                        {detailView.department
                          ? ` • ${detailView.department}`
                          : ""}
                        {detailView.location ? ` • ${detailView.location}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px]">
                      {detailView.doj && (
                        <span className="rounded-full bg-slate-50 px-2 py-[3px] text-slate-700">
                          DOJ:{" "}
                          {new Date(detailView.doj).toLocaleDateString()}
                        </span>
                      )}
                      {detailView.status && (
                        <span className="rounded-full bg-emerald-50 px-2 py-[3px] text-emerald-700">
                          {detailView.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact & emails */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoField
                      label="Official / Work Email"
                      value={detailView.officialEmail || "Not set"}
                    />
                    <InfoField
                      label="Personal Email"
                      value={detailView.personalEmail || "Not set"}
                    />
                    <InfoField
                      label="Mobile"
                      value={detailView.mobile || "Not set"}
                    />
                    <InfoField
                      label="Manager / Reporting L1"
                      value={detailView.managerName || "Not set"}
                    />
                  </div>

                  {/* IDs */}
                  <div className="mt-1">
                    <div className="text-[11px] font-semibold text-slate-700">
                      ID &amp; Compliance
                    </div>
                    <div className="mt-1 grid gap-3 md:grid-cols-3">
                      <InfoField label="Aadhaar" value={detailView.aadhaar} />
                      <InfoField label="PAN" value={detailView.pan} />
                      <InfoField
                        label="Passport"
                        value={detailView.passport}
                      />
                      <InfoField
                        label="Passport Expiry"
                        value={detailView.passportExpiry}
                      />
                      <InfoField
                        label="Voter ID"
                        value={detailView.voterId}
                      />
                    </div>
                  </div>

                  {/* Bank */}
                  <div className="mt-1">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Bank &amp; Payroll
                    </div>
                    <div className="mt-1 grid gap-3 md:grid-cols-2">
                      <InfoField
                        label="Bank Name"
                        value={detailView.bankName}
                      />
                      <InfoField
                        label="Account Number"
                        value={detailView.bankAccountNumber}
                      />
                      <InfoField label="IFSC" value={detailView.bankIfsc} />
                    </div>
                  </div>

                  {/* Emergency & education */}
                  <div className="mt-1 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">
                        Emergency Contact
                      </div>
                      <div className="mt-1 grid gap-2">
                        <InfoField
                          label="Name"
                          value={detailView.emergencyName}
                        />
                        <InfoField
                          label="Relationship"
                          value={detailView.emergencyRelation}
                        />
                        <InfoField
                          label="Mobile"
                          value={detailView.emergencyMobile}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700">
                        Education
                      </div>
                      <div className="mt-1 grid gap-2">
                        <InfoField
                          label="Highest Degree"
                          value={detailView.highestDegree}
                        />
                        <InfoField
                          label="Institution"
                          value={detailView.institution}
                        />
                        <InfoField
                          label="Year of Passing"
                          value={detailView.educationYear}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* HR Copilot */}
          <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                HR Copilot
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ask org-level questions.{" "}
                {selectedEmployee
                  ? `Currently focused on ${
                      detailView?.fullName ||
                      selectedEmployee.fullName ||
                      selectedEmployee.name ||
                      "the selected employee"
                    }.`
                  : "Select an employee to focus the answer on a person."}
              </p>
            </div>

            <form
              onSubmit={handleAskCopilot}
              className="flex flex-col gap-2 px-4 py-3"
            >
              <textarea
                className="min-h-[80px] w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                placeholder={
                  selectedEmployee
                    ? `e.g. "What documents are pending for ${
                        detailView?.fullName ||
                        selectedEmployee.fullName ||
                        selectedEmployee.name ||
                        "this employee"
                      }?"`
                    : 'e.g. "Who hasn\'t submitted onboarding documents yet?"'
                }
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                disabled={copilotLoading}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-400">
                  Demo mode – answers are generated from sample data, not real
                  HR policies.
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                  disabled={copilotLoading || !copilotQuestion.trim()}
                >
                  {copilotLoading ? "Asking…" : "Ask Copilot"}
                </button>
              </div>
            </form>

            <div className="max-h-64 overflow-auto border-t border-slate-100 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
              {copilotError && (
                <div className="mb-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                  {copilotError}
                </div>
              )}

              {copilotAnswer ? (
                copilotAnswer
              ) : (
                <span className="text-sm text-slate-400">
                  Copilot answers will appear here. Try questions like:
                  <br />
                  • &quot;List employees with pending onboarding documents&quot;
                  <br />
                  • &quot;Show leave requests awaiting approval this week&quot;
                  <br />
                  • &quot;How many employees are in Mumbai office?&quot;
                </span>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

/* Small info field helper */
function InfoField(props: { label: string; value?: any }) {
  const value =
    props.value === null ||
    props.value === undefined ||
    String(props.value).trim() === ""
      ? "—"
      : String(props.value);
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-slate-500">
        {props.label}
      </div>
      <div className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-900">
        {value}
      </div>
    </div>
  );
}
