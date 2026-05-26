import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app/App";
import MinimalTest from "./app/MinimalTest";
import { EmergencyFallback } from "./app/EmergencyFallback";
import { seedAllData } from "./app/utils/seedAllData";

// ── Run seed SYNCHRONOUSLY before React mounts ────────────────────────────
// MUST run before createRoot so every Context useState(() => DataService.get())
// reads fresh seeded data. Running in a useEffect is too late — all contexts
// already captured stale localStorage in their useState lazy initialisers.
// try { seedAllData(); } catch (e) { console.error("Seed failed:", e); }

// EMERGENCY DEBUG MODE
const USE_MINIMAL_TEST = false;
const USE_EMERGENCY_FALLBACK = false;

// FIX: Handle Figma Make ?preview-route= query param
const params = new URLSearchParams(window.location.search);
const previewRoute = params.get("preview-route");
if (previewRoute && window.location.pathname === "/") {
  const cleanRoute = previewRoute.startsWith("/") ? previewRoute : "/" + previewRoute;
  history.replaceState(null, "", cleanRoute);
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found in index.html");
}

const getComponent = () => {
  if (USE_EMERGENCY_FALLBACK) return <EmergencyFallback />;
  if (USE_MINIMAL_TEST) return <MinimalTest />;
  return <App />;
};

try {
  createRoot(container).render(
    <React.Fragment>
      {getComponent()}
    </React.Fragment>
  );
} catch (error) {
  console.error("Fatal error rendering app:", error);
  createRoot(container).render(<EmergencyFallback />);
}
