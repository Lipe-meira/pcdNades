import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { createDemoService } from "./services/lineupService";
import "./styles.css";

const service = createDemoService();
window.addEventListener("pagehide", () => service.dispose());
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App service={service} />
  </StrictMode>,
);
