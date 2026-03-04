import { useEffect, useState } from "react";
import "./copilot.css";

/**
 * Props for CopilotWidget
 * embedded = true  → renders as full-width page component
 * embedded = false → renders as floating FAB widget
 */
type CopilotWidgetProps = {
  embedded?: boolean;
  mode?: "manager" | "travel"; // future-ready
};

type Msg = {
  role: "user" | "ai";
  text: string;
};

export default function CopilotWidget({
  embedded = false,
  mode = "manager",
}: CopilotWidgetProps) {
  const [open, setOpen] = useState<boolean>(embedded);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Listen for quick-action prompts
   * Fired from CopilotQuickActions
   */
  useEffect(() => {
    function handleQuickPrompt(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        setInput(detail);
        if (!embedded) setOpen(true);
      }
    }

    window.addEventListener("copilot:quickPrompt", handleQuickPrompt);
    return () =>
      window.removeEventListener("copilot:quickPrompt", handleQuickPrompt);
  }, [embedded]);

  async function send() {
    if (!input.trim() || loading) return;

    const text = input.trim();

    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const endpoint =
        mode === "travel"
          ? "/api/v1/copilot/travel"
          : "/api/v1/copilot/manager";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: text }),
      });

      const data = await res.json();

      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text:
            data?.answer ||
            "I’m not sure how to respond. Please try again or contact support.",
        },
      ]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          role: "ai",
          text:
            "Something went wrong while contacting Copilot. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating FAB (only when NOT embedded) */}
      {!embedded && (
        <button className="copilot-fab" onClick={() => setOpen((o) => !o)}>
          ✨
        </button>
      )}

      {(open || embedded) && (
        <div className={`copilot-box ${embedded ? "embedded" : ""}`}>
          <div className="copilot-header">
            Plumtrips AI Copilot
            {!embedded && (
              <button
                className="copilot-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            )}
          </div>

          <div className="copilot-messages">
            {msgs.length === 0 && (
              <div className="msg ai">
                Hi! I’m your Plumtrips Copilot.  
                Ask me about HR, leaves, or travel planning.
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.text}
              </div>
            ))}

            {loading && <div className="msg ai">Thinking…</div>}
          </div>

          <div className="copilot-input">
            <input
              value={input}
              placeholder={
                mode === "travel"
                  ? "Plan my holiday or business travel…"
                  : "Ask about leaves, attendance, HR info…"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button onClick={send} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
