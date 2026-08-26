# Research: Simplified Gates and Capability-Driven Workflow

## R-001 — Runtime and provider are separate concepts

**Decision**: Model the execution environment and inference/billing authority separately.

**Rationale**: ComfyUI is an execution runtime. The same ComfyUI instance may run a local checkpoint, call ComfyUI Partner/API nodes, or call third-party custom nodes. Calling all of these `comfyui-partner` loses billing, credential, availability, and provenance meaning.

**Rejected**: Treating ComfyUI as the provider; deriving provider solely from the adapter name.

## R-002 — Use one generic ComfyUI transport adapter

**Decision**: All supported ComfyUI implementations share `comfyui-mcp-v2` unless their transport protocol truly differs.

**Rationale**: Submission, status polling, cancellation, reconciliation, and artifact retrieval are runtime protocol concerns. H3, Seedance, Wan, local checkpoints, and remote API nodes differ in graph/input semantics, not in the MCP transport boundary.

**Rejected**: One hard-coded Web/Worker adapter class per model or node.

## R-003 — Discovery is not registration or readiness

**Decision**: Node discovery produces non-selectable `DISCOVERED` candidates. An operator must publish a reviewed immutable version before planning can select it.

**Rationale**: A node schema does not reveal trusted provider ownership, pricing, credential scope, output semantics, safety constraints, or whether dynamic inputs need special prompt mapping.

**Rejected**: Automatically making any discovered ComfyUI node production-selectable; requiring every candidate to be authored entirely by hand.

## R-004 — Compiler profiles own model/node differences

**Decision**: A reviewed compiler profile maps semantic shot requirements to node selection, graph template, dynamic ports, ordered references, prompt labels, output extraction, and validation rules.

**Rationale**: This allows capability-driven planning without allowing the Workflow Agent to invent arbitrary graphs or bypass reviewed boundaries.

**Rejected**: A single fixed H3 workflow instance; free-form AI graph generation in production.

## R-005 — Hailuo 03 has three relevant node contracts

**Decision**: Publish separate implementations/compiler profiles for text-to-video, reference-to-video, and first/last-frame behavior.

**Rationale**: The current official local ComfyUI source exposes different constraints: text-to-video supports no references; reference-to-video accepts dynamic images/videos/audio but requires at least one image or video; first/last-frame requires the first frame and makes the last frame optional.

**Rejected**: Treating “0–9 images” as proof that the reference node can run prompt-only; forcing every H3 shot into five semantic image slots.

## R-006 — Ordered media bindings need explicit semantics

**Decision**: The plan stores ordered bindings and the compiler emits matching prompt references such as `Image 1` and `Video 1`.

**Rationale**: ComfyUI/H3 ports do not inherently mean character, environment, product, or continuity. Meaning comes from the selected asset version, binding purpose, order, and compiled prompt.

**Rejected**: Inferring meaning from file names, paths, or fixed port positions.

## R-007 — Cost policy supports non-monetary local execution

**Decision**: Cost policy is a tagged union: `MONETARY`, `LOCAL_COMPUTE`, or `TEST_ZERO_CALL`.

**Rationale**: Local generation can consume compute without a provider invoice. It should not be assigned fabricated USD cost, nor rejected as `COST_UNAVAILABLE` merely because no monetary tariff exists.

**Rejected**: Requiring every implementation to expose USD pricing; treating missing monetary price as free.

## R-008 — Remove readiness approvals, retain execution authority

**Decision**: Remove project-wide READY, Storyboard approval, Shot Plan approval, and duplicate pre-generation approval. Retain validation of required inputs, default-off server LIVE control, exact paid-call authorization, caps/expiry, no retry, and final Owner QA.

**Rationale**: Readiness approval gates are workflow friction. Execution authorization and final acceptance govern money, side effects, and ownership and remain distinct.

**Rejected**: Reusing an earlier approval as authorization for changed shot scope or implementation; removing all safety controls together with the readiness gates.

## R-009 — Fake is removed from the product boundary only

**Decision**: Remove owner-facing Fake proposals/providers/options and production selection paths. Keep explicitly labeled fixtures and backward reads for historical evidence.

**Rationale**: Tests still need deterministic zero-call behavior, and historical provenance must remain auditable. Neither requires exposing Fake as a current owner workflow.

**Rejected**: Deleting historical Fake records; allowing test fixtures in production registry resolution.

## R-010 — Migrate additively to V3 lineage

**Decision**: New requirement, snapshot, plan, registry, authorization, and evidence records are immutable/versioned. Legacy records remain readable.

**Rationale**: Silent mutation would break auditability and could reinterpret old paid-call scope using new compiler logic.

**Rejected**: In-place conversion that overwrites legacy slot bindings or compiler identity.
