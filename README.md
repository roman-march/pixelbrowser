# Pixel Perfect Dev Browser

Electron desktop app for checking sites against reference images at fixed viewport breakpoints.

## Stack

- Electron 42
- electron-vite
- React + TypeScript
- electron-builder
- electron-updater

## Commands

```bash
npm run dev
npm run build
npm run dist:mac
```

## Updates

Packaging is configured through `electron-builder.yml`.

The current publish provider is `generic`:

```yaml
publish:
  provider: generic
  url: https://updates.example.com/pixel-perfect-dev-browser/
```

Before production release, replace this URL with the real update host and sign/notarize macOS builds. macOS auto-update requires a signed app.
