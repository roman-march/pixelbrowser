import type { BreakpointDraft, BreakpointDraftField } from "../model";

type BreakpointDraftFieldsProps = {
  draft: BreakpointDraft;
  onChange: (field: BreakpointDraftField, value: string) => void;
};

export function BreakpointDraftFields({
  draft,
  onChange,
}: BreakpointDraftFieldsProps) {
  return (
    <>
      <div className="form-grid two">
        <label>
          Page
          <input
            value={draft.pageName}
            onChange={(event) => onChange("pageName", event.target.value)}
            autoFocus
          />
        </label>
        <label>
          Name
          <input
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
          />
        </label>
      </div>
      <label>
        Path
        <input
          value={draft.pagePath}
          onChange={(event) => onChange("pagePath", event.target.value)}
          placeholder="/about"
        />
      </label>
      <div className="form-grid">
        <label>
          Width
          <input
            type="number"
            min="1"
            value={draft.width}
            onChange={(event) => onChange("width", event.target.value)}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min="1"
            value={draft.height}
            onChange={(event) => onChange("height", event.target.value)}
          />
        </label>
        <label>
          DPR
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={draft.deviceScaleFactor}
            onChange={(event) =>
              onChange("deviceScaleFactor", event.target.value)
            }
          />
        </label>
      </div>
    </>
  );
}
