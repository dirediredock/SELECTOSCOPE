import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { BottomBar } from "./components/BottomBar";
import { PaneRow } from "./components/PaneRow";
import { attachKeyboardShortcuts } from "./interaction/keyboard";
import { blockPageZoom } from "./interaction/navigate";
import { attachHoverFocus } from "./interaction/hoverFocus";
import { TooltipLayer } from "./components/Tooltip";
import { initData } from "./data/datasetStore";
import { stopBuild } from "./engine/engine";
import { watchRowMode } from "./state/paneRow";

export default function App() {
  useEffect(() => {
    initData(stopBuild);
  }, []);

  useEffect(blockPageZoom, []);

  useEffect(attachKeyboardShortcuts, []);

  useEffect(attachHoverFocus, []);

  useEffect(watchRowMode, []);

  return (
    <div className="app">
      <TopBar />
      <PaneRow />
      <BottomBar />
      <TooltipLayer />
    </div>
  );
}
