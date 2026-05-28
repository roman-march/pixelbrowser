import type { ReferenceImage } from "../../../../shared/types";

export type DraftReferenceImage = {
  id: string;
  image: ReferenceImage;
  name: string;
  width: string;
  height: string;
  deviceScaleFactor: string;
};

export type BreakpointDraft = {
  open: boolean;
  pageName: string;
  pagePath: string;
  name: string;
  width: string;
  height: string;
  deviceScaleFactor: string;
  images: DraftReferenceImage[];
};

export type BreakpointDraftField = Exclude<keyof BreakpointDraft, "open" | "images">;

export type DraftReferenceImageField = Exclude<
  keyof DraftReferenceImage,
  "id" | "image"
>;
