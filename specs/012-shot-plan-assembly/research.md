# Research: Approved Shot Plan Assembly

## Decision 1: Select the latest owner-PASS artifact per approved ordinal

**Decision**: Resolve all artifacts reachable from targets for the approved GenerationSpec, keep
technically valid retained artifacts with an explicit latest Human QA PASS, then sort by artifact
retention time and ID descending and select one.

**Rationale**: A later blank or failed attempt must not erase an earlier accepted result. Binding to
the approved spec prevents cross-version or cross-shot substitution.

**Alternatives rejected**: Latest job regardless of decision (silently loses valid PASS); newest batch
only (hides history); manual artifact selection in v1 (adds another approval UI and state model).

## Decision 2: Canonical source-set hashing

**Decision**: Hash a stable JSON object containing contract version, approved plan version ID, and
ordered source records with spec ID, ordinal, artifact ID, SHA-256, byte size, and MIME type.

**Rationale**: This makes idempotency, staleness, and auditability independent from presentation order
or database query ordering.

**Alternatives rejected**: Hash only artifact IDs (weak provenance); mutable current-assembly pointer
(destroys history); compare creation timestamps (not content-bound).

## Decision 3: Normalize and concatenate locally with FFmpeg

**Decision**: Use one input per source and a `filter_complex` chain that scales/pads to 768x1344,
sets square pixels, 24 fps and `yuv420p`, concatenates video only, then encodes H.264 with fast-start
and no audio.

**Rationale**: Source timestamp and audio differences make stream-copy concat fragile. Re-encoding
gives a browser-compatible deterministic contract without modifying historical sources.

**Alternatives rejected**: Stream-copy concat (fragile across timestamps/codecs/audio); client-side
MediaSource assembly (not a durable file); external video editor/Provider (cost and trust boundary).

## Decision 4: Validate before durable persistence

**Decision**: Probe the completed temporary output and require non-empty H.264 video, 768x1344,
approximately 24 fps, expected duration tolerance, and no audio before storage/persistence.

**Rationale**: An FFmpeg exit code alone does not prove a playable contract-compliant artifact.

**Alternatives rejected**: Store first then mark failed (pollutes durable history); browser-only
validation (non-deterministic and too late).

## Decision 5: No Worker or execution authorization for assembly

**Decision**: Run assembly from an explicit local API action and protect it with source-set
idempotency. Do not consume generation/AI QA authorization or call the Project Worker.

**Rationale**: The operation is local, reversible by creating a new version, and has no paid/external
boundary. Reusing Provider authorization would falsely imply paid scope.

**Alternatives rejected**: Queue in the generation Worker (couples local media work to Provider
leases); automatic assembly on PASS (violates explicit owner action).

## Decision 6: Preserve the 17:42 Shot 3 as evidence and retry baseline

**Decision**: Do not mutate its FAIL decision or auto-promote it. Its accepted visual facts are
carried forward as explicit retry constraints: original sofa side, coffee-table placement, room
composition, natural character scale and seated end state. The glass stays on the table with visible
red wine matching Shot 2; the character never holds or places it.

**Rationale**: The historical attempt is visually closest but still fails a material continuity fact.
Its strengths and defects must be separated instead of replacing it with the newer worse layout.

**Alternatives rejected**: Approve with known wine discontinuity; use latest attempt merely because it
is newer; edit historical QA evidence; automatically submit a paid retry.
