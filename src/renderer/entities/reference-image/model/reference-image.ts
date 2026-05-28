import type { ReferenceImage, ResolutionPreset } from "../../../../shared/types";

export function pruneUnusedReferenceImages(
  images: ReferenceImage[],
  resolutions: ResolutionPreset[],
) {
  const usedImageIds = new Set(
    resolutions
      .map((resolution) => resolution.referenceImageId)
      .filter((imageId): imageId is string => Boolean(imageId)),
  );

  return images.filter((image) => usedImageIds.has(image.id));
}

export function fileNameWithoutExtension(value: string) {
  return value.replace(/\.[^.]+$/, "");
}
