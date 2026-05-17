# Test Validation Report

Generated: 2026-05-17T07:48:14.964Z | Mode: local | Branch: sondoannam/feat/improve-wf | Commit: ed06c2f332995e233105e52ff772d554d364e763

## Summary

| Module | Status | Automated Tests | Inventory | Gaps |
| --- | --- | --- | --- | --- |
| kapter-backend | passed | yes | 26 files / 105 cases | none |
| kapter-webapp | passed | no | 0 files / 0 cases | no automated tests, manual-only |
| kapter-extension | passed | yes | 2 files / 3 cases | none |
| kapter-ai-worker | passed | yes | 6 files / 37 cases | none |

## Workspace Preconditions

- `build-contracts`: passed (1.29s)
  Command: `pnpm --filter @kapter/contracts build`
  Log: `reports/tests/logs/latest/workspace-build-contracts.log`

## Module Details

### kapter-backend

- Validation posture: lint + typecheck + build + automated specs
- Inventory: 26 files / 105 cases (node-test-compiled)
- Notes: Compiled Node test runner via kapter-backend/scripts/run-tests.mjs.
- CI: Backend CI enforces lint, typecheck, build, and test.
- Gaps: none

| Command | Kind | Status | CI | Duration |
| --- | --- | --- | --- | --- |
| lint | lint | passed | enforced | 4.74s |
| typecheck | typecheck | passed | enforced | 2.42s |
| build | build | passed | enforced | 4.01s |
| test | test | passed | enforced | 17.25s |

### kapter-webapp

- Validation posture: lint + typecheck + build + manual feature validation
- Inventory: 0 files / 0 cases (none)
- Notes: No automated frontend tests are configured; validation relies on lint, typecheck, build, and manual feature checks.
- CI: Webapp CI enforces lint, typecheck, and build only.
- Gaps: no automated tests, manual-only

| Command | Kind | Status | CI | Duration |
| --- | --- | --- | --- | --- |
| lint | lint | passed | enforced | 6.02s |
| typecheck | typecheck | passed | enforced | 300ms |
| build | build | passed | enforced | 8.14s |

### kapter-extension

- Validation posture: lint + typecheck + build + auth spec + packaging test
- Inventory: 2 files / 3 cases (node-test-direct)
- Notes: Direct Node test runner for the auth spec plus packaging verification.
- CI: Extension CI enforces lint, typecheck, build, auth test, and packaging test.
- Gaps: none

| Command | Kind | Status | CI | Duration |
| --- | --- | --- | --- | --- |
| lint | lint | passed | enforced | 2.11s |
| typecheck | typecheck | passed | enforced | 1.28s |
| build | build | passed | enforced | 3.96s |
| test | test | passed | enforced | 298ms |
| test-package | test | passed | enforced | 290ms |

### kapter-ai-worker

- Validation posture: automated pytest regressions and endpoint tests
- Inventory: 6 files / 37 cases (pytest-wrapper)
- Notes: Pytest regression and endpoint tests via kapter-ai-worker/scripts/run_tests.py.
- CI: AI worker CI enforces the maintained pytest suite.
- Gaps: none

| Command | Kind | Status | CI | Duration |
| --- | --- | --- | --- | --- |
| test | test | passed | enforced | 7.18s |

