import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installApiFetch } from "./lib/config";

// Route relative /api calls to the configured backend (needed for native builds).
installApiFetch();

createRoot(document.getElementById("root")!).render(<App />);
