import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return <Tooltip.Provider delayDuration={250}>{children}</Tooltip.Provider>;
}
