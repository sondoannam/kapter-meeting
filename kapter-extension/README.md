# Browser Extension Workspace

This package is a Vite + React + TypeScript workspace for a Manifest V3 browser extension.

## Entry Points

- `public/manifest.json`: extension manifest template
- `src/background/index.ts`: MV3 service worker
- `src/content/index.tsx`: content script entry
- `src/popup/index.html`: popup UI entry
- `src/options/index.html`: options page entry
- `src/devtools/index.html`: devtools page entry
- `src/devtools/panel.html`: custom devtools panel entry

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm package:zip
pnpm lint
```

`pnpm package:zip` rebuilds the extension and creates a shareable archive at `artifacts/kapter-extension-<version>.zip`.
The packaging step now runs through Node, so the same command works on Windows, macOS, and Linux.

## Rollout Flag

- Leave `VITE_ENABLE_GOOGLE_MEET_DUAL_LANE_CAPTURE` unset, or set it to `true`, to keep Google Meet dual-lane capture (`tab_mix` + `self_mic`) enabled.
- Set `VITE_ENABLE_GOOGLE_MEET_DUAL_LANE_CAPTURE=false` in `.env.local` before `pnpm build` when you want a tab-only baseline build for internal Meet comparison runs.

## Load In Chrome

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `extension/dist`.

For tester handoff, you can instead run `pnpm package:zip`, send the generated zip, and have the tester extract it before loading the unpacked `dist` folder.

## Notes

- The manifest version is synced from `package.json` in `vite.config.ts`.
- Popup and options UIs use Tailwind via `src/ui.css`.
- Source paths are declared in the manifest and rewritten by the web-extension build plugin during bundling.
