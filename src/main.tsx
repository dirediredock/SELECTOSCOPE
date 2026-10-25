import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CONTRAST, setContrast } from "./state/uiStore";
import "./styles.css";

// Labels' rows open faded as the canvases do (styles.css has 0%'s share).
setContrast(CONTRAST.opening);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
