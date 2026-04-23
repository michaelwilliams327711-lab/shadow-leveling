import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorLogging } from "./lib/logger";

installGlobalErrorLogging();

createRoot(document.getElementById("root")!).render(<App />);

// ── Service Worker Registration ──────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.info("[SW] Registered — scope:", registration.scope);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}
