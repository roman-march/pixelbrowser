import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type IconButtonProps = {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  title: string;
  onClick?: () => void;
};

export function IconButton({
  active = false,
  children,
  disabled = false,
  title,
  onClick,
}: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`icon-button ${active ? "active" : ""}`}
          disabled={disabled}
          onClick={onClick}
          aria-label={title}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={8}>
          {title}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
