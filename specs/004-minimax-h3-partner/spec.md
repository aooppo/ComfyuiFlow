# Feature Specification: Replace Wan with MiniMax H3 Partner Node

**Feature Branch**: `004-minimax-h3-partner`

**Created**: 2026-08-24

**Status**: Complete

**Input**: User description: "Delete the locally deployed Wan model and use the ComfyUI MiniMax H3 Partner Node."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Generate a reference-conditioned H3 shot (Priority: P1)

As the project owner, I want the active video workflow to use the hosted MiniMax H3
reference-to-video capability with my character and scene images, so that short advertising shots
can be generated without maintaining local Wan weights or renting a GPU.

**Why this priority**: This replaces the failed local generation path and is the prerequisite for
all future paid video work.

**Independent Test**: A zero-cost preview identifies one enabled H3 workflow, has no local model
requirements, accepts two distinct reference images and a prompt, and reports its bounded output
profile without contacting a generation provider.

**Acceptance Scenarios**:

1. **Given** two distinct reference images and the H3 Partner Node is available, **When** the owner
   requests a dry-run, **Then** the system selects the enabled H3 reference workflow and reports
   zero external/provider calls.
2. **Given** an H3 workflow is selected, **When** its readiness is checked, **Then** it reports no
   local model as required and identifies any unavailable Partner Node or local service clearly.
3. **Given** a future live generation is authorized, **When** it is submitted, **Then** the two
   reference images remain distinct, the prompt identifies them by ordered reference, and the saved
   H3 video is retained as the declared workflow artifact.

---

### User Story 2 - Remove retired Wan runtime assets (Priority: P2)

As the project owner, I want the three locally installed Wan runtime weights removed after the H3
workflow has passed readiness checks, so that local storage is reclaimed and the retired model is
not mistaken for the active generation path.

**Why this priority**: The local Wan deployment is no longer an intended execution option.

**Independent Test**: The exact three Wan artifact paths no longer exist, while the active H3
workflow continues to pass its no-generation readiness check.

**Acceptance Scenarios**:

1. **Given** H3 readiness passes with zero generation calls, **When** the migration is completed,
   **Then** only the documented Wan diffusion, VAE, and text-encoder files are removed.
2. **Given** existing historical Wan specifications and evidence, **When** cleanup occurs, **Then**
   historical evidence remains available and no unrelated ComfyUI files or user assets are deleted.

---

### User Story 3 - Make paid-use prerequisites explicit (Priority: P3)

As the project owner, I want the project to explain the ComfyUI account, credits, and approval
requirements before a live H3 task can run, so that no paid generation is started accidentally.

**Why this priority**: H3 Partner Node generation is prepaid and externally billed.

**Independent Test**: The validation guide distinguishes a free readiness check from a paid live
generation and lists the required owner actions.

**Acceptance Scenarios**:

1. **Given** the owner has not logged into ComfyUI or purchased credits, **When** a live task is
   attempted, **Then** the project does not claim that a paid H3 generation is ready.
2. **Given** the owner has completed ComfyUI setup, **When** a live task is planned, **Then** one
   explicit, single-use authorization remains required before submission.

### Edge Cases

- The H3 Partner Node is absent or disabled even though the local ComfyUI service responds.
- The owner is not authenticated with ComfyUI or has insufficient Comfy Credits.
- One reference image is missing, identical to the other, or outside the H3 image constraints.
- A paid H3 task returns technical success but the video is visually or aurally unusable.
- A historical Wan workflow or specification remains on disk but is no longer selectable for a
  generation request.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST register exactly one enabled hosted MiniMax H3 reference-to-video
  workflow as the active video-generation option.
- **FR-002**: The active workflow MUST accept a character image, a scene image, and a positive
  prompt as two ordered reference images and one text instruction.
- **FR-003**: The active workflow MUST use a fixed 768P, 9:16, 24-frames-per-second, five-second
  preview profile, with a permitted duration range of four through fifteen seconds.
- **FR-004**: The active workflow MUST have no local model-weight dependency and MUST save one
  video artifact through the normal ComfyUI output mechanism.
- **FR-005**: The project MUST remove retired Wan workflows from the selectable registry and delete
  only the three documented local Wan weight files after H3 readiness succeeds.
- **FR-006**: The project MUST preserve historical Wan specifications and prior-run evidence as
  immutable records; they MUST NOT be advertised as active generation choices.
- **FR-007**: Dry-run and readiness checks MUST make zero provider and generation calls.
- **FR-008**: A live H3 execution MUST retain the existing single-use authorization gate and MUST
  not automatically retry, resubmit, or substitute another provider on failure.
- **FR-009**: The validation documentation MUST state that ComfyUI account login and prepaid
  credits are owner-managed prerequisites, not project configuration values.

### Key Entities

- **H3 Workflow Manifest**: The reviewed, hash-locked active workflow and its supported bounds.
- **H3 Partner Job**: A single authorized ComfyUI submission that may consume Comfy Credits and
  yields a saved video artifact.
- **Retired Wan Asset Set**: The three identified local weight files eligible for deletion after
  readiness succeeds.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A dry-run with two distinct image inputs completes with zero provider calls and zero
  generation submissions.
- **SC-002**: The active workflow readiness result has no missing node classes, no missing local
  models, no binding errors, and zero generation calls.
- **SC-003**: The three defined Wan weight files are absent after cleanup, reclaiming at least
  18,145,000,000 bytes, without deleting any other files from the local ComfyUI installation.
- **SC-004**: Every attempted H3 live generation remains limited to one explicitly authorized
  submission and produces either a retained video artifact or a persisted failure result.

## Assumptions

- The current local ComfyUI installation remains accessible on loopback and continues to include
  the MiniMax H3 Partner Node and Save Video node verified on 2026-08-24.
- The owner will independently log in to ComfyUI and buy credits before requesting a live H3 run;
  this migration does not purchase credits, submit media, or generate a video.
- The first production candidate uses the two existing role-specific image inputs; reference video,
  reference audio, Context IR, and 2K regeneration are intentionally out of scope.
- Existing Wan specifications are retained as historical evidence, but their generated workflow
  JSON files and registry entries are retired from the execution path.
