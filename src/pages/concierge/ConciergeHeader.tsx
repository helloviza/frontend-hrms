// apps/frontend/src/pages/concierge/ConciergeHeader.tsx
export default function ConciergeHeader() {
  return (
    <header className="concierge-header">
      <div className="concierge-title">
        <h1>Plumtrips AI Concierge</h1>
        <p>Travel, Holidays & Experiences — intelligently planned</p>
      </div>

      <div className="concierge-status">
        <span className="status-dot" />
        System Active
      </div>
    </header>
  );
}
