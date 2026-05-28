# Renderer architecture

The renderer follows a Feature-Sliced Design shape:

- `app` wires global providers and app-level composition.
- `pages` owns route/screen state and orchestrates widgets.
- `widgets` composes features into stable screen regions.
- `features` owns user actions and feature-specific UI/model logic.
- `entities` owns domain selectors and project/reference-image primitives.
- `shared` owns reusable UI, hooks, formatting, and generic helpers.

Imports should point down the stack only: `app -> pages -> widgets -> features -> entities -> shared`.
Compound components live in `shared/ui` and expose their parts through one public API object, for example `Modal` and `Toolbar`.

Electron main-process code is kept outside FSD and split by infrastructure concern:
app-data persistence, reference-image import, overlay HTML, and the window/browser lifecycle bootstrap.
