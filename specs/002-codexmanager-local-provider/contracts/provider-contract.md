# Contract: `codexmanager-local`

## Registration

```text
providerId = codexmanager-local
displayName = CodexManager Local
baseUrl = fixed loopback gateway
credentialEnv = CODEX_MANAGER_API_KEY
supportedTask = STORYBOARD_GENERATION
inputModalities = text,image
structuredOutput = true
```

The base URL and credential environment name are server-owned constants. No API or request body may
override them.

## Configuration validation

```json
{ "configured": true }
```

or a non-secret reason:

```json
{ "configured": false, "reason": "CODEX_MANAGER_API_KEY is missing" }
```

Configuration validation may probe local readiness but must not create a model response and must
have a bounded timeout.

## Structured generation

Input and output conform to the existing `AiTaskRequest` and `AiProviderResult` schemas. The
adapter accepts only its registered provider ID and registered `gpt-5.4` gateway alias, sends two
image inputs, sets `store:false`, and requests the existing strict shot schema.

Returned provenance must include:

```json
{
  "providerId": "codexmanager-local",
  "requestedModelId": "gpt-5.4",
  "resolvedModelId": "<gateway reported or requested model>",
  "responseId": "<gateway response id>",
  "providerMetadata": {
    "gateway": "loopback",
    "store": false
  }
}
```

Invalid output, mismatched duration, authentication failure, or transport failure terminates the
attempt. No automatic repair, retry, or Provider fallback is permitted.
