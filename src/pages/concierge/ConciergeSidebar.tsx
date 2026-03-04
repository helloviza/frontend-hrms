// apps/frontend/src/pages/concierge/ConciergeSidebar.tsx
export default function ConciergeSidebar() {
  return (
    <aside className="concierge-sidebar">
      <section>
        <h3>Capabilities</h3>
        <ul>
          <li>🌴 Holidays</li>
          <li>✈️ Business Travel</li>
          <li>🏢 MICE / Conferences</li>
          <li>🎯 Team Offsites & Events</li>
        </ul>
      </section>

      <section>
        <h3>Active Planning Sessions</h3>
        <ul className="sessions">
          <li>Paris Fashion Week – 2025</li>
          <li>Dubai Incentive Trip – Q4</li>
        </ul>
      </section>

      <div className="rm-handoff">
        <p>
          Your AI Concierge prepares the strategy.  
          Our Relationship Managers execute perfection.
        </p>
        <button>Connect Now →</button>
      </div>
    </aside>
  );
}
