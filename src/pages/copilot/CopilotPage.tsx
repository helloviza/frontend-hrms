import CopilotHeader from "./CopilotHeader";
import CopilotQuickActions from "./CopilotQuickActions";
import CopilotWidget from "../../components/copilot/CopilotWidget";
import "./copilot-page.css";

export default function CopilotPage() {
  return (
    <div className="copilot-page">
      <CopilotHeader />

      <CopilotQuickActions />

      <div className="copilot-main">
        <CopilotWidget embedded />
      </div>
    </div>
  );
}
