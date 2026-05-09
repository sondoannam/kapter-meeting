# Kapter Web Dashboard Checkpoint

Last updated: 2026-04-29

This file is the state tracker and todo list for `kapter-webapp/`.

It reflects the current implementation state of the dashboard client based on the code that exists today.

## Current Module Status

- [x] Vite React client scaffold exists and builds.
- [x] React Router is wired into the app entry.
- [x] Clerk is integrated at the root layout level.
- [x] Theme system and shared UI primitives exist.
- [x] Extension token bridge route exists.
- [x] The first management dashboard workflow is implemented with an active-session monitor and meeting history list. (2026-04-21)
- [x] The dashboard now integrates with backend meeting detail data for one-meeting review and live processing visibility. (2026-04-22)
- [x] The dashboard now supports Notion workspace connection status plus per-project destination setup for the foundation phase. (2026-04-25)
- [x] The landing and dashboard now expose extension testing setup guidance with an optional direct download URL for non-marketplace installs. (2026-04-25)
- [x] Meeting summary/action-item review, meeting-level approval, and project-context proposal review UX are implemented on the meeting detail page. (2026-04-26)
- [x] Meeting review now includes a Try again action that requests backend LLM re-extraction for unapproved meetings. (2026-04-26)
- [x] Meeting detail now keeps polling while extraction review status is `PENDING`, so background retries complete without leaving the page stale after the initial request returns. (2026-04-26)
- [x] Meeting detail now uses a redesigned split workspace with transcript, review, workflow, project-memory, and Notion sync operations separated into dedicated panels on desktop and tabs on mobile. (2026-04-29)
- [x] Comprehensive dashboard UI/UX overhaul completed: new design tokens (Tailwind v4), separated Landing/Dashboard layouts, and 100% Vietnamese localization. (2026-04-30)
- [x] Redesigned MetricGrid, SessionCard (polling), and split-view Meeting/Project panels for a cleaner management experience. (2026-04-30)
- [x] Integrated Zustand for global app state (theme, active project). (2026-04-30)
- [x] Fixed dashboard redesign review regressions from `fix.md`: sidebar counts now use API-backed stats, and the active-session banner restores detail navigation plus meeting/review badges. (2026-04-30)
- [x] Addressed review performance note by calculating dashboard sidebar meeting stats in one pass instead of multiple filters. (2026-04-30)
- [x] Corrected dashboard review count so failed extraction meetings are no longer included in the sidebar "Chờ duyệt" total. (2026-04-30)
- [x] Made dashboard sidebar status counts mutually exclusive so active processing meetings cannot also count as review or approved work. (2026-04-30)
- [x] Fixed dashboard light/dark visual regressions from `fix.md` by adding dashboard token aliases, component hover/active states, semantic status colors, and corrected dashboard filter typing. (2026-04-30 22:20 +07:00)
- [x] Reworked the main dashboard layout with existing shadcn/ui primitives for a clearer two-column operations view, shadcn cards/buttons/inputs/selects/badges, and corrected metric-driven filtering. (2026-05-01 07:21 +07:00)
- [x] Addressed dashboard review notes by making metric cards native buttons and adding refresh loading/error feedback to the meeting list panel. (2026-05-01 07:45 +07:00)
- [x] Added a shared animated loading screen for dashboard auth and meeting-detail hydration, using existing Kapter tokens plus reduced-motion fallbacks. (2026-05-01 21:23 +07:00)
- [x] Meeting detail now supports direct Notion OAuth connection back to the current meeting and manual sync of approved action items to Notion from the same review surface. (2026-05-02 16:36 +07:00)
- [x] Addressed review feedback by keeping meeting-detail Notion connection failures local to the sync card instead of also setting page-level error state. (2026-05-02 17:51 +07:00)
- [x] Meeting-detail Notion sync now matches the backend auto-create destination behavior and shows the real task queue before/after sync. (2026-05-04 21:13 +07:00)

## Phase 1: Project Scaffolding

Status: completed.

- [x] Vite + React + TypeScript project scaffold exists.
- [x] Tailwind CSS v4 is configured.
- [x] shadcn/ui configuration exists.
- [x] path alias `@` is configured in Vite.
- [x] `App.tsx` hosts the router.
- [x] `main.tsx` mounts the app with `StrictMode`.
- [x] theme provider is wired globally.
- [x] shared `Button` UI primitive exists.
- [x] shared `Card` UI primitive exists.
- [x] lint, build, and typecheck scripts exist in `package.json`.

## Phase 2: Authentication And App Shell

Status: in progress.

- [x] `ClerkProvider` is mounted in `src/layouts/root-layout.tsx`.
- [x] app shell exposes sign-in and sign-out actions.
- [x] `UserButton` is present in the root shell.
- [x] `VITE_CLERK_PUBLISHABLE_KEY` is required by the app.
- [x] a `DashboardLayout` auth guard component exists.
- [x] `DashboardLayout` is mounted in the router for `/dashboard`.
- [x] the root header is branded for Kapter.
- [x] the root shell now includes a shared light/dark theme toggle with persisted preference. (2026-04-21)
- [x] theme toggle is now a polished 2-segment pill ("Sáng | Tối") with persistent state. (2026-04-30)
- [x] route-level loading and auth fallback UX are minimal.
- [x] dashboard auth and meeting-detail entry states now share a branded animated loading screen with reduced-motion support. (2026-05-01 21:23 +07:00)

## Phase 3: Public Landing And Navigation

Status: in progress.

- [x] public landing page route exists at `/`.
- [x] dashboard route exists at `/dashboard`.
- [x] extension bridge route exists at `/extension-bridge`.
- [x] landing page now presents Kapter-specific positioning and workflow instead of placeholder copy. (2026-04-21)
- [x] landing page CTA now routes signed-in users to `/dashboard` and signed-out users through Clerk sign-in. (2026-04-21)
- [x] app metadata now uses Kapter title, description, and favicon instead of the Vite defaults. (2026-04-21)
- [x] landing page now includes a branded footer section that reinforces product scope and navigation anchors. (2026-04-21)
- [x] navigation structure for real dashboard workflows exists via a new responsive Sidebar. (2026-04-30)

## Phase 4: Extension Auth Bridge

Status: in progress.

- [x] `/extension-bridge` page exists.
- [x] bridge page reads `requestId` from query params.
- [x] bridge page checks Clerk session state before sending a token.
- [x] bridge page posts a token payload back to the page context.
- [x] bridge page waits for extension acknowledgement.
- [x] bridge UI includes loading, sign-in, success, and error states.
- [x] bridge token flow can request a dedicated Clerk JWT template when configured.
- [ ] bridge token refresh policy is not implemented beyond the basic handoff.
- [ ] bridge flow is not yet connected to a full meeting hand-off route such as opening the correct detail page automatically after stop.

## Phase 5: Dashboard Product Workflows

Status: in progress.

- [x] meeting list page is implemented with backend data and status badges. (2026-04-21)
- [x] meeting detail page is implemented with transcript, speakers, and processing-progress cards. (2026-04-22)
- [x] dashboard project cards now support Notion connection status, shared-page search, and project destination setup directly from `/dashboard`. (2026-04-25)
- [ ] transcript viewer is not implemented.
- [ ] speaker mapping UI is not implemented.
- [x] summary review UI is implemented on meeting detail. (2026-04-26)
- [x] action item review UI is implemented on meeting detail with task status, assignee, deadline, add, and remove controls. (2026-04-26)
- [x] approval-before-sync UX is implemented as meeting-level review approval. (2026-04-26)
- [x] Notion sync result UX is implemented on the redesigned meeting detail page with readiness states, manual sync, and result feedback. (2026-04-29)
- [x] Dashboard workspace refactored from a single ResizablePanel into a modern grid with dedicated MeetingPanel and ProjectPanel. (2026-04-30)
- [x] MetricGrid redesigned with 4-column horizontal layout and active filtering states. (2026-04-30)
- [x] SessionCard updated to support real-time recording pulse and 5s polling. (2026-04-30)

## Phase 6: Backend Integration

Status: in progress.

- [x] API client layer exists for auth session lookups.
- [x] typed integration with backend auth endpoints exists for `GET /api/auth/me`.
- [x] axios-backed meeting fetch hooks exist for `GET /api/meetings` and `GET /api/meetings/active`. (2026-04-21)
- [x] axios-backed meeting detail hook exists for `GET /api/meetings/:meetingId` with live polling for in-progress meetings. (2026-04-22)
- [ ] no error boundary or API error handling strategy exists.
- [x] loading skeleton strategy exists for the active-session banner and meeting history list. (2026-04-21)
- [x] loading and error states now exist for the meeting detail route. (2026-04-22)
- [x] Global ErrorBanner implemented for dashboard-level network failures. (2026-04-30)
- [x] Meeting detail and active-session surfaces now show capture mode, active audio lanes, and degraded recorder-mic state from backend meeting APIs. (2026-05-02)

## Phase 7: Quality And Production Readiness

Status: pending.

- [x] ESLint flat config explicitly pins `tsconfigRootDir` for monorepo-safe TSX parsing. (2026-04-21)
- [x] theme state is now restricted to explicit light/dark modes instead of the previous hidden system-mode behavior. (2026-04-21)
- [x] theme toggle now uses a smooth sliding segmented-control animation instead of abrupt active-state swapping. (2026-04-21)
- [ ] no frontend test setup exists.
- [ ] no route protection verification beyond the simple auth check component exists.
- [ ] no accessibility review has been done for dashboard workflows.
- [ ] no production-ready copy pass has been done.
- [ ] no analytics or product instrumentation exists.

## Highest-Weight Files Right Now

- [x] `src/main.tsx`
- [x] `src/App.tsx`
- [x] `src/routes/routes.tsx`
- [x] `src/routes/routes.constants.ts`
- [x] `src/layouts/root-layout.tsx`
- [x] `src/layouts/dashboard-layout.tsx`
- [x] `src/pages/landing/index.tsx`
- [x] `src/pages/dashboard/index.tsx`
- [x] `src/pages/extension-bridge/index.tsx`
- [x] `src/components/theme-provider.tsx`
- [x] `src/components/ui/button.tsx`
- [x] `src/components/ui/card.tsx`
- [x] `src/index.css`

## Known Gaps

- [x] the current dashboard page is now a first meeting-management workspace with an active-session banner and meeting history list. (2026-04-21)
- [x] the public landing page now communicates the Google Meet -> review -> Notion flow with Kapter-specific copy and CTAs. (2026-04-21)
- [x] there is now a client-side feature structure for meetings API calls, hooks, formatting, and dashboard components. (2026-04-21)

## Suggested Next Webapp Priorities

- [x] replace the auth verification dashboard with the first real meeting-management view.
- [x] replace placeholder landing copy with Kapter-specific UX. (2026-04-21)
- [x] add a meeting-centered route structure. (2026-04-22)
- [x] add a typed backend API client layer.
- [x] implement meeting review pages for transcript, extracted summary, and action items. (2026-04-26)
- [x] implement the approval flow before Notion sync. (2026-04-26)
- [x] implement Notion sync result UX after backend sync execution exists. Completed with backend sync action, auto-create destination handling, and visible task sync states on the meeting detail page. (2026-05-04 21:13 +07:00)

## Progress Log

- [x] 2026-04-18 Protected `/dashboard` with `DashboardLayout`, branded the app shell for Kapter, and added the first typed backend auth lookup so the dashboard now verifies Clerk-to-backend user sync through `GET /api/auth/me`.
- [x] 2026-04-18 Updated the extension bridge to request a dedicated Clerk JWT template when `VITE_CLERK_EXTENSION_TOKEN_TEMPLATE` is configured, while preserving the default-token fallback for local development.
- [x] 2026-04-20 Added repo-level `@contracts` alias plumbing so future dashboard meeting pages can import the shared backend contract surface from `libs/contracts/typescript` instead of re-declaring meeting models locally.
- [x] 2026-04-21 Removed the temporary sibling-source alias workaround in preparation for consuming shared contracts through the real workspace package boundary at `@kapter/contracts`.
- [x] 2026-04-21 Validated the webapp against the new root workspace layout: it now builds cleanly from the repo root without the old sibling-source contract wiring, while shared-contract consumption remains deferred until the dashboard imports `@kapter/contracts` directly.
- [x] 2026-04-21 Replaced the placeholder dashboard with the first real meeting workspace, added an axios-backed webapp API client plus meeting hooks, and surfaced the backend meeting history and active capture monitor inside `/dashboard`.
- [x] 2026-04-21 Fixed the webapp ESLint flat config so `typescript-eslint` resolves `tsconfigRootDir` to `kapter-webapp` instead of guessing across monorepo packages.
- [x] 2026-04-21 Replaced the public placeholder page with a Kapter-specific landing experience, upgraded the route-aware app shell, and removed the last Vite-branded browser metadata from the webapp.
- [x] 2026-04-21 Corrected dark-theme contrast on light landing and header surfaces so hard-coded light panels no longer inherit white token text.
- [x] 2026-04-21 Simplified the theme system to explicit light/dark modes and added a polished shared toggle in the root shell for both landing and dashboard views.
- [x] 2026-04-21 Tuned the active-session and meeting-history widgets for dark mode, added a landing footer, and upgraded the theme toggle to a smooth sliding segmented control.
- [x] 2026-04-21 Replaced the root starter-template README with real Kapter monorepo setup instructions, then updated it again to document the full local teammate workflow where each machine runs Postgres, worker, backend, dashboard, and extension locally.
- [x] 2026-04-22 Added `/dashboard/meetings/:meetingId`, wired dashboard list and active-session widgets into that route, and built the first meeting detail experience with live polling for transcript/speaker processing results while LLM extraction is still pending.
- [x] 2026-04-23 Upgraded the meeting detail transcript feed to render speaker-aligned sentence turns by merging persisted transcript fragments on read, while surfacing merged-turn counts instead of raw word-level rows.
- [x] 2026-04-25 Added dashboard project creation and project-list management on `/dashboard`, so users can seed reusable capture context before the later review and Notion phases.
- [x] 2026-04-25 Added dashboard Notion setup UX with connection status, callback feedback, shared-page selection, and per-project destination configuration.
- [x] 2026-04-25 Added a landing-page extension setup section, optional `VITE_EXTENSION_TEST_BUILD_URL` download support, and dashboard/header links so testers can install the unpacked extension before Chrome Web Store release.
- [x] 2026-04-26 Added editable meeting extraction review on the detail page, including summary edits, action-item edits, task status, meeting approval, project ownership display, extraction error visibility, and apply/dismiss controls for pending project-context proposals.
- [x] 2026-04-26 Added a Try again control to the meeting review panel so users can manually rerun LLM extraction before approving artifacts.
- [x] 2026-04-26 Updated the meeting detail hook and review panel so background extraction retries poll automatically and do not present a stale 524-style failure as if the retry itself had failed.
- [x] 2026-04-28 Added read-only chunked extraction progress to the meeting detail review panel so pending meetings now show backend artifact-processing state until final summary and action items are materialized.
- [x] 2026-04-28 Added a webapp GitHub Actions workflow that installs workspace dependencies, rebuilds shared contracts, runs lint/typecheck/build, and uploads the generated `dist/` bundle as a short-lived CI artifact.
- [x] 2026-04-29 Started the staged meeting-detail workflow implementation with a workflow rail, a combined save-and-approve review action, and a manual Notion sync panel driven from meeting-level sync-readiness data.
- [x] 2026-04-29 Replaced the old meeting detail screen with a new split transcript-review-operations workspace under `src/components/meeting-detail`, preserving the existing hook contract while adding desktop resizable panels, mobile tabs, project-memory actions, and Notion sync result feedback.
- [x] 2026-04-29 Reworked the new meeting detail hierarchy so review is now the primary desktop canvas, the overview is compressed into a compact signal strip, transcript moved into a bounded secondary reference section, and the operations rail became a supporting side panel instead of a peer workspace.
- [x] 2026-04-29 Corrected the first redesign pass after visual review by switching the page to a true review-first stack: compact header, full-width review workspace, and a lower secondary row for support controls and transcript evidence instead of competing side-by-side primaries.
- [x] 2026-04-30 Redesigned the main Dashboard UI/UX: migrated to a custom Tailwind v4 design system, implemented separated Landing/Dashboard layouts, and localized all navigation to Vietnamese.
- [x] 2026-04-30 Refactored DashboardWorkspace into a cleaner grid-based layout with a new MetricGrid, SessionCard (with 5s polling), MeetingPanel (with search/filter), and ProjectPanel (with system status table).
- [x] 2026-04-30 Integrated Zustand for centralized theme and project state management, and resolved missing dependency/import issues during the migration.
- [x] 2026-04-30 Created DashboardTopNav and DashboardSidebar components with full responsiveness (mobile drawer/tablet icons/desktop rail).
- [x] 2026-04-30 Fixed dashboard review regressions from `fix.md`: sidebar counts now use real meeting/project API data, and the active-session banner restores meeting-detail navigation, status badges, backend snapshot details, and error feedback.
- [x] 2026-04-30 Optimized `useStats()` so sidebar processing/review/approved counts are computed in a single pass over meeting history.
- [x] 2026-04-30 Corrected `useStats()` review logic so only `READY` meetings count as "Chờ duyệt"; `FAILED` extraction results are no longer presented as actionable review work.
- [x] 2026-04-30 Updated `useStats()` to prioritize primary `RECORDING`/`PROCESSING` status before artifact review status, keeping sidebar status totals mutually exclusive.
- [x] 2026-05-01 Replaced the plain dashboard auth fallback and meeting-detail skeleton entry with a shared cinematic loading screen that reuses Kapter tokens, animated signal cards, and reduced-motion-safe CSS.
- [x] 2026-05-02 Added meeting-detail Notion connection entry point with return-to-meeting OAuth plus the existing approved-action-item sync action in the Notion sync card.
- [x] 2026-05-02 17:51 +07:00 Simplified meeting-detail Notion connection error handling so card-local UI owns connection failures without duplicating global route error state.
- [x] 2026-05-02 Added capture-mode and degraded-lane indicators to the active-session banner and meeting detail overview so Meet dual-lane diagnostics are visible in the dashboard.
- [x] 2026-05-02 Added transcript provenance pills and merge-flag visibility to the meeting detail evidence panel so manual dual-lane review can see self-mic versus tab-mix segments and overlap decisions.
- [x] 2026-05-03 Added first-pass `i18next`/`react-i18next` infrastructure with local `vi/en` catalogs, a persistent language switcher, and translated landing plus shared shell surfaces for manual validation.
- [x] 2026-05-03 Extended the i18n rollout across dashboard, meeting-detail, transcript, loading, and extension-bridge surfaces, and switched meeting/date formatting to follow the active app locale.
- [x] 2026-05-04 21:13 +07:00 Updated the meeting-detail Notion sync card so webapp sync no longer requires a preconfigured destination, reflects backend auto-creation, and displays each approved task's sync state.
- [x] 2026-05-05 23:58 +07:00 Added Vercel SPA deployment support with `kapter-webapp/vercel.json` and corrected the webapp env contract docs to use `VITE_API_URL` for the deployed backend origin.
- [x] 2026-05-05 23:58 +07:00 Updated the shared webapp Axios client to prefer `VITE_API_URL` while keeping `VITE_BACKEND_URL` as a backward-compatible fallback for older local env files.
- [x] 2026-05-09 Added a public `/pricing` page with authenticated quota usage, plan cards from the backend billing API, and dashboard/sidebar navigation into the subscription surface.
- [x] 2026-05-09 Added webapp-side project patch and meeting metadata patch wiring in the feature types, API clients, and auth-aware hooks so upcoming edit UX can reuse the new backend services without duplicating mutation logic.
- [x] 2026-05-09 Moved dashboard meeting/project API DTOs to `@kapter/contracts`, converted webapp feature type modules into shared-contract re-export surfaces, and fixed the meeting-detail delete hint to use `projectTitle` instead of the stale nested `project` shape.
- [x] 2026-05-09 Added dialog-based project brief editing on the dashboard and meeting metadata editing on the meeting detail overview, backed by project-detail prefill and a passing `pnpm --filter webapp typecheck` validation.
- [x] 2026-05-09 19:02 +07:00 Added dashboard meeting deletion, meeting-detail deletion, and a two-step project delete flow that warns about cascading linked-meeting removal before final confirmation.
- [x] 2026-05-09 Replaced `useState`-driven project and meeting form drafts with shared `react-hook-form` + `zod` schemas, collapsed the dashboard project editor to name/description/context, and validated with passing `pnpm --filter webapp typecheck` and `pnpm --filter webapp lint`.
- [x] 2026-05-09 Added dashboard-side project deletion wiring and a confirmation dialog that only allows empty projects to be removed, while explaining linked-meeting blockers before users trigger a destructive action.
- [x] 2026-05-09 Removed the dashboard project-management accordion bottleneck by keeping project actions always visible, moving project creation into a dialog, and standardizing remaining direct app-level form controls onto shadcn `Input`/`Textarea`/`Select` primitives with a passing `pnpm --filter webapp typecheck` validation.
- [x] 2026-05-09 Fixed the RHF/Zod review-form typing regressions in meeting detail and resolved Vite dev startup by deduping `zod` from the webapp root package, with passing typecheck, lint, and forced `pnpm dev --force` startup validation.
- [x] 2026-05-09 Consolidated the dashboard into one desktop-first hybrid project list by promoting `ProjectPanel` into the only project surface with selection, create/edit/delete dialogs, Notion actions, and inline destination setup, then removed the old duplicate project list components with passing `pnpm --filter ./kapter-webapp typecheck` and `pnpm --filter ./kapter-webapp lint`.
- [x] 2026-05-09 Split dashboard project setup away from the compact project list by moving creation and Notion destination controls into a dedicated top setup section, trimming row content for the narrow rail, and bounding the list with a scroll area, validated by passing `pnpm --filter ./kapter-webapp typecheck` and `pnpm --filter ./kapter-webapp lint`.
- [x] 2026-05-09 Moved the project creation and Notion setup surface to a full-width section directly below the four dashboard metric cards, keeping the right rail focused on project selection plus edit/delete actions, validated by passing `pnpm --filter ./kapter-webapp typecheck` and `pnpm --filter ./kapter-webapp lint`.
