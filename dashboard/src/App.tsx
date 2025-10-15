import React from "react";
import AgentTraceVisualizer from "./components/AgentTraceVisualizer";

// Alternative imports you can use:
import EnhancedDashboard from "./components/EnhancedDashboard";
// import ProductionDashboard from './components/ProductionDashboard';
// import DashboardDesign from './components/DashboardDesign';

function App() {
  return (
    <div className="w-full h-screen">
      <AgentTraceVisualizer />
    </div>
  );
}

export default App;
