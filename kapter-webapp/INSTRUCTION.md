# Kapter Web Dashboard

## Module Overview

**Module name:** Kapter Web Dashboard

This module is the management client for Kapter, the AI meeting assistant.

It is a React + Vite dashboard that serves two distinct product roles:

- the authenticated user-facing dashboard for managing Kapter account state and future meeting review workflows
- the secure browser-side bridge used to transfer a Clerk session token into the Chrome Extension

Within the full Kapter system, this client sits between the human user and the backend orchestrator. It is responsible for authentication-aware UI, future meeting review UX, and browser-side flows that must happen in the same origin as the Clerk session.

## System Position

Inside the Kapter architecture, this module is the **management client**.

It must eventually support:

- user sign-in and sign-out through Clerk
- dashboard navigation for reviewing meetings, transcripts, and action items
- human-in-the-loop approval workflows before syncing tasks to Notion
- browser-side token bridging for the Chrome Extension

This module is **not** responsible for:

- capturing Google Meet audio
- streaming audio directly to the backend
- running AI inference
- writing directly to PostgreSQL

Those concerns belong to the extension, backend, and Python worker respectively.

## Tech Stack

- **Framework:** React 19
- **Bundler:** Vite
- **Language:** TypeScript
- **Routing:** React Router
- **Authentication:** Clerk via `@clerk/react-router`
- **Styling:** Tailwind CSS v4
- **UI primitives:** shadcn/ui with Radix-based components
- **Theme management:** custom client-side `ThemeProvider`

## Runtime Requirements

Current required client environment:

- `VITE_CLERK_PUBLISHABLE_KEY`

The app fails fast in the root layout if the Clerk publishable key is missing.

## Core Responsibilities

## 1. Authentication-Aware App Shell

The dashboard must provide the authenticated UI shell for Kapter users.

Target responsibility:

- wrap the app in `ClerkProvider`
- expose sign-in, sign-out, and current-user controls
- protect dashboard routes that require an authenticated Clerk session
- eventually coordinate authenticated API calls to the backend orchestrator

Current code status:

- `ClerkProvider` is mounted in the root layout
- sign-in, sign-out, and `UserButton` controls exist
- a `DashboardLayout` component exists for route protection
- the current router does not yet use `DashboardLayout`
- the dashboard page is still a placeholder

## 2. Extension Token Bridge

The webapp owns the browser-side bridge route that can mint a Clerk session token in first-party app context and relay it to the extension.

Target responsibility:

- expose a dedicated `/extension-bridge` route
- read the active Clerk session in the webapp origin
- post a short-lived token back to the extension via `window.postMessage`
- wait for acknowledgement from the extension before considering the handoff complete

Current code status:

- `/extension-bridge` route exists
- request/acknowledgement message flow exists
- the bridge route can call `getToken()` and return the token payload
- the bridge currently uses the default token path and does not yet request a dedicated Clerk JWT template

## 3. Dashboard UX For Human Review

The final product dashboard must support meeting review and approval.

Target responsibility:

- list recorded meetings
- show transcripts and diarized speaker segments
- let the user map AI speaker labels to real people
- show extracted summaries and action items
- allow approval before sending tasks to Notion

Current code status:

- meeting history and meeting detail routes exist
- transcript and speaker result UI exists
- editable summary and action item review UI exists on the meeting detail route
- meeting-level approval UX exists before future Notion sync
- project-context proposal apply/dismiss UI exists after meeting approval
- Notion sync result UI does not exist yet

## 4. Backend Client Integration

The web dashboard will eventually be the main consumer of the NestJS backend APIs.

Target responsibility:

- fetch authenticated user state from the backend
- fetch meeting lists and detail views
- submit approval or sync actions
- surface loading, error, and success states clearly

Current code status:

- API client layer exists for authenticated backend requests
- meeting data fetching hooks exist for history, active meeting, and detail views
- meeting review mutation APIs exist for saving artifacts, approving review, and applying or dismissing context proposals

## 5. Design System And Theming

The webapp is also the home of the current dashboard UI shell and component primitives.

Current design-system responsibilities:

- maintain Tailwind-based design tokens in `src/index.css`
- provide reusable UI primitives under `src/components/ui/`
- support light, dark, and system themes with local storage persistence

Current code status:

- `ThemeProvider` is implemented
- shared `Button` and `Card` primitives exist
- theme tokens and font setup exist in `src/index.css`

## Current Module Structure

Key directories and files:

- `src/main.tsx`
  - React entry point and theme provider bootstrap
- `src/App.tsx`
  - router host
- `src/routes/`
  - route table and route constants
- `src/layouts/root-layout.tsx`
  - Clerk provider and top-level app shell
- `src/layouts/dashboard-layout.tsx`
  - auth-gated layout component for dashboard content
- `src/pages/landing/`
  - public landing page
- `src/pages/dashboard/`
  - current placeholder dashboard
- `src/pages/extension-bridge/`
  - secure extension handoff route
- `src/components/theme-provider.tsx`
  - client-side theme state and keyboard shortcut behavior
- `src/components/ui/`
  - shared UI primitives
- `src/lib/utils.ts`
  - utility helpers such as class name merging

## Current Route Map

Current routes:

- `/`
  - public landing page
- `/dashboard`
  - placeholder authenticated dashboard destination
- `/extension-bridge`
  - extension token handoff route

Important note:

- the route table currently mounts `Dashboard` directly and does not yet wrap it with `DashboardLayout`

## Current Implementation Snapshot

Implemented now:

- Vite + React + TypeScript scaffold
- React Router setup
- Clerk provider integration
- root app shell with sign-in/sign-out controls
- theme provider and design tokens
- shared button/card primitives
- extension bridge route with request and acknowledgement flow
- dashboard meeting history and active-session views
- meeting detail view with transcript, speakers, editable extraction review, approval, and project-context proposal review

Not implemented yet:

- speaker mapping UX
- Notion sync UX
- polished brand copy, app metadata, and production-ready shell text

## MVP Constraints

This client must respect the main Kapter MVP boundaries:

- Clerk is the only authentication provider
- the dashboard is the human review surface, not the AI worker
- Google Meet is the only supported capture platform
- Notion is the only supported task destination
- do not introduce Zoom, Teams, Jira, Trello, or unrelated product flows unless explicitly requested

## Guidance For Future Work

When extending this module:

- keep UI concerns in the webapp and orchestration concerns in the backend
- use Clerk as the only user identity source
- avoid leaking extension-specific concerns into general dashboard pages unless they are part of the auth bridge flow
- build feature pages around the actual Kapter workflow: meeting review, speaker mapping, action-item approval, Notion sync
- keep React Router structure clear and route responsibilities explicit
- prefer reusable UI primitives and feature-specific components over ad hoc page markup

## Useful Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm typecheck
```

## Source Of Truth Rule

If future notes, plans, or branches conflict with this file, verify the actual code in `kapter-webapp/` before changing behavior. This document should track the real implemented state of the dashboard client, not only the intended product direction.
