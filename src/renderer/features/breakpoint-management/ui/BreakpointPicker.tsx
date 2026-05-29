import { Check, Plus, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import type { ProjectPage, ResolutionPreset } from "../../../../shared/types";

type BreakpointPickerProps = {
  activePage: ProjectPage | null;
  activeResolution: ResolutionPreset;
  containerRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  pages: ProjectPage[];
  resolutions: ResolutionPreset[];
  onAdd: () => void;
  onDelete: (resolution: ResolutionPreset) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (page: ProjectPage, resolution: ResolutionPreset) => void;
};

export function BreakpointPicker({
  activePage,
  activeResolution,
  containerRef,
  open,
  pages,
  resolutions,
  onAdd,
  onDelete,
  onOpenChange,
  onSelect,
}: BreakpointPickerProps) {
  return (
    <div className="breakpoint-picker" ref={containerRef}>
      <BreakpointTrigger
        activePage={activePage}
        activeResolution={activeResolution}
        open={open}
        onOpenChange={onOpenChange}
      />
      {open ? (
        <BreakpointMenu
          activeResolution={activeResolution}
          pages={pages}
          resolutions={resolutions}
          onAdd={onAdd}
          onDelete={onDelete}
          onSelect={(page, resolution) => {
            onOpenChange(false);
            onSelect(page, resolution);
          }}
        />
      ) : null}
    </div>
  );
}

type BreakpointTriggerProps = {
  activePage: ProjectPage | null;
  activeResolution: ResolutionPreset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function BreakpointTrigger({
  activePage,
  activeResolution,
  open,
  onOpenChange,
}: BreakpointTriggerProps) {
  return (
    <button
      className="viewport-pill"
      type="button"
      aria-expanded={open}
      aria-label="Current breakpoint"
      onClick={() => onOpenChange(!open)}
    >
      <span className="viewport-pill-label">
        {activePage?.name ?? activeResolution.name}
      </span>
      <span className="viewport-pill-divider" aria-hidden="true" />
      <span className="viewport-pill-size">
        {activeResolution.width}x{activeResolution.height}
      </span>
    </button>
  );
}

type BreakpointMenuProps = {
  activeResolution: ResolutionPreset;
  pages: ProjectPage[];
  resolutions: ResolutionPreset[];
  onAdd: () => void;
  onDelete: (resolution: ResolutionPreset) => void;
  onSelect: (page: ProjectPage, resolution: ResolutionPreset) => void;
};

function BreakpointMenu({
  activeResolution,
  pages,
  resolutions,
  onAdd,
  onDelete,
  onSelect,
}: BreakpointMenuProps) {
  return (
    <div className="breakpoint-menu" role="menu" aria-label="Breakpoints">
      <div className="breakpoint-menu-list">
        {pages.flatMap((page) =>
          resolutions
            .filter((resolution) => resolution.pageId === page.id)
            .map((resolution) => (
              <BreakpointMenuItem
                active={activeResolution.id === resolution.id}
                canDelete={resolutions.length > 1}
                key={resolution.id}
                page={page}
                resolution={resolution}
                onDelete={onDelete}
                onSelect={onSelect}
              />
            )),
        )}
      </div>
      <div className="breakpoint-menu-separator" />
      <button
        className="breakpoint-menu-add"
        type="button"
        role="menuitem"
        onClick={onAdd}
      >
        <span>
          <Plus /> Add breakpoint
        </span>
        <code>Page / size</code>
      </button>
    </div>
  );
}

type BreakpointMenuItemProps = {
  active: boolean;
  canDelete: boolean;
  page: ProjectPage;
  resolution: ResolutionPreset;
  onDelete: (resolution: ResolutionPreset) => void;
  onSelect: (page: ProjectPage, resolution: ResolutionPreset) => void;
};

function BreakpointMenuItem({
  active,
  canDelete,
  page,
  resolution,
  onDelete,
  onSelect,
}: BreakpointMenuItemProps) {
  return (
    <div
      className={`breakpoint-menu-row ${active ? "active" : ""}`}
      role="none"
    >
      <button
        className="breakpoint-menu-select"
        type="button"
        role="menuitem"
        onClick={() => onSelect(page, resolution)}
      >
        <span>{page.name} / {resolution.name}</span>
        <code>
          {resolution.width}x{resolution.height}
        </code>
        {active ? <Check /> : null}
      </button>
      <button
        className="breakpoint-menu-delete"
        type="button"
        disabled={!canDelete}
        onClick={() => onDelete(resolution)}
        aria-label={`Delete ${page.name} ${resolution.name}`}
      >
        <Trash2 />
      </button>
    </div>
  );
}
