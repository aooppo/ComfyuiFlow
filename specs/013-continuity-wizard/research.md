# Research: Whole-Film Continuity Wizard

## R1. Shared boundary model

**Decision**: Persist N+1 immutable `ShotBoundary` rows and have each shot state reference its start
and end boundary. An internal boundary is one identity, not copied end/start JSON.

**Rationale**: Equality by shared identity prevents Shot N end and Shot N+1 start from diverging and
makes one boundary hash invalidate every downstream preview deterministically.

**Rejected**: Copying state into each shot and comparing strings. It permits contradictory edits and
requires reconciliation after every save.

## R2. Extensible consistency subjects

**Decision**: Use a controlled registry whose initial kinds are environment, character, product,
prop, camera, and visual style. Persist stable subject keys and structured facts; render all kinds
through the same policy/state controls.

**Rationale**: The business workflow is about invariants and allowed transitions, not a scene-only
feature. A registry supplies labels, default importance, supported properties, and renderer fallback.

**Rejected**: Dedicated scene/person/prop tables and bespoke pages. They would make every future
continuity type a schema-and-UI redesign.

## R3. Keyframe image integration

**Decision**: Define `KeyframeImageProvider` independently from structured AI and video QA. Fake is
the automated default. The first optional LIVE adapter calls Codex Manager, not OpenAI directly.

**Evidence**: Read-only local discovery on 2026-08-25 returned health 200 and exposed
`/v1/images/generations` and `/v1/images/edits` request handlers. `/v1/capabilities` was absent and
the ordinary model listing contained text/Codex models only. Therefore route existence is not enough:
the application must use its own explicit registered capability snapshot and fail closed unless live
enablement, image edit, multi-reference input, exact dimensions, model snapshot, and current price
facts are configured.

**Rationale**: AI QA proves visual understanding only. It does not prove image output, editing,
multi-reference, dimensions, or billing semantics.

**Rejected**: Adding OpenAI SDK calls in `project-core`, or treating a successful QA preflight as
image-generation readiness.

## R4. Image model and cost

**Decision**: Register a model snapshot such as `gpt-image-2-2026-04-21` behind Codex Manager only
when the local gateway/operator declares it available. Request the Provider-supported 1024×1536
portrait size at low quality with multiple frozen references, validate the actual returned dimensions,
then deterministically scale/crop locally to 768×1344. Price facts are injected at preview time and
expire; unavailable pricing blocks LIVE confirmation.

**Rationale**: Official OpenAI documentation describes GPT Image 2 generation/editing, multiple
reference images, high-fidelity input, and flexible output dimensions, but actual access and billing
through Codex Manager remain gateway facts. A local one-call generation on 2026-08-25 also returned
1536×1024 after a 1024×1024 request, proving that returned dimensions must be validated rather than
trusted. A historical hard-coded price or silent size assumption would be unsafe.

## R5. Paid execution semantics

**Decision**: Preview is zero-call. Confirmation persists an expiring authorization with exact plan
hash and maximum N+1 calls. A consumption/attempt row is committed before each request. Every target
is submitted at most once; failure, moderation, timeout, or ambiguous transport stops the remaining
keyframe batch and never refunds or retries.

**Rationale**: A request may have reached the provider even when the response is unknown. Consuming
before I/O is the only fail-closed credit boundary.

## R6. H3 integration

**Decision**: Add explicit video control tier `ORDINARY_REFERENCE | LOCKED_START | LOCKED_START_END`.
Current H3 is `ORDINARY_REFERENCE`. In continuity-aware execution its approved start keyframe fills
the Scene reference slot; its end keyframe is hashed as a soft QA target, not submitted as a lock.

**Rationale**: The current workflow accepts references but does not prove first/last-frame locking.
The product must describe model limits truthfully.

## R7. Draft versus formal assembly

**Decision**: Add a separate draft aggregate. It may select one technically valid playable artifact
per shot and record AI/continuity warnings. Formal assembly remains unchanged and selects only the
latest explicit Human PASS artifact.

**Rationale**: Owners need to watch the whole sequence before accepting every shot, but a useful
preview must not silently become final approval.

## R8. Backward compatibility

**Decision**: All tables/columns are additive. Historical execution batches remain valid without a
continuity plan. Continuity-aware execution requires an explicit approved keyframe plan and binds
its hashes into the new preview/batch fields.

**Rationale**: Retrofitting historical generations with invented continuity evidence would corrupt
provenance.
