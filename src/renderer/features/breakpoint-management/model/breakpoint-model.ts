import type {
  AppData,
  ImportedReferenceImage,
  Project,
  ProjectPage,
  ResolutionPreset,
} from "../../../../shared/types";
import { defaultDiffSettings, defaultOverlaySettings } from "../../../../shared/types";
import {
  fileNameWithoutExtension,
  pruneUnusedReferenceImages,
} from "../../../entities/reference-image";
import { normalizePagePath, resolvePageUrl, slugify } from "../../../entities/project";
import { parsePositiveInt, parsePositiveNumber } from "../../../shared/lib/number";
import type { BreakpointDraft, DraftReferenceImage } from "./types";

export const emptyBreakpointDraft = (): BreakpointDraft => ({
  open: false,
  pageName: "",
  pagePath: "/",
  name: "Desktop",
  width: "1440",
  height: "900",
  deviceScaleFactor: "1",
  images: [],
});

type BuildBreakpointDraftInput = {
  activePage: ProjectPage | null;
  activeResolution: ResolutionPreset | null;
  browserPath: string;
  imported: ImportedReferenceImage[];
  pageTitle: string;
};

export function buildBreakpointDraft({
  activePage,
  activeResolution,
  browserPath,
  imported,
  pageTitle,
}: BuildBreakpointDraftInput): BreakpointDraft {
  const firstImage = imported[0]?.image;
  const draft: BreakpointDraft = {
    open: true,
    pageName: pageTitle || activePage?.name || "Page",
    pagePath: browserPath,
    name:
      (firstImage ? fileNameWithoutExtension(firstImage.fileName) : "") ||
      activeResolution?.name ||
      "Desktop",
    width: String(firstImage?.width || activeResolution?.width || 1440),
    height: String(firstImage?.height || activeResolution?.height || 900),
    deviceScaleFactor: String(activeResolution?.deviceScaleFactor ?? 1),
    images: [],
  };

  return {
    ...draft,
    images: imported.map((item, index) => toDraftReferenceImage(item, draft, index)),
  };
}

export function extendBreakpointDraft(
  draft: BreakpointDraft,
  imported: ImportedReferenceImage[],
): BreakpointDraft {
  const firstImage = imported[0]?.image;
  const shouldPrimeFromImage = draft.images.length === 0 && Boolean(firstImage);
  const nextDraft = shouldPrimeFromImage
    ? {
        ...draft,
        name:
          fileNameWithoutExtension(firstImage!.fileName) ||
          draft.name ||
          "Desktop",
        width: String(firstImage!.width || parsePositiveInt(draft.width, 1440)),
        height: String(firstImage!.height || parsePositiveInt(draft.height, 900)),
      }
    : draft;

  return {
    ...nextDraft,
    images: [
      ...nextDraft.images,
      ...imported.map((item, index) =>
        toDraftReferenceImage(item, nextDraft, index),
      ),
    ],
  };
}

export function toDraftReferenceImage(
  item: ImportedReferenceImage,
  draft: BreakpointDraft,
  index: number,
): DraftReferenceImage {
  const width = item.image.width || parsePositiveInt(draft.width, 1440);
  const height = item.image.height || parsePositiveInt(draft.height, 900);
  const nameFromFile = fileNameWithoutExtension(item.image.fileName);
  const defaultName =
    index === 0 && draft.name.trim()
      ? draft.name.trim()
      : nameFromFile || `${width}x${height}`;

  return {
    id: crypto.randomUUID(),
    image: item.image,
    name: defaultName,
    width: String(width),
    height: String(height),
    deviceScaleFactor: draft.deviceScaleFactor || "1",
  };
}

type BuildBreakpointSubmitInput = {
  activeProject: Project;
  browserUrl: string;
  data: AppData;
  draft: BreakpointDraft;
};

type BreakpointMutationResult = {
  data: AppData;
  nextUrl: string;
};

export function buildBreakpointSubmit({
  activeProject,
  browserUrl,
  data,
  draft,
}: BuildBreakpointSubmitInput): BreakpointMutationResult | null {
  const pageName = draft.pageName.trim() || "Page";
  const pagePath = normalizePagePath(draft.pagePath || `/${slugify(pageName)}`);
  const now = new Date().toISOString();
  const existingPage = data.pages.find(
    (page) =>
      page.projectId === activeProject.id &&
      normalizePagePath(page.path) === pagePath,
  );
  const page: ProjectPage = existingPage
    ? { ...existingPage, name: pageName, path: pagePath, updatedAt: now }
    : {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        name: pageName,
        path: pagePath,
        createdAt: now,
        updatedAt: now,
      };
  const draftItems =
    draft.images.length > 0
      ? draft.images
      : [
          {
            id: crypto.randomUUID(),
            image: null,
            name: draft.name,
            width: draft.width,
            height: draft.height,
            deviceScaleFactor: draft.deviceScaleFactor,
          },
        ];

  const newResolutions: ResolutionPreset[] = draftItems.map((item) => {
    const width = parsePositiveInt(item.width, Number(draft.width) || 1440);
    const height = parsePositiveInt(item.height, Number(draft.height) || 900);
    const deviceScaleFactor = parsePositiveNumber(
      item.deviceScaleFactor,
      Number(draft.deviceScaleFactor) || 1,
    );

    return {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      pageId: page.id,
      name: item.name.trim() || `${width}x${height}`,
      width,
      height,
      deviceScaleFactor,
      referenceImageId: item.image?.id,
      overlaySettings: defaultOverlaySettings(),
      diffSettings: defaultDiffSettings(),
      createdAt: now,
      updatedAt: now,
    };
  });
  const firstResolution = newResolutions[0];
  if (!firstResolution) {
    return null;
  }

  const nextUrl = resolvePageUrl(activeProject.startUrl || browserUrl, page.path);
  const nextImages = draft.images
    .map((item) => item.image)
    .filter(
      (image) =>
        !data.referenceImages.some((existing) => existing.id === image.id),
    );

  return {
    nextUrl,
    data: {
      ...data,
      pages: existingPage
        ? data.pages.map((item) => (item.id === page.id ? page : item))
        : [...data.pages, page],
      referenceImages: [...data.referenceImages, ...nextImages],
      resolutions: [...data.resolutions, ...newResolutions],
      projects: data.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              activePageId: page.id,
              activeResolutionId: firstResolution.id,
              lastUrl: nextUrl,
              updatedAt: now,
            }
          : project,
      ),
    },
  };
}

type BuildDeleteBreakpointInput = {
  activePage: ProjectPage | null;
  activeProject: Project;
  browserUrl: string;
  data: AppData;
  projectPages: ProjectPage[];
  projectResolutions: ResolutionPreset[];
  resolution: ResolutionPreset;
};

export function buildDeleteBreakpoint({
  activePage,
  activeProject,
  browserUrl,
  data,
  projectPages,
  projectResolutions,
  resolution,
}: BuildDeleteBreakpointInput): BreakpointMutationResult | null {
  if (projectResolutions.length <= 1) {
    return null;
  }

  const now = new Date().toISOString();
  const remainingResolutions = data.resolutions.filter(
    (item) => item.id !== resolution.id,
  );
  const remainingProjectResolutions = remainingResolutions.filter(
    (item) => item.projectId === activeProject.id,
  );
  if (remainingProjectResolutions.length === 0) {
    return null;
  }

  const pageHasBreakpoints = remainingProjectResolutions.some(
    (item) => item.pageId === resolution.pageId,
  );
  const shouldRemovePage = !pageHasBreakpoints && projectPages.length > 1;
  const remainingPages = shouldRemovePage
    ? data.pages.filter((page) => page.id !== resolution.pageId)
    : data.pages;
  const activeResolutionStillExists = remainingProjectResolutions.find(
    (item) => item.id === activeProject.activeResolutionId,
  );
  const fallbackResolution =
    activeResolutionStillExists ??
    remainingProjectResolutions.find(
      (item) => item.pageId === activeProject.activePageId,
    ) ??
    remainingProjectResolutions[0];
  const fallbackPage =
    remainingPages.find((page) => page.id === fallbackResolution?.pageId) ??
    projectPages.find((page) => page.id === fallbackResolution?.pageId) ??
    activePage ??
    projectPages[0];
  const nextUrl = fallbackPage
    ? resolvePageUrl(activeProject.startUrl || browserUrl, fallbackPage.path)
    : browserUrl;

  return {
    nextUrl: activeResolutionStillExists ? "" : nextUrl,
    data: {
      ...data,
      pages: remainingPages,
      referenceImages: pruneUnusedReferenceImages(
        data.referenceImages,
        remainingResolutions,
      ),
      resolutions: remainingResolutions,
      projects: data.projects.map((project) =>
        project.id === activeProject.id
          ? {
              ...project,
              activePageId: fallbackPage?.id ?? project.activePageId,
              activeResolutionId:
                fallbackResolution?.id ?? project.activeResolutionId,
              lastUrl: !activeResolutionStillExists ? nextUrl : project.lastUrl,
              updatedAt: now,
            }
          : project,
      ),
    },
  };
}
