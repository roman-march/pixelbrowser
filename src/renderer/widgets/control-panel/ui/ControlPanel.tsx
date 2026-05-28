import type { FormEvent, RefObject } from "react";
import type {
  DiffSettings,
  OverlaySettings,
  ProjectPage,
  ReferenceImage,
  ResolutionPreset,
} from "../../../../shared/types";
import {
  BrowserNavigationControls,
  UrlNavigationForm,
} from "../../../features/browser-navigation";
import { BreakpointPicker } from "../../../features/breakpoint-management";
import { OverlayControls } from "../../../features/overlay-controls";
import { ReferenceImageAction } from "../../../features/reference-image";
import { Toolbar } from "../../../shared/ui/toolbar";

type ControlPanelProps = {
  activeImage: ReferenceImage | null;
  activePage: ProjectPage | null;
  activeResolution: ResolutionPreset;
  browserDraftUrl: string;
  breakpointPickerRef: RefObject<HTMLDivElement | null>;
  breakpointSelectOpen: boolean;
  diff: DiffSettings;
  overlay: OverlaySettings;
  projectPages: ProjectPage[];
  projectResolutions: ResolutionPreset[];
  onBreakpointDelete: (resolution: ResolutionPreset) => void;
  onBreakpointImport: () => void;
  onBreakpointOpenChange: (open: boolean) => void;
  onBreakpointSelect: (page: ProjectPage, resolution: ResolutionPreset) => void;
  onReferenceSelect: () => void;
  onResolutionUpdate: (
    updater: (resolution: ResolutionPreset) => ResolutionPreset,
  ) => void;
  onUrlDraftChange: (value: string) => void;
  onUrlSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ControlPanel({
  activeImage,
  activePage,
  activeResolution,
  browserDraftUrl,
  breakpointPickerRef,
  breakpointSelectOpen,
  diff,
  overlay,
  projectPages,
  projectResolutions,
  onBreakpointDelete,
  onBreakpointImport,
  onBreakpointOpenChange,
  onBreakpointSelect,
  onReferenceSelect,
  onResolutionUpdate,
  onUrlDraftChange,
  onUrlSubmit,
}: ControlPanelProps) {
  return (
    <Toolbar>
      <Toolbar.TrafficSpacer />
      <BrowserNavigationControls />
      <UrlNavigationForm
        value={browserDraftUrl}
        onChange={onUrlDraftChange}
        onSubmit={onUrlSubmit}
      />
      <BreakpointPicker
        activePage={activePage}
        activeResolution={activeResolution}
        containerRef={breakpointPickerRef}
        open={breakpointSelectOpen}
        pages={projectPages}
        resolutions={projectResolutions}
        onAdd={() => void onBreakpointImport()}
        onDelete={onBreakpointDelete}
        onOpenChange={onBreakpointOpenChange}
        onSelect={onBreakpointSelect}
      />
      <ReferenceImageAction image={activeImage} onSelect={onReferenceSelect} />
      <OverlayControls
        diff={diff}
        overlay={overlay}
        onResolutionUpdate={onResolutionUpdate}
      />
    </Toolbar>
  );
}
