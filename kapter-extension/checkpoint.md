# Project Checkpoint: Kapter Extension

## Current Status: Initial Feature Implementation

This module is currently in the late stages of initial development. Core audio capture and streaming mechanics are functional, with UI polishing and production integration remaining.

## Completed Milestones

- [x] **Manifest V3 Foundation**: Fully configured with required permissions (`tabCapture`, `offscreen`, `storage`, `scripting`).
- [x] **Audio Engineering**: Implemented `chrome.offscreen` audio capture and Web Audio PCM chunking to bypass MV3 service-worker media limitations.
- [x] **Streaming Protocol**: Developed an asynchronous WebSocket client capable of streaming binary audio chunks.
- [x] **Background Coordination**: Service worker logic for managing recording session states and component communication.
- [x] **Popup UI**: Basic dashboard showing recording status, elapsed time, and data throughput.
- [x] **Test Environment**: Included a local WebSocket server (`ws-test-server.js`) for isolated testing.
<!-- - [x] **Stability Patch**: Fixed hardcoded delays with precise ping/pong handshakes to prevent race conditions, and patched memory leaks in background/offscreen component lifecycle. -->

## In Progress

- [ ] **Floating Widget (Content Script)**: Refactoring the generic template into the branded Kapter Meeting Widget with real session controls.
- [x] **Stream Reliability**: Implemented auto-reconnection logic, transmission error handling, and silent background token refreshing to prevent recording failures due to session expiry.
- [x] **UX Polish**: Added glassmorphism, modern gradients, and refined Vietnamese localization for a premium look and feel.

## Upcoming Tasks (To-Do)

- [ ] **Production Backend Integration**: Connecting to the live NestJS WebSocket Gateway.
- [ ] **Auth Synchronization**: Automatically retrieving authentication tokens from the Web Dashboard domain (`kapter.com`).
- [ ] **Post-Meeting Hand-off**: Implementing the logic to redirect users to specific meeting review pages after stopping a recording.
- [ ] **Settings Panel**: Adding options for audio quality, auto-start, and notification preferences.

## Progress Log

- [x] 2026-04-29 Translated the entire extension (Popup and Content Script) to Vietnamese and upgraded the UI to a premium style (glassmorphism, gradients).
- [x] 2026-04-29 Added a Windows `pnpm package:zip` helper that rebuilds the extension and archives `dist/` to `artifacts/kapter-extension-<version>.zip` for faster mentor/tester handoff.
- [x] 2026-04-22 Added an extension-side backend auth preflight on `START_CAPTURE`, backed by `/api/auth/me` and manifest host-permission coverage for configured API and websocket origins, so first recording attempts can force backend local-user sync without depending on a teammate-local Clerk webhook tunnel.
- [x] 2026-04-18 Added build-time manifest coverage for the configured webapp origin and split the content script flow so the secure bridge relay runs on `/extension-bridge` without injecting the Meet widget into dashboard pages.
- [x] 2026-04-18 Hardened extension auth freshness checks in the background worker, including stale pending-request cleanup, JWT expiry validation, and explicit start-capture rejection when no fresh Clerk token is available.
- [x] 2026-04-18 Replaced the offscreen raw WebSocket transport with authenticated Socket.IO lifecycle events (`stream:start`, `stream:chunk`, `stream:stop`) against the backend `/audio-stream` namespace, with ordered chunk acknowledgements and explicit transport failure propagation into extension capture state.
- [x] 2026-04-20 Repointed extension stream payload typing to the repo-level shared backend contract surface so popup, background, and offscreen code all follow the same websocket payload shapes as the Nest audio-stream DTOs.
- [x] 2026-04-21 Migrated extension contract imports off app-local path aliases and onto the real workspace package `@kapter/contracts`, removing the need to compile sibling contract source via `rootDir: ".."`.
- [x] 2026-04-21 Validated the root workspace migration end-to-end for the extension path: the shared contracts package builds first, the extension builds and lints from the workspace root, and the obsolete empty `libs/contracts/typescript` directory has been removed.
- [x] 2026-04-21 Replaced offscreen `MediaRecorder` WebM chunking with Web Audio PCM capture so backend chunk concatenation produces valid worker batches without container-fragment decode failures.
- [x] 2026-04-25 Added popup-side project selection backed by the backend projects API and threaded the optional `projectId` through `START_CAPTURE` -> `OFFSCREEN_START` -> `stream:start` while preserving the backend draft-project fallback.
- [x] 2026-04-28 Added an extension GitHub Actions workflow that installs workspace dependencies, rebuilds shared contracts, runs lint/typecheck/build, and uploads the unpacked extension `dist/` output for CI review.
- [x] 2026-04-29 Refactored the entire Popup UI into React Components with Tailwind CSS v4, and added a `fix-db.ts` script to debug Clerk account sync in the Backend.
- [x] 2026-04-30 Localized the entire kapter-webapp dashboard UI to Vietnamese...
- [x] 2026-05-02 Hardened recording reliability: enabled socket auto-reconnect, implemented silent background token refresh via webapp tabs, and updated offscreen recorder to pause/resume during connection hiccups instead of aborting.
- [x] 2026-05-02 Hardened recording reliability: fixed race condition in auth refresh, added reconnection timeout to prevent hanging, and resolved memory leak in worker stream locks.
- [x] 2026-05-02 Started dual-lane capture groundwork by adding the implementation checklist, threading explicit `captureContext` through popup/background/offscreen start state, and preserving current Meet-only recording behavior while preparing for future generic-tab compatibility.
- [x] 2026-05-02 Tagged the existing offscreen chunk transport as `tab_mix` so the current recorder path is explicitly source-aware before a future Google Meet `self_mic` lane is added.
- [x] 2026-05-02 Refactored the offscreen recorder into named source runtimes, added a Meet-only `self_mic` capture lane with graceful fallback to `tab_mix`, and surfaced degraded microphone-capture state back into background/popup status.
- [x] 2026-05-02 Added a post-start `stream:ready` acknowledgement so the extension only announces recording started after the backend persists final degraded self-mic state for the active meeting.
- [x] 2026-05-02 Added Google Meet DOM mic-state detection in the content script and surfaced the local mute/unmute hint in extension status so capture no longer relies only on browser-level microphone availability checks.
- [x] 2026-05-02 Moved the Google Meet microphone permission prompt onto the popup start-click path, then added the `VITE_ENABLE_GOOGLE_MEET_DUAL_LANE_CAPTURE` rollout flag so internal testers can switch between dual-lane and tab-only baseline builds without touching the offscreen recorder code.
- [x] 2026-05-02 Replaced the ineffective popup/offscreen microphone preflight with a dedicated extension-tab permission request page, then made `START_CAPTURE` wait on that grant before launching the offscreen recorder so Meet dual-lane sessions can obtain persistent extension-origin mic access.
- [x] 2026-05-02 Replaced picker-based `getDisplayMedia()` tab audio capture with `chrome.tabCapture.getMediaStreamId()` for the active tab, so the actual captured surface now matches the validated Google Meet tab and recorder microphone capture can no longer stay enabled when a user accidentally shares a different tab.
- [x] 2026-05-02 Gated Meet `self_mic` startup on the latest detected Google Meet mute state, so sessions that start while the local Meet microphone button is muted now skip the recorder microphone permission/capture path and remain tab-audio only.
- [x] 2026-05-05 23:58 +07:00 Aligned the extension production env template with the deployed MVP topology so packaged builds can target the Vercel webapp origin and the Heroku backend for both REST auth preflight and Socket.IO capture transport.
- [x] 2026-05-09 Added extension-side quota preflight before recorder startup, cached quota status, popup quota visibility, and a disabled record state that links exhausted users to the Webapp Pricing page.
- [x] 2026-05-09 Relayed live Google Meet mic-state changes into the offscreen recorder and tear down queued/live `self_mic` capture immediately when the recorder mic becomes muted, preventing muted-recorder hallucination batches from reaching the worker.
- [x] 2026-05-09 Added a send-loop guard that drops any already-dequeued `self_mic` chunk before socket emission when the local Meet mic has flipped to muted, closing the last stale-queue path that could still leak recorder audio to the backend.
- [x] 2026-05-09 Tightened Google Meet mute-state detection to prefer explicit mute/unmute controls over generic microphone labels, so muted sessions no longer falsely start recorder `self_mic` capture from an `unknown` DOM match.
