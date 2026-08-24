# Data Model: Wan2.2 Stability Recovery

## RecoveryCandidate

| Field                | Rule                                                        |
| -------------------- | ----------------------------------------------------------- |
| `workflowId`         | New immutable identifier, distinct from the failed baseline |
| `version`            | New candidate version                                       |
| `workflowSha256`     | Exact graph content hash                                    |
| `baselineWorkflowId` | Failed v1 identifier retained for comparison                |
| `rationale`          | Plain-language list of quality risks addressed              |
| `mediaProfile`       | Fixed width, height, frames, fps, duration, and codec       |
| `enabled`            | Only the selected candidate is executable                   |

## RecoveryAttempt

Uses the existing append-only run stream. It links the exact asset hashes, Director result,
candidate hash, one-call grants, provider task ID, retained video facts, and technical completion.

State path:

```text
DRY_RUN -> AUTHORIZED -> SUBMITTED -> IN_PROGRESS
  -> COMPLETED -> REVIEW_REQUIRED -> PASS | FAIL | RISK_ACCEPTED
```

Polling exhaustion enters an ambiguous/reconcilable state and never returns to submission.

## ReviewEvidence

| Field              | Rule                                    |
| ------------------ | --------------------------------------- |
| `artifactId`       | Retained video identity                 |
| `videoSha256`      | Exact reviewed bytes                    |
| `contactSheetPath` | First, middle, and final frames         |
| `decision`         | Owner-only PASS, FAIL, or RISK_ACCEPTED |
| `notes`            | Append-only explanation                 |

The failed v1 candidate, artifact, and review remain immutable after v2 is added.
