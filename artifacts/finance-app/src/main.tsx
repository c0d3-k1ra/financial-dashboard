import { createRoot } from "react-dom/client";
import App from "./App";
import { PrivacyProvider } from "./lib/privacy-context";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <PrivacyProvider>
    <App />
  </PrivacyProvider>
);
