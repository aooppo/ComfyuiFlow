# Feature Specification: Approved Shot Plan Assembly

**Feature Branch**: `codex/012-shot-plan-assembly`

**Created**: 2026-08-25

**Status**: Approved for local implementation; no Provider generation or AI QA is authorized

**Input**: After every shot in the approved Shot Plan has an explicit owner PASS, assemble the
selected final shot artifacts in ordinal order, preview and download the result, and retain it on the
Shot Plan with immutable source lineage and history.

## Clarifications

### Session 2026-08-25

- Q: Which artifact represents each shot? -> A: The most recently retained artifact for that shot
  that has an explicit owner PASS. A newer unreviewed or failed artifact does not replace it.
- Q: Does assembly authorize generation or AI QA? -> A: No. Assembly is an explicit local-only
  action and makes zero H3, ComfyUI, CodexManager, or other Provider calls.
- Q: What is the first output format? -> A: One silent portrait MP4 normalized to 768x1344 H.264 at
  24 fps, matching the approved shot capability `audio: no` while leaving every source artifact
  unchanged.
- Q: What happens when a later owner-PASS artifact changes the source set? -> A: Existing assemblies
  remain immutable and visible as historical versions; the current source set is marked as needing a
  new assembly.
- Q: How should the preferred 17:42 Shot 3 result guide a future retry? -> A: It is a visual baseline,
  not an automatically approved output. Preserve its room composition, sofa side, coffee-table
  placement, character scale, and seating action. Correct only the continuity defects: the character
  must begin with empty hands, the same glass must remain stationary on the coffee table, and the red
  wine color and fill level must match Shot 2. The newer result's moved sofa and missing table/glass
  are unacceptable. Creating a paid retry remains a separate owner-authorized workflow.

## User Scenarios & Testing

### User Story 1 - Know When Assembly Is Ready (Priority: P1)

As the project owner, I can immediately see whether every approved shot has an owner-PASS video and
which shot numbers are still missing before any assembly action is available.

**Why this priority**: Assembly must never silently substitute an unreviewed, failed, or unrelated
artifact.

**Independent Test**: Open a three-shot approved plan with PASS decisions for only shots 1 and 2;
the page names shot 3 as missing and prevents assembly without modifying any records.

**Acceptance Scenarios**:

1. **Given** one or more approved specs have no owner-PASS artifact, **When** the owner opens the
   Shot Plan, **Then** the assembly control is disabled and every missing ordinal is listed.
2. **Given** a newer unreviewed or failed artifact exists after an older PASS, **When** eligibility is
   evaluated, **Then** the older latest-PASS artifact remains eligible and the newer artifact is not
   silently promoted.
3. **Given** every approved spec has at least one owner-PASS artifact, **When** the page refreshes,
   **Then** the exact ordered source list is shown and the local assembly control is enabled.

---

### User Story 2 - Create and Use a Combined Preview (Priority: P1)

As the project owner, I can explicitly assemble the final accepted shots in ordinal order, play the
combined video in the page, and download it from the approved Shot Plan.

**Why this priority**: This converts individually accepted shots into a reviewable sequence without
another paid generation step.

**Independent Test**: Give all specs owner-PASS artifacts, click the assembly control once, and
verify a playable portrait MP4 whose sequence and duration match the ordered inputs while Provider
call counters remain unchanged.

**Acceptance Scenarios**:

1. **Given** an eligible exact source set, **When** the owner clicks `生成合成预览`, **Then** one
   local deterministic assembly is created in ascending shot ordinal with no external calls.
2. **Given** an assembly completes, **When** the page refreshes, **Then** its video, download link,
   source ordinals, hashes, creation time, and media facts remain available on the plan.
3. **Given** the same source set is submitted again, **When** the request is processed, **Then** the
   existing assembly is returned and no duplicate file or record is created.

---

### User Story 3 - Preserve Assembly History and Retry Baselines (Priority: P2)

As the project owner, I can inspect prior assemblies and historical shot videos without a newer retry
overwriting the evidence or changing which output I previously approved.

**Why this priority**: Creative review depends on comparing attempts and retaining the exact source
lineage of every combined result.

**Independent Test**: Create an assembly, append a newer owner-PASS artifact for one shot, and verify
the old assembly remains playable and is marked historical while the new exact source set is eligible
for a separate local assembly.

**Acceptance Scenarios**:

1. **Given** an existing assembly and a later owner-PASS source, **When** the page loads, **Then** the
   prior assembly remains immutable and is marked historical/stale relative to the current sources.
2. **Given** a historical failed Shot 3 is visually preferred as a retry baseline, **When** the owner
   prepares a new attempt, **Then** its room layout and accepted continuity requirements can be carried
   into the new immutable retry prompt without approving, editing, or overwriting the historical video.
3. **Given** any assembly or source-resolution failure, **When** it is reported, **Then** all source
   artifacts and earlier assemblies remain unchanged and the error identifies a safe corrective step.

### Edge Cases

- The approved plan or approved version changes while an assembly request is being prepared.
- A shot has multiple historical PASS artifacts, later FAIL artifacts, or an unreviewed latest artifact.
- A selected source file is missing, hash-mismatched, empty, corrupt, or no longer technically valid.
- Two identical assembly requests arrive concurrently.
- Input durations, audio tracks, timestamps, or encodings differ despite matching portrait dimensions.
- Local FFmpeg or FFprobe is unavailable or exits without a valid output.
- A zero-shot plan or a plan with duplicate/missing ordinals is encountered.
- A source set changes after a historical assembly exists but before a new assembly is requested.

## Requirements

### Functional Requirements

- **FR-001**: Eligibility MUST be evaluated only against the plan's currently approved immutable
  GenerationPlanVersion and its complete ordered GenerationSpec set.
- **FR-002**: For each ordinal, the system MUST select the newest retained, technically valid
  GeneratedArtifact that has an explicit owner PASS; newer FAIL or blank decisions MUST NOT revoke or
  replace an earlier PASS.
- **FR-003**: The page MUST list missing shot ordinals and MUST NOT allow assembly until exactly one
  eligible source is resolved for every approved spec.
- **FR-004**: The exact source-set identity MUST bind the approved version ID plus each ordered spec
  ID, ordinal, artifact ID, SHA-256, byte size, and MIME type in deterministic canonical form.
- **FR-005**: Assembly MUST require an explicit owner click, execute locally, and make zero H3,
  ComfyUI, CodexManager, AI QA, or other external Provider calls.
- **FR-006**: The output MUST concatenate shots in ascending ordinal order and normalize to a silent
  768x1344 H.264 MP4 at 24 fps without changing any retained source artifact.
- **FR-007**: The output MUST be locally validated for container, codec, dimensions, frame rate,
  duration, non-empty content, and absence of audio before it is persisted.
- **FR-008**: Assembly metadata and ordered source lineage MUST be project-scoped, append-only, and
  persisted with SHA-256, byte size, media facts, assembler version, and creation time; binary content
  MUST remain in generated-artifact storage outside the database.
- **FR-009**: Repeated or concurrent requests for the same source-set hash MUST return one durable
  assembly and MUST NOT create duplicate output records.
- **FR-010**: When the current selected PASS source set differs from a saved assembly, the system MUST
  mark that assembly historical/stale without mutating or deleting it.
- **FR-011**: Current and historical assemblies MUST remain playable and downloadable from the Shot
  Plan, with source ordinals and artifact identities visible for audit.
- **FR-012**: APIs and UI MUST expose safe errors and MUST NOT reveal absolute storage paths,
  credentials, raw Provider responses, or secret-bearing data.
- **FR-013**: Recording a new owner PASS MUST refresh eligibility but MUST NOT automatically create an
  assembly.
- **FR-014**: The preferred 17:42 Shot 3 result MUST remain historical evidence and a retry baseline;
  the application MUST NOT reinterpret it as PASS or automatically submit a replacement.
- **FR-015**: The next Shot 3 retry requirement MUST preserve the 17:42 layout (sofa side, coffee-table
  position, character scale and room composition), begin with empty hands, keep the same glass
  stationary on the table, and preserve Shot 2's visible red-wine color and fill level throughout.

### Key Entities

- **GenerationPlanAssembly**: One immutable locally assembled MP4 for an exact approved plan version
  and source-set hash, including storage identity, media facts, assembler version, and creation time.
- **GenerationPlanAssemblySource**: One ordered link from an assembly to an approved GenerationSpec
  and owner-PASS GeneratedArtifact, capturing ordinal and source hash facts.
- **Assembly Eligibility**: A computed view of the approved specs, latest owner-PASS sources, missing
  ordinals, exact source-set hash, matching current assembly, and historical assemblies.
- **Historical Retry Baseline**: A retained generated artifact selected by the owner for visual
  comparison; it remains independent from owner PASS and paid execution authorization.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For every tested plan state, eligibility identifies 100 percent of missing ordinals and
  never selects a blank or failed Human QA artifact.
- **SC-002**: Repeated evaluation of unchanged records produces the same ordered source list and
  source-set hash in 100 percent of tests.
- **SC-003**: A completed assembly plays in the supported browser at 768x1344, 24 fps, H.264, no
  audio, and a duration within 0.25 seconds per join of the sum of source durations.
- **SC-004**: Assembly consumes zero generation calls and zero AI QA calls and performs zero external
  network submissions in automated and manual acceptance.
- **SC-005**: Repeating the same request returns the same assembly ID and adds no duplicate database
  row or stored output.
- **SC-006**: After a later source PASS, 100 percent of earlier assemblies remain playable,
  downloadable, hash-verifiable, and visibly historical.
- **SC-007**: The Shot Plan enables assembly only when all approved shots have PASS sources and shows
  the resulting preview/download after one explicit local action.
- **SC-008**: Existing generation, retry, AI QA, Human QA, and historical batch behavior remains
  compatible and all affected automated suites, type checks, lint, build, migration rehearsal, and
  browser checks pass.

## Assumptions

- The product remains a local, single-owner, project-scoped application.
- FFmpeg and FFprobe are installed in the same runtime that serves the project application.
- Source artifacts are retained local MP4 files and remain immutable.
- The first assembly format is silent because the approved H3 shot capability is `audio: no`; source
  audio, when present, remains untouched in the individual historical videos.
- The most recent owner-PASS artifact per ordinal is the default final source; explicit manual source
  selection is outside this first assembly increment.
- A future paid Shot 3 retry is out of scope until the owner reviews the exact retry preview, cost,
  call cap, and separately confirms execution.
