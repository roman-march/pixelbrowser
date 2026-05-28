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

      #reference {
        position: absolute;
        left: 0;
        top: 0;
        display: none;
        max-width: none;
        transform-origin: top left;
        user-select: none;
        pointer-events: none;
      }

      #diff {
        position: absolute;
        inset: 0;
        display: none;
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
    <img id="reference" alt="" />
    <div id="diff"></div>
    <script>
      window.__renderPixelPerfectOverlay = function renderPixelPerfectOverlay(state) {
        var reference = document.getElementById("reference");
        var diff = document.getElementById("diff");

        if (state.overlayVisible && state.referenceImageUrl) {
          reference.style.display = "block";
          reference.src = state.referenceImageUrl;
          reference.style.width = state.referenceImageWidth * state.scale + "px";
          reference.style.height = state.referenceImageHeight * state.scale + "px";
          reference.style.opacity = state.overlayOpacity;
          reference.style.mixBlendMode = state.overlayBlendMode;
          reference.style.transform =
            "translate(" +
            state.overlayOffsetX * state.scale +
            "px, " +
            state.overlayOffsetY * state.scale +
            "px) scale(" +
            state.overlayScale +
            ")";
        } else {
          reference.removeAttribute("src");
          reference.style.display = "none";
        }

        if (state.diffVisible) {
          diff.style.display = "block";
          diff.style.opacity = state.diffOpacity;
        } else {
          diff.style.display = "none";
        }
      };
    </script>
  </body>
</html>`;
}
