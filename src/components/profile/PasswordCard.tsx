// src/profile/PasswordCard.tsx
import React from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function PasswordCard({
  eyebrow = "SECURITY",
  title,
  subtitle,
  rightSlot,
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`rounded-[26px] p-5 ${className}`}
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
        boxShadow: "0 18px 50px rgba(0,0,0,.22)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.24em]" style={{ color: "rgba(255,255,255,.55)" }}>
            {eyebrow}
          </div>
          <div className="mt-1 text-base font-semibold text-white">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,.70)" }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}
