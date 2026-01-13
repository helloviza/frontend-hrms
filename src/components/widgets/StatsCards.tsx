// apps/frontend/src/components/widgets/StatsCards.tsx
import { memo } from "react";

export type StatTone = "aqua" | "lavender" | "ink" | "neon";
export type StatItem = { label: string; value: string; tone?: StatTone };

function toneClass(tone?: StatTone) {
  switch (tone) {
    case "aqua":
      return "bg-aqua/15 ring-aqua/40";
    case "lavender":
      return "bg-lavender/15 ring-lavender/40";
    case "ink":
      return "bg-ink/10 ring-ink/30";
    case "neon":
      return "bg-neon/15 ring-neon/40";
    default:
      return "bg-white ring-black/5";
  }
}

function StatsCards({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it, idx) => (
        <div
          key={idx}
          className={`rounded-2xl border p-4 shadow-sm ring-1 ${toneClass(
            it.tone
          )} backdrop-blur`}
        >
          <div className="text-xs text-ink/60">{it.label}</div>
          <div className="text-2xl font-extrabold text-ink mt-1">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

export default memo(StatsCards);
