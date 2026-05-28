import { app, BrowserWindow, ipcMain, shell, WebContentsView } from "electron";
import type { Rectangle } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import log from "electron-log/main";
import electronUpdater from "electron-updater";
import { join } from "node:path";
import type {
  AppData,
  BrowserOverlayState,
  BrowserViewConfig,
  BrowserViewport,
  UpdateStatus,
} from "../shared/types";
import { readAppData, writeAppData } from "./app-data/app-data";
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
let browserView: WebContentsView | null = null;
let browserPartition = "";
let lastBrowserUrl = "";
let lastBrowserConfig: BrowserViewConfig | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayReady = false;
let pendingOverlay: BrowserOverlayRenderState | null = null;

// Avoid macOS Keychain prompts from Chromium safe storage in local/ad-hoc builds.
if (process.platform === "darwin") {
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

  mainWindow.on("move", syncOverlayWindowBounds);
  mainWindow.on("resize", syncOverlayWindowBounds);
  mainWindow.on("minimize", () => {
    browserView?.setVisible(false);
    overlayWindow?.hide();
  });
  mainWindow.on("restore", () => {
    if (lastBrowserConfig?.visible) {
      browserView?.setVisible(true);
      syncOverlayWindow();
    }
  });
  mainWindow.on("closed", () => {
    overlayWindow?.destroy();
    overlayWindow = null;
    browserView = null;
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

  ipcMain.handle("browser:configure", async (_event, input: BrowserViewConfig) => {
    return configureBrowser(input);
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
  scale: number;
};

function configureBrowser(config: BrowserViewConfig): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  lastBrowserConfig = normalizeBrowserConfig(config);

  const view = ensureBrowserView(lastBrowserConfig.partition);
  if (!view) {
    return false;
  }

  view.setBounds(lastBrowserConfig.bounds);
  view.setVisible(lastBrowserConfig.visible);
  if (lastBrowserConfig.visible && lastBrowserConfig.url !== lastBrowserUrl) {
    lastBrowserUrl = lastBrowserConfig.url;
    view.webContents.loadURL(lastBrowserConfig.url);
  } else {
    void applyDeviceEmulation(view, lastBrowserConfig.viewport);
  }

  syncOverlayWindow();
  return true;
}

function normalizeBrowserConfig(config: BrowserViewConfig): BrowserViewConfig {
  return {
    ...config,
    bounds: {
      x: Math.max(0, Math.round(config.bounds.x)),
      y: Math.max(0, Math.round(config.bounds.y)),
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

function ensureBrowserView(partition: string): WebContentsView | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  if (browserView && browserPartition === partition) {
    return browserView;
  }

  if (browserView) {
    mainWindow.contentView.removeChildView(browserView);
    browserView.webContents.close({ waitForBeforeUnload: false });
  }

  browserPartition = partition;
  lastBrowserUrl = "";
  browserView = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  browserView.setBackgroundColor("#000");
  browserView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  browserView.webContents.on("did-navigate", (_event, url) => {
    emitBrowserUrl(url);
  });
  browserView.webContents.on("did-navigate-in-page", (_event, url) => {
    emitBrowserUrl(url);
  });
  browserView.webContents.on("dom-ready", () => {
    if (lastBrowserConfig) {
      void applyDeviceEmulation(browserView!, lastBrowserConfig.viewport);
    }
  });

  mainWindow.contentView.addChildView(browserView);
  return browserView;
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

function emitBrowserUrl(url: string): void {
  lastBrowserUrl = url;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("browser:url-changed", url);
}

function goBack(): boolean {
  const contents = browserView?.webContents;
  if (!contents || contents.isDestroyed() || !contents.canGoBack()) {
    return false;
  }

  contents.goBack();
  return true;
}

function reloadBrowser(): boolean {
  const contents = browserView?.webContents;
  if (!contents || contents.isDestroyed()) {
    return false;
  }

  contents.reload();
  return true;
}

function getBrowserPageTitle(): string {
  const title = browserView?.webContents.isDestroyed()
    ? ""
    : browserView?.webContents.getTitle().trim();
  return title || "";
}

function syncOverlayWindow(): void {
  if (!lastBrowserConfig || !mainWindow || mainWindow.isDestroyed()) {
    overlayWindow?.hide();
    return;
  }

  const overlay = buildOverlayRenderState(lastBrowserConfig);
  const shouldShow =
    lastBrowserConfig.visible && (overlay.overlayVisible || overlay.diffVisible);
  if (!shouldShow) {
    overlayWindow?.hide();
    return;
  }

  const overlayBounds = getOverlayWindowBounds(lastBrowserConfig.bounds);
  if (!overlayBounds) {
    overlayWindow?.hide();
    return;
  }

  const win = ensureOverlayWindow();
  if (!win) {
    return;
  }

  win.setBounds(overlayBounds, false);
  pendingOverlay = overlay;
  if (overlayReady) {
    renderOverlay(overlay);
  }
  if (!win.isVisible()) {
    win.showInactive();
  }
}

function syncOverlayWindowBounds(): void {
  if (!lastBrowserConfig || !overlayWindow?.isVisible()) {
    return;
  }

  const overlayBounds = getOverlayWindowBounds(lastBrowserConfig.bounds);
  if (overlayBounds) {
    overlayWindow.setBounds(overlayBounds, false);
  }
}

function getOverlayWindowBounds(bounds: Rectangle): Rectangle | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const contentBounds = mainWindow.getContentBounds();
  return {
    x: contentBounds.x + bounds.x,
    y: contentBounds.y + bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function buildOverlayRenderState(config: BrowserViewConfig): BrowserOverlayRenderState {
  return {
    ...config.overlay,
    scale: config.viewport.scale,
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

function renderOverlay(state: BrowserOverlayRenderState): void {
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
