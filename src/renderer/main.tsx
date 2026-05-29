import React from "react";
import ReactDOM from "react-dom/client";
import type { WindowChromeState } from "../shared/types";
import { App } from "./App";
import "./styles.css";

void window.pixelPerfect.getWindowChromeState().then(applyWindowChromeState);
window.pixelPerfect.onWindowChromeStateChanged(applyWindowChromeState);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function applyWindowChromeState(state: WindowChromeState) {
  document.documentElement.dataset.platform = state.platform;
  document.documentElement.dataset.windowMode = state.mode;
}
