# Research: Wan2.2 Stability Recovery

## R-001 — Use the official 5B sampler baseline

**Decision**: Change the recovery candidate from 12 to 20 sampling steps while retaining shift 8,
CFG 5, `uni_pc`, the simple scheduler, and denoise 1.

**Rationale**: The official ComfyUI Wan2.2 5B workflow uses 20 steps with those remaining values.
The failed v1 cut the official step count by 40%, making insufficient denoising the clearest
configuration deviation connected to the observed color and geometry collapse.

**Alternatives considered**: Immediate 14B migration (rejected: large model/memory expansion);
automatic multi-seed sweep (rejected: multiple unapproved submissions); changing every sampler
field (rejected: removes causal traceability).

## R-002 — Keep the first recovery profile within proven memory bounds

**Decision**: Retain 512x288, 33 frames, and 16 fps for candidate v2.

**Rationale**: The failed attempt proved this media profile completes on the M1 Pro. Raising spatial
and temporal size at the same time as sampler recovery would materially increase unified-memory
risk and obscure which change improved stability. The official model supports larger profiles, but
that remains a later separately authorized candidate if v2 is stable but too soft.

**Alternatives considered**: Official 1280x704/121/24 profile (rejected for the first recovery due
to memory and runtime risk); 640x352/49/24 (deferred until sampler stability is known).

## R-003 — Separate positive motion guidance from negative constraints

**Decision**: Compile start state, action, end state, camera, and composition into the positive
prompt; do not append the Director's entire continuity list. Put quality, identity-change, scene
change, and deformation exclusions in the negative prompt.

**Rationale**: The failed positive prompt mixed intended content with multiple negative-style
sentences such as “no cuts” and “no background rearrangement.” The official template uses a concise
positive description and a dedicated, extensive negative quality prompt.

**Alternatives considered**: Keep every continuity sentence (rejected: repeats negative concepts in
positive conditioning); discard all identity guidance (rejected: source consistency remains a core
review criterion).

## R-004 — Treat five-minute local generation as normal, not failed

**Decision**: Bound polling at ten minutes and retain query-only reconciliation for overruns.

**Rationale**: The first real prompt completed successfully in about 304 seconds, while the CLI
stopped polling at 120 seconds. A ten-minute bound covers the observed local runtime without
changing authorization or submission semantics.

**Alternatives considered**: Infinite polling (rejected: no operator bound); resubmit on timeout
(rejected: authorization and idempotency violation); leave 120 seconds (rejected: known false
failure on this machine).
