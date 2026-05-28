import { X } from "lucide-react";
import type {
  DraftReferenceImage,
  DraftReferenceImageField,
} from "../model";

type ReferenceImageDraftCardProps = {
  item: DraftReferenceImage;
  onFieldChange: (
    id: string,
    field: DraftReferenceImageField,
    value: string,
  ) => void;
  onRemove: (id: string) => void;
};

export function ReferenceImageDraftCard({
  item,
  onFieldChange,
  onRemove,
}: ReferenceImageDraftCardProps) {
  return (
    <div className="reference-card">
      <button
        className="reference-remove"
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Remove image"
      >
        <X />
      </button>
      <img src={item.image.fileUrl} alt="" />
      <label>
        Name
        <input
          value={item.name}
          onChange={(event) =>
            onFieldChange(item.id, "name", event.target.value)
          }
        />
      </label>
      <div className="reference-size-row">
        <input
          aria-label="Width"
          type="number"
          min="1"
          value={item.width}
          onChange={(event) =>
            onFieldChange(item.id, "width", event.target.value)
          }
        />
        <span>x</span>
        <input
          aria-label="Height"
          type="number"
          min="1"
          value={item.height}
          onChange={(event) =>
            onFieldChange(item.id, "height", event.target.value)
          }
        />
      </div>
    </div>
  );
}
