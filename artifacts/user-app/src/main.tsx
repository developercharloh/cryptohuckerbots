import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { API_BASE } from "@/lib/api-base";

setBaseUrl(API_BASE || null);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((registration) => registration.update())
      .catch(() => {
        // A service worker is an optional offline enhancement. Login and API
        // requests must continue through the normal network path if it fails.
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
