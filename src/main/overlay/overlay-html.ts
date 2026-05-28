export function overlayHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        pointer-events: none;
      }

      #layers {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .pane-layer {
        position: absolute;
        overflow: hidden;
        pointer-events: none;
      }

      .reference {
        position: absolute;
        left: 0;
        top: 0;
        max-width: none;
        transform-origin: top left;
        user-select: none;
        pointer-events: none;
      }

      .diff {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          rgba(255, 55, 85, 0.42) 0 10px,
          transparent 10px 20px
        );
        mix-blend-mode: multiply;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div id="layers"></div>
    <script>
      window.__renderPixelPerfectOverlay = function renderPixelPerfectOverlay(state) {
        var layers = document.getElementById("layers");
        var panes = Array.isArray(state && state.panes) ? state.panes : [];
        layers.replaceChildren();

        panes.forEach(function renderPane(pane) {
          var layer = document.createElement("div");
          layer.className = "pane-layer";
          layer.style.left = pane.bounds.x + "px";
          layer.style.top = pane.bounds.y + "px";
          layer.style.width = pane.bounds.width + "px";
          layer.style.height = pane.bounds.height + "px";

          if (pane.overlayVisible && pane.referenceImageUrl) {
            var reference = document.createElement("img");
            reference.className = "reference";
            reference.alt = "";
            reference.src = pane.referenceImageUrl;
            reference.style.width = pane.referenceImageWidth * pane.scale + "px";
            reference.style.height = pane.referenceImageHeight * pane.scale + "px";
            reference.style.opacity = pane.overlayOpacity;
            reference.style.mixBlendMode = pane.overlayBlendMode;
            reference.style.transform =
              "translate(" +
              pane.overlayOffsetX * pane.scale +
              "px, " +
              pane.overlayOffsetY * pane.scale +
              "px) scale(" +
              pane.overlayScale +
              ")";
            layer.appendChild(reference);
          }

          if (pane.diffVisible) {
            var diff = document.createElement("div");
            diff.className = "diff";
            diff.style.opacity = pane.diffOpacity;
            layer.appendChild(diff);
          }

          layers.appendChild(layer);
        });
      };
    </script>
  </body>
</html>`;
}
