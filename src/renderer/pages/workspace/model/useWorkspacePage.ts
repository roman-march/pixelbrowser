import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AppData,
  ImportedReferenceImage,
  ProjectPage,
  ResolutionPreset,
} from "../../../../shared/types";
import { defaultDiffSettings, defaultOverlaySettings } from "../../../../shared/types";
import {
  buildBreakpointDraft,
  buildBreakpointSubmit,
  buildDeleteBreakpoint,
  emptyBreakpointDraft,
  extendBreakpointDraft,
} from "../../../features/breakpoint-management/model";
import type {
  BreakpointDraftField,
  DraftReferenceImageField,
} from "../../../features/breakpoint-management/model";
import {
  normalizeUrl,
  pagePathFromUrl,
  resolvePageUrl,
  selectActiveWorkspace,
} from "../../../entities/project";
import { useOutsideClick } from "../../../shared/lib/use-outside-click";

export function useWorkspacePage() {
  const [data, setData] = useState<AppData | null>(null);
  const [urlDraft, setUrlDraft] = useState("http://localhost:3000");
  const [browserUrl, setBrowserUrl] = useState("http://localhost:3000");
  const [breakpointSelectOpen, setBreakpointSelectOpen] = useState(false);
  const [breakpointDraft, setBreakpointDraft] = useState(emptyBreakpointDraft);
  const breakpointPickerRef = useOutsideClick<HTMLDivElement>(
    breakpointSelectOpen,
    () => setBreakpointSelectOpen(false),
  );

  useEffect(() => {
    let mounted = true;

    window.pixelPerfect.getAppData().then((initialData) => {
      if (!mounted) {
        return;
      }

      setData(initialData);
      const project = initialData.projects[0];
      if (project) {
        const initialUrl = project.lastUrl || project.startUrl;
        setUrlDraft(initialUrl);
        setBrowserUrl(initialUrl);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const active = useMemo(() => selectActiveWorkspace(data), [data]);
  const overlay = active.resolution?.overlaySettings ?? defaultOverlaySettings();
  const diff = active.resolution?.diffSettings ?? defaultDiffSettings();

  async function persist(nextData: AppData) {
    setData(nextData);
    await window.pixelPerfect.saveAppData(nextData);
  }

  function updateActiveResolution(
    updater: (resolution: ResolutionPreset) => ResolutionPreset,
  ) {
    if (!data || !active.resolution) {
      return;
    }

    void persist({
      ...data,
      resolutions: data.resolutions.map((resolution) =>
        resolution.id === active.resolution?.id ? updater(resolution) : resolution,
      ),
    });
  }

  function saveProjectUrl(url: string) {
    if (!data || !active.project) {
      return;
    }

    void persist({
      ...data,
      projects: data.projects.map((project) =>
        project.id === active.project?.id
          ? { ...project, lastUrl: url, updatedAt: new Date().toISOString() }
          : project,
      ),
    });
  }

  useEffect(() => {
    return window.pixelPerfect.onBrowserUrlChanged((nextUrl) => {
      setUrlDraft(nextUrl);
      setBrowserUrl(nextUrl);
      saveProjectUrl(nextUrl);
    });
  }, [active.project?.id, data]);

  function submitUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeUrl(urlDraft);
    setUrlDraft(normalized);
    setBrowserUrl(normalized);
    saveProjectUrl(normalized);
  }

  async function selectReferenceImage() {
    if (!data || !active.project || !active.resolution) {
      return;
    }

    const result = await window.pixelPerfect.selectReferenceImage(active.project.id);
    if (!result) {
      return;
    }

    const now = new Date().toISOString();
    await persist({
      ...data,
      referenceImages: [
        ...data.referenceImages.filter((image) => image.id !== result.image.id),
        result.image,
      ],
      resolutions: data.resolutions.map((resolution) =>
        resolution.id === active.resolution?.id
          ? {
              ...resolution,
              referenceImageId: result.image.id,
              updatedAt: now,
            }
          : resolution,
      ),
    });
  }

  function switchBreakpoint(page: ProjectPage, resolution: ResolutionPreset) {
    if (!data || !active.project) {
      return;
    }

    const nextUrl = resolvePageUrl(active.project.startUrl || browserUrl, page.path);
    setUrlDraft(nextUrl);
    setBrowserUrl(nextUrl);

    void persist({
      ...data,
      projects: data.projects.map((project) =>
        project.id === active.project?.id
          ? {
              ...project,
              activePageId: page.id,
              activeResolutionId: resolution.id,
              lastUrl: nextUrl,
              updatedAt: new Date().toISOString(),
            }
          : project,
      ),
    });
  }

  async function startBreakpointImport() {
    if (!active.project) {
      return;
    }

    setBreakpointSelectOpen(false);
    const imported = await window.pixelPerfect.selectReferenceImages(active.project.id);
    if (imported.length === 0) {
      return;
    }

    await openBreakpointDialog(imported);
  }

  async function openBreakpointDialog(imported: ImportedReferenceImage[] = []) {
    const title = await window.pixelPerfect.getBrowserPageTitle();
    const draft = buildBreakpointDraft({
      activePage: active.page,
      activeResolution: active.resolution,
      browserPath: pagePathFromUrl(browserUrl),
      imported,
      pageTitle: title,
    });

    setBreakpointDraft(draft);
  }

  function deleteBreakpoint(resolution: ResolutionPreset) {
    if (!data || !active.project) {
      return;
    }

    const result = buildDeleteBreakpoint({
      activePage: active.page,
      activeProject: active.project,
      browserUrl,
      data,
      projectPages: active.pages,
      projectResolutions: active.resolutions,
      resolution,
    });

    if (!result) {
      return;
    }

    if (result.nextUrl) {
      setUrlDraft(result.nextUrl);
      setBrowserUrl(result.nextUrl);
    }

    setBreakpointSelectOpen(false);
    void persist(result.data);
  }

  async function addDraftImages() {
    if (!active.project) {
      return;
    }

    const imported = await window.pixelPerfect.selectReferenceImages(active.project.id);
    if (imported.length === 0) {
      return;
    }

    setBreakpointDraft((draft) => extendBreakpointDraft(draft, imported));
  }

  function updateDraftField(field: BreakpointDraftField, value: string) {
    setBreakpointDraft((draft) => ({ ...draft, [field]: value }));
  }

  function updateDraftImageField(
    id: string,
    field: DraftReferenceImageField,
    value: string,
  ) {
    setBreakpointDraft((draft) => ({
      ...draft,
      images: draft.images.map((image) =>
        image.id === id ? { ...image, [field]: value } : image,
      ),
    }));
  }

  function removeDraftImage(id: string) {
    setBreakpointDraft((draft) => ({
      ...draft,
      images: draft.images.filter((image) => image.id !== id),
    }));
  }

  function submitBreakpoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !active.project) {
      return;
    }

    const result = buildBreakpointSubmit({
      activeProject: active.project,
      browserUrl,
      data,
      draft: breakpointDraft,
    });

    if (!result) {
      return;
    }

    setUrlDraft(result.nextUrl);
    setBrowserUrl(result.nextUrl);
    void persist(result.data);
    setBreakpointDraft(emptyBreakpointDraft());
  }

  const ready = Boolean(data && active.project && active.resolution);
  const partition = active.project
    ? `persist:pixel-perfect-${active.project.id}`
    : "";
  const browserVisible = !breakpointSelectOpen && !breakpointDraft.open;

  return {
    ready,
    active: {
      diff,
      image: active.image,
      overlay,
      page: active.page,
      pages: active.pages,
      project: active.project,
      resolution: active.resolution!,
      resolutions: active.resolutions,
      updateResolution: updateActiveResolution,
    },
    browser: {
      draftUrl: urlDraft,
      partition,
      setDraftUrl: setUrlDraft,
      submitUrl,
      url: browserUrl,
      visible: browserVisible,
    },
    breakpoint: {
      addDraftImages,
      closeDialog: () => setBreakpointDraft(emptyBreakpointDraft()),
      deleteResolution: deleteBreakpoint,
      draft: breakpointDraft,
      pickerRef: breakpointPickerRef,
      removeDraftImage,
      selectOpen: breakpointSelectOpen,
      setSelectOpen: setBreakpointSelectOpen,
      startImport: startBreakpointImport,
      submit: submitBreakpoints,
      switchResolution: switchBreakpoint,
      updateDraftField,
      updateDraftImageField,
    },
    reference: {
      select: selectReferenceImage,
    },
  };
}
