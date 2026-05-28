import type { BlendMode } from "../../../shared/types";

export function formatBlendMode(mode: BlendMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
