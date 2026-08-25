# Generation Provider Contract v1

`GenerationProvider` exposes registered capability facts and four bounded operations:

- `preflight(target)`: zero-submit compatibility/readiness result.
- `submit(target)`: one exact submission; returns the preselected/bound task identity.
- `status(taskId)`: query only.
- `retainArtifacts(taskId, jobId)`: download only after terminal completion.
- `cancel(taskId)`: optional and honest about unsupported/unknown remote termination.

The Fake Provider creates deterministic local MP4 fixture output and reports external calls 0. The
H3 Provider uses the registered ComfyUI MCP client only, is fixed to
`minimax-h3-project-shot-4s-v1`, and cannot accept raw endpoint/workflow/node/path inputs.

`GenerationProviderCapabilitiesV1` reports Provider/profile identity, mode, aspect, duration,
dimensions, fps, required semantic slots, max references, output media, audio facts, cancellation,
cost visibility, and contract/workflow versions. Capability mismatches never trigger coercion or
fallback.
