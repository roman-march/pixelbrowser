import { app } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppData, FigmaSettings } from "../../shared/types";
import { defaultDiffSettings, defaultOverlaySettings } from "../../shared/types";

export async function readAppData(): Promise<AppData> {
  try {
    const raw = await readFile(dataPath(), "utf8");
    return normalizeAppData(JSON.parse(raw) as AppData);
  } catch {
    const data = createDefaultData();
    await writeAppData(data);
    return data;
  }
}

export async function writeAppData(data: AppData): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(dataPath(), JSON.stringify(normalizeAppData(data), null, 2), "utf8");
}

function dataPath(): string {
  return join(app.getPath("userData"), "pixel-perfect-data.json");
}

function createDefaultData(): AppData {
  const now = new Date().toISOString();
  const projectId = randomUUID();
  const pageId = randomUUID();
  const resolutionId = randomUUID();

  return {
    projects: [
      {
        id: projectId,
        name: "Pixel Perfect Project",
        startUrl: "http://localhost:3000",
        lastUrl: "http://localhost:3000",
        activePageId: pageId,
        activeResolutionId: resolutionId,
        createdAt: now,
        updatedAt: now,
      },
    ],
    pages: [
      {
        id: pageId,
        projectId,
        name: "Home",
        path: "/",
        createdAt: now,
        updatedAt: now,
      },
    ],
    resolutions: [
      {
        id: resolutionId,
        projectId,
        pageId,
        name: "Desktop",
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        overlaySettings: defaultOverlaySettings(),
        diffSettings: defaultDiffSettings(),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        projectId,
        pageId,
        name: "Tablet",
        width: 768,
        height: 1024,
        deviceScaleFactor: 1,
        overlaySettings: defaultOverlaySettings(),
        diffSettings: defaultDiffSettings(),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        projectId,
        pageId,
        name: "Mobile",
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        overlaySettings: defaultOverlaySettings(),
        diffSettings: defaultDiffSettings(),
        createdAt: now,
        updatedAt: now,
      },
    ],
    referenceImages: [],
  };
}

function normalizeAppData(data: AppData): AppData {
  const normalized: AppData = {
    projects: Array.isArray(data.projects) ? data.projects : [],
    pages: Array.isArray(data.pages) ? data.pages : [],
    resolutions: Array.isArray(data.resolutions) ? data.resolutions : [],
    referenceImages: Array.isArray(data.referenceImages) ? data.referenceImages : [],
  };

  if (data.figma) {
    normalized.figma = normalizeFigmaSettings(data.figma);
  }

  return normalized;
}

function normalizeFigmaSettings(settings: FigmaSettings): FigmaSettings {
  return {
    fileUrl: typeof settings.fileUrl === "string" ? settings.fileUrl : "",
    fileKey: typeof settings.fileKey === "string" ? settings.fileKey : undefined,
    pageNodeId:
      typeof settings.pageNodeId === "string" ? settings.pageNodeId : undefined,
    updatedAt: typeof settings.updatedAt === "string" ? settings.updatedAt : undefined,
  };
}
