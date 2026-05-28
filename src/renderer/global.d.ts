import type { PixelPerfectApi } from "../shared/types";

declare global {
  interface Window {
    pixelPerfect: PixelPerfectApi;
  }
}

export {};
