import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
setBaseUrl(
  configuredApiUrl ||
    (import.meta.env.DEV ? null : "https://vixus-ai-api.vercel.app"),
);

createRoot(document.getElementById("root")!).render(<App />);
