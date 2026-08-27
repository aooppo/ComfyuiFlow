# Canonical Data Model

All canonical records have immutable identity, creation time, and content digest where payload is frozen. Update and delete operations are prohibited for the execution lineage.

| Entity                    | Required facts                                                         | Relationships and invariants                          |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| CapabilityProfile         | ref, schemaVersion, digest, status                                     | owns RuntimeContract and implementations              |
| RuntimeContract           | ref, capabilityRef, node allowlist, runtime digest                     | referenced by compiler, implementation, spec, attempt |
| GenerationImplementation  | ref, capability/runtime/provider/model/adapter/compiler/validator refs | exact selectable execution identity                   |
| ShotGenerationRequirement | shot and capability constraints                                        | one or more requirements per shot                     |
| PlanningInputSnapshot     | storyboard/shot content and digest                                     | source for GenerationSpec                             |
| GenerationSpec            | all frozen identity refs and digest                                    | owns ReferencePlan and graph snapshot                 |
| ReferencePlan             | source asset refs and role bindings                                    | immutable compiler input                              |
| MaterializedGraphSnapshot | graph digest and validated graph                                       | compiler-owned, never caller-supplied                 |
| GenerationPlan            | target set and plan digest                                             | owns authorization/batch lifecycle                    |
| GenerationAuthorization   | scope, limits, prices, expiry                                          | owns immutable consumption records                    |
| GenerationBatch / Target  | selected plan targets and state                                        | one Target has at most one submitted Attempt          |
| AuthorizationConsumption  | operation, timestamp, limit snapshot                                   | append before network byte                            |
| GenerationAttempt         | frozen refs, provider task, terminal outcome                           | owns artifacts and reconciliation facts               |
| GenerationArtifact        | retained object/hash, technical facts, three frames                    | may have QA and Owner decision                        |
| AiQaRun / Result          | independent QA authorization, advisory result                          | never determines Owner state                          |
| OwnerDecision             | PASS, FAIL, or RISK_ACCEPTED                                           | required before retry/assembly                        |
| RetryPreview              | source decision and fresh target material                              | created only from Owner FAIL                          |
| GenerationAssembly        | selected approved artifacts and output facts                           | idempotent per content digest                         |

## State Rules

- Authorization is ACTIVE, CONSUMED, EXPIRED, or CANCELLED; consumption never changes the original scope.
- Attempt progresses to submitted/reconciling then one terminal outcome. Terminal ambiguity is not resubmittable.
- Artifact is technically valid only after content hash, playable-media probe, and three-frame records exist.
- Retry preview cites Owner FAIL; assembly cites owner-reviewed artifacts and is unique by input digest.
