# Feature Specification: Whole-Film Continuity Wizard

**Feature Branch**: `codex/013-continuity-wizard`
**Created**: 2026-08-25
**Status**: Approved for implementation; no LIVE image, video, or AI call is authorized

**Input**: Add a beginner-facing continuity step between an approved Storyboard and paid shot
generation so one owner can freeze what remains constant, declare shot changes, approve inexpensive
boundary keyframes, and understand the remaining Provider limitations before spending credits.

## Clarifications

### Session 2026-08-25

- Q: What does one-pass production mean? -> A: One confirmed batch with at most one video submission
  per shot; it does not mean one long-video call.
- Q: How should continuity be established? -> A: Freeze the whole film's boundary states and
  keyframes before any video submission; do not chain random generated tail frames.
- Q: What is the paid gate? -> A: The owner reviews one contact sheet and exact call/cost ceilings,
  then confirms the video batch once.
- Q: What happens on failure? -> A: Hard or ambiguous technical failure pauses later submissions;
  playable visual warnings continue and may form a clearly non-final draft assembly.
- Q: How is keyframe generation integrated? -> A: A provider-neutral image capability uses the
  existing Codex Manager gateway; AI QA capability does not imply image-generation capability.

## User Scenarios & Testing

### User Story 1 - Set Whole-Film Continuity Without Prompt Editing (Priority: P1)

As a first-time AI video owner, I can open a dedicated continuity step, see suggested scene,
character, product, prop, camera, and style subjects, and decide only whether each stays fixed,
changes in a shot, or is unimportant.

**Independent Test**: Starting from the existing approved three-shot Storyboard, configure and save
all continuity subjects without opening technical details or editing a Provider prompt; reopening
shows the immutable saved version and its source asset versions.

**Acceptance Scenarios**:

1. Given an approved Storyboard with a complete manifest, the wizard suggests subjects from exact
   approved semantic versions and defaults important subjects to whole-film hold.
2. Given a subject, the owner can select `WHOLE_FILM_HOLD`, `SHOT_CHANGE`, or `UNIMPORTANT`; a shot
   change requires an explicit resulting state.
3. Saving appends an immutable profile version and never rewrites the Storyboard, manifest, assets,
   or earlier profile versions.
4. Technical prompt, workflow, model, path, credential, and hash details stay collapsed by default.

### User Story 2 - Resolve Shot Boundaries Before Paid Work (Priority: P1)

As the owner, I can inspect one shot timeline where a shared boundary represents both the previous
shot's end and the next shot's start, and I can resolve inherited, declared-change, conflict, and
soft-reference states using plain-language actions.

**Independent Test**: Make Shot 2 end with the glass on the table and Shot 3 start with the glass in
hand; preflight identifies the exact subject and boundary, then `沿用上一镜` makes both sides share
one state identity and hash without any external call.

**Acceptance Scenarios**:

1. The system creates exactly N+1 ordered boundaries for N ordered shots.
2. Adjacent shots reference one shared boundary rather than duplicate editable end/start records.
3. Conflicts return a stable explanation and actions to inherit, declare a change, or select another
   approved reference.
4. Unimportant rules produce warnings, while unresolved whole-film holds block approval.

### User Story 3 - Approve a Bounded Keyframe Contact Sheet (Priority: P1)

As the owner, I can preview an N+1 keyframe batch with exact provider capability, maximum image call
count, timestamped cost facts, and no-retry policy, explicitly authorize it, and approve or reject
the retained contact sheet without authorizing video.

**Independent Test**: Use the Fake provider for three shots; one authorization creates four retained
boundary images and zero external calls, AI QA does not auto-decide, and an owner approval freezes
the exact four hashes.

**Acceptance Scenarios**:

1. Preview is read-only and reports one candidate per boundary, exact references, call ceiling,
   price availability, expiry, and external call count zero.
2. Confirmation binds one provider/model snapshot and at most N+1 image calls; consumption occurs
   before each attempted external request and is never refunded.
3. Failure, timeout, moderation block, or ambiguous response never triggers retry or fallback.
4. LIVE keyframes remain disabled unless Codex Manager explicitly reports image editing/generation,
   multiple reference images, requested portrait dimensions, and pricing visibility.
5. Approval/rejection is append-only and never authorizes video or Human PASS.

### User Story 4 - Understand Video Capability and Generate One Bounded Draft (Priority: P1)

As the owner, I can see whether the selected video Provider offers ordinary reference, locked start,
or locked start-and-end control; hard rules beyond capability block generation, while accepted soft
rules are explicit and the approved keyframes are bound to the batch.

**Independent Test**: The current H3 profile displays ordinary reference. A hard locked-end rule
blocks preview; changing it to soft allows a three-shot preview whose scope includes the profile,
boundary, start-keyframe, and target-keyframe hashes and still performs zero calls.

**Acceptance Scenarios**:

1. Provider capability is shown in business language and never inferred from a model name.
2. Current H3 uses the approved start keyframe in its Scene reference slot and treats the ending
   keyframe as a QA target only; the UI never claims first/last-frame locking.
3. Any profile, boundary, keyframe, source-asset, Storyboard, plan, or Provider snapshot change makes
   the execution preview stale.
4. Hard/ambiguous technical failure pauses later shots; a playable advisory visual warning does not.
5. When all selected shots retain playable artifacts, the system can create a local draft assembly
   with visible warnings; draft status never becomes final approval.

### User Story 5 - Review Draft and Preserve Formal Approval (Priority: P2)

As the owner, I can watch the draft sequence, inspect shot and transition warnings, and record
explicit decisions while formal assembly continues to use only owner-PASS artifacts.

**Independent Test**: Assemble three technically valid artifacts with one visual warning and no
Human PASS; the draft plays and lists the warning, the formal assembly remains ineligible, and all
history remains readable.

### Edge Cases

- Storyboard or manifest approval is revoked after a continuity profile or keyframe approval.
- A semantic asset/version/file is removed, superseded, cross-project, unapproved, or hash-mismatched.
- A future subject kind is registered without a corresponding UI renderer or validation schema.
- A zero-shot, duplicate-ordinal, missing-ordinal, or twenty-plus-shot version is encountered.
- Two profile saves, approvals, or paid confirmations race with the same or different request hash.
- Codex Manager supports QA but not image generation, supports generation but not editing, returns no
  price, returns multiple images, or has an ambiguous network outcome.
- A keyframe is rejected after a newer profile exists, or an approved keyframe binary is missing.
- Current H3 cannot enforce an owner-marked hard start/end boundary.
- Draft assembly has missing, corrupt, or technically invalid source video.

## Requirements

### Functional Requirements

- **FR-001**: The product MUST expose a dedicated continuity step linked from Storyboard and Shot
  Plan, using beginner-facing labels and progressive disclosure for technical data.
- **FR-002**: A profile MUST be created only from a currently approved 1-20-shot StoryboardVersion
  and its exact complete AssetResolutionManifest.
- **FR-003**: The system MUST represent extensible continuity subjects through a controlled registry
  covering environment, character, product, prop, camera, and visual style without a scene-only data
  model.
- **FR-004**: Every subject MUST have one policy: WHOLE_FILM_HOLD, SHOT_CHANGE, or UNIMPORTANT.
- **FR-005**: Profile versions, subjects, rules, states, boundaries, decisions, and paid attempts MUST
  be append-only and project-scoped.
- **FR-006**: N shots MUST resolve to exactly N+1 contiguous boundaries; each internal boundary MUST
  be one shared identity for the prior end and next start.
- **FR-007**: Zero-call preflight MUST return stable subject-, shot-, and boundary-level blockers and
  warnings plus plain-language corrective actions.
- **FR-008**: Whole-film holds and undeclared shot changes MUST block approval; unimportant rules MAY
  warn but MUST NOT block.
- **FR-009**: Saving and decisions MUST use optimistic concurrency or idempotency and reject changed
  request hashes atomically.
- **FR-010**: Keyframe planning MUST create one exact candidate target per boundary and bind approved
  semantic/file versions, state, prompt, dimensions, provider snapshot, and canonical hashes.
- **FR-011**: Keyframe preview MUST perform zero calls and show current price facts, maximum calls,
  expiry, no retry, and price-unavailable status.
- **FR-012**: Keyframe LIVE execution MUST default disabled and require a persisted authorization
  whose budget is consumed before every external attempt.
- **FR-013**: The first LIVE image adapter MUST use the Codex Manager gateway and a registered image
  model snapshot; ComfyuiFlow MUST NOT directly call OpenAI from project-core.
- **FR-014**: Codex Manager image capability MUST be independent from structured AI and video QA and
  explicitly describe generation, editing, multi-image input, dimensions, cost, and model snapshot.
- **FR-015**: Fake keyframe execution MUST cover the full automated path with zero external calls.
- **FR-016**: LIVE keyframe attempts MUST submit once with zero retry/fallback; failure, timeout,
  moderation block, and ambiguity consume the grant and stop that attempt.
- **FR-017**: Generated keyframe bytes MUST remain outside PostgreSQL in verified content-addressed
  storage; metadata, lineage, cost, and decisions MUST remain durable.
- **FR-018**: Keyframe decisions MUST be explicit append-only APPROVED or REJECTED and MUST NOT grant
  video authorization.
- **FR-019**: Video capability MUST use ORDINARY_REFERENCE, LOCKED_START, or LOCKED_START_END and UI
  language MUST reflect the registered capability exactly.
- **FR-020**: A hard rule beyond the selected Provider's capability MUST block execution preview;
  the system MUST NOT silently select another Provider.
- **FR-021**: Current H3 MUST remain ORDINARY_REFERENCE, use the approved start keyframe as SCENE,
  and expose the end keyframe only as a soft QA target.
- **FR-022**: Execution preview and authorization MUST bind continuity profile, boundary, start and
  target keyframe hashes; any stale dependency MUST fail closed before submission.
- **FR-023**: Hard/ambiguous technical video failure MUST pause later submissions while advisory
  visual QA MUST NOT trigger retry, fallback, or pause.
- **FR-024**: A local draft assembly MAY use all technically valid selected artifacts and retain
  warnings, but MUST remain separate from formal latest-owner-PASS assembly.
- **FR-025**: Draft creation MUST be explicit, local, idempotent, append-only, and make zero external
  calls; it MUST NOT imply final or Human QA approval.
- **FR-026**: APIs, UI, events, and logs MUST not expose secrets, absolute paths, raw Provider
  payloads, Base64 content, workflow JSON, or technical identifiers in the default beginner view.
- **FR-027**: Existing asset, Storyboard, plan, execution, retry, QA, formal assembly, and historical
  records MUST remain backward compatible through additive migrations.
- **FR-028**: No implementation or automated acceptance action may perform LIVE image, video, or AI
  calls; real acceptance remains a separately confirmed action-time operation.

### Key Entities

- **ContinuityProfile / ContinuityProfileVersion**: Stable Storyboard-bound aggregate and immutable
  configuration snapshot.
- **ContinuitySubject / ContinuityRule**: Extensible semantic subject and its hold/change/importance
  rules.
- **ShotContinuityState / ShotBoundary**: Exact per-shot states and shared adjacent boundary.
- **ContinuityDecision / ContinuityPreflight**: Append-only owner approval and zero-call validation.
- **KeyframePlanVersion / KeyframeTarget / KeyframeAuthorization / KeyframeAttempt**: Immutable
  contact-sheet scope and bounded paid execution.
- **KeyframeArtifact / KeyframeDecision**: Retained boundary image plus explicit owner review.
- **DraftAssembly / DraftAssemblySource**: Local non-final sequence and its warnings/lineage.

## Success Criteria

- **SC-001**: The owner completes the existing three-shot continuity configuration without editing a
  prompt or opening technical details.
- **SC-002**: One hundred percent of internal shot transitions use one shared boundary identity and
  stable hash for unchanged inputs.
- **SC-003**: One hundred percent of intentional conflicts identify subject, boundary, reason, and a
  plain-language corrective action without an external call.
- **SC-004**: A three-shot Fake keyframe batch retains exactly four keyframes, performs zero external
  calls, and cannot exceed four attempts.
- **SC-005**: Every real preview displays a timestamped price fact or explicit unavailable state,
  exact maximum calls, expiry, and no-retry policy before confirmation.
- **SC-006**: Current H3 is shown as ordinary reference in every UI/API response and never passes a
  hard start/end-lock acceptance case.
- **SC-007**: One hundred percent of stale profile, asset, boundary, keyframe, plan, or Provider
  snapshots stop before a video submission.
- **SC-008**: Technical failure starts zero later submissions; advisory visual warning starts no
  retry and permits a draft only from playable retained artifacts.
- **SC-009**: Draft and formal assemblies remain visibly and behaviorally distinct; only formal
  assembly selects owner-PASS artifacts.
- **SC-010**: Existing automated suites, database contents, and historical media remain compatible,
  and all Phase 13 automated checks record zero LIVE calls.

## Assumptions

- The product remains local, single-owner, project-scoped, portrait-video oriented, and limited to
  1-20 shots.
- Suggestions may use deterministic rules or separately authorized AI, but no suggestion is approval.
- Codex Manager may eventually route keyframe requests to `gpt-image-2`; model access and gateway
  image schema are capabilities to verify, not assumptions.
- The first H3 integration materially improves reference quality but cannot guarantee exact first or
  last frames.

## Out of Scope

- Silent Provider fallback, automatic retry, automatic keyframe approval, automatic Human PASS,
  direct OpenAI access from project-core, arbitrary workflow editing, a new start/end video Provider,
  publication, professional timeline editing, or any unconfirmed LIVE acceptance run.
