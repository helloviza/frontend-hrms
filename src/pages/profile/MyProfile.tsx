// apps/frontend/src/pages/profile/MyProfile.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import AttendanceChart, {
  AttendancePoint,
} from "../../components/charts/AttendanceChart";
import LeavePie, { LeaveSlice } from "../../components/charts/LeavePie";
import StatsCards from "../../components/widgets/StatsCards";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const COPILOT_MASCOT_SRC = "/assets/hr-copilot-mascot.png";

const BACKEND_ORIGIN =
  import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8080";


/* ---------- types ---------- */

type ProfileData = {
  name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  managerName?: string;
  department?: string;
  location?: string;
  avatarUrl?: string;

  // extended profile fields for richer tabs
  skills?: string[];
  tools?: string[];
  totalExperienceYears?: number;
  currentLevel?: string;
  squad?: string;
  documents?: {
    name: string;
    category?: string;
    uploadedAt?: string;
  }[];
};

type RecentLog = { message: string; date: string };

type DashboardStats = {
  attendancePercent: string;
  leavesTaken: string;
  pendingApprovals: string;
  docsUploaded: string;
  attendance?: AttendancePoint[];
  leaveMix?: LeaveSlice[];
};

type AiInsight = {
  title: string;
  body: string;
  tone: "good" | "warn" | "info";
};

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  intent?: string | null;
  ts: string;
  isError?: boolean;
};

type DetailTabId =
  | "profile"
  | "skills"
  | "performance"
  | "comp"
  | "team"
  | "docs"
  | "security";

/* ---------- helpers ---------- */

const PROFILE_CACHE_KEY = "hrms_profile_cache";

function safePercent(value?: string): number {
  if (!value) return 0;
  const n = parseFloat(value.replace("%", "").trim());
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function computeProfileScore(p: ProfileData): number {
  let score = 0;
  const checks: Array<[boolean, number]> = [
    [!!p.name && p.name.trim().length > 0, 12],
    [!!p.email, 12],
    [!!p.phone && p.phone.trim().length >= 10, 14],
    [!!p.department, 10],
    [!!p.location, 10],
    [!!p.managerName, 10],
    [Array.isArray(p.roles) && p.roles.length > 0, 12],
    [!!p.avatarUrl, 20],
  ];
  for (const [ok, pts] of checks) if (ok) score += pts;
  return Math.max(10, Math.min(100, score || 10));
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Stable";
  if (score >= 30) return "Getting started";
  return "Needs attention";
}

function scoreTone(score: number): "good" | "warn" | "info" {
  if (score >= 70) return "good";
  if (score >= 50) return "info";
  return "warn";
}

function isNonEmpty(value: any): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

/**
 * Load cached profile, but ONLY if it belongs to the same user (by email).
 */
function loadCachedProfile(ownerEmail?: string): Partial<ProfileData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const cacheOwner = (parsed as any).__ownerEmail as string | undefined;
    if (ownerEmail && cacheOwner && cacheOwner !== ownerEmail) {
      // Cache belongs to a different logged-in user → ignore
      return {};
    }

    const { __ownerEmail, ...rest } = parsed as any;
    return rest as Partial<ProfileData>;
  } catch {
    return {};
  }
}

/**
 * Save profile into cache, tagged with the owner email so logins do not mix.
 */
function saveCachedProfile(p: ProfileData, ownerEmail?: string) {
  if (typeof window === "undefined") return;
  try {
    const toStore: any = {
      ...p,
      __ownerEmail: ownerEmail || p.email || null,
    };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore quota / privacy errors
  }
}

/**
 * Merge sources:
 *  - base: from token (AuthContext user)
 *  - fromServer: backend /users/profile
 *  - fromCache: localStorage (cosmetic only)
 *
 * IMPORTANT: cache is NOT allowed to override roles.
 */
function mergeProfile(
  base: ProfileData,
  fromServer?: Partial<ProfileData> | null,
  fromCache?: Partial<ProfileData> | null
): ProfileData {
  const merged: ProfileData = { ...base };

  const apply = (
    src?: Partial<ProfileData> | null,
    opts: { allowRoles?: boolean } = {}
  ) => {
    if (!src || typeof src !== "object") return;
    const keys: (keyof ProfileData)[] = [
      "name",
      "email",
      "phone",
      "roles",
      "managerName",
      "department",
      "location",
      //avatarUrl,
      "skills",
      "tools",
      "totalExperienceYears",
      "currentLevel",
      "squad",
      "documents",
    ];
    for (const key of keys) {
      if (key === "roles" && !opts.allowRoles) continue;
      const value = src[key];
      if (isNonEmpty(value)) {
        (merged as any)[key] = value as any;
      }
    }
  };

  // Backend can set roles; base has roles from logged-in token
  apply(fromServer || undefined, { allowRoles: true });

  // Cache is purely cosmetic and MUST NOT affect roles
  apply(fromCache || undefined, { allowRoles: false });

  // 🔒 Avatar is server-owned identity — never overridden by cache
if (fromServer?.avatarUrl) {
  merged.avatarUrl = fromServer.avatarUrl;
}


  return merged;
}

function getAccessToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("hrms_access_token") ||
    localStorage.getItem("hrms:accessToken") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("token") ||
    ""
  );
}

function toStr(v: any, fallback: string): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return v.toString();
  if (typeof v === "string") return v;
  return String(v);
}

/**
 * Normalise whatever the backend returns for /stats/dashboard
 * into our DashboardStats shape so tiles + AI Copilot see the
 * correct numbers.
 *
 * Supports:
 *  - Axios-style { data: { ... } }
 *  - Flat { attendancePercent, leavesTaken, ... }
 *  - Nested { stats: { ... }, attendance: [...], leaveMix: [...] }
 */
function normalizeDashboardStats(raw: any): DashboardStats {
  // 1) Unwrap Axios-style response if present
  const src =
    raw && typeof raw === "object" ? (raw as any).data ?? raw : null;

  if (!src || typeof src !== "object") {
    return {
      attendancePercent: "—",
      leavesTaken: "0",
      pendingApprovals: "0",
      docsUploaded: "0",
      attendance: [],
      leaveMix: [],
    };
  }

  // 2) Some backends send { stats: { ... }, attendance: [...], leaveMix: [...] }
  const base =
    (src as any).stats && typeof (src as any).stats === "object"
      ? (src as any).stats
      : (src as any);

  const attendancePercent =
    toStr(
      base.attendancePercent ??
        base.attendance_pct ??
        base.attendanceRate ??
        base.attendancePercentThisMonth ??
        base.attendancePercentage,
      "—"
    ) || "—";

  const leavesTaken =
    toStr(
      base.leavesTaken ??
        base.leaveCount ??
        base.leavesCount ??
        base.totalLeavesTaken ??
        base.usedLeaves,
      "0"
    ) || "0";

  const pendingApprovals =
    toStr(
      base.pendingApprovals ??
        base.pendingLeaves ??
        base.pendingLeaveCount ??
        base.pendingRequests,
      "0"
    ) || "0";

  const docsUploaded =
    toStr(
      base.docsUploaded ??
        base.documentsUploaded ??
        base.documentCount ??
        base.docsCount,
      "0"
    ) || "0";

  // 3) Time-series / charts – use src first, then base
  const attendanceSeries: AttendancePoint[] =
    ((src as any).attendance ||
      (src as any).attendanceSeries ||
      (src as any).attendanceChart ||
      base.attendance ||
      []) as AttendancePoint[];

  const leaveMix: LeaveSlice[] =
    ((src as any).leaveMix ||
      (src as any).leaveDistribution ||
      (src as any).leaveChart ||
      base.leaveMix ||
      []) as LeaveSlice[];

  return {
    attendancePercent,
    leavesTaken,
    pendingApprovals,
    docsUploaded,
    attendance: attendanceSeries || [],
    leaveMix: leaveMix || [],
  };
}

/* ---------- component ---------- */

export default function MyProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const fallbackName = (user?.email || "You").split("@")[0];

  const [profile, setProfile] = useState<ProfileData>({
    name: fallbackName,
    email: user?.email,
    roles: user?.roles || [],
  });

  const [attendance, setAttendance] = useState<AttendancePoint[]>([]);
  const [leaveSlices, setLeaveSlices] = useState<LeaveSlice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<RecentLog[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ProfileData>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // HR assistant state
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DetailTabId>("profile");

  // security / password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // admin reset password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // chat container: scroll only inside the chat, not the whole page
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // track when profile has finished initial load (server/cache)
  const [profileLoaded, setProfileLoaded] = useState(false);
  // ensure we only inject the welcome message once
  const assistantInitRef = useRef(false);

  const firstName = useMemo(() => {
    const sourceName = profile.name || fallbackName || "";
    const trimmed = sourceName.trim();
    if (!trimmed) return "";
    const parts = trimmed.split(/\s+/);
    return parts[0] || "";
  }, [profile.name, fallbackName]);

  /**
   * Route lock:
   *  - If URL has an :id (or :userId / :employeeId)
   *  - And logged in user is NOT HR / Admin
   *  - And paramId !== logged-in user id
   *  → force redirect to this user's own profile route (strip trailing segment or /profile).
   */
  useEffect(() => {
    if (!user) return;

    const userId =
      (user as any).id ||
      (user as any)._id ||
      (user as any).userId ||
      (user as any).employeeId ||
      "";

    const paramId =
      (params as any).id ||
      (params as any).userId ||
      (params as any).employeeId ||
      "";

    if (!paramId || !userId) return;

    const rolesArray = Array.isArray(user.roles) ? user.roles : [];
    const upperRoles = rolesArray.map((r: any) => String(r).toUpperCase());
    const isHrOrAdmin =
      upperRoles.includes("HR") || upperRoles.includes("ADMIN");

    if (!isHrOrAdmin && String(paramId) !== String(userId)) {
      const path = location.pathname || "";
      const stripped = path.replace(/\/[^/]+$/, "");
      const target = stripped && stripped !== path ? stripped : "/profile";
      navigate(target, { replace: true });
    }
  }, [user, params, location.pathname, navigate]);

  const isHrOrAdmin = useMemo(() => {
    const sourceRoles =
      user?.roles && user.roles.length ? user.roles : profile.roles || [];
    const roles = sourceRoles.map((r) => String(r).toUpperCase());
    return roles.includes("HR") || roles.includes("ADMIN");
  }, [user?.roles, profile.roles]);

  // Autoscroll *inside* chat panel when messages change
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [assistantMessages.length]);

  // auto-hide toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  /* load profile + stats + logs */
  useEffect(() => {
    (async () => {
      let serverProfile: Partial<ProfileData> | null = null;

      try {
        // 1) get from backend (best-effort)
        try {
          const p = await api.get("/users/profile");
          if (p && typeof p === "object") {
            serverProfile = p as Partial<ProfileData>;
          }
        } catch (err) {
          console.warn("Profile load failed", err);
        }

        // 2) get from cache (only if belongs to this email)
        const cachedProfile = loadCachedProfile(user?.email || undefined);

        // 3) merge: fallback -> server -> cache
        const merged = mergeProfile(
          {
            name: fallbackName,
            email: user?.email,
            roles: user?.roles || [],
          },
          serverProfile,
          cachedProfile
        );

        setProfile(merged);
        saveCachedProfile(merged, user?.email || undefined);

        // 4) stats (normalised)
        try {
          const raw = await api.get("/stats/dashboard");
          const dash = normalizeDashboardStats(raw);
          setStats(dash);
          setAttendance(dash.attendance || []);
          setLeaveSlices(dash.leaveMix || []);
        } catch (err: any) {
          console.warn("Dashboard stats failed", err?.message || err);

          const fallbackStats: DashboardStats = {
            attendancePercent: "—",
            leavesTaken: "0",
            pendingApprovals: "0",
            docsUploaded: "0",
            attendance: [],
            leaveMix: [],
          };
          setStats(fallbackStats);
        }

        // 5) logs
        try {
          const rec = await api.get("/logs/recent");
          if (Array.isArray(rec)) setLogs(rec);
        } catch (err) {
          console.warn("Logs fetch failed", err);
        }
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, [fallbackName, user?.email, user?.roles]);

  // initialise assistant welcome message once profile is available
  useEffect(() => {
    if (assistantInitRef.current) return;
    if (!profileLoaded) return;

    const greetingName =
      (firstName && firstName.toLowerCase() !== "you" ? firstName : "") ||
      "Dear";

    assistantInitRef.current = true;
    setAssistantMessages([
      {
        id: "welcome",
        from: "bot",
        text: `Hi ${greetingName}! I’m your PlumTrips HR Copilot. Ask me about your leave balance, attendance, manager details, or documents.`,
        ts: new Date().toISOString(),
      },
    ]);
  }, [profileLoaded, firstName]);

  const roleBadge = useMemo(() => {
    const source =
      user?.roles && user.roles.length ? user.roles : profile.roles;
    return source && source.length ? source[0] : "Employee";
  }, [user?.roles, profile.roles]);

  const profileScore = useMemo(() => computeProfileScore(profile), [profile]);
  const profileScoreLabel = useMemo(
    () => scoreLabel(profileScore),
    [profileScore]
  );
  const profileScoreTone = useMemo(
    () => scoreTone(profileScore),
    [profileScore]
  );

  const resolvedAvatarUrl = useMemo(() => {
  const url = profile.avatarUrl;
  if (!url) return "";

  // absolute URL or base64
  if (/^https?:\/\//.test(url) || url.startsWith("data:")) return url;

  // frontend assets
  if (url.startsWith("/assets/")) return url;

  // backend-served uploads
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}, [profile.avatarUrl]);


  const aiInsights: AiInsight[] = useMemo(() => {
    const items: AiInsight[] = [];
    const att = safePercent(stats?.attendancePercent);
    const hasPhone = !!profile.phone;
    const hasDept = !!profile.department;
    const hasLocation = !!profile.location;

    if (att >= 90) {
      items.push({
        title: "On-time & reliable",
        body: `Your attendance for this period is around ${att}%. This is a strong reliability signal for performance reviews.`,
        tone: "good",
      });
    } else if (att > 0) {
      items.push({
        title: "Attendance can trend higher",
        body: `Your attendance is around ${att}%. Small improvements in on-time check-ins will improve your HR scorecards.`,
        tone: "warn",
      });
    }

    if (!hasPhone || !hasDept || !hasLocation) {
      items.push({
        title: "Complete your contact graph",
        body: "Add phone, department, and location so managers and cross-functional teams can find and reach you instantly.",
        tone: "warn",
      });
    }

    if (leaveSlices && leaveSlices.length > 0) {
      const totalLeaves =
        leaveSlices.reduce((sum, slice) => sum + (slice.value || 0), 0) || 0;
      if (totalLeaves === 0) {
        items.push({
          title: "You haven’t availed leaves yet",
          body: "Planned time-off is healthy. Consider scheduling short breaks to stay sharp and avoid burnout.",
          tone: "info",
        });
      }
    }

    if (!items.length) {
      items.push({
        title: "You’re in a good place",
        body: "Your profile and utilisation patterns look stable. Keeping details fresh lets AI assistants work better for you.",
        tone: "good",
      });
    }

    return items.slice(0, 3);
  }, [stats, profile, leaveSlices]);

  const detailTabs = useMemo(
    () =>
      [
        {
          id: "profile" as DetailTabId,
          label: "Profile Details",
          icon: "👤",
          badge: `${profileScore}%`,
        },
        {
          id: "skills" as DetailTabId,
          label: "Skills & Expertise",
          icon: "💡",
          badge:
            profile.skills && profile.skills.length
              ? profile.skills.length.toString()
              : undefined,
        },
        {
          id: "performance" as DetailTabId,
          label: "Performance & Growth",
          icon: "📈",
          badge: stats?.attendancePercent,
        },
        {
          id: "comp" as DetailTabId,
          label: "Compensation & Benefits",
          icon: "💰",
        },
        {
          id: "team" as DetailTabId,
          label: "Team & Collaboration",
          icon: "🤝",
        },
        {
          id: "docs" as DetailTabId,
          label: "Documents",
          icon: "📎",
          badge: stats?.docsUploaded,
        },
        {
          id: "security" as DetailTabId,
          label: "Security & Password",
          icon: "🔐",
        },
      ] satisfies {
        id: DetailTabId;
        label: string;
        icon: string;
        badge?: string | number;
      }[],
    [profileScore, profile.skills, stats?.attendancePercent, stats?.docsUploaded]
  );

  /* edit profile */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let serverUpdated: Partial<ProfileData> | null = null;

      try {
        const resp = await api.post("/users/profile/update", form);
        if (resp && typeof resp === "object") {
          serverUpdated = resp as Partial<ProfileData>;
        }
      } catch (err) {
        console.warn("Profile update failed (server)", err);
      }

      const merged = mergeProfile(profile, serverUpdated, form);
      setProfile(merged);
      saveCachedProfile(merged, user?.email || undefined);
      setShowEdit(false);
    } catch {
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  /* upload docs */
  const handleUpload = async () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.jpg,.png,.jpeg,.docx";

    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        await api.postForm<any>("/docs/upload", formData);

        alert("Document uploaded successfully");
      } catch (err) {
        console.error(err);
        alert("Upload failed");
      } finally {
        setUploading(false);
      }
    };

    fileInput.click();
  };

    /* upload / change avatar image */
  const handleAvatarUpload = async () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";

    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setAvatarSaving(true);
      try {
        const formData = new FormData();
        formData.append("avatar", file);

        // ✅ Use unified api.postForm so it:
        //  - attaches the in-memory Bearer token
        //  - handles /auth/refresh + retry
        const data = await api.postForm<any>(
          "/users/profile/avatar",
          formData,
        );

        const urlFromServer: string =
  data?.avatarUrl || data?.url || data?.path || "";

const finalUrl = (() => {
  if (!urlFromServer) return profile.avatarUrl || "";

  // already absolute or base64
  if (/^https?:\/\//.test(urlFromServer) || urlFromServer.startsWith("data:")) {
    return urlFromServer;
  }

  // static assets
  if (urlFromServer.startsWith("/assets/")) {
    return urlFromServer;
  }

  // backend base (strip /api)
  const base = new URL(api.BASE).origin;


if (urlFromServer.startsWith("/")) {
  return `${BACKEND_ORIGIN}${urlFromServer}`;
}

return `${BACKEND_ORIGIN}/${urlFromServer}`;
})();


        if (!finalUrl) {
          alert("Avatar uploaded, but server did not return a usable URL.");
        } else {
          // 🔐 Persist avatarUrl into the profile record
          // so /users/profile returns it on ANY device / browser.
          try {
            await api.post("/users/profile/update", {
              avatarUrl: finalUrl,
            });
          } catch (err) {
            console.warn(
              "[HRMS] Failed to persist avatarUrl on profile, using local value only",
              err,
            );
          }
        }

        const merged: ProfileData = {
          ...profile,
          avatarUrl: finalUrl,
        };
        setProfile(merged);
        saveCachedProfile(merged, user?.email || undefined);
      } catch (err) {
        console.error(err);
        alert("Failed to upload profile photo");
      } finally {
        setAvatarSaving(false);
      }
    };

    fileInput.click();
  };


  const handleUseCompanyLogo = async () => {
    const logoUrl = "/assets/logo.png";
    setAvatarSaving(true);
    try {
      const updated = await api.post("/users/profile/update", {
        avatarUrl: logoUrl,
      });
      const finalUrl =
        (updated && (updated as any).avatarUrl) || logoUrl || profile.avatarUrl;

      const merged = {
        ...profile,
        avatarUrl: finalUrl,
      };
      setProfile(merged);
      saveCachedProfile(merged, user?.email || undefined);
    } catch (err) {
      console.error(err);
      const merged = {
        ...profile,
        avatarUrl: logoUrl,
      };
      setProfile(merged);
      saveCachedProfile(merged, user?.email || undefined);
    } finally {
      setAvatarSaving(false);
    }
  };

  const toneClass = (tone: AiInsight["tone"]) => {
    if (tone === "good")
      return "border-emerald-500/40 bg-emerald-500/5 text-emerald-100";
    if (tone === "warn")
      return "border-amber-400/40 bg-amber-400/5 text-amber-100";
    return "border-sky-400/40 bg-sky-400/5 text-sky-100";
  };

  // Ask HR assistant (Phase 1 – rule based + real-time context)
  const handleAskAssistant = async (presetQuestion?: string) => {
    const raw = (presetQuestion ?? assistantQuestion).trim();
    if (!raw) return;

    setAssistantQuestion("");

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      from: "user",
      text: raw,
      ts: new Date().toISOString(),
    };
    setAssistantMessages((prev) => [...prev, userMessage]);

    setAssistantLoading(true);
    setAssistantError(null);

    try {
      const resp = await api.post("/assistant/hr", {
        question: raw,
        context: {
          profile,
          stats,
        },
      });

      console.log("[HR ASSISTANT] raw response:", resp);

      const data: any =
        resp && typeof resp === "object" && "answer" in (resp as any)
          ? resp
          : (resp as any)?.data ?? resp ?? {};

      const intent: string | null = data.intent ?? null;

      const answerText: string =
        (typeof data.answer === "string" && data.answer.trim().length > 0
          ? data.answer
          : typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : typeof data === "string"
          ? data
          : "I’m not able to answer that right now.") ||
        "I’m not able to answer that right now.";

      const botMessage: ChatMessage = {
        id: `b-${Date.now()}`,
        from: "bot",
        text: answerText,
        intent,
        ts: new Date().toISOString(),
      };

      setAssistantMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      console.error("HR assistant error", err);
      const errorText =
        "Sorry, I couldn’t fetch an answer just now. Please try again in a moment.";
      setAssistantError(errorText);
      const botMessage: ChatMessage = {
        id: `e-${Date.now()}`,
        from: "bot",
        text: errorText,
        isError: true,
        ts: new Date().toISOString(),
      };
      setAssistantMessages((prev) => [...prev, botMessage]);
    } finally {
      setAssistantLoading(false);
    }
  };

  // change password submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword.trim() || !newPassword.trim()) {
      const msg = "Please fill both current and new password.";
      setPasswordError(msg);
      setToast({ message: msg, type: "error" });
      return;
    }
    if (newPassword.length < 8) {
      const msg = "New password must be at least 8 characters.";
      setPasswordError(msg);
      setToast({ message: msg, type: "error" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      const msg = "New password and confirm password do not match.";
      setPasswordError(msg);
      setToast({ message: msg, type: "error" });
      return;
    }

    setPasswordSaving(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      const successMsg = "Password updated successfully.";
      setPasswordMessage(successMsg);
      setToast({ message: successMsg, type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      console.error("change-password error", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update password. Please try again.";
      setPasswordError(msg);
      setToast({ message: msg, type: "error" });
    } finally {
      setPasswordSaving(false);
    }
  };

  // admin reset password submit
  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetResult(null);

    if (!resetEmail.trim()) {
      const msg = "Please enter the employee's official email.";
      setResetError(msg);
      setToast({ message: msg, type: "error" });
      return;
    }

    if (resetNewPassword && resetNewPassword.length < 8) {
      const msg = "New password must be at least 8 characters.";
      setResetError(msg);
      setToast({ message: msg, type: "error" });
      return;
    }

    setResetSaving(true);
    try {
      const payload: any = {
        email: resetEmail.trim(),
      };
      if (resetNewPassword.trim()) {
        payload.newPassword = resetNewPassword.trim();
      }

      const resp: any = await api.post(
        "/auth/admin/reset-password",
        payload
      );
      const temp =
        resp?.tempPassword ||
        resp?.data?.tempPassword ||
        "(password set, but not returned)";

      const resultText = `Password reset successfully. Temporary password: ${temp}`;
      setResetResult(resultText);
      setToast({
        message: "Password reset successfully for the selected user.",
        type: "success",
      });
      // DO NOT auto-clear email; HR may want to copy it
      setResetNewPassword("");
    } catch (err: any) {
      console.error("admin reset password error", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to reset password. Please try again.";
      setResetError(msg);
      setToast({ message: msg, type: "error" });
    } finally {
      setResetSaving(false);
    }
  };

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#050816] to-[#020617] text-slate-100">
      {/* top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/40">
            <img
              src="/assets/logo.png"
              alt="PlumTrips HRMS"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-slate-400">
              PlumTrips HRMS
            </p>
            <p className="text-sm font-semibold text-slate-100">
              Quantum Profile Console
            </p>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-6">
          <div className="flex-1 flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700 px-4 py-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.35)]" />
            <input
              placeholder="Search people, skills, squads, projects…"
              className="flex-1 bg-transparent outline-none text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="h-8 w-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center text-[11px]">
              ⏺
            </span>
            <span className="h-8 w-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center text-[11px]">
              ⚙
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-500/60">
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-cyan-500 to-violet-500 text-xs font-bold">
                  {(profile.name || "Y")[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <span className="hidden md:block text-xs text-slate-300">
              {profile.name || fallbackName}
            </span>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="px-6 py-6 space-y-6">
        {/* PERSONAL DETAILS ROW */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)]">
          {/* left nav */}
          <aside className="rounded-3xl bg-slate-900/80 border border-slate-700 p-4 md:p-5 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">
              Details
            </p>
            <nav className="space-y-2 text-sm">
              {detailTabs.map((tab) => {
                const isActive = tab.id === activeDetail;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetail(tab.id)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3 py-2.5 text-left text-xs transition ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 via-sky-500/15 to-violet-500/25 border border-cyan-400/60 text-cyan-50 shadow-[0_0_30px_rgba(8,145,178,0.6)]"
                        : "bg-slate-950/50 border border-slate-700/80 text-slate-300 hover:bg-slate-900/80 hover:border-cyan-400/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-base ${
                          isActive
                            ? "bg-slate-950/80 border border-cyan-400/70 text-cyan-200"
                            : "bg-slate-900/80 border border-slate-600 text-slate-200"
                        }`}
                      >
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {tab.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            isActive
                              ? "bg-cyan-500/20 text-cyan-100 border border-cyan-300/60"
                              : "bg-slate-900/80 text-slate-300 border border-slate-600/70"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="h-7 w-[3px] rounded-full bg-gradient-to-b from-cyan-300 via-sky-400 to-violet-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* right-hand detail panel */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-700 p-5 md:p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.24),transparent_60%)]" />
            </div>

            {/* PROFILE DETAILS */}
            {activeDetail === "profile" && (
              <div className="relative z-10 flex flex-col md:flex-row gap-6">
                {/* avatar & identity */}
                <div className="flex-none">
                  <div className="relative">
                    <div className="h-28 w-28 rounded-2xl overflow-hidden border border-cyan-300/40 shadow-[0_0_40px_rgba(56,189,248,0.7)]">
                      {resolvedAvatarUrl ? (
                        <img
                          src={resolvedAvatarUrl}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center bg-gradient-to-br from-violet-500 to-cyan-500 text-3xl font-bold">
                          {(profile.name || "Y")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAvatarUpload}
                      className="absolute -right-2 top-1/2 translate-y-[-50%] h-8 w-8 rounded-full bg-slate-950/90 border border-cyan-400/60 flex items-center justify-center text-[14px] text-cyan-100 shadow-lg hover:bg-slate-900 disabled:opacity-60"
                      title="Change photo"
                      disabled={avatarSaving}
                    >
                      📷
                    </button>

                    <span className="absolute -right-2 -bottom-2 rounded-xl bg-emerald-400/90 text-slate-900 text-[11px] font-semibold px-3 py-1 shadow-lg">
                      {roleBadge}
                    </span>
                  </div>

                  {/* quick actions */}
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">
                      Quick actions
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleAvatarUpload}
                        disabled={avatarSaving}
                        className="group relative h-9 w-9 rounded-full bg-slate-950/80 border border-cyan-500/50 flex items-center justify-center text-[16px] text-cyan-100 hover:bg-slate-900 hover:border-cyan-300 transition disabled:opacity-60"
                      >
                        📷
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-slate-700 group-hover:opacity-100 group-hover:-translate-y-1 transition-all">
                          {avatarSaving ? "Updating photo…" : "Change photo"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUseCompanyLogo}
                        disabled={avatarSaving}
                        className="group relative h-9 w-9 rounded-full bg-slate-950/80 border border-slate-600 flex items-center justify-center text-[16px] text-slate-100 hover:bg-slate-900 hover:border-slate-300 transition disabled:opacity-60"
                      >
                        🪪
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-slate-700 group-hover:opacity-100 group-hover:-translate-y-1 transition-all">
                          Use Plumtrips.com logo
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            name: profile.name || "",
                            phone: profile.phone || "",
                            department: profile.department || "",
                            location: profile.location || "",
                          });
                          setShowEdit(true);
                        }}
                        className="group relative h-9 w-9 rounded-full bg-slate-950/80 border border-slate-600 flex items-center justify-center text-[16px] text-slate-100 hover:bg-slate-900 hover:border-cyan-400 transition"
                      >
                        ✏️
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[10px] text-slate-100 opacity-0 shadow-lg ring-1 ring-slate-700 group-hover:opacity-100 group-hover:-translate-y-1 transition-all">
                          Edit profile
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="group relative h-9 w-9 rounded-full bg-slate-950/80 border border-emerald-500/60 flex items-center justify-center text-[16px] text-emerald-200 hover:bg-slate-900 hover:border-emerald-300 transition disabled:opacity-60"
                      >
                        📎
                        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[10px] text-emerald-100 opacity-0 shadow-lg ring-1 ring-slate-700 group-hover:opacity-100 group-hover:-translate-y-1 transition-all">
                          {uploading ? "Uploading…" : "Upload docs"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* profile text */}
                <div className="flex-1 space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      Profile Details
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-50">
                      {profile.name || fallbackName}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {profile.department || "Travel Operations"} •{" "}
                      {profile.location || "Remote / Hybrid"}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-slate-400">Email</p>
                      <p className="font-medium text-slate-100">
                        {profile.email || user?.email}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400">Phone</p>
                      <p className="font-medium text-slate-100">
                        {profile.phone || "Add your contact number"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400">Manager</p>
                      <p className="font-medium text-slate-100">
                        {profile.managerName || "Not mapped yet"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400">Role</p>
                      <p className="font-medium text-slate-100">
                        {(user?.roles && user.roles.length
                          ? user.roles
                          : profile.roles || []
                        ).join(", ") || "Employee"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 rounded-2xl bg-black/40 border border-slate-700 px-3 py-3 text-xs">
                    <p className="text-slate-400 mb-1">
                      AI summary of your HR graph
                    </p>
                    <p className="text-slate-100">
                      {aiInsights[0]?.body ||
                        "Your profile looks stable. Keeping your details updated lets managers and AI assistants collaborate with you better."}
                    </p>
                  </div>
                </div>

                {/* profile score */}
                <div className="flex-none w-full md:w-56 space-y-3 text-xs">
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <p className="text-slate-400 mb-1">Profile completeness</p>
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-16">
                        <div className="absolute inset-0 rounded-full border border-slate-700" />
                        <div
                          className="absolute inset-1 rounded-full border-[6px] border-transparent"
                          style={{
                            borderImage:
                              "conic-gradient(from 0deg, #22c55e, #06b6d4, #a855f7, #22c55e) 1",
                            transform: `rotate(${profileScore * 1.8}deg)`,
                          }}
                        />
                        <div className="absolute inset-3 rounded-full bg-slate-950 flex items-center justify-center text-[11px] font-semibold text-slate-100">
                          {profileScore}%
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-300 font-semibold">
                          {profileScoreLabel}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Keep this above{" "}
                          <span className="font-semibold">80%</span> for smooth
                          onboarding, approvals &amp; AI routing.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border px-3 py-3 ${toneClass(
                      profileScoreTone
                    )} text-xs`}
                  >
                    <p className="font-semibold mb-1">Next recommended step</p>
                    <p>
                      {profileScore >= 80
                        ? "You’re in a healthy zone. Keep your skills, location, and manager details perfectly up to date."
                        : "Open “Edit profile” and complete your contact details, department and location to unlock full AI features."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SKILLS & EXPERTISE */}
            {activeDetail === "skills" && (
              <div className="relative z-10 grid gap-6 md:grid-cols-2 text-xs">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Skills &amp; expertise
                  </p>
                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400">
                      No skills captured yet. Add your primary skills to your
                      profile so AI assistants can recommend better learning
                      paths and projects.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Role signals
                  </p>
                  <div className="grid gap-2">
                    <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">Role</p>
                      <p className="font-medium text-slate-100">
                        {(user?.roles && user.roles.length
                          ? user.roles
                          : profile.roles || []
                        ).join(", ") || "Employee"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Department
                      </p>
                      <p className="font-medium text-slate-100">
                        {profile.department || "Not mapped yet"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Location
                      </p>
                      <p className="font-medium text-slate-100">
                        {profile.location || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PERFORMANCE & GROWTH */}
            {activeDetail === "performance" && (
              <div className="relative z-10 grid gap-4 md:grid-cols-2 text-xs">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Performance &amp; growth
                  </p>
                  <div className="grid gap-2">
                    <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Attendance %
                      </p>
                      <p className="text-lg font-semibold text-emerald-300">
                        {stats?.attendancePercent || "—"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Target &gt; 95% for top performance band.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-2.5">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Leaves taken
                      </p>
                      <p className="text-lg font-semibold text-cyan-300">
                        {stats?.leavesTaken || "0"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pending approvals:{" "}
                        <span className="font-semibold text-amber-200">
                          {stats?.pendingApprovals || "0"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Trend view
                  </p>
                  <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3">
                    <p className="text-[11px] text-slate-400 mb-2">
                      Attendance – last 30 days
                    </p>
                    <div className="h-32">
                      <AttendanceChart data={attendance} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3">
                    <p className="text-[11px] text-slate-400 mb-2">
                      Leave mix
                    </p>
                    <div className="h-24 flex items-center justify-center">
                      <LeavePie data={leaveSlices} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COMPENSATION & BENEFITS */}
            {activeDetail === "comp" && (
              <div className="relative z-10 space-y-4 text-xs">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                  Compensation &amp; benefits
                </p>
                <div className="rounded-2xl bg-black/40 border border-slate-700 px-4 py-4">
                  <p className="text-slate-100 font-semibold mb-1">
                    Secure data zone
                  </p>
                  <p className="text-slate-400">
                    Your compensation and benefits data are handled in a secure
                    HR system. When this module is enabled, you’ll see your pay
                    bands, benefit enrollment and renewals here.
                  </p>
                </div>
                <p className="text-[11px] text-slate-500">
                  If you believe your compensation details are incorrect or
                  missing, please reach out to HR. This view will automatically
                  refresh when new data is pushed.
                </p>
              </div>
            )}

            {/* TEAM & COLLABORATION */}
            {activeDetail === "team" && (
              <div className="relative z-10 grid gap-6 md:grid-cols-2 text-xs">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Reporting line
                  </p>
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <p className="text-[11px] text-slate-400 mb-1">Manager</p>
                    <p className="font-medium text-slate-100">
                      {profile.managerName || "Not mapped yet"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Department
                    </p>
                    <p className="font-medium text-slate-100">
                      {profile.department || "Not mapped yet"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <p className="text-[11px] text-slate-400 mb-1">Location</p>
                    <p className="font-medium text-slate-100">
                      {profile.location || "Not set"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Collaboration footprint
                  </p>
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <p className="text-slate-100 font-semibold mb-1">
                      Recent HR activity
                    </p>
                    <p className="text-slate-400">
                      {logs.length > 0
                        ? "You have recent HR events logged. Check the Activity widget for a detailed timeline."
                        : "No recent HR events captured for you yet."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {activeDetail === "docs" && (
              <div className="relative z-10 space-y-4 text-xs">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                  Documents
                </p>

                {profile.documents && profile.documents.length > 0 ? (
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-3 py-3">
                    <ul className="divide-y divide-slate-800/70">
                      {profile.documents.map((doc) => (
                        <li
                          key={doc.name}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="text-slate-100">{doc.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {doc.category || "Document"}{" "}
                            {doc.uploadedAt &&
                              " • " +
                                new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-black/40 border border-slate-700 px-4 py-4">
                    <p className="text-slate-100 font-semibold mb-1">
                      Your document vault
                    </p>
                    <p className="text-slate-400">
                      You have{" "}
                      <span className="font-semibold">
                        {stats?.docsUploaded || 0}
                      </span>{" "}
                      document(s) associated with your profile. Use the{" "}
                      <span className="font-semibold">Upload docs</span> quick
                      action to add ID proofs, bank details or other HR
                      documents. This view will show a live list when the docs
                      API is wired.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SECURITY & PASSWORD */}
            {activeDetail === "security" && (
              <div className="relative z-10 grid gap-6 md:grid-cols-2 text-xs">
                {/* Change my password */}
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Change your password
                  </p>
                  <div className="rounded-2xl bg-black/50 border border-slate-700 px-4 py-4">
                    <p className="text-slate-100 font-semibold mb-1">
                      Personal login password
                    </p>
                    <p className="text-slate-400 mb-3">
                      Update the password you use to sign in to PlumTrips HRMS.
                    </p>

                    <form onSubmit={handleChangePassword} className="space-y-2">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Current password
                        </label>
                        <input
                          type="password"
                          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                          value={currentPassword}
                          onChange={(e) =>
                            setCurrentPassword(e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          New password
                        </label>
                        <input
                          type="password"
                          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          Confirm new password
                        </label>
                        <input
                          type="password"
                          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                          value={confirmNewPassword}
                          onChange={(e) =>
                            setConfirmNewPassword(e.target.value)
                          }
                        />
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1">
                        Minimum 8 characters. Use a mix of letters, numbers and
                        symbols for better security.
                      </p>

                      {passwordError && (
                        <p className="text-[11px] text-rose-300 mt-1">
                          {passwordError}
                        </p>
                      )}
                      {passwordMessage && (
                        <p className="text-[11px] text-emerald-300 mt-1">
                          {passwordMessage}
                        </p>
                      )}

                      <div className="flex justify-end mt-2">
                        <button
                          type="submit"
                          disabled={passwordSaving}
                          className="px-4 py-2 rounded-xl bg-cyan-500 text-xs text-slate-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                        >
                          {passwordSaving ? "Updating…" : "Update password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Admin/HR reset */}
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                    Set / Reset password for others
                  </p>

                  <div className="rounded-2xl bg-black/50 border border-slate-700 px-4 py-4">
                    {isHrOrAdmin ? (
                      <>
                        <p className="text-slate-100 font-semibold mb-1">
                          HR / Admin reset
                        </p>
                        <p className="text-slate-400 mb-3">
                          Reset a team member&apos;s login password using their
                          official email. If you leave the password blank, the
                          system will generate a strong temporary password.
                        </p>

                        <form
                          onSubmit={handleAdminResetPassword}
                          className="space-y-2"
                        >
                          <div>
                            <label className="block text-[11px] text-slate-300 mb-1">
                              Employee official email
                            </label>
                            <input
                              type="email"
                              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-violet-400"
                              value={resetEmail}
                              onChange={(e) =>
                                setResetEmail(e.target.value)
                              }
                              placeholder="user@company.com"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-300 mb-1">
                              New password (optional)
                            </label>
                            <input
                              type="password"
                              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-violet-400"
                              value={resetNewPassword}
                              onChange={(e) =>
                                setResetNewPassword(e.target.value)
                              }
                              placeholder="Leave blank to auto-generate"
                            />
                          </div>

                          {resetError && (
                            <p className="text-[11px] text-rose-300 mt-1">
                              {resetError}
                            </p>
                          )}
                          {resetResult && (
                            <p className="text-[11px] text-emerald-300 mt-1 whitespace-pre-wrap">
                              {resetResult}
                            </p>
                          )}

                          <p className="text-[10px] text-amber-300/80 mt-1">
                            Share the temporary password only over approved
                            secure channels (e.g. company email or official
                            ticket).
                          </p>

                          <div className="flex justify-end mt-2">
                            <button
                              type="submit"
                              disabled={resetSaving}
                              className="px-4 py-2 rounded-xl bg-violet-500 text-xs text-slate-50 font-semibold hover:bg-violet-400 disabled:opacity-60"
                            >
                              {resetSaving ? "Resetting…" : "Reset password"}
                            </button>
                          </div>
                        </form>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-100 font-semibold mb-1">
                          Restricted to HR / Admin
                        </p>
                        <p className="text-slate-400">
                          Password resets for other employees can only be
                          performed by HR or Admin users. If a colleague cannot
                          log in, please ask them to contact HR.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* QUANTUM INSIGHTS + RECENT ACTIVITY */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* insights */}
          <section className="rounded-3xl bg-slate-900/80 border border-violet-500/40 p-5 md:p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-25">
              <div className="w-full h-full bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.3),transparent_60%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.3),transparent_60%)]" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-300/80">
                    Quantum insights
                  </p>
                  <p className="text-sm text-slate-50 mt-1">
                    Predictive nudges curated for you
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full border border-slate-600 bg-slate-900/80 text-slate-200">
                  Powered by PlumTrips AI
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-xs">
                {aiInsights.map((ins, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border px-3 py-3 ${toneClass(
                      ins.tone
                    )}`}
                  >
                    <p className="font-semibold mb-1">{ins.title}</p>
                    <p>{ins.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* recent activity */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-700 p-5 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Activity
                </p>
                <p className="text-sm text-slate-100 mt-1">
                  Recent HR events
                </p>
              </div>
            </div>
            <ul className="text-xs text-slate-200 space-y-2 max-h-56 overflow-auto pr-1">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-b border-slate-800/70 pb-2 last:border-0"
                  >
                    <span className="flex-1">{log.message}</span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(log.date).toLocaleString()}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">No recent activity</li>
              )}
            </ul>
          </section>
        </div>

        {/* AI ASSISTANT + SNAPSHOT */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]"
        >
          {/* AI assistant */}
          <section className="rounded-3xl bg-slate-900/70 border border-cyan-500/20 shadow-[0_24px_80px_rgba(8,47,73,0.7)] p-5 md:p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="w-full h-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.17),transparent_55%),radial-gradient(circle_at_bottom,rgba(139,92,246,0.18),transparent_60%)]" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
                    My AI Assistant
                  </p>
                  <p className="text-sm md:text-base text-slate-100 mt-1">
                    Hi{" "}
                    <span className="font-semibold">
                      {firstName || "there"}
                    </span>
                    , how can we help today?
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-cyan-200/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.3)]" />
                  Live
                </div>
              </div>

              {/* quick prompts */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleAskAssistant("What is my leave balance?")}
                  className="px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/20 transition"
                >
                  Check my leave balance
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAskAssistant("Update my skills in the system")
                  }
                  className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-400/40 text-violet-100 hover:bg-violet-500/20 transition"
                >
                  Update my skills
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAskAssistant("What is my next learning module?")
                  }
                  className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/20 transition"
                >
                  What’s my next learning module?
                </button>
              </div>

              {/* chat card */}
              <div className="mt-2 rounded-2xl bg-black/40 border border-slate-700/80 px-4 py-3 flex flex-col gap-3">
                <p className="text-[11px] text-slate-300">
                  Ask anything related to your HR life – leaves, approvals,
                  documents, learning paths.
                </p>

                {/* conversation area – autoscroll inside only */}
                <div
                  ref={chatContainerRef}
                  className="ml-1 mr-1 rounded-2xl bg-slate-950/70 border border-slate-800/80 px-3 py-2 max-h-56 overflow-y-auto space-y-2 text-[11px]"
                >
                  {assistantMessages.map((msg) =>
                    msg.from === "user" ? (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl bg-gradient-to-l from-cyan-500/70 via-sky-500/70 to-violet-500/70 px-3 py-2 text-slate-50 text-[11px] whitespace-pre-line shadow-lg shadow-cyan-500/30">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="flex items-start gap-2 max-w-full"
                      >
                        <div className="mt-0.5 flex items-center justify-center">
                          <img
                            src={COPILOT_MASCOT_SRC}
                            alt="PlumTrips People & Business Copilot"
                            className="h-6 w-6 md:h-7 md:w-7 object-contain drop-shadow-[0_0_14px_rgba(34,211,238,0.65)]"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          {msg.intent && (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/50 text-[9px] uppercase tracking-[0.15em] text-cyan-200">
                              {msg.intent.replace(/_/g, " ")}
                            </span>
                          )}

                          <div
                            className={`inline-block rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                              msg.isError
                                ? "bg-rose-500/10 border border-rose-400/60 text-rose-100"
                                : "bg-slate-900/80 border border-slate-700 text-slate-100"
                            }`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {assistantLoading && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 animate-pulse delay-75" />
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/50 animate-pulse delay-150" />
                      </div>
                      <span>PlumTrips HR Copilot is typing…</span>
                    </div>
                  )}

                  {assistantError && !assistantLoading && null}
                </div>

                {/* input row */}
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-full px-3 py-1.5 mt-1">
                  <input
                    className="flex-1 bg-transparent outline-none text-xs text-slate-100 placeholder:text-slate-500"
                    placeholder="Ask PlumTrips HR Copilot…"
                    value={assistantQuestion}
                    onChange={(e) => setAssistantQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !assistantLoading
                      ) {
                        e.preventDefault();
                        handleAskAssistant();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAskAssistant()}
                    disabled={assistantLoading || !assistantQuestion.trim()}
                    className="text-[11px] px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                  >
                    {assistantLoading ? "…" : "⏎"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* snapshot */}
          <section className="rounded-3xl bg-slate-900/80 border border-slate-700 shadow-[0_20px_70px_rgba(15,23,42,0.9)] p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  My Snapshot
                </p>
                <p className="text-sm text-slate-100 mt-1">
                  This month at a glance
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full border border-slate-600 bg-slate-800/70 text-slate-200">
                AI view
              </span>
            </div>

            {stats && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-slate-900/70 border border-slate-700 px-3 py-3">
                  <p className="text-[11px] text-slate-400 mb-1">
                    Attendance %
                  </p>
                  <p className="text-lg font-semibold text-emerald-300">
                    {stats.attendancePercent || "—"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Target &gt; 95% for top performance band.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900/70 border border-slate-700 px-3 py-3">
                  <p className="text-[11px] text-slate-400 mb-1">
                    Leaves taken
                  </p>
                  <p className="text-lg font-semibold text-cyan-300">
                    {stats.leavesTaken || "0"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pending approvals:{" "}
                    <span className="font-semibold text-amber-200">
                      {stats.pendingApprovals || "0"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 grid grid-cols-1 gap-4">
              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3">
                <p className="text-[11px] text-slate-400 mb-2">
                  Attendance – last 30 days
                </p>
                <div className="h-32">
                  <AttendanceChart data={attendance} />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3">
                <p className="text-[11px] text-slate-400 mb-2">Leave mix</p>
                <div className="h-32 flex items-center justify-center">
                  <LeavePie data={leaveSlices} />
                </div>
              </div>
            </div>
          </section>
        </motion.div>

        {/* stats strip UNDER AI snapshot row */}
        {stats && (
          <div className="rounded-3xl bg-slate-900/80 border border-slate-700 px-4 py-3">
            <StatsCards
              items={[
                {
                  label: "This Month Attendance %",
                  value: stats.attendancePercent,
                  tone: "aqua",
                },
                {
                  label: "Leaves Taken",
                  value: stats.leavesTaken,
                  tone: "lavender",
                },
                {
                  label: "Pending Approvals",
                  value: stats.pendingApprovals,
                  tone: "ink",
                },
                {
                  label: "Docs Uploaded",
                  value: stats.docsUploaded,
                  tone: "neon",
                },
              ]}
            />
          </div>
        )}
      </main>

      {/* edit profile modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.form
              onSubmit={handleSave}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md text-slate-100 shadow-2xl"
            >
              <h2 className="text-lg font-semibold mb-1">Edit profile</h2>
              <p className="text-xs text-slate-400 mb-4">
                These details are used by managers and AI assistants across
                PlumTrips HRMS.
              </p>

              <label className="block text-xs text-slate-300 mb-1">
                Full name
              </label>
              <input
                className="w-full mb-3 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <label className="block text-xs text-slate-300 mb-1">
                Phone
              </label>
              <input
                className="w-full mb-3 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              <label className="block text-xs text-slate-300 mb-1">
                Department
              </label>
              <input
                className="w-full mb-3 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                value={form.department || ""}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />

              <label className="block text-xs text-slate-300 mb-1">
                Location
              </label>
              <input
                className="w-full mb-3 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-400"
                value={form.location || ""}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
              />

              <div className="flex justify-between items-center mt-2 mb-4">
                <span className="text-[10px] text-slate-500">
                  Changes may take a few seconds to reflect across dashboards.
                </span>
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 rounded-xl border border-slate-600 text-xs text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-xs text-slate-900 font-semibold hover:bg-cyan-400 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* global toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[60]">
          <div
            className={`rounded-2xl px-4 py-3 text-xs shadow-xl border ${
              toast.type === "success"
                ? "bg-emerald-500/95 border-emerald-300 text-emerald-950"
                : "bg-rose-500/95 border-rose-200 text-rose-950"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">
                {toast.type === "success" ? "✅" : "⚠️"}
              </span>
              <p>{toast.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
