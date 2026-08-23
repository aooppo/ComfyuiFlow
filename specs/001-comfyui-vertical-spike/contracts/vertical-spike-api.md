# Vertical Spike CLI Contract

The CLI is local/operator-facing and defaults to `DRY_RUN`.

```text
pnpm spike discover
pnpm spike dry-run --request <request.json>
pnpm spike grant director --request <request.json> --expires-in <minutes>
pnpm spike grant generation --request <request.json> --expires-in <minutes>
pnpm spike run --request <request.json> --director-grant <id> --generation-grant <id>
pnpm spike status --run <id>
pnpm spike review --run <id> --decision PASS|FAIL|RISK_ACCEPTED --notes <text>
pnpm spike cancel --prompt <provider-task-id>
```

`discover`, `dry-run`, and `status` cannot create provider calls. Grant creation does not call a
provider. `run` additionally requires `OPENAI_LIVE_ENABLED=1` and `COMFYUI_LIVE_ENABLED=1` and
fails before any request if the exact scopes do not match.

## Dry-run output

- `mode: DRY_RUN`
- source asset role/path/hash/MIME/size
- Director provider/model and prompt/schema version
- selected workflow ID/version/hash/constraints
- exact bounded settings and MCP tool invocation summary
- readiness blockers
- `providerCalls: 0`

## Request file

```json
{
  "characterImage": "/absolute/path/character.png",
  "sceneImage": "/absolute/path/scene.png",
  "creativeDescription": "A concise one-shot intent",
  "workflowId": "registered-workflow-id"
}
```

Arbitrary model IDs, provider endpoints, workflow files, node IDs, or output directories are not
accepted in the request.
