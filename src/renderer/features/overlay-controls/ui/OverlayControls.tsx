import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Blend,
  Check,
  Eye,
  EyeOff,
  Lock,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";
import type {
  BlendMode,
  DiffSettings,
  OverlaySettings,
  ResolutionPreset,
} from "../../../../shared/types";
import { formatBlendMode } from "../../../shared/lib/format";
import { IconButton } from "../../../shared/ui/icon-button";
import { blendModes } from "../model/blend-modes";

type OverlayControlsProps = {
  diff: DiffSettings;
  overlay: OverlaySettings;
  onResolutionUpdate: (
    updater: (resolution: ResolutionPreset) => ResolutionPreset,
  ) => void;
};

export function OverlayControls({
  diff,
  overlay,
  onResolutionUpdate,
}: OverlayControlsProps) {
  return (
    <>
      <OverlayVisibilityButton overlay={overlay} onUpdate={onResolutionUpdate} />
      <OverlayLockButton overlay={overlay} onUpdate={onResolutionUpdate} />
      <OverlayBlendModeSelect overlay={overlay} onUpdate={onResolutionUpdate} />
      <OverlayOpacityControl overlay={overlay} onUpdate={onResolutionUpdate} />
      <div className="toolbar-separator" aria-hidden="true" />
      <SettingsToggleButton diff={diff} onUpdate={onResolutionUpdate} />
    </>
  );
}

type OverlayPartProps = {
  overlay: OverlaySettings;
  onUpdate: OverlayControlsProps["onResolutionUpdate"];
};

function OverlayVisibilityButton({ overlay, onUpdate }: OverlayPartProps) {
  return (
    <IconButton
      title="Toggle overlay"
      active={overlay.enabled}
      onClick={() =>
        onUpdate((resolution) => ({
          ...resolution,
          overlaySettings: {
            ...resolution.overlaySettings,
            enabled: !resolution.overlaySettings.enabled,
          },
          updatedAt: new Date().toISOString(),
        }))
      }
    >
      {overlay.enabled ? <Eye /> : <EyeOff />}
    </IconButton>
  );
}

function OverlayLockButton({ overlay, onUpdate }: OverlayPartProps) {
  return (
    <IconButton
      title="Lock overlay"
      active={overlay.locked}
      onClick={() =>
        onUpdate((resolution) => ({
          ...resolution,
          overlaySettings: {
            ...resolution.overlaySettings,
            locked: !resolution.overlaySettings.locked,
          },
          updatedAt: new Date().toISOString(),
        }))
      }
    >
      {overlay.locked ? <Lock /> : <Unlock />}
    </IconButton>
  );
}

function OverlayOpacityControl({ overlay, onUpdate }: OverlayPartProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div className="opacity-control" aria-label="Overlay opacity">
          <Slider.Root
            className="slider-root"
            min={0}
            max={1}
            step={0.01}
            value={[overlay.opacity]}
            onValueChange={(value) => {
              const opacity = value[0] ?? overlay.opacity;
              onUpdate((resolution) => ({
                ...resolution,
                overlaySettings: {
                  ...resolution.overlaySettings,
                  opacity,
                },
                updatedAt: new Date().toISOString(),
              }));
            }}
          >
            <Slider.Track className="slider-track">
              <Slider.Range className="slider-range" />
            </Slider.Track>
            <Slider.Thumb className="slider-thumb" />
          </Slider.Root>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={8}>
          Overlay opacity
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function OverlayBlendModeSelect({ overlay, onUpdate }: OverlayPartProps) {
  return (
    <Select.Root
      value={overlay.blendMode}
      onValueChange={(value) =>
        onUpdate((resolution) => ({
          ...resolution,
          overlaySettings: {
            ...resolution.overlaySettings,
            blendMode: value as BlendMode,
          },
          updatedAt: new Date().toISOString(),
        }))
      }
    >
      <Select.Trigger className="blend-trigger" aria-label="Blend mode">
        <Blend />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="select-content"
          position="popper"
          sideOffset={7}
          align="end"
        >
          <Select.Viewport className="select-viewport">
            {blendModes.map((mode) => (
              <Select.Item className="select-item" key={mode} value={mode}>
                <Select.ItemText>{formatBlendMode(mode)}</Select.ItemText>
                <Select.ItemIndicator className="select-item-indicator">
                  <Check />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

type UpdateOnlyProps = {
  onUpdate: OverlayControlsProps["onResolutionUpdate"];
};

type DiffToggleButtonProps = UpdateOnlyProps & {
  diff: DiffSettings;
};

function SettingsToggleButton({ diff, onUpdate }: DiffToggleButtonProps) {
  return (
    <IconButton
      title="Settings"
      active={diff.enabled}
      onClick={() =>
        onUpdate((resolution) => ({
          ...resolution,
          diffSettings: {
            ...resolution.diffSettings,
            enabled: !resolution.diffSettings.enabled,
          },
          updatedAt: new Date().toISOString(),
        }))
      }
    >
      <SlidersHorizontal />
    </IconButton>
  );
}
