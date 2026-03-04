// apps/frontend/src/pages/concierge/ConciergePromptBar.tsx
import { useState } from "react";

export default function ConciergePromptBar() {
  const [input, setInput] = useState("");

  return (
    <div className="concierge-prompt">
      <div className="prompt-chips">
        <button>Plan a holiday 🌴</button>
        <button>Plan business travel ✈️</button>
        <button>Plan MICE / conference 🏢</button>
        <button>Plan team offsite 🎯</button>
        <button>Visa-friendly destinations 🌍</button>
      </div>

      <div className="prompt-input">
        <input
          placeholder="Plan a 5-day holiday in April or design a MICE trip…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="send-btn">➜</button>
      </div>
    </div>
  );
}
