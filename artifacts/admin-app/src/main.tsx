import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { API_BASE } from "@/lib/api-base";

setBaseUrl(API_BASE || null);

createRoot(document.getElementById("root")!).render(<App />);
