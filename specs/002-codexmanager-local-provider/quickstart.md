# Quickstart: CodexManager Local Test Provider

## Prerequisites

- CodexManager listens on `127.0.0.1:48760`.
- The platform key is available to the server process as `CODEX_MANAGER_API_KEY`; do not place it in
  project files or terminal history.
- ComfyUI readiness prerequisites from feature 001 remain satisfied.

## Zero-call verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm secret:scan
git diff --check
```

Run the existing spike dry-run with a valid request fixture:

```bash
pnpm --silent spike dry-run --request /absolute/path/to/request.json
```

Expected evidence:

- `director.providerId` is `codexmanager-local`.
- The local requested model is `gpt-5.4` and is clearly identified as a gateway-managed alias.
- The destination is identified only as a loopback local gateway.
- `providerCalls` is `0`.
- No credential appears in output.
- `director.readiness` reports only configured state or a non-secret missing/unreachable reason.

## LIVE boundary

Do not run `spike run` as part of feature verification. A real Director request still requires the
existing LIVE environment gate, an exact one-call authorization grant bound to the dry-run scope,
owner-selected assets, and separate ComfyUI authorization.
