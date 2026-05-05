import React from "react";
import { createRoot } from "react-dom/client";
import "../ui.css";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in options HTML");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
