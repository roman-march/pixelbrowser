import { Upload } from "lucide-react";
import type {
  DraftReferenceImage,
  DraftReferenceImageField,
} from "../model";
import { ReferenceImageDraftCard } from "./ReferenceImageDraftCard";

type ReferenceImageDraftGridProps = {
  images: DraftReferenceImage[];
  onAddImages: () => void;
  onFieldChange: (
    id: string,
    field: DraftReferenceImageField,
    value: string,
  ) => void;
  onRemove: (id: string) => void;
};

export function ReferenceImageDraftGrid({
  images,
  onAddImages,
  onFieldChange,
  onRemove,
}: ReferenceImageDraftGridProps) {
  return (
    <div className="reference-grid">
      {images.map((image) => (
        <ReferenceImageDraftCard
          item={image}
          key={image.id}
          onFieldChange={onFieldChange}
          onRemove={onRemove}
        />
      ))}
      <button className="reference-add" type="button" onClick={onAddImages}>
        <Upload />
        <span>Add image</span>
      </button>
    </div>
  );
}
