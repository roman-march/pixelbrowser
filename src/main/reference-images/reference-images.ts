import { app, dialog } from "electron";
import type { BrowserWindow, OpenDialogOptions } from "electron";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { imageSize } from "image-size";
import type {
  ImportedReferenceImage,
  ReferenceImage,
  ReferenceImageSource,
} from "../../shared/types";

type ReferenceImageBufferInput = {
  projectId: string;
  fileName: string;
  buffer: Buffer | Uint8Array;
  mimeType: ReferenceImage["mimeType"];
  source?: ReferenceImageSource;
  sourcePath?: string;
};

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
    fileName: basename(sourcePath) || targetName,
    filePath: targetPath,
    fileUrl: pathToFileURL(targetPath).toString(),
    mimeType,
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    sizeBytes: targetStats.size,
    createdAt: now,
    source: { type: "local", sourcePath },
  };

  return { image, sourcePath };
}

export async function importReferenceImageFromBuffer({
  projectId,
  fileName,
  buffer,
  mimeType,
  source,
  sourcePath,
}: ReferenceImageBufferInput): Promise<ImportedReferenceImage> {
  const content = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const extension = extensionFromMimeType(mimeType);
  const id = randomUUID();
  const fileHash = createHash("sha1").update(content).digest("hex").slice(0, 12);
  const targetName = `${id}-${fileHash}${extension}`;
  const targetDir = assetsDir(projectId);
  const targetPath = join(targetDir, targetName);

  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, content);

  const dimensions = imageSize(targetPath);
  const targetStats = await stat(targetPath);
  const now = new Date().toISOString();
  const image: ReferenceImage = {
    id,
    projectId,
    fileName: sanitizeFileName(fileName) || targetName,
    filePath: targetPath,
    fileUrl: pathToFileURL(targetPath).toString(),
    mimeType,
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    sizeBytes: targetStats.size,
    createdAt: now,
    source,
  };

  return { image, sourcePath: sourcePath ?? targetPath };
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

function extensionFromMimeType(mimeType: ReferenceImage["mimeType"]): string {
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  throw new Error(`Unsupported image mime type: ${mimeType}`);
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}
