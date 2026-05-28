import type { FormEvent } from "react";
import type {
  BreakpointDraft,
  BreakpointDraftField,
  DraftReferenceImageField,
} from "../model";
import { Modal } from "../../../shared/ui/modal";
import { BreakpointDraftFields } from "./BreakpointDraftFields";
import { ReferenceImageDraftGrid } from "./ReferenceImageDraftGrid";

type BreakpointDialogProps = {
  draft: BreakpointDraft;
  onAddImages: () => void;
  onClose: () => void;
  onDraftFieldChange: (field: BreakpointDraftField, value: string) => void;
  onImageFieldChange: (
    id: string,
    field: DraftReferenceImageField,
    value: string,
  ) => void;
  onImageRemove: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function BreakpointDialog({
  draft,
  onAddImages,
  onClose,
  onDraftFieldChange,
  onImageFieldChange,
  onImageRemove,
  onSubmit,
}: BreakpointDialogProps) {
  return (
    <Modal open={draft.open} onClose={onClose}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <div>
            <Modal.Title>Breakpoint</Modal.Title>
            <Modal.Description>Edit pixel perfect project data.</Modal.Description>
          </div>
          <Modal.Close />
        </Modal.Header>
        <form className="modal-form breakpoint-form" onSubmit={onSubmit}>
          <BreakpointDraftFields draft={draft} onChange={onDraftFieldChange} />
          <ReferenceImageDraftGrid
            images={draft.images}
            onAddImages={onAddImages}
            onFieldChange={onImageFieldChange}
            onRemove={onImageRemove}
          />
          <div className="modal-actions">
            <button type="button" className="small-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="small-button primary">
              Create
            </button>
          </div>
        </form>
      </Modal.Content>
    </Modal>
  );
}
