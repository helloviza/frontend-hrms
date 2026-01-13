import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import api, { setAccessToken, onAccessTokenRefresh } from "../lib/api";

export type User = {
  _id: string;
  id?: string;
  email: string;
  roles: string[];
  role?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  accountType?: string;
  userType?: string;
  hrmsAccessRole?: string;
  hrmsAccessLevel?: string;
  customerId?: string;
  businessId?: string;
  customerMemberRole?: string;
};

export type AuthCtx = {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep in-memory token synced from storage on boot (api.ts also does this, but harmless)
  useEffect(() => {
    const saved = localStorage.getItem("jwt") || localStorage.getItem("hrms_accessToken");
    if (saved) setAccessToken(saved);
  }, []);

  // When api.ts refreshes token, persist + update state
  useEffect(() => {
    onAccessTokenRefresh((token) => {
      if (token) {
        // api.ts already writes storage, but we keep it consistent
        localStorage.setItem("jwt", token);
        localStorage.setItem("hrms_accessToken", token);
        setAccessToken(token);
      } else {
        localStorage.removeItem("jwt");
        localStorage.removeItem("hrms_accessToken");
        setAccessToken(null);
        setUser(null);
      }
    });
  }, []);

  const refreshSession = useCallback(async () => {
    // Use api.post so Authorization header is present as fallback; cookies included too.
    const data: any = await api.post("/auth/refresh");

    if (data?.accessToken) {
      setAccessToken(data.accessToken); // also persists
    }

    if (data?.user) setUser(data.user);
    else {
      // optional: fetch /me if refresh didn't return user
      try {
        const me = await api.get<{ user: User }>("/auth/me");
        setUser(me?.user ?? null);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Silent restore on app boot
  useEffect(() => {
    (async () => {
      try {
        // Try /me first (works with Bearer even if cookie was not stored)
        try {
          const me = await api.get<{ user: User }>("/auth/me");
          setUser(me?.user ?? null);
          setLoading(false);
          return;
        } catch {
          // then try refresh cookie
        }

        await refreshSession();
      } catch (err) {
        console.warn("Session restore failed", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await api.post("/auth/login", { email, password });

    if (!res?.accessToken) throw new Error("Invalid login response");

    setAccessToken(res.accessToken); // persists + sets memory
    if (res?.user) setUser(res.user);

    // If server sets refresh cookie, this will also canonicalize the session.
    // If not, it's okay because Bearer will still work.
    try {
      await refreshSession();
    } catch {
      /* ignore */
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("jwt");
    localStorage.removeItem("hrms_accessToken");
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      setUser,
      login,
      logout,
      refreshSession,
    }),
    [user, loading, login, logout, refreshSession]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {loading && (
        <div className="h-screen flex items-center justify-center text-ink/70 text-sm">
          Restoring session…
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
