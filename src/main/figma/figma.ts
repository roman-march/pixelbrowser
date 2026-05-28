import { Buffer } from "node:buffer";
import type {
  FigmaFileRequest,
  FigmaFileSummary,
  FigmaFrameSummary,
  FigmaFramesRequest,
  FigmaImportFrameRequest,
  ImportedReferenceImage,
} from "../../shared/types";
import { importReferenceImageFromBuffer } from "../reference-images/reference-images";

const FIGMA_API_BASE = "https://api.figma.com/v1";
const TOP_LEVEL_SCREEN_TYPES = new Set([
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
]);

type FigmaBounds = {
  width?: number;
  height?: number;
};

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: FigmaBounds;
  absoluteRenderBounds?: FigmaBounds | null;
};

type FigmaFileResponse = {
  name?: string;
  version?: string;
  document?: FigmaNode;
  err?: string;
  message?: string;
  status?: number;
};

type FigmaNodesResponse = {
  nodes?: Record<string, { document?: FigmaNode | null } | null>;
  err?: string;
  message?: string;
  status?: number;
};

type FigmaImagesResponse = {
  images?: Record<string, string | null>;
  err?: string | null;
  message?: string;
  status?: number;
};

export async function getFigmaFile({
  fileUrl,
}: FigmaFileRequest, accessToken: string): Promise<FigmaFileSummary> {
  const fileKey = parseFigmaFileKey(fileUrl);
  const file = await figmaGet<FigmaFileResponse>(
    `/files/${fileKey}`,
    accessToken,
    { depth: "1" },
  );
  const pages =
    file.document?.children
      ?.filter((node) => node.type === "CANVAS")
      .map((node) => ({ id: node.id, name: node.name })) ?? [];

  return {
    fileKey,
    fileName: file.name?.trim() || "Untitled Figma file",
    fileVersion: file.version?.trim() || "",
    pages,
  };
}

export async function listFigmaFrames({
  fileKey,
  pageNodeId,
}: FigmaFramesRequest, accessToken: string): Promise<FigmaFrameSummary[]> {
  const nodes = await figmaGet<FigmaNodesResponse>(
    `/files/${fileKey}/nodes`,
    accessToken,
    {
      depth: "2",
      ids: pageNodeId,
    },
  );
  const pageNode = nodes.nodes?.[pageNodeId]?.document;
  const frames = (pageNode?.children ?? [])
    .filter(isTopLevelScreenNode)
    .map((node) => {
      const bounds = node.absoluteBoundingBox ?? node.absoluteRenderBounds ?? {};
      return {
        id: node.id,
        name: node.name,
        type: node.type,
        width: Math.round(bounds.width ?? 0),
        height: Math.round(bounds.height ?? 0),
        thumbnailUrl: null,
      };
    });

  const thumbnails = await renderFigmaImages({
    accessToken,
    fileKey,
    ids: frames.map((frame) => frame.id),
    scale: 0.25,
  });

  return frames.map((frame) => ({
    ...frame,
    thumbnailUrl: thumbnails[frame.id] ?? null,
  }));
}

export async function importFigmaFrame(
  input: FigmaImportFrameRequest,
  accessToken: string,
): Promise<ImportedReferenceImage> {
  const scale = clampExportScale(input.scale);
  const images = await renderFigmaImages({
    accessToken,
    fileKey: input.fileKey,
    ids: [input.frameNodeId],
    scale,
  });
  const imageUrl = images[input.frameNodeId];
  if (!imageUrl) {
    throw new Error("Figma did not return a rendered PNG for this frame.");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Figma PNG (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return importReferenceImageFromBuffer({
    projectId: input.projectId,
    fileName: `${input.frameName}.png`,
    buffer,
    mimeType: "image/png",
    sourcePath: `figma://${input.fileKey}/${input.frameNodeId}`,
    source: {
      type: "figma",
      fileKey: input.fileKey,
      fileName: input.fileName,
      fileVersion: input.fileVersion,
      pageNodeId: input.pageNodeId,
      pageName: input.pageName,
      frameNodeId: input.frameNodeId,
      frameName: input.frameName,
      scale,
      importedAt: new Date().toISOString(),
    },
  });
}

function parseFigmaFileKey(fileUrl: string): string {
  const input = fileUrl.trim();
  if (!input) {
    throw new Error("Enter a Figma file URL.");
  }

  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const fileTypeIndex = parts.findIndex((part) =>
      ["file", "design", "proto", "board", "slides"].includes(part),
    );
    const fileKey = fileTypeIndex >= 0 ? parts[fileTypeIndex + 1] : undefined;
    if (fileKey) {
      return fileKey;
    }
  } catch {
    // Fall back to accepting a raw file key for internal use and tests.
  }

  if (/^[A-Za-z0-9_-]{8,}$/.test(input)) {
    return input;
  }

  throw new Error("Could not parse the Figma file key from this URL.");
}

async function renderFigmaImages({
  accessToken,
  fileKey,
  ids,
  scale,
}: {
  accessToken: string;
  fileKey: string;
  ids: string[];
  scale: number;
}): Promise<Record<string, string | null>> {
  if (ids.length === 0) {
    return {};
  }

  const result: Record<string, string | null> = {};
  for (const chunk of chunkIds(ids, 80)) {
    const response = await figmaGet<FigmaImagesResponse>(
      `/images/${fileKey}`,
      accessToken,
      {
        format: "png",
        ids: chunk.join(","),
        scale: String(scale),
      },
    );
    Object.assign(result, response.images ?? {});
  }

  return result;
}

async function figmaGet<T>(
  path: string,
  accessToken: string,
  query: Record<string, string>,
): Promise<T> {
  const authToken = accessToken.trim().replace(/^Bearer\s+/i, "");
  if (!authToken) {
    throw new Error("Connect Figma before importing frames.");
  }

  const url = new URL(`${FIGMA_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(figmaErrorMessage(response.status, body));
  }

  return body as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function figmaErrorMessage(status: number, body: unknown): string {
  const data = body as { err?: unknown; message?: unknown; status?: unknown };
  const message =
    typeof data.err === "string"
      ? data.err
      : typeof data.message === "string"
        ? data.message
        : "";
  return message
    ? `Figma API error (${status}): ${message}`
    : `Figma API error (${status}).`;
}

function isTopLevelScreenNode(node: FigmaNode): boolean {
  const bounds = node.absoluteBoundingBox ?? node.absoluteRenderBounds;
  return (
    TOP_LEVEL_SCREEN_TYPES.has(node.type) &&
    Boolean(bounds?.width && bounds.height)
  );
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function clampExportScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.min(4, Math.max(0.01, scale));
}
