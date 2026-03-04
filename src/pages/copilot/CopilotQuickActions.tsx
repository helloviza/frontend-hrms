const actions = [
  { label: "Check my leave balance", prompt: "What is my current leave balance?" },
  { label: "Update my skills", prompt: "How can I update my skills or learning path?" },
  { label: "What's my next learning module?", prompt: "What is my next learning module?" },
  { label: "Plan a holiday strip ✈️", prompt: "I have a few leaves. Can you design a holiday strip?" },
  { label: "Plan business travel 🧳", prompt: "Help me plan a business trip." }
];

export default function CopilotQuickActions() {
  function fire(prompt: string) {
    window.dispatchEvent(
      new CustomEvent("copilot:quickPrompt", { detail: prompt })
    );
  }

  return (
    <div className="copilot-actions">
      {actions.map(a => (
        <button key={a.label} onClick={() => fire(a.prompt)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}
