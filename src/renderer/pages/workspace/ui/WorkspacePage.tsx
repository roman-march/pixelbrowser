import { BreakpointDialog } from "../../../features/breakpoint-management";
import { FigmaImportDialog } from "../../../features/figma-import";
import { ControlPanel } from "../../../widgets/control-panel";
import { BrowserViewport } from "../../../widgets/browser-viewport";
import { useWorkspacePage } from "../model/useWorkspacePage";

export function WorkspacePage() {
  const workspace = useWorkspacePage();

  if (!workspace.ready) {
    return <div className="loading">Loading</div>;
  }

  return (
    <main className="app-shell">
      <ControlPanel
        activeImage={workspace.active.image}
        activePage={workspace.active.page}
        activeResolution={workspace.active.resolution}
        browserDraftUrl={workspace.browser.draftUrl}
        breakpointPickerRef={workspace.breakpoint.pickerRef}
        breakpointSelectOpen={workspace.breakpoint.selectOpen}
        diff={workspace.active.diff}
        overlay={workspace.active.overlay}
        projectPages={workspace.active.pages}
        projectResolutions={workspace.active.resolutions}
        onBreakpointDelete={workspace.breakpoint.deleteResolution}
        onBreakpointImport={workspace.breakpoint.startImport}
        onBreakpointOpenChange={workspace.breakpoint.setSelectOpen}
        onBreakpointSelect={workspace.breakpoint.switchResolution}
        onFigmaImportOpen={workspace.figma.open}
        onReferenceSelect={workspace.reference.select}
        onResolutionUpdate={workspace.active.updateResolution}
        onUrlDraftChange={workspace.browser.setDraftUrl}
        onUrlSubmit={workspace.browser.submitUrl}
      />

      <BrowserViewport
        diff={workspace.active.diff}
        image={workspace.active.image}
        overlay={workspace.active.overlay}
        partition={workspace.browser.partition}
        resolution={workspace.active.resolution}
        url={workspace.browser.url}
        visible={workspace.browser.visible}
      />

      <BreakpointDialog
        draft={workspace.breakpoint.draft}
        onAddImages={workspace.breakpoint.addDraftImages}
        onClose={workspace.breakpoint.closeDialog}
        onDraftFieldChange={workspace.breakpoint.updateDraftField}
        onImageFieldChange={workspace.breakpoint.updateDraftImageField}
        onImageRemove={workspace.breakpoint.removeDraftImage}
        onSubmit={workspace.breakpoint.submit}
      />

      <FigmaImportDialog
        error={workspace.figma.draft.error}
        file={workspace.figma.draft.file}
        fileUrl={workspace.figma.draft.fileUrl}
        frames={workspace.figma.draft.frames}
        loading={workspace.figma.draft.loading}
        open={workspace.figma.draft.open}
        selectedPageId={workspace.figma.draft.selectedPageId}
        authStatus={workspace.figma.draft.authStatus}
        onClose={workspace.figma.close}
        onConnect={workspace.figma.connect}
        onDisconnect={workspace.figma.disconnect}
        onFileLoad={workspace.figma.loadFile}
        onFileUrlChange={workspace.figma.updateFileUrl}
        onFrameImport={workspace.figma.importFrame}
        onPageSelect={workspace.figma.selectPage}
      />
    </main>
  );
}
