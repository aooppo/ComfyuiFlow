# Frame-based AI QA Contract v1

## Request

`AiQaRequestV1` binds one technically valid Artifact, its GenerationSpec/hash, five exact source
references, three exact review frames, technical media facts, Provider/model, prompt/contract
versions, and request hash. It contains bytes only at the in-memory Provider boundary; durable
records keep slot identities and SHA-256 values.

## Result

Each criterion (`IDENTITY`, `WARDROBE_STATE`, `PRODUCT_STRUCTURE`, `SCENE`, `COMPOSITION`,
`CROSS_FRAME_CONTINUITY`, `VISUAL_DAMAGE`, `UNEXPECTED_OBJECTS`) returns:

- status `PASS | WARN | FAIL | NOT_ASSESSABLE`
- confidence `LOW | MEDIUM | HIGH`
- short evidence text
- zero or more frame roles `FIRST | MIDDLE | FINAL`

The result also includes overall advisory status, summary, explicit limitations, Provider/requested
and resolved model, response ID, usage when available, and canonical output hash. Motion quality and
audio semantics are always listed as limitations and cannot be promoted from the still frames.

Fake is the automated default. LIVE uses CodexManager Local `gpt-5.4`, strict structured output,
`store:false`, no retry, and one authorization consumption before the request.
