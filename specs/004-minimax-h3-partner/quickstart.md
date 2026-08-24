# Quickstart: MiniMax H3 Partner Node Migration

## What this migration does

It makes the local ComfyUI application a thin, loopback-only executor for MiniMax H3 Partner Node
tasks. H3 runs remotely through Comfy Credits; no local H3/Wan model is downloaded or used.

## Owner setup before any paid generation

1. Start ComfyUI locally without `--disable-api-nodes`.
2. In ComfyUI, open **Settings → User** and sign in to the owner's Comfy account.
3. Open **Settings → Credits** and buy enough Comfy Credits. This is a user payment action and is
   not part of project setup.
4. Confirm the `MiniMax H3 Reference to Video` node appears in the Partner/MiniMax category.

## Cost-free migration verification

Run the registered workflow readiness and dry-run checks. Expected results:

- `minimax-h3-reference-to-video` is the sole enabled workflow.
- Node readiness finds `LoadImage`, `MinimaxHailuo03ReferenceNode`, and `SaveVideo`.
- Missing local models is empty because H3 has no local model dependencies.
- `generationCalls: 0` and `providerCalls: 0`.
- The three exact Wan weight paths have been removed only after this readiness result passes.

## Future single paid H3 shot

Do this only after a new exact owner authorization:

1. Provide two distinct inputs: character as `Image 1`, scene as `Image 2`.
2. Use a prompt that explicitly names both references.
3. Start at 768P, 9:16, 5 seconds, 24fps with no reference video/audio or 2K regeneration.
4. Submit once through the project authorization gate.
5. Inspect the retained MP4 visually and listen to its audio; technical success is not creative
   approval.

Do not automatically retry, use a backup provider, or re-run at 2K without a separate owner
authorization.
