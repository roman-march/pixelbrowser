export type BlendMode =
  | "normal"
  | "difference"
  | "multiply"
  | "screen"
  | "overlay"
  | "exclusion";

export type OverlaySettings = {
  enabled: boolean;
  opacity: number;
  blendMode: BlendMode;
  offsetX: number;
  offsetY: number;
  scale: number;
  locked: boolean;
};

export type DiffSettings = {
  enabled: boolean;
  threshold: number;
  highlightOpacity: number;
  ignoreAntiAliasing: boolean;
};

export type ReferenceImage = {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  source?: ReferenceImageSource;
};

export type ReferenceImageSource =
  | { type: "local"; sourcePath: string }
  | {
      type: "figma";
      fileKey: string;
      fileName: string;
      fileVersion: string;
      pageNodeId: string;
      pageName: string;
      frameNodeId: string;
      frameName: string;
      scale: number;
      importedAt: string;
    };

export type ResolutionPreset = {
  id: string;
  projectId: string;
  pageId: string;
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  referenceImageId?: string;
  overlaySettings: OverlaySettings;
  diffSettings: DiffSettings;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPage = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  startUrl: string;
  lastUrl: string;
  activePageId: string;
  activeResolutionId: string;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  projects: Project[];
  pages: ProjectPage[];
  resolutions: ResolutionPreset[];
  referenceImages: ReferenceImage[];
  figma?: FigmaSettings;
};

export type FigmaSettings = {
  fileUrl: string;
  fileKey?: string;
  pageNodeId?: string;
  updatedAt?: string;
};

export type ImportedReferenceImage = {
  image: ReferenceImage;
  sourcePath: string;
};

export type FigmaAuthStatus = {
  configured: boolean;
  connected: boolean;
  expiresAt?: string;
  reason?: string;
  userId?: string;
};

export type FigmaFileRequest = {
  fileUrl: string;
};

export type FigmaFramesRequest = {
  fileKey: string;
  pageNodeId: string;
};

export type FigmaImportFrameRequest = {
  projectId: string;
  fileKey: string;
  fileName: string;
  fileVersion: string;
  pageNodeId: string;
  pageName: string;
  frameNodeId: string;
  frameName: string;
  scale: number;
};

export type FigmaPageSummary = {
  id: string;
  name: string;
};

export type FigmaFrameSummary = {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  thumbnailUrl: string | null;
};

export type FigmaFileSummary = {
  fileKey: string;
  fileName: string;
  fileVersion: string;
  pages: FigmaPageSummary[];
};

export type UpdateStatus =
  | { state: "disabled"; reason: string }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloaded"; version: string }
  | { state: "error"; message: string };

export type BrowserViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserViewport = {
  width: number;
  height: number;
  deviceScaleFactor: number;
  scale: number;
};

export type BrowserOverlayState = {
  referenceImageUrl: string | null;
  referenceImageWidth: number;
  referenceImageHeight: number;
  overlayVisible: boolean;
  overlayOpacity: number;
  overlayBlendMode: BlendMode;
  overlayOffsetX: number;
  overlayOffsetY: number;
  overlayScale: number;
  diffVisible: boolean;
  diffOpacity: number;
};

export type BrowserViewConfig = {
  url: string;
  partition: string;
  visible: boolean;
  bounds: BrowserViewBounds;
  viewport: BrowserViewport;
  overlay: BrowserOverlayState;
};

export type BrowserPaneConfig = BrowserViewConfig & {
  id: string;
};

export type BrowserPanesConfig = {
  panes: BrowserPaneConfig[];
  primaryPaneId: string;
  maxLivePanes: number;
};

export type PixelPerfectApi = {
  getAppData(): Promise<AppData>;
  saveAppData(data: AppData): Promise<AppData>;
  selectReferenceImage(projectId: string): Promise<ImportedReferenceImage | null>;
  selectReferenceImages(projectId: string): Promise<ImportedReferenceImage[]>;
  getFigmaAuthStatus(): Promise<FigmaAuthStatus>;
  connectFigma(): Promise<FigmaAuthStatus>;
  disconnectFigma(): Promise<FigmaAuthStatus>;
  getFigmaFile(input: FigmaFileRequest): Promise<FigmaFileSummary>;
  listFigmaFrames(input: FigmaFramesRequest): Promise<FigmaFrameSummary[]>;
  importFigmaFrame(input: FigmaImportFrameRequest): Promise<ImportedReferenceImage>;
  configureBrowser(input: BrowserViewConfig): Promise<boolean>;
  configureBrowserPanes(input: BrowserPanesConfig): Promise<boolean>;
  goBack(): Promise<boolean>;
  reload(): Promise<boolean>;
  getBrowserPageTitle(): Promise<string>;
  onBrowserUrlChanged(callback: (url: string) => void): () => void;
  getVersion(): Promise<string>;
  checkForUpdates(): Promise<UpdateStatus>;
};

export const defaultOverlaySettings = (): OverlaySettings => ({
  enabled: true,
  opacity: 0.5,
  blendMode: "difference",
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  locked: false,
});

export const defaultDiffSettings = (): DiffSettings => ({
  enabled: false,
  threshold: 0.1,
  highlightOpacity: 0.45,
  ignoreAntiAliasing: true,
});
