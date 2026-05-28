import { Figma } from "lucide-react";
import { IconButton } from "../../../shared/ui/icon-button";

type FigmaImportActionProps = {
  onOpen: () => void;
};

export function FigmaImportAction({ onOpen }: FigmaImportActionProps) {
  return (
    <IconButton title="Connect Figma" onClick={onOpen}>
      <Figma />
    </IconButton>
  );
}
