import React from "react";

type Props = {
  customUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8 w-20",
  md: "h-10 w-28",
  lg: "h-12 w-36",
} as const;

export default function Logo({ customUrl, size = "md", className }: Props) {
  if (!customUrl) {
    return (
      <div className={className}>
        <div className="text-[#004A8C] font-black leading-none">Plumtrips</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          Voucher
        </div>
      </div>
    );
  }

  return (
    <img
      src="/assets/logo.png"
      alt="Plumtrips"
      className={`${sizes[size]} object-contain ${className ?? ""}`}
      loading="eager"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
