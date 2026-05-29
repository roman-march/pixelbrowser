import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  BrowserOverlayState,
  BrowserPaneConfig,
  DiffSettings,
  OverlaySettings,
  ReferenceImage,
  ResolutionPreset,
} from "../../../../shared/types";

type BrowserViewportProps = {
  diff: DiffSettings;
  image: ReferenceImage | null;
  overlay: OverlaySettings;
  partition: string;
  resolution: ResolutionPreset;
  url: string;
  visible: boolean;
};

export function BrowserViewport({
  diff,
  image,
  overlay,
  partition,
  resolution,
  url,
  visible,
}: BrowserViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setHostSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const viewportSize = getViewportSize(hostSize, resolution);
  const { displayHeight, displayWidth, scale } = viewportSize;
  const shouldShowOverlay = Boolean(overlay.enabled && overlay.opacity > 0 && image);
  const shouldShowDiff = Boolean(diff.enabled && diff.highlightOpacity > 0 && image);
  const overlayState = buildBrowserOverlayState({ diff, image, overlay });
  const overlayStateRef = useRef(overlayState);
  overlayStateRef.current = overlayState;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || displayWidth <= 0 || displayHeight <= 0) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    void window.pixelPerfect.configureBrowserPanes({
      panes: [
        buildPaneConfig({
          displayHeight,
          displayWidth,
          id: "primary",
          overlay: overlayStateRef.current,
          rect,
          resolution,
          scale,
          partition,
          url,
          visible,
        }),
      ],
      primaryPaneId: "primary",
      maxLivePanes: 1,
    });
  }, [
    url,
    partition,
    visible,
    resolution.width,
    resolution.height,
    resolution.deviceScaleFactor,
    scale,
    hostSize.width,
    hostSize.height,
    displayWidth,
    displayHeight,
  ]);

  useLayoutEffect(() => {
    void window.pixelPerfect.updateBrowserPaneOverlays({
      panes: [
        {
          id: "primary",
          overlay: overlayState,
        },
      ],
    });
  }, [
    image?.fileUrl,
    image?.width,
    image?.height,
    shouldShowOverlay,
    shouldShowDiff,
    overlay.enabled,
    overlay.opacity,
    overlay.blendMode,
    overlay.offsetX,
    overlay.offsetY,
    overlay.scale,
    diff.enabled,
    diff.highlightOpacity,
  ]);

  return (
    <section ref={hostRef} className="viewport-host">
      <div
        ref={frameRef}
        className="viewport-frame"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <div
          className="viewport-scale"
          style={{
            width: displayWidth,
            height: displayHeight,
          }}
        >
          <div className="native-browser-slot" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

type HostSize = {
  width: number;
  height: number;
};

function getViewportSize(hostSize: HostSize, resolution: ResolutionPreset) {
  const rawScale = Math.min(
    1,
    hostSize.width > 0 ? hostSize.width / resolution.width : 1,
    hostSize.height > 0 ? hostSize.height / resolution.height : 1,
  );
  const displayWidth = Math.max(1, Math.round(resolution.width * rawScale));
  const displayHeight = Math.max(1, Math.round(resolution.height * rawScale));

  return {
    displayWidth,
    displayHeight,
    scale: getEmulationScale({
      displayHeight,
      displayWidth,
      resolution,
    }),
  };
}

function getEmulationScale({
  displayHeight,
  displayWidth,
  resolution,
}: {
  displayHeight: number;
  displayWidth: number;
  resolution: ResolutionPreset;
}) {
  const coverScale = Math.max(
    displayWidth / resolution.width,
    displayHeight / resolution.height,
  );

  if (coverScale >= 1) {
    return 1;
  }

  return coverScale;
}

type BuildPaneConfigInput = {
  displayHeight: number;
  displayWidth: number;
  id: string;
  overlay: BrowserOverlayState;
  partition: string;
  rect: DOMRect;
  resolution: ResolutionPreset;
  scale: number;
  url: string;
  visible: boolean;
};

function buildPaneConfig({
  displayHeight,
  displayWidth,
  id,
  overlay,
  partition,
  rect,
  resolution,
  scale,
  url,
  visible,
}: BuildPaneConfigInput): BrowserPaneConfig {
  return {
    id,
    url,
    partition,
    visible,
    bounds: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: displayWidth,
      height: displayHeight,
    },
    viewport: {
      width: resolution.width,
      height: resolution.height,
      deviceScaleFactor: resolution.deviceScaleFactor,
      scale,
    },
    overlay,
  };
}

type BuildBrowserOverlayStateInput = {
  diff: DiffSettings;
  image: ReferenceImage | null;
  overlay: OverlaySettings;
};

function buildBrowserOverlayState({
  diff,
  image,
  overlay,
}: BuildBrowserOverlayStateInput): BrowserOverlayState {
  const shouldShowOverlay = Boolean(overlay.enabled && overlay.opacity > 0 && image);
  const shouldShowDiff = Boolean(diff.enabled && diff.highlightOpacity > 0 && image);

  return {
    referenceImageUrl: image?.fileUrl ?? null,
    referenceImageWidth: image?.width ?? 0,
    referenceImageHeight: image?.height ?? 0,
    overlayVisible: Boolean(shouldShowOverlay),
    overlayOpacity: overlay.opacity,
    overlayBlendMode: overlay.blendMode,
    overlayOffsetX: overlay.offsetX,
    overlayOffsetY: overlay.offsetY,
    overlayScale: overlay.scale,
    diffVisible: Boolean(shouldShowDiff),
    diffOpacity: diff.highlightOpacity,
  };
}
