import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { BottomBar } from "./components/BottomBar";
import { PaneRow } from "./components/PaneRow";
import { attachKeyboardShortcuts } from "./interaction/keyboard";
import { blockPageZoom } from "./interaction/navigate";
import { TooltipLayer } from "./components/Tooltip";
import { initData } from "./data/dataStore";
import { stopBuild } from "./engine/engine";

export default function App() {
  useEffect(() => {
    initData(stopBuild);
  }, []);

  useEffect(blockPageZoom, []);

  useEffect(attachKeyboardShortcuts, []);

  return (
    <div className="app">
      <TopBar />
      <PaneRow />
      <BottomBar />
      <TooltipLayer />
    </div>
  );
}
