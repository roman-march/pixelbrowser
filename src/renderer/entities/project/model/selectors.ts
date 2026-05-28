import type {
  AppData,
  Project,
  ProjectPage,
  ReferenceImage,
  ResolutionPreset,
} from "../../../../shared/types";

export type ActiveWorkspace = {
  project: Project | null;
  pages: ProjectPage[];
  page: ProjectPage | null;
  resolutions: ResolutionPreset[];
  resolution: ResolutionPreset | null;
  image: ReferenceImage | null;
};

export function selectActiveWorkspace(data: AppData | null): ActiveWorkspace {
  const project = data?.projects[0] ?? null;
  const pages =
    data?.pages.filter((page) => page.projectId === project?.id) ?? [];
  const page =
    pages.find((item) => item.id === project?.activePageId) ?? pages[0] ?? null;
  const resolutions =
    data?.resolutions.filter((resolution) => resolution.projectId === project?.id) ??
    [];
  const resolution =
    resolutions.find((item) => item.id === project?.activeResolutionId) ??
    resolutions.find((item) => item.pageId === page?.id) ??
    resolutions[0] ??
    null;
  const image =
    data?.referenceImages.find((item) => item.id === resolution?.referenceImageId) ??
    null;

  return {
    image,
    page,
    pages,
    project,
    resolution,
    resolutions,
  };
}
