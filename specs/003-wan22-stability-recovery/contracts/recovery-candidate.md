# Contract: Stability Recovery Candidate

## Zero-call preview

The existing dry-run request selects an explicitly registered candidate ID. Its output must include:

```text
source asset hashes
Director provider and model
candidate workflow ID, version, and SHA-256
fixed media profile
plain-language stability changes
maxDirectorCalls = 1
maxGenerationSubmissions = 1
providerCalls = 0
generationCalls = 0
```

## Candidate invariants

- The failed workflow file and hash remain present.
- Only an enabled, hash-matching registered candidate can materialize.
- Candidate v2 uses one deterministic seed and one fixed parameter set.
- The positive prompt contains intended states, action, camera, and composition.
- Quality/identity/scene exclusions remain in negative conditioning.
- No request field can override workflow nodes, model names, sampler parameters, or output path.

## LIVE and reconciliation

LIVE retains separate one-call Director and generation grants. Polling may observe one bound prompt
for up to ten minutes. Reconciliation accepts only a task ID already bound to the run and exposes no
submit operation.

## Human QA

Technical completion requires a verified playable video. Review requires first/middle/final frames
and an explicit owner decision. Only PASS opens the productization gate.
