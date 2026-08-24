# Quickstart: Wan2.2 Stability Recovery

## Zero-call validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
pnpm secret:scan
git diff --check
pnpm --silent spike discover
pnpm --silent spike dry-run --request /Users/tj/Documents/ChatGPT/ComfyuiFlow/var/user-inputs/request-codexmanager-local-stable.json
```

Expected preview:

- stable candidate v2 and its exact hash;
- the same two source asset hashes;
- 512x288, 33 frames, 16 fps, about 2.06 seconds;
- 20 sampling steps represented in the registered graph;
- local Director readiness and ComfyUI readiness are true;
- provider and generation calls are both zero.

Native no-queue prompt validation must return `valid: true` before authorization.

## Deterministic Human QA evidence

After a separately authorized run retains one MP4, derive three review frames without changing the
source artifact. Replace the two absolute paths and keep the generated files next to other QA
evidence, not in Git:

```bash
ffmpeg -y -i /absolute/path/to/artifact.mp4 -vf "select='eq(n,0)+eq(n,16)+eq(n,32)',scale=768:-2,tile=3x1" -frames:v 1 /absolute/path/to/contact-sheet.png
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of json /absolute/path/to/artifact.mp4
```

The three columns are first, middle, and final frame for the fixed 33-frame profile. Technical
completion does not open the product gate. Only an explicit owner `PASS` or `RISK_ACCEPTED` does;
`FAIL` keeps the gate closed and never triggers an automatic retry.

## Plain-language change summary

- More refinement time: use the official 20-step baseline instead of 12 steps.
- Cleaner instructions: keep desired action in the positive prompt and corruption/identity changes
  in the negative prompt.
- Different deterministic noise seed: avoid repeating the failed noise trajectory.
- Longer observation window: wait for the existing task for up to ten minutes without resubmitting.

## LIVE boundary

Stop after dry-run. A new attempt requires the owner to approve the exact new scope hash and permit
at most one Director request plus one ComfyUI submission. After completion, verify media, generate a
first/middle/final contact sheet, and wait for owner PASS/FAIL/RISK_ACCEPTED.
