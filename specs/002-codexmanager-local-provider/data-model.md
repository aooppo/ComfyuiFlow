# Data Model: CodexManager Local Test Provider

## LocalProviderRegistration

Version-controlled definition of the one trusted local Provider.

| Field              | Rule                                                            |
| ------------------ | --------------------------------------------------------------- |
| `providerId`       | Exactly `codexmanager-local`                                    |
| `displayName`      | CodexManager Local                                              |
| `baseUrl`          | Fixed loopback gateway; never request-controlled                |
| `modelId`          | Registered gateway alias `gpt-5.4`; not claimed as a snapshot   |
| `inputModalities`  | Text and image                                                  |
| `structuredOutput` | Required                                                        |
| `credentialState`  | `configured` or `missing`; never the credential value           |
| `readinessState`   | `ready`, `missing_credential`, `unreachable`, or `incompatible` |

## AiRunProvenance

Existing append-only run evidence continues to store:

| Field              | Rule                                                           |
| ------------------ | -------------------------------------------------------------- |
| `providerId`       | `codexmanager-local` for local gateway runs                    |
| `requestedModelId` | Exact model requested by the application                       |
| `resolvedModelId`  | Gateway response model when present, otherwise requested model |
| `responseId`       | Gateway response identifier                                    |
| `usage`            | Optional numeric gateway usage fields only                     |
| `finishReason`     | Gateway response status when present                           |
| `providerMetadata` | Non-secret destination class and `store:false` marker          |

No schema migration is required for the spike evidence stream because existing provider and model
fields are strings. Retry and fallback state transitions are intentionally absent.
