import { app, dialog } from "electron";
import type { BrowserWindow, OpenDialogOptions } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { imageSize } from "image-size";
import type { ImportedReferenceImage, ReferenceImage } from "../../shared/types";

export async function selectReferenceImage(
  ownerWindow: BrowserWindow | null,
  projectId: string,
): Promise<ImportedReferenceImage | null> {
  const dialogOptions: OpenDialogOptions = {
    title: "Select reference image",
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
    ],
  };
  const result = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return importReferenceImage(projectId, result.filePaths[0]);
}

export async function selectReferenceImages(
  ownerWindow: BrowserWindow | null,
  projectId: string,
): Promise<ImportedReferenceImage[]> {
  const dialogOptions: OpenDialogOptions = {
    title: "Select reference images",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
    ],
  };
  const result = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return Promise.all(
    result.filePaths.map((sourcePath) => importReferenceImage(projectId, sourcePath)),
  );
}

async function importReferenceImage(
  projectId: string,
  sourcePath: string,
): Promise<ImportedReferenceImage> {
  const extension = extname(sourcePath).toLowerCase();
  const mimeType = mimeTypeFromExtension(extension);
  const sourceStats = await stat(sourcePath);
  const fileHash = createHash("sha1")
    .update(`${sourcePath}:${sourceStats.size}:${sourceStats.mtimeMs}`)
    .digest("hex")
    .slice(0, 12);
  const id = randomUUID();
  const targetName = `${id}-${fileHash}${extension}`;
  const targetDir = assetsDir(projectId);
  const targetPath = join(targetDir, targetName);

  await mkdir(targetDir, { recursive: true });
  await copyFile(sourcePath, targetPath);

  const dimensions = imageSize(targetPath);
  const targetStats = await stat(targetPath);
  const now = new Date().toISOString();
  const image: ReferenceImage = {
    id,
    projectId,
    fileName: sourcePath.split(/[\\/]/).pop() ?? targetName,
    filePath: targetPath,
    fileUrl: pathToFileURL(targetPath).toString(),
    mimeType,
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    sizeBytes: targetStats.size,
    createdAt: now,
  };

  return { image, sourcePath };
}

function assetsDir(projectId: string): string {
  return join(app.getPath("userData"), "projects", projectId, "reference-images");
}

function mimeTypeFromExtension(extension: string): ReferenceImage["mimeType"] {
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  throw new Error(`Unsupported image format: ${extension}`);
}
