# H3 Reference Capability Pack Contract

## Pack selection

The Pack uses `compilerProfile: "h3-reference-video-v1"`, model `model.minimax-h3` at version `1.0.0`, runtime target `runtime.comfy-partner@1.0.0`, and a sorted allowlist of `LoadImage`, `MinimaxHailuo03ReferenceNode`, and `SaveVideo`.

The Pack may declare only bounded intent settings. It cannot declare a raw graph, staging filename, output prefix, endpoint, credential, or provider payload.

## Server-only compile context

```text
asset IDs:      [A1, A2, ...]
staged names:   [S1, S2, ...]
compiled links: LoadImage(S1) -> H3 Image 1; LoadImage(S2) -> H3 Image 2
```

There must be one safe, unique staged name per asset ID. This context is required for H3 compilation and not exposed to the browser/AI Pack input.

## Execution boundary

Review, publication, compilation, and runtime preflight are zero-call actions. A later Test A preview must still disclose exact price facts and receive fresh action-time Owner confirmation before staging or a remote H3 `/prompt` request.
