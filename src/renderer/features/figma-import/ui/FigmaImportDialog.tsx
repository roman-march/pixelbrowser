import type { FormEvent } from "react";
import type {
  FigmaAuthStatus,
  FigmaFileSummary,
  FigmaFrameSummary,
} from "../../../../shared/types";
import { Modal } from "../../../shared/ui/modal";

export type FigmaImportLoadingState =
  | "idle"
  | "connect"
  | "file"
  | "frames"
  | "import";

type FigmaImportDialogProps = {
  authStatus: FigmaAuthStatus;
  error: string | null;
  file: FigmaFileSummary | null;
  fileUrl: string;
  frames: FigmaFrameSummary[];
  loading: FigmaImportLoadingState;
  open: boolean;
  selectedPageId: string;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onFileLoad: () => void;
  onFileUrlChange: (value: string) => void;
  onFrameImport: (frame: FigmaFrameSummary) => void;
  onPageSelect: (pageId: string) => void;
};

export function FigmaImportDialog({
  authStatus,
  error,
  file,
  fileUrl,
  frames,
  loading,
  open,
  selectedPageId,
  onClose,
  onConnect,
  onDisconnect,
  onFileLoad,
  onFileUrlChange,
  onFrameImport,
  onPageSelect,
}: FigmaImportDialogProps) {
  const selectedPage = file?.pages.find((page) => page.id === selectedPageId);
  const loadingLabel = loadingLabelByState[loading];
  const busy = loading !== "idle";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFileLoad();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <div>
            <Modal.Title>Connect Figma</Modal.Title>
            <Modal.Description>Import a Figma frame as a reference image.</Modal.Description>
          </div>
          <Modal.Close />
        </Modal.Header>
        <form className="modal-form figma-import-form" onSubmit={submit}>
          <div className="figma-auth-row">
            <div>
              <span>{authStatus.connected ? "Connected" : "Not connected"}</span>
              <small>
                {authStatus.connected
                  ? "Figma OAuth is ready for file import."
                  : authStatus.reason ?? "Connect with your Figma account."}
              </small>
            </div>
            {authStatus.connected ? (
              <button
                className="small-button"
                disabled={busy}
                type="button"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            ) : (
              <button
                className="small-button primary"
                disabled={busy || !authStatus.configured}
                type="button"
                onClick={onConnect}
              >
                {loading === "connect" ? "Connecting" : "Connect Figma"}
              </button>
            )}
          </div>
          <label>
            File URL
            <input
              autoComplete="off"
              placeholder="https://www.figma.com/design/..."
              value={fileUrl}
              disabled={!authStatus.connected || busy}
              onChange={(event) => onFileUrlChange(event.target.value)}
            />
          </label>

          <div className="figma-load-row">
            <button
              className="small-button primary"
              disabled={!authStatus.connected || busy}
              type="submit"
            >
              {loading === "file" ? "Loading" : "Load file"}
            </button>
            {file ? <span>{file.fileName}</span> : null}
          </div>

          {error ? <div className="figma-error">{error}</div> : null}
          {loadingLabel ? <div className="figma-status">{loadingLabel}</div> : null}

          {file ? (
            <section className="figma-section">
              <div className="figma-section-head">
                <span>Pages</span>
                <code>{file.pages.length}</code>
              </div>
              <div className="figma-page-list">
                {file.pages.map((page) => (
                  <button
                    className={
                      page.id === selectedPageId
                        ? "figma-page-button active"
                        : "figma-page-button"
                    }
                    disabled={loading !== "idle"}
                    key={page.id}
                    type="button"
                    onClick={() => onPageSelect(page.id)}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {selectedPage ? (
            <section className="figma-section">
              <div className="figma-section-head">
                <span>{selectedPage.name}</span>
                <code>{frames.length} frames</code>
              </div>
              <div className="figma-frame-grid">
                {frames.map((frame) => (
                  <button
                    className="figma-frame-card"
                    disabled={loading !== "idle"}
                    key={frame.id}
                    type="button"
                    onClick={() => onFrameImport(frame)}
                  >
                    {frame.thumbnailUrl ? (
                      <img alt="" src={frame.thumbnailUrl} />
                    ) : (
                      <div className="figma-frame-empty">No preview</div>
                    )}
                    <span>{frame.name}</span>
                    <code>
                      {frame.width}x{frame.height}
                    </code>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </form>
      </Modal.Content>
    </Modal>
  );
}

const loadingLabelByState: Record<FigmaImportLoadingState, string> = {
  idle: "",
  connect: "Waiting for Figma authorization",
  file: "Loading pages",
  frames: "Loading frames",
  import: "Importing PNG",
};
