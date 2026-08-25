# Data Model

- `StoryboardDirectorRun`: existing aggregate extended with V2 profile/model/head/scope, max shots,
  status, price snapshot, idempotency, lease, and terminal facts.
- `StoryboardDirectorInputReference`: ordered immutable alias, asset/version/binding/file, semantic
  facts, expected SHA-256 and size.
- `StoryboardDirectorAuthorization`: one run, one allowed call, expiry, consumed timestamp.
- `StoryboardDirectorAttempt`: created with authorization consumption before I/O; records status,
  actual model, safe response ID, and failure classification.
- `StoryboardDirectorProposal`: one completed run, normalized narrative/shots JSON and output hash.
- `StoryboardDirectorProposalDecision`: append-only REJECTED or ADOPTED decision.
- `StoryboardVersion`: source enum gains `AI_DIRECTOR` and nullable source proposal relation.

All relations are project-scoped through the run/storyboard and use additive indexes/uniques.
Proposal JSON never stores credentials, paths, Base64, or raw Provider payloads.
