import { ArrowLeft, RefreshCw } from "lucide-react";
import { IconButton } from "../../../shared/ui/icon-button";

export function BrowserNavigationControls() {
  return (
    <>
      <IconButton title="Back" onClick={() => void window.pixelPerfect.goBack()}>
        <ArrowLeft />
      </IconButton>
      <IconButton title="Reload" onClick={() => void window.pixelPerfect.reload()}>
        <RefreshCw />
      </IconButton>
    </>
  );
}
