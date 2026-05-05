import React from "react";
import { createRoot } from "react-dom/client";

export default function DevToolsPanel() {
  return (
    <div style={{ padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "14px", fontWeight: 600 }}>My Extension</h2>
      <p style={{ fontSize: "12px", color: "#6b7280" }}>
        Inspected page: <strong>{chrome.devtools.inspectedWindow.tabId}</strong>
      </p>
      {/* Add panel UI here — e.g. log viewer, state inspector */}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found in devtools panel HTML");

createRoot(root).render(
  <React.StrictMode>
    <DevToolsPanel />
  </React.StrictMode>,
);
