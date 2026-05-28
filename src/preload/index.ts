import { contextBridge, ipcRenderer } from "electron";
import type {
  AppData,
  BrowserPanesConfig,
  BrowserViewConfig,
  ImportedReferenceImage,
  PixelPerfectApi,
  UpdateStatus,
} from "../shared/types";

const api: PixelPerfectApi = {
  getAppData: () => ipcRenderer.invoke("app-data:get") as Promise<AppData>,
  saveAppData: (data) => ipcRenderer.invoke("app-data:save", data) as Promise<AppData>,
  selectReferenceImage: (projectId) =>
    ipcRenderer.invoke("reference-image:select", projectId) as Promise<ImportedReferenceImage | null>,
  selectReferenceImages: (projectId) =>
    ipcRenderer.invoke("reference-images:select", projectId) as Promise<ImportedReferenceImage[]>,
  getFigmaAuthStatus: () =>
    ipcRenderer.invoke("figma:auth-status") as ReturnType<PixelPerfectApi["getFigmaAuthStatus"]>,
  connectFigma: () =>
    ipcRenderer.invoke("figma:connect") as ReturnType<PixelPerfectApi["connectFigma"]>,
  disconnectFigma: () =>
    ipcRenderer.invoke("figma:disconnect") as ReturnType<PixelPerfectApi["disconnectFigma"]>,
  getFigmaFile: (input) =>
    ipcRenderer.invoke("figma:file", input) as ReturnType<PixelPerfectApi["getFigmaFile"]>,
  listFigmaFrames: (input) =>
    ipcRenderer.invoke("figma:frames", input) as ReturnType<PixelPerfectApi["listFigmaFrames"]>,
  importFigmaFrame: (input) =>
    ipcRenderer.invoke("figma:import-frame", input) as ReturnType<PixelPerfectApi["importFigmaFrame"]>,
  configureBrowser: (input: BrowserViewConfig) =>
    ipcRenderer.invoke("browser:configure", input) as Promise<boolean>,
  configureBrowserPanes: (input: BrowserPanesConfig) =>
    ipcRenderer.invoke("browser-panes:configure", input) as Promise<boolean>,
  goBack: () => ipcRenderer.invoke("browser:go-back") as Promise<boolean>,
  reload: () => ipcRenderer.invoke("browser:reload") as Promise<boolean>,
  getBrowserPageTitle: () =>
    ipcRenderer.invoke("browser:get-page-title") as Promise<string>,
  onBrowserUrlChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("browser:url-changed", listener);
    return () => ipcRenderer.removeListener("browser:url-changed", listener);
  },
  getVersion: () => ipcRenderer.invoke("app:get-version") as Promise<string>,
  checkForUpdates: () => ipcRenderer.invoke("updates:check") as Promise<UpdateStatus>,
};

contextBridge.exposeInMainWorld("pixelPerfect", api);
