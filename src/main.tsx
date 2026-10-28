import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CONTRAST, setContrast } from "./state/controls";
import "./styles.css";

// Labels' rows open faded as the canvases do (styles.css has 0%'s share).
setContrast(CONTRAST.opening);

// `?bake`: the curated builds' bake (scripts/bake.ts) drives the engine here,
// with no interface. Loaded only then, so no one else downloads it.
if (new URLSearchParams(location.search).has("bake")) void import("./engine/bakeHook");
else
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
