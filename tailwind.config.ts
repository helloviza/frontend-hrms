import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        ink: "#0b0b10",
        mist: "#f6f7fb",
        lavender: "#b8b3ff",
        aqua: "#9ef0ff",
        neon: "#4cffb0",
        peach: "#ffb8a1",
        grape: "#6e59ff",
        plum: "#b06cff",
      },
      boxShadow: {
        glow: "0 10px 30px -10px rgba(176,108,255,.45)",
        neon: "0 10px 30px -10px rgba(76,255,176,.45)",
        soft: "0 6px 24px rgba(16,18,27,.06)",
      },
      backgroundImage: {
        "grid-dots":
          "radial-gradient(circle at 1px 1px, rgba(110,89,255,.25) 1px, transparent 0)",
        "gradient-hero":
          "radial-gradient(1200px 600px at 10% -10%, rgba(184,179,255,.35), transparent 40%), radial-gradient(1000px 500px at 100% 0%, rgba(158,240,255,.35), transparent 45%)",
      },
      backgroundSize: {
        dots: "16px 16px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(10px, -14px) scale(1.02)" },
          "66%": { transform: "translate(-12px, 8px) scale(0.98)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        blob: "blob 12s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
