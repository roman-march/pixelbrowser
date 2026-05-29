import type { ReactNode } from "react";

type ToolbarRootProps = {
  children: ReactNode;
};

function Root({ children }: ToolbarRootProps) {
  return <header className="topbar">{children}</header>;
}

function TrafficSpacer() {
  return <div className="traffic-spacer" aria-hidden="true" />;
}

function Separator() {
  return <div className="toolbar-separator" aria-hidden="true" />;
}

export const Toolbar = Object.assign(Root, {
  Separator,
  TrafficSpacer,
});
