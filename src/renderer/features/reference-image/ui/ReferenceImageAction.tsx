import { FolderOpen, ImagePlus } from "lucide-react";
import type { ReferenceImage } from "../../../../shared/types";
import { IconButton } from "../../../shared/ui/icon-button";

type ReferenceImageActionProps = {
  image: ReferenceImage | null;
  onSelect: () => void;
};

export function ReferenceImageAction({
  image,
  onSelect,
}: ReferenceImageActionProps) {
  return (
    <IconButton title="Select reference image" onClick={onSelect}>
      {image ? <ImagePlus /> : <FolderOpen />}
    </IconButton>
  );
}
