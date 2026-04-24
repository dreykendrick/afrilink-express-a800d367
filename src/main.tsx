import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Expose build version so we can verify which bundle a device is running
if (typeof window !== "undefined") {
  window.__APP_BUILD_VERSION__ = __APP_BUILD_VERSION__;
  // eslint-disable-next-line no-console
  console.info(`[AfriLink] build ${__APP_BUILD_VERSION__}`);
}

// Bootstrap app
createRoot(document.getElementById("root")!).render(<App />);
