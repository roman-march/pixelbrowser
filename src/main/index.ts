import { app, BrowserWindow, ipcMain, shell, WebContentsView } from "electron";
import type { Rectangle } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import log from "electron-log/main";
import electronUpdater from "electron-updater";
import { join } from "node:path";
import type {
  AppData,
  BrowserPaneConfig,
  BrowserPanesConfig,
  BrowserOverlayState,
  BrowserViewConfig,
  BrowserViewport,
  FigmaFileRequest,
  FigmaFramesRequest,
  FigmaImportFrameRequest,
  UpdateStatus,
} from "../shared/types";
import { readAppData, writeAppData } from "./app-data/app-data";
import {
  getFigmaFile,
  importFigmaFrame,
  listFigmaFrames,
} from "./figma/figma";
import {
  connectFigma,
  disconnectFigma,
  getFigmaAccessToken,
  getFigmaAuthStatus,
} from "./figma/oauth";
import { overlayHtml } from "./overlay/overlay-html";
import {
  selectReferenceImage,
  selectReferenceImages,
} from "./reference-images/reference-images";

const { autoUpdater } = electronUpdater;

log.initialize();
autoUpdater.logger = log;
autoUpdater.autoDownload = false;

let mainWindow: BrowserWindow | null = null;
const browserPanes = new Map<string, BrowserPaneRuntime>();
let primaryPaneId = "primary";
let lastBrowserPanesConfig: BrowserPanesConfig | null = null;
let lastEmittedBrowserUrl = "";
let overlayWindow: BrowserWindow | null = null;
let overlayReady = false;
let pendingOverlay: BrowserOverlayRenderPayload | null = null;

type BrowserPaneRuntime = {
  id: string;
  view: WebContentsView;
  partition: string;
  lastUrl: string;
  live: boolean;
  config: BrowserPaneConfig | null;
};

// Avoid macOS Keychain prompts from Chromium safe storage only in local builds.
if (process.platform === "darwin" && !app.isPackaged) {
  app.commandLine.appendSwitch("use-mock-keychain");
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    title: "Pixel Perfect Dev Browser",
    backgroundColor: "#090b0f",
    show: true,
    hasShadow: process.platform !== "darwin",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("move", syncOverlayWindow);
  mainWindow.on("resize", syncOverlayWindow);
  mainWindow.on("minimize", () => {
    for (const pane of browserPanes.values()) {
      pane.live = false;
      pane.view.setVisible(false);
    }
    overlayWindow?.hide();
  });
  mainWindow.on("restore", () => {
    if (lastBrowserPanesConfig) {
      configureBrowserPanes(lastBrowserPanesConfig);
    }
  });
  mainWindow.on("closed", () => {
    overlayWindow?.destroy();
    overlayWindow = null;
    for (const paneId of Array.from(browserPanes.keys())) {
      destroyPane(paneId);
    }
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("dev.pixelperfect.browser");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers(): void {
  ipcMain.handle("app-data:get", async () => {
    return readAppData();
  });

  ipcMain.handle("app-data:save", async (_event, data: AppData) => {
    await writeAppData(data);
    return data;
  });

  ipcMain.handle("reference-image:select", async (_event, projectId: string) => {
    return selectReferenceImage(mainWindow, projectId);
  });

  ipcMain.handle("reference-images:select", async (_event, projectId: string) => {
    return selectReferenceImages(mainWindow, projectId);
  });

  ipcMain.handle("figma:auth-status", async () => {
    return getFigmaAuthStatus();
  });

  ipcMain.handle("figma:connect", async () => {
    return connectFigma();
  });

  ipcMain.handle("figma:disconnect", async () => {
    return disconnectFigma();
  });

  ipcMain.handle("figma:file", async (_event, input: FigmaFileRequest) => {
    return getFigmaFile(input, await getFigmaAccessToken());
  });

  ipcMain.handle("figma:frames", async (_event, input: FigmaFramesRequest) => {
    return listFigmaFrames(input, await getFigmaAccessToken());
  });

  ipcMain.handle("figma:import-frame", async (_event, input: FigmaImportFrameRequest) => {
    return importFigmaFrame(input, await getFigmaAccessToken());
  });

  ipcMain.handle("browser:configure", async (_event, input: BrowserViewConfig) => {
    return configureBrowser(input);
  });

  ipcMain.handle("browser-panes:configure", async (_event, input: BrowserPanesConfig) => {
    return configureBrowserPanes(input);
  });

  ipcMain.handle("browser:go-back", () => goBack());

  ipcMain.handle("browser:reload", () => reloadBrowser());

  ipcMain.handle("browser:get-page-title", () => getBrowserPageTitle());

  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("updates:check", async () => {
    return checkForUpdates();
  });
}

type BrowserOverlayRenderState = BrowserOverlayState & {
  paneId: string;
  bounds: Rectangle;
  scale: number;
};

type BrowserOverlayRenderPayload = {
  panes: BrowserOverlayRenderState[];
};

function configureBrowser(config: BrowserViewConfig): boolean {
  return configureBrowserPanes({
    panes: [{ id: "primary", ...config }],
    primaryPaneId: "primary",
    maxLivePanes: 1,
  });
}

function configureBrowserPanes(config: BrowserPanesConfig): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  lastBrowserPanesConfig = normalizeBrowserPanesConfig(config);
  primaryPaneId = lastBrowserPanesConfig.primaryPaneId;

  const activeIds = new Set(lastBrowserPanesConfig.panes.map((pane) => pane.id));
  const liveIds = selectLivePaneIds(lastBrowserPanesConfig);

  for (const paneConfig of lastBrowserPanesConfig.panes) {
    const pane = ensurePaneView(paneConfig.id, paneConfig.partition);
    if (!pane) {
      continue;
    }

    const shouldShowLive = paneConfig.visible && liveIds.has(paneConfig.id);
    pane.config = paneConfig;
    pane.live = shouldShowLive;
    pane.view.setBounds(paneConfig.bounds);
    pane.view.setVisible(shouldShowLive);

    if (!shouldShowLive) {
      continue;
    }

    if (paneConfig.url !== pane.lastUrl) {
      pane.lastUrl = paneConfig.url;
      pane.view.webContents.loadURL(paneConfig.url).catch((error) => {
        log.warn("Failed to load browser pane URL", error);
      });
    } else {
      void applyDeviceEmulation(pane.view, paneConfig.viewport);
    }
  }

  for (const paneId of Array.from(browserPanes.keys())) {
    if (!activeIds.has(paneId)) {
      destroyPane(paneId);
    }
  }

  syncOverlayWindow();
  return true;
}

function normalizeBrowserPanesConfig(config: BrowserPanesConfig): BrowserPanesConfig {
  const panes = config.panes.map(normalizeBrowserPaneConfig);
  const primaryExists = panes.some((pane) => pane.id === config.primaryPaneId);
  return {
    panes,
    primaryPaneId: primaryExists ? config.primaryPaneId : panes[0]?.id ?? "primary",
    maxLivePanes: Math.max(1, Math.floor(config.maxLivePanes || 1)),
  };
}

function normalizeBrowserPaneConfig(config: BrowserPaneConfig): BrowserPaneConfig {
  const id = config.id.trim() || "primary";
  return {
    ...normalizeBrowserConfig(config),
    id,
  };
}

function normalizeBrowserConfig(config: BrowserViewConfig): BrowserViewConfig {
  return {
    ...config,
    bounds: {
      x: Math.round(config.bounds.x),
      y: Math.round(config.bounds.y),
      width: Math.max(1, Math.round(config.bounds.width)),
      height: Math.max(1, Math.round(config.bounds.height)),
    },
    viewport: {
      width: Math.max(1, Math.round(config.viewport.width)),
      height: Math.max(1, Math.round(config.viewport.height)),
      deviceScaleFactor: Number.isFinite(config.viewport.deviceScaleFactor)
        ? config.viewport.deviceScaleFactor
        : 1,
      scale: Number.isFinite(config.viewport.scale) ? config.viewport.scale : 1,
    },
  };
}

function selectLivePaneIds(config: BrowserPanesConfig): Set<string> {
  const visiblePanes = config.panes.filter((pane) => pane.visible);
  const primaryPane = visiblePanes.find((pane) => pane.id === config.primaryPaneId);
  const orderedPanes = primaryPane
    ? [primaryPane, ...visiblePanes.filter((pane) => pane.id !== primaryPane.id)]
    : visiblePanes;
  const ids = orderedPanes.slice(0, config.maxLivePanes).map((pane) => pane.id);

  return new Set(ids);
}

function ensurePaneView(paneId: string, partition: string): BrowserPaneRuntime | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const existing = browserPanes.get(paneId);
  if (
    existing &&
    existing.partition === partition &&
    !existing.view.webContents.isDestroyed()
  ) {
    return existing;
  }

  if (existing) {
    destroyPane(paneId);
  }

  const view = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });
  const pane: BrowserPaneRuntime = {
    id: paneId,
    view,
    partition,
    lastUrl: "",
    live: false,
    config: null,
  };

  view.setBackgroundColor("#000");
  view.webContents.setBackgroundThrottling(true);
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  view.webContents.on("did-navigate", (_event, url) => {
    emitBrowserUrl(paneId, url);
  });
  view.webContents.on("did-navigate-in-page", (_event, url) => {
    emitBrowserUrl(paneId, url);
  });
  view.webContents.on("dom-ready", () => {
    const currentPane = browserPanes.get(paneId);
    if (currentPane?.config) {
      void applyDeviceEmulation(view, currentPane.config.viewport);
    }
  });

  mainWindow.contentView.addChildView(view);
  browserPanes.set(paneId, pane);
  return pane;
}

function destroyPane(paneId: string): void {
  const pane = browserPanes.get(paneId);
  if (!pane) {
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(pane.view);
  }
  if (!pane.view.webContents.isDestroyed()) {
    pane.view.webContents.close({ waitForBeforeUnload: false });
  }
  browserPanes.delete(paneId);
}

async function applyDeviceEmulation(
  view: WebContentsView,
  viewport: BrowserViewport,
): Promise<void> {
  if (view.webContents.isDestroyed()) {
    return;
  }

  if (!needsDeviceEmulation(viewport)) {
    await clearDeviceEmulation(view);
    return;
  }

  try {
    if (!view.webContents.debugger.isAttached()) {
      view.webContents.debugger.attach("1.3");
    }

    await view.webContents.debugger.sendCommand(
      "Emulation.setDeviceMetricsOverride",
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        mobile: false,
        scale: viewport.scale,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
        positionX: 0,
        positionY: 0,
      },
    );
  } catch (error) {
    log.warn("Failed to apply browser viewport emulation", error);
  }
}

function needsDeviceEmulation(viewport: BrowserViewport): boolean {
  return viewport.scale !== 1 || viewport.deviceScaleFactor !== 1;
}

async function clearDeviceEmulation(view: WebContentsView): Promise<void> {
  const browserDebugger = view.webContents.debugger;
  if (!browserDebugger.isAttached()) {
    return;
  }

  try {
    await browserDebugger.sendCommand("Emulation.clearDeviceMetricsOverride");
  } catch (error) {
    log.warn("Failed to clear browser viewport emulation", error);
  }

  try {
    browserDebugger.detach();
  } catch (error) {
    log.warn("Failed to detach browser debugger", error);
  }
}

function emitBrowserUrl(paneId: string, url: string): void {
  const pane = browserPanes.get(paneId);
  if (pane) {
    pane.lastUrl = url;
  }
  if (url === lastEmittedBrowserUrl) {
    return;
  }
  lastEmittedBrowserUrl = url;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("browser:url-changed", url);
}

function goBack(): boolean {
  const contents = getPrimaryPane()?.view.webContents;
  if (!contents || contents.isDestroyed() || !contents.canGoBack()) {
    return false;
  }

  contents.goBack();
  return true;
}

function reloadBrowser(): boolean {
  const livePanes = Array.from(browserPanes.values()).filter(
    (pane) => pane.live && !pane.view.webContents.isDestroyed(),
  );
  const panesToReload =
    livePanes.length > 0 ? livePanes : [getPrimaryPane()].filter(Boolean);

  for (const pane of panesToReload) {
    pane?.view.webContents.reload();
  }

  return panesToReload.length > 0;
}

function getBrowserPageTitle(): string {
  const contents = getPrimaryPane()?.view.webContents;
  const title = contents?.isDestroyed()
    ? ""
    : contents?.getTitle().trim();
  return title || "";
}

function getPrimaryPane(): BrowserPaneRuntime | null {
  return (
    browserPanes.get(primaryPaneId) ??
    Array.from(browserPanes.values()).find((pane) => pane.config?.visible) ??
    Array.from(browserPanes.values())[0] ??
    null
  );
}

function syncOverlayWindow(): void {
  if (!lastBrowserPanesConfig || !mainWindow || mainWindow.isDestroyed()) {
    overlayWindow?.hide();
    return;
  }

  const overlay = buildOverlayRenderPayload(lastBrowserPanesConfig);
  if (overlay.panes.length === 0) {
    overlayWindow?.hide();
    return;
  }

  const overlayBounds = getOverlayWindowBounds(overlay.panes.map((pane) => pane.bounds));
  if (!overlayBounds) {
    overlayWindow?.hide();
    return;
  }

  const win = ensureOverlayWindow();
  if (!win) {
    return;
  }

  const contentBounds = mainWindow.getContentBounds();
  const relativeOverlay: BrowserOverlayRenderPayload = {
    panes: overlay.panes.map((pane) => ({
      ...pane,
      bounds: {
        x: pane.bounds.x - (overlayBounds.x - contentBounds.x),
        y: pane.bounds.y - (overlayBounds.y - contentBounds.y),
        width: pane.bounds.width,
        height: pane.bounds.height,
      },
    })),
  };

  win.setBounds(overlayBounds, false);
  pendingOverlay = relativeOverlay;
  if (overlayReady) {
    renderOverlay(relativeOverlay);
  }
  if (!win.isVisible()) {
    win.showInactive();
  }
}

function getOverlayWindowBounds(bounds: Rectangle[]): Rectangle | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  const first = bounds[0];
  if (!first) {
    return null;
  }

  const union = bounds.slice(1).reduce(
    (rect, item) => {
      const x1 = Math.min(rect.x, item.x);
      const y1 = Math.min(rect.y, item.y);
      const x2 = Math.max(rect.x + rect.width, item.x + item.width);
      const y2 = Math.max(rect.y + rect.height, item.y + item.height);
      return {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      };
    },
    { ...first },
  );

  const contentBounds = mainWindow.getContentBounds();
  return {
    x: contentBounds.x + union.x,
    y: contentBounds.y + union.y,
    width: union.width,
    height: union.height,
  };
}

function buildOverlayRenderPayload(config: BrowserPanesConfig): BrowserOverlayRenderPayload {
  const liveIds = selectLivePaneIds(config);
  return {
    panes: config.panes.flatMap((pane) => {
      const shouldShow =
        pane.visible &&
        liveIds.has(pane.id) &&
        (pane.overlay.overlayVisible || pane.overlay.diffVisible);

      if (!shouldShow) {
        return [];
      }

      return {
        ...pane.overlay,
        paneId: pane.id,
        bounds: pane.bounds,
        scale: pane.viewport.scale,
      };
    }),
  };
}

function ensureOverlayWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayReady = false;
  overlayWindow = new BrowserWindow({
    parent: mainWindow,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: false,
    },
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.webContents.once("did-finish-load", () => {
    overlayReady = true;
    if (pendingOverlay) {
      renderOverlay(pendingOverlay);
    }
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayReady = false;
  });
  overlayWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml())}`,
  );

  return overlayWindow;
}

function renderOverlay(state: BrowserOverlayRenderPayload): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const serialized = JSON.stringify(state).replace(/</g, "\\u003c");
  overlayWindow.webContents.executeJavaScript(
    `window.__renderPixelPerfectOverlay(${serialized})`,
  );
}

async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return { state: "disabled", reason: "Auto updates run only in packaged builds." };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) {
      return { state: "not-available" };
    }
    return {
      state: "available",
      version: result.updateInfo.version,
    };
  } catch (error) {
    return {
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
