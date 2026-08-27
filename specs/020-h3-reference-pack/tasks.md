# Tasks: Remote H3 Reference Capability Pack

## Phase 1: Contract and compiler foundation

- [x] T001 Add reviewed H3 Pack constraints and bounded resolution/seed intent fields in `packages/project-core/src/capability-pack.ts` and `packages/project-core/src/graph-intent.ts`.
- [x] T002 Add safe server-only frozen staging-name compilation context in `packages/project-core/src/graph-intent.ts` and `packages/project-core/src/capability-pack-planning-service.ts`.
- [x] T003 Add tests for H3 Pack rejection and graph context failures in `tests/unit/capability-pack.test.ts` and `tests/unit/graph-intent.test.ts`.

## Phase 2: Runtime contract validation

- [x] T004 Add bounded dynamic-option catalog normalization in `packages/comfyui-bridge/src/node-catalog.ts`.
- [x] T005 Add selected dynamic-input validation in `packages/comfyui-bridge/src/zero-call-graph-validator.ts`.
- [x] T006 Add complete H3 reference zero-call validation fixture in `tests/unit/zero-call-graph-evidence.test.ts`.

## Phase 3: Publish the first audited Pack

- [x] T007 Update the local administration template in `apps/project-web/components/capability-publication-panel.tsx`.
- [x] T008 Canonicalize, zero-call-preflight, publish, and read back the H3 Pack; record zero external calls in `specs/020-h3-reference-pack/quickstart.md`.
- [x] T009 Run format, lint, typecheck, focused tests, full tests, build, secret scan, and `git diff --check`; mark all tasks complete.
