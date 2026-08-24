# Data Model: DECOROLALA H3 Live Validation

## Extended input roles

`InputAsset.role` supports `CHARACTER`, `SCENE`, `PRODUCT`, `CHARACTER_FACE`, and
`CHARACTER_REAR`. Existing two-reference requests remain valid; an additional-reference list adds
unique optional roles up to the H3 capacity.

## Advertisement request

| Field                | Rule                                                            |
| -------------------- | --------------------------------------------------------------- |
| character            | `full-body.png`, fixed SHA-256                                  |
| scene                | rustic fireplace room, fixed SHA-256                            |
| product              | IN3725 product cutout, fixed SHA-256                            |
| character face       | `2.png`, fixed SHA-256                                          |
| character rear       | `3:4.png`, fixed SHA-256                                        |
| creative description | Owner intent for Director context                               |
| generation prompt    | Owner-reviewed H3 full-reference prompt, included in scope hash |
| active workflow      | `minimax-h3-decorolala-validation-4s-v1`, fixed graph hash      |
| disabled history     | `minimax-h3-decorolala-ad-15s-v1`, preserved unchanged          |

## Workflow bindings

The manifest retains mandatory `character` and `scene` bindings and adds optional `product`,
`characterFace`, and `characterRear` bindings. Materialization fails if a registered binding has no
staged value.

## State model

```text
DRY_RUN
  -> EXACT_CONFIRMATION
  -> DIRECTOR_GRANT_CONSUMED -> DIRECTOR_COMPLETED
  -> GENERATION_GRANT_CONSUMED -> SUBMITTED
  -> COMPLETED | FAILED | AMBIGUOUS
  -> REVIEW_REQUIRED -> PASS | FAIL | RISK_ACCEPTED
```

Ambiguous state permits only query/collection of the same task. Human review never changes the
technical event history.

## External secret/payment boundary

Comfy account identity, token, API key, credit balance, charge, and payment details are not project
entities and are never persisted.
