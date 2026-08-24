# Feature Specification: DECOROLALA H3 Live Validation

## Requirement revision: shortest-cost validation first (2026-08-24)

The owner replaced the next 15-second validation attempt with a request for a 2-second feasibility
clip to reduce waste. The installed H3 node accepts only 4–15 seconds, so the executable validation
target is the minimum supported 4 seconds. The 15-second workflow and prompt remain immutable,
disabled history and MUST NOT be selected or submitted during this validation iteration.

The short clip validates only simultaneous character, product, scene, prop, and visual-stability
retention in one restrained continuous shot. It does not attempt the full walk, glass placement,
product-only hero cut, or sofa-seating story.

**Feature Directory**: `specs/005-h3-live-validation`
**Created**: 2026-08-24
**Status**: Approved for zero-call implementation; LIVE submission pending exact action-time confirmation
**Input**: The owner confirmed the Comfy account is signed in and funded with USD 10, asked to continue validation/development, and designated Codex task `01a02ebc-67e5-7b11-bc70-597ee151ffb5` as the source for the video prompt and reference images.

## User Scenarios & Testing

### User Story 1 - Prepare the exact five-reference advertisement (Priority: P1)

As the owner, I can preview a hash-locked 15-second DECOROLALA coffee-table advertisement using
the designated scene, product, and three Lady LaLa identity references without uploading or
spending credits.

**Why this priority**: The current two-reference workflow cannot faithfully represent all approved
product and character sources, while the installed H3 node supports up to nine ordered images.

**Independent Test**: A dry-run reports five distinct ordered assets, the product-specific workflow
hash, 768P portrait 15-second profile, the approved H3 full-reference prompt, and zero provider and
generation calls.

**Acceptance Scenarios**:

1. **Given** the five designated files, **When** the request is prepared, **Then** their roles are
   fixed as Image 1 scene, Image 2 product, Image 3 full-body character, Image 4 face identity, and
   Image 5 rear/side identity.
2. **Given** the approved 15-second storyboard, **When** the H3 prompt is compiled, **Then** it
   preserves the single red-wine-glass state transition, the exact coffee-table design, Lady LaLa
   identity/wardrobe, the final sofa pose, and no generated text or logo.
3. **Given** the local H3 node, **When** readiness is checked, **Then** all five bindings, workflow
   hash, node classes, and output path pass with zero generation calls.

---

### User Story 2 - Execute at most one paid H3 generation (Priority: P1)

As the owner, I can approve the exact prepared scope immediately before external upload/submission,
after which the system submits at most once and never retries or substitutes another provider.

**Why this priority**: A real H3 result is the remaining Phase 0.5 feasibility gate and consumes
prepaid credits irreversibly.

**Independent Test**: Without action-time confirmation, no grants, uploads, or calls occur. With a
fresh exact confirmation and grants, execution consumes authorization before at most one Director
request and one H3 submission, preserving a durable task identity.

**Acceptance Scenarios**:

1. **Given** account login and purchased credits, **When** exact request confirmation is still
   absent, **Then** the system performs no external upload or paid submission.
2. **Given** a displayed exact scope and action-time owner confirmation, **When** LIVE execution
   begins, **Then** maximum calls are one Director request and one H3 submission.
3. **Given** failure, insufficient credits, timeout, or ambiguity, **When** execution stops, **Then**
   there is no automatic retry, resubmission, 2K upgrade, alternate prompt, or provider fallback.
4. **Given** a durable H3 task identifier, **When** recovery is needed, **Then** only that task may
   be queried and collected.

---

### User Story 3 - Review the advertisement and gate Phase 1 (Priority: P2)

As the owner, I can inspect the retained video and explicitly decide whether product development
may proceed.

**Why this priority**: Technical completion does not prove product geometry, character identity,
object continuity, audio quality, or commercial usability.

**Independent Test**: The retained artifact has hash/media/first-middle-final evidence while the
product gate remains closed until the owner records `PASS`, `FAIL`, or `RISK_ACCEPTED`.

**Acceptance Scenarios**:

1. **Given** a completed H3 task, **When** the artifact is collected, **Then** it is retained,
   hashed, FFprobe-validated, and represented by deterministic review frames.
2. **Given** technical success, **When** no owner decision exists, **Then** no creative PASS or
   Phase 1 start is inferred.
3. **Given** `PASS` or `RISK_ACCEPTED`, **When** the gate is evaluated, **Then** the Phase 1
   Project/Asset feature may be specified.
4. **Given** `FAIL`, **When** the gate is evaluated, **Then** no replacement is generated and a new
   experiment requires new scope and authorization.

### Edge Cases

- One or more source paths are missing, changed, duplicated, or have a different SHA-256.
- The H3 node exposes five references but the registered graph binds them in the wrong order.
- The 15-second storyboard is shortened, the red wine disappears, a second glass appears, or Lady
  LaLa sits/leans on the coffee table.
- The product changes shape, support geometry, finish, size, or location across shots.
- H3 generates readable text, a logo, narration, dialogue, subtitles, or watermarks.
- The Comfy account session is expired or USD 10 is insufficient for the exact request.
- Submission returns no durable task ID or polling expires while the task may still be running.
- The output is absent, unplayable, outside the fixed profile, unexpectedly silent/noisy, or
  visually unsuitable despite technical completion.

## Requirements

### Functional Requirements

- **FR-001**: The feature MUST use only the five exact reference files and SHA-256 values identified
  in the designated source task.
- **FR-002**: The feature MUST bind Image 1–5 respectively to scene, product, full-body character,
  face identity, and rear/side identity.
- **FR-003**: The workflow MUST be a new versioned, hash-locked H3 full-reference graph; it MUST NOT
  overwrite historical two-reference or Wan evidence.
- **FR-004**: The workflow MUST fix 768P, 9:16, 24fps, 15 seconds, watermark off, and exactly five
  image references.
- **FR-005**: The generation prompt MUST follow H3 full-reference structure and preserve the source
  task's approved five-shot timeline, product facts, character facts, red-wine-glass continuity,
  final sofa pose, warm instrumental music, and fireplace ambience.
- **FR-006**: H3 MUST NOT be asked to render display text or the DECOROLALA logo; those remain a
  separately gated post-generation editing step.
- **FR-007**: All implementation, tests, discovery, and dry-run work MUST make zero external
  provider calls, uploads, and generation submissions.
- **FR-008**: Purchased credits and login MUST be treated only as prerequisites, not as exact LIVE
  authorization.
- **FR-009**: The final pre-submission handoff MUST disclose the five references/hashes, exact
  prompt, workflow/profile/hash, maximum calls, no-retry policy, and provider-presented or unknown
  cost.
- **FR-010**: LIVE execution MUST require fresh exact-scope grants consumed before no more than one
  Director request and one H3 submission.
- **FR-011**: Failure or ambiguity MUST NOT trigger retry, replacement, fallback, provider switch,
  resolution change, or alternate output.
- **FR-012**: Ambiguous recovery MUST be query-only for the already bound task identity.
- **FR-013**: Inputs, grants, calls, H3 task, artifact, media facts, and owner review MUST be
  append-only and preserve historical evidence.
- **FR-014**: Technical completion MUST remain separate from explicit Human QA.
- **FR-015**: Human QA MUST check Lady LaLa identity/wardrobe/proportions, coffee-table geometry and
  finish, glass count and red-wine state, sofa seating, scene continuity, hands/body integrity,
  camera stability, visual corruption, audio continuity, and absence of generated text/logo.
- **FR-016**: Phase 1+ development MUST remain closed until the owner records `PASS` or
  `RISK_ACCEPTED`.
- **FR-017**: Credentials, account/session data, balance, and payment details MUST never be written
  into project files, prompts, logs, or run evidence.
- **FR-018**: The next executable workflow MUST use the installed H3 minimum duration of 4 seconds;
  a 2-second request MUST be rejected as unsupported rather than rounded during LIVE execution.
- **FR-019**: The 15-second workflow MUST remain preserved and disabled while the 4-second
  validation workflow is active.
- **FR-020**: The 4-second prompt MUST use one continuous untimed shot with restrained motion and
  MUST NOT attempt walking, glass placement, sitting, or multiple cuts.
- **FR-021**: The short validation MUST retain the same five ordered reference assets, 768P 9:16
  profile, watermark-off setting, and explicit Human QA boundary.
- **FR-022**: Before any short paid attempt, readiness MUST prove the Partner credential is
  configured and a new exact scope/cost confirmation MUST be obtained.

### Key Entities

- **Ordered Reference Set**: Five immutable source assets with stable semantic roles and hashes.
- **Approved H3 Generation Prompt**: Structured full-reference subject definitions, retention
  analysis, timed storyboard, soundscape, and music plan.
- **Advertisement Workflow**: Versioned H3 graph with five allowlisted bindings and fixed output
  profile.
- **Exact LIVE Authorization**: Short-lived, single-attempt permissions bound to references,
  prompt, provider/model or workflow hash, and call maximums.
- **Validated Advertisement Artifact**: Retained MP4 with lineage, media facts, and review frames.
- **Owner Quality Decision**: Append-only `PASS`, `FAIL`, or `RISK_ACCEPTED` phase gate.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The exact dry-run reports five distinct reference hashes, correct Image 1–5 roles,
  no readiness blockers, and `0 / 0` actual provider/generation calls.
- **SC-002**: Contract tests prove all five workflow bindings, the fixed 15-second profile, prompt
  structure, output selection, and historical workflow preservation.
- **SC-003**: LIVE execution cannot exceed one Director attempt and one H3 submission for the
  confirmed scope.
- **SC-004**: Every outcome has durable task/call/status evidence and no hidden retry.
- **SC-005**: A completed artifact has a verified SHA-256 and complete playable-media facts before
  Human QA.
- **SC-006**: The product gate remains closed until an explicit owner decision is recorded.
- **SC-007**: Secret scanning finds no credential, account, payment, or session data in tracked
  content.
- **SC-008**: Zero-call discovery selects only the 4-second validation workflow, reports an
  estimated maximum H3 generation cost of `$0.5148`, and makes no Provider or generation call.

## Assumptions

- The newest completed production plan in the designated task is authoritative: one 15-second
  9:16 H3 multi-reference generation, no narration/dialogue/subtitles, warm instrumental music and
  subtle fireplace ambience, with exact English copy and official logo added only after visual QA.
- Source facts are DECOROLALA `Chunky Chestnut Coffee Table - Solid Mango Wood`, SKU `IN3725`, 100%
  solid mango wood, chestnut finish; volatile price, stock, promotion, and delivery claims are
  excluded.
- The owner-reported login and USD 10 credit purchase are current, but the project will not claim
  the balance or exact charge without current provider UI evidence.
