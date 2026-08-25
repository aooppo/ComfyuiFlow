# Variable Generation Plan Contract

- Shared `GenerationSpec v1` retains all existing fields; ordinal range expands to 1–20.
- An owner Generation Plan version contains 1–20 specs, ordered contiguously from 1 through N.
- Creation produces exactly one spec for every source StoryboardShot.
- Append/preflight/approval reject missing, duplicate, extra, or reordered source identities.
- Aggregate hashes cover the complete ordered spec array.
- Archived source Storyboards return `STORYBOARD_ARCHIVED` for create, append, preflight, and decision writes.
- Every response continues to expose `generationAuthorized: false`; no external call or execution record is created.
