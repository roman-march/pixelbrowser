import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AppData,
  FigmaAuthStatus,
  FigmaFileSummary,
  FigmaFrameSummary,
  ImportedReferenceImage,
  ProjectPage,
  ResolutionPreset,
} from "../../../../shared/types";
import type { FigmaImportLoadingState } from "../../../features/figma-import";
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

type FigmaDraft = {
  error: string | null;
  file: FigmaFileSummary | null;
  fileUrl: string;
  frames: FigmaFrameSummary[];
  loading: FigmaImportLoadingState;
  open: boolean;
  selectedPageId: string;
  authStatus: FigmaAuthStatus;
};

function createEmptyFigmaDraft(): FigmaDraft {
  return {
    error: null,
    file: null,
    fileUrl: "",
    frames: [],
    loading: "idle",
    open: false,
    selectedPageId: "",
    authStatus: {
      configured: false,
      connected: false,
    },
  };
}

export function useWorkspacePage() {
  const [data, setData] = useState<AppData | null>(null);
  const [urlDraft, setUrlDraft] = useState("http://localhost:3000");
  const [browserUrl, setBrowserUrl] = useState("http://localhost:3000");
  const [breakpointSelectOpen, setBreakpointSelectOpen] = useState(false);
  const [breakpointDraft, setBreakpointDraft] = useState(emptyBreakpointDraft);
  const [figmaDraft, setFigmaDraft] = useState(createEmptyFigmaDraft);
  const breakpointPickerRef = useOutsideClick<HTMLDivElement>(
    breakpointSelectOpen,
    () => setBreakpointSelectOpen(false),
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      window.pixelPerfect.getAppData(),
      window.pixelPerfect.getFigmaAuthStatus(),
    ]).then(([initialData, figmaAuthStatus]) => {
      if (!mounted) {
        return;
      }

      setData(initialData);
      setFigmaDraft((draft) => ({
        ...draft,
        authStatus: figmaAuthStatus,
      }));
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

  function openFigmaImport() {
    const saved = data?.figma;
    setFigmaDraft((draft) => ({
      ...draft,
      error: null,
      file: null,
      frames: [],
      loading: "idle",
      open: true,
      selectedPageId: saved?.pageNodeId ?? draft.selectedPageId,
      fileUrl: saved?.fileUrl || draft.fileUrl,
    }));
    void refreshFigmaAuthStatus();
  }

  function closeFigmaImport() {
    setFigmaDraft((draft) => ({
      ...draft,
      error: null,
      loading: "idle",
      open: false,
    }));
  }

  function updateFigmaFileUrl(fileUrl: string) {
    setFigmaDraft((draft) => ({
      ...draft,
      error: null,
      file: null,
      fileUrl,
      frames: [],
      selectedPageId: "",
    }));
  }

  async function refreshFigmaAuthStatus() {
    const authStatus = await window.pixelPerfect.getFigmaAuthStatus();
    setFigmaDraft((draft) => ({ ...draft, authStatus }));
    return authStatus;
  }

  async function connectFigma() {
    setFigmaDraft((draft) => ({ ...draft, error: null, loading: "connect" }));
    try {
      const authStatus = await window.pixelPerfect.connectFigma();
      setFigmaDraft((draft) => ({
        ...draft,
        authStatus,
        error: authStatus.connected ? null : authStatus.reason ?? "Figma connection failed.",
        loading: "idle",
      }));
    } catch (error) {
      const authStatus = await refreshFigmaAuthStatus();
      setFigmaDraft((draft) => ({
        ...draft,
        authStatus,
        error: errorMessage(error),
        loading: "idle",
      }));
    }
  }

  async function disconnectFigma() {
    setFigmaDraft((draft) => ({ ...draft, error: null, loading: "connect" }));
    try {
      const authStatus = await window.pixelPerfect.disconnectFigma();
      setFigmaDraft((draft) => ({
        ...draft,
        authStatus,
        file: null,
        frames: [],
        loading: "idle",
        selectedPageId: "",
      }));
    } catch (error) {
      setFigmaDraft((draft) => ({
        ...draft,
        error: errorMessage(error),
        loading: "idle",
      }));
    }
  }

  async function loadFigmaFile() {
    const fileUrl = figmaDraft.fileUrl.trim();

    setFigmaDraft((draft) => ({ ...draft, error: null, loading: "file" }));
    try {
      const authStatus = await refreshFigmaAuthStatus();
      if (!authStatus.connected) {
        throw new Error(authStatus.reason ?? "Connect Figma before loading a file.");
      }

      const file = await window.pixelPerfect.getFigmaFile({ fileUrl });
      const savedPageId = data?.figma?.pageNodeId;
      const selectedPageId =
        (savedPageId && file.pages.some((page) => page.id === savedPageId)
          ? savedPageId
          : file.pages[0]?.id) ?? "";

      await saveFigmaSettings({
        fileKey: file.fileKey,
        fileUrl,
        pageNodeId: selectedPageId,
      });

      setFigmaDraft((draft) => ({
        ...draft,
        error: null,
        file,
        frames: [],
        loading: selectedPageId ? "frames" : "idle",
        selectedPageId,
      }));

      if (selectedPageId) {
        await loadFigmaFrames(file, selectedPageId, fileUrl);
      }
    } catch (error) {
      setFigmaDraft((draft) => ({
        ...draft,
        error: errorMessage(error),
        loading: "idle",
      }));
    }
  }

  async function selectFigmaPage(pageNodeId: string) {
    if (!figmaDraft.file) {
      return;
    }

    await loadFigmaFrames(
      figmaDraft.file,
      pageNodeId,
      figmaDraft.fileUrl.trim(),
    );
  }

  async function loadFigmaFrames(
    file: FigmaFileSummary,
    pageNodeId: string,
    fileUrl: string,
  ) {
    setFigmaDraft((draft) => ({
      ...draft,
      error: null,
      frames: [],
      loading: "frames",
      selectedPageId: pageNodeId,
    }));

    try {
      const frames = await window.pixelPerfect.listFigmaFrames({
        fileKey: file.fileKey,
        pageNodeId,
      });

      await saveFigmaSettings({
        fileKey: file.fileKey,
        fileUrl,
        pageNodeId,
      });

      setFigmaDraft((draft) => ({
        ...draft,
        error: null,
        frames,
        loading: "idle",
      }));
    } catch (error) {
      setFigmaDraft((draft) => ({
        ...draft,
        error: errorMessage(error),
        loading: "idle",
      }));
    }
  }

  async function importFigmaFrame(frame: FigmaFrameSummary) {
    if (!data || !active.project || !active.resolution || !figmaDraft.file) {
      return;
    }

    const file = figmaDraft.file;
    const selectedPage = file.pages.find((page) => page.id === figmaDraft.selectedPageId);
    if (!selectedPage) {
      return;
    }

    setFigmaDraft((draft) => ({ ...draft, error: null, loading: "import" }));
    try {
      const result = await window.pixelPerfect.importFigmaFrame({
        projectId: active.project.id,
        fileKey: file.fileKey,
        fileName: file.fileName,
        fileVersion: file.fileVersion,
        pageNodeId: selectedPage.id,
        pageName: selectedPage.name,
        frameNodeId: frame.id,
        frameName: frame.name,
        scale: 1,
      });
      const now = new Date().toISOString();

      await persist({
        ...data,
        figma: {
          fileUrl: figmaDraft.fileUrl.trim(),
          fileKey: file.fileKey,
          pageNodeId: selectedPage.id,
          updatedAt: now,
        },
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

      setFigmaDraft((draft) => ({
        ...draft,
        error: null,
        loading: "idle",
        open: false,
      }));
    } catch (error) {
      setFigmaDraft((draft) => ({
        ...draft,
        error: errorMessage(error),
        loading: "idle",
      }));
    }
  }

  async function saveFigmaSettings(settings: {
    fileKey: string;
    fileUrl: string;
    pageNodeId: string;
  }) {
    if (!data) {
      return;
    }

    await persist({
      ...data,
      figma: {
        fileUrl: settings.fileUrl,
        fileKey: settings.fileKey,
        pageNodeId: settings.pageNodeId,
        updatedAt: new Date().toISOString(),
      },
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
  const browserVisible =
    !breakpointSelectOpen && !breakpointDraft.open && !figmaDraft.open;

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
    figma: {
      close: closeFigmaImport,
      connect: connectFigma,
      disconnect: disconnectFigma,
      draft: figmaDraft,
      importFrame: importFigmaFrame,
      loadFile: loadFigmaFile,
      open: openFigmaImport,
      selectPage: selectFigmaPage,
      updateFileUrl: updateFigmaFileUrl,
    },
    reference: {
      select: selectReferenceImage,
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Figma import failed.";
}
