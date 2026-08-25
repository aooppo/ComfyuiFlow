# Research: Generation Execution and QA

## R-001: Product execution reuses the MCP boundary

**Decision**: Extract a reusable server-only MCP client port from the spike path; Project Worker may
call only the allowlisted ComfyUI MCP tools.

**Rationale**: The constitution requires MCP, and the existing bridge already has validated
submission/status/artifact/cancel behavior and ambiguity semantics.

**Alternatives considered**: Direct ComfyUI HTTP from `project-core` was rejected because it creates
a second execution contract and bypasses the governed tool boundary.

## R-002: Add a generic H3 profile instead of mutating historical workflows

**Decision**: Add `minimax-h3-project-shot-4s-v1`, copied from the validated graph behavior but with
dynamic provider prompt materialization and a new immutable manifest/SHA.

**Rationale**: Historical DECOROLALA evidence must retain byte identity. Product shots need semantic
facts instead of brand-specific prompt bytes.

**Alternatives considered**: Editing the active validation file was rejected; using the brand-named
workflow unchanged was rejected as misleading provenance.

## R-003: Compatibility is deterministic and fails closed

**Decision**: Resolve five slots from exact ProductionAsset type, ReferenceUsage, Viewpoint, shared
Character identity/state, and approved file bindings. Any absence or ambiguity is a blocker.

**Rationale**: Provider mapping cannot guess from filenames, display names, paths, or AI ranking.

**Alternatives considered**: Auto-selecting closest candidates or coercing duration was rejected
because it changes approved intent after Plan approval.

## R-004: Combined authorization has independent per-target consumptions

**Decision**: One owner confirmation creates one immutable manifest with separate Generation and
AI_QA target entries. Each entry can be consumed once in its own database transaction.

**Rationale**: It honors the selected one-confirmation UX without turning success of one operation
into reusable authority for another target.

**Alternatives considered**: A single integer call counter loses operation identity; creating the AI
grant after generation would require a second confirmation and contradict the selected UX.

## R-005: AI QA is exact still-frame comparison

**Decision**: CodexManager Local receives five source references, three deterministic review frames,
technical facts, and GenerationSpec expectations through strict structured output with `store:false`.

**Rationale**: The existing registered Provider supports images and structured output, not full-video
or audio understanding. Eight images stay within its current nine-image contract.

**Alternatives considered**: Claiming full motion/audio review was rejected; a new video Provider and
Official OpenAI/Qwen adapter are outside this feature.

## R-006: Generated artifacts are not source assets

**Decision**: Reuse `StorageProvider` mechanics in a separate generated namespace and model generated
artifacts/frames explicitly.

**Rationale**: Source originals and generated candidates have different provenance, approval, and
future assembly semantics.

**Alternatives considered**: Auto-import into `Asset` was rejected because it makes generated output
indistinguishable from user-provided source material.

## R-007: Batch stops on technical uncertainty, not advisory QA

**Decision**: Provider/ambiguity/artifact failures pause later targets. AI QA findings are recorded
but all technically successful authorized targets may finish before Human QA.

**Rationale**: Continuing after a technical failure risks repeated paid waste, while AI advice must
not become execution or approval authority.

**Alternatives considered**: Always continue was rejected for cost risk; pausing on AI FAIL was
rejected because it delegates execution control to an advisory model.
