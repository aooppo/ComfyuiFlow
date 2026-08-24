# Implementation Plan: Wan2.2 Stability Recovery

**Branch**: `codex/phase-0-discovery` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

## Summary

Add an immutable stable candidate beside the failed Wan2.2 workflow. Align its sampler with the
official ComfyUI 5B template, replace the abbreviated negative prompt with the reviewed official
quality exclusions plus identity safeguards, remove negative-style continuity sentences from the
positive prompt, and extend local status polling beyond the observed five-minute generation time.
Keep the same low-memory media profile for the first controlled comparison. Validate the candidate
with zero calls, then stop for a new exact authorization before one real attempt.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22; ComfyUI 0.33.2 on Python 3.11

**Primary Dependencies**: Existing Zod contracts, MCP bridge, FFmpeg/FFprobe, Wan2.2 TI2V 5B

**Storage**: Version-controlled workflow/registry; gitignored append-only run and media evidence

**Testing**: Vitest contract/integration tests plus native no-queue prompt validation

**Target Platform**: Apple M1 Pro, 32 GB unified memory, ComfyUI MPS

**Performance Goals**: Zero-call candidate validation; bounded polling for up to ten minutes; one
recovery submission only after authorization

**Constraints**: Preserve v1 bytes/hash and failed evidence; fixed installed models; no automatic
parameter sweep, fallback, retry, resubmission, or Human QA promotion

**Scale/Scope**: One additive workflow candidate, one prompt-compiler adjustment, polling bound,
tests, dry-run, and review-frame evidence

## Constitution Check

### Before research

- **I — Prove the Video Path First**: PASS. The work remains the single-shot feasibility path.
- **II — Separate Creative Intelligence from Generation**: PASS. Director output remains structured;
  the prompt compiler and workflow own generation translation.
- **III — Provider-Neutral Contracts and Honest Capabilities**: PASS. No provider identity changes or
  unsupported capability claims are introduced.
- **IV — Zero-Call Defaults and Bounded Live Execution**: PASS. All implementation and validation are
  zero-call; a real candidate still requires new exact one-call grants.
- **V — Durable Provenance and Verification**: PASS. The failed workflow and review remain immutable;
  the candidate has a new identity/hash and requires technical plus owner review.

### After design

PASS. The design is additive, keeps the failed baseline independently traceable, has no submission
path in reconciliation, and separates technical media validity from owner PASS.

## Project Structure

```text
workflows/
├── registry.json
├── wan22-ti2v-5b-dual-reference.api.json
└── wan22-ti2v-5b-dual-reference-stable.api.json

apps/spike-cli/src/index.ts
packages/spike-core/src/run-service.ts
tests/contract/wan22-workflow.test.ts
tests/integration/live-safety.test.ts

specs/003-wan22-stability-recovery/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/recovery-candidate.md
├── quickstart.md
└── tasks.md
```

## Implementation Sequence

1. Lock the failed v1 workflow/hash as a disabled baseline and add failing stable-candidate tests.
2. Add v2 with the official 20-step sampler profile, a new deterministic seed, and expanded
   negative quality exclusions while keeping 512x288, 33 frames, and 16 fps for memory safety.
3. Compile only positive scene/action/camera/composition fields into the positive prompt; keep
   negative constraints in the workflow negative encoder.
4. Increase bounded local polling to cover the observed 304-second runtime while preserving
   query-only reconciliation.
5. Run automated checks, live readiness, native no-queue validation, and exact asset dry-run with
   zero calls.
6. Stop for owner authorization. After a later single attempt, validate the artifact, create a
   first/middle/final contact sheet, and request append-only Human QA.

## Rollback

Disable v2 and re-enable v1 in the registry without changing either workflow file or historical
evidence. Prompt compiler and polling changes can be reverted independently. No data migration or
secret cleanup is required.

## Complexity Tracking

No constitution exception is required. A single controlled candidate is chosen instead of an
automatic parameter sweep because each extra generation would require separate owner authority.
