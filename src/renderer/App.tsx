import { AppProviders } from "./app/providers/AppProviders";
import { WorkspacePage } from "./pages/workspace";

export function App() {
  return (
    <AppProviders>
      <WorkspacePage />
    </AppProviders>
  );
}
