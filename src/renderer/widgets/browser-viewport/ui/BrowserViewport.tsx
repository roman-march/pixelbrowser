import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
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

  const scale = getViewportScale(hostSize, resolution);
  const displayWidth = Math.round(resolution.width * scale);
  const displayHeight = Math.round(resolution.height * scale);
  const shouldShowOverlay = Boolean(overlay.enabled && overlay.opacity > 0 && image);
  const shouldShowDiff = Boolean(diff.enabled && diff.highlightOpacity > 0 && image);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || displayWidth <= 0 || displayHeight <= 0) {
      return;
    }

    const rect = frame.getBoundingClientRect();
    void window.pixelPerfect.configureBrowser({
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
      overlay: {
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
      },
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
    image?.fileUrl,
    image?.width,
    image?.height,
    shouldShowOverlay,
    shouldShowDiff,
    overlay.opacity,
    overlay.blendMode,
    overlay.offsetX,
    overlay.offsetY,
    overlay.scale,
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
        {scale < 1 ? (
          <div className="scale-badge">
            {resolution.width}x{resolution.height} @ {Math.round(scale * 100)}%
          </div>
        ) : null}
      </div>
    </section>
  );
}

type HostSize = {
  width: number;
  height: number;
};

function getViewportScale(hostSize: HostSize, resolution: ResolutionPreset) {
  return Math.min(
    1,
    hostSize.width > 0 ? hostSize.width / resolution.width : 1,
    hostSize.height > 0 ? hostSize.height / resolution.height : 1,
  );
}
