// apps/frontend/src/components/layout/Footer.tsx
import React from "react";
import { useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();

  const hideShell = ["/login", "/register", "/forgot", "/onboarding", "/invite", "/ob"].some(
    (p) => location.pathname.startsWith(p),
  );

  if (hideShell) return null;

  return (
    <footer className="mt-12 border-t border-zinc-200 bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-zinc-500">
        <span>
          © {new Date().getFullYear()} Plumtrips.com — HRMS · All rights reserved.
        </span>
        <span className="text-[10px]">
          Built with care for{" "}
          <span className="font-semibold text-zinc-700">AI-assisted teams</span>.
        </span>
      </div>
    </footer>
  );
}
