# Dynamic Hailuo 03 Capability V3 Contract

## Authority boundary

The AI Director and Capability Planner may emit only semantic intent, bounded generation parameters,
and reference roles. They may not emit executable ComfyUI JSON, node classes, node IDs, links,
endpoints, credentials, paths, output prefixes, upload targets, or commands.

Only the server-owned deterministic compiler may create a Graph. Only an independently validated and
persisted `MaterializedGraphSnapshotV3` may be included in an execution authorization. The Worker
submits the frozen snapshot bytes and must not recompile.

## ReferencePlanV3

```ts
type Hailuo03Ratio = "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
type Hailuo03Resolution = "768P" | "2K";

interface ReferencePlanV3 {
  schemaVersion: "reference-plan-v3";
  shotId: UUID;
  storyboardVersionId: UUID;
  generationSpecId: UUID;
  implementationRef: VersionRef;
  compilerRef: VersionRef;
  durationSeconds: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  aspectRatio: Hailuo03Ratio;
  resolution: Hailuo03Resolution;
  seed: number;
  watermark: boolean;
  prompt: string;
  bindings: ReferenceBindingV3[];
  referencePlanDigest: Sha256;
}

interface ReferenceBindingV3 {
  sourceRef: VersionRef;
  sha256: Sha256;
  modality: "IMAGE" | "VIDEO" | "AUDIO";
  role:
    | "SCENE"
    | "CHARACTER_IDENTITY"
    | "CHARACTER_FACE"
    | "CHARACTER_BODY"
    | "CHARACTER_REAR"
    | "PRODUCT"
    | "STYLE"
    | "CONTINUITY_FRAME"
    | "REFERENCE_VIDEO"
    | "REFERENCE_AUDIO"
    | "OTHER";
  order: number;
  necessity: "REQUIRED" | "OPTIONAL";
  selectionReasonCode: string;
  stagedInputName: string;
  upstreamLineage?: {
    attemptId: UUID;
    artifactId: UUID;
    frameId: UUID;
    frameSha256: Sha256;
  };
}
```

Canonical ordering is modality `IMAGE`, `VIDEO`, `AUDIO`, then role rank, explicit order, and exact
source reference. Filename and filesystem path do not participate in semantic selection.

## Capability envelope

- Image references: 0–9.
- Video references: 0–3.
- Audio references: 0–3.
- Reference-node invariant: at least one image or video.
- Audio invariant: audio cannot be the only reference modality.
- Duration: integer 4–15 seconds.
- Ratio: `adaptive`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`.
- Resolution: `768P`, `2K`.
- Output: MP4 through `SaveVideo`.

Individual reference media must satisfy the exact validated runtime contract. A future change to
image dimensions/aspect, reference-video/audio duration totals, or FPS creates a new runtime-contract
digest and evidence scope.

## Deterministic materialization

The compiler allocates numeric node IDs in this exact order:

1. Ordered image `LoadImage` nodes.
2. Ordered video `LoadVideo` nodes.
3. Ordered audio `LoadAudio` nodes.
4. One `MinimaxHailuo03ReferenceNode`.
5. One `SaveVideo`.

Connections use `model.reference_images.image_N`, `model.reference_videos.video_N`, and
`model.reference_audios.audio_N`. Saver input is the Hailuo node `VIDEO` output. The output prefix is
derived server-side from immutable project/plan/shot/attempt-safe identifiers and never accepted from
Planner, LLM, or browser input.

Canonical JSON bytes produce `materializedGraphSha256`. Identical normalized input must produce
identical bytes and SHA. Different ReferencePlans may share the same implementation identity but
each Attempt freezes its own Graph SHA.

## Validation and stable blockers

The validator returns either `VALID` with exact compiler/validator/envelope/runtime-contract facts,
or `BLOCKED` with one stable code. Required codes include:

- `HAILUO_IMAGE_LIMIT_EXCEEDED`
- `HAILUO_VIDEO_LIMIT_EXCEEDED`
- `HAILUO_AUDIO_LIMIT_EXCEEDED`
- `HAILUO_VISUAL_REFERENCE_REQUIRED`
- `HAILUO_AUDIO_REQUIRES_VISUAL_REFERENCE`
- `HAILUO_DURATION_UNSUPPORTED`
- `HAILUO_RATIO_UNSUPPORTED`
- `HAILUO_RESOLUTION_UNSUPPORTED`
- `HAILUO_NODE_CLASS_FORBIDDEN`
- `HAILUO_GRAPH_TOPOLOGY_INVALID`
- `HAILUO_STAGED_INPUT_INVALID`
- `HAILUO_OUTPUT_MAPPING_INVALID`
- `HAILUO_RUNTIME_CONTRACT_DRIFT`
- `HAILUO_EXECUTABLE_INPUT_FORBIDDEN`

Validation occurs before authorization. A blocked result creates no authorization, consumption,
Attempt, MCP request, Provider task, or paid call.

## Implementation and Attempt identity

Formal dynamic implementation identity includes:

- compiler id/version;
- validator id/version;
- validated capability-envelope digest;
- adapter id/version;
- runtime-contract digest;
- model and provider exact refs;
- evidence-policy version.

The fixed `minimax-h3-project-shot-4s-v1` Workflow SHA is excluded from this identity. It remains
known-good fixture/provider evidence only.

Each Attempt additionally binds `ReferencePlanV3`, `GenerationSpecV3`, Graph snapshot,
`materializedGraphSha256`, staged-input manifest digest, authorization, consumption, and exact cost
facts.

## READY evidence

Every selectable capability-envelope slice must have PASS evidence for the exact identity:

1. compiler matrix;
2. independent Graph validator;
3. runtime `/object_info` compatibility/readiness;
4. authorized runtime/E2E submission, artifact, FFprobe, review frames, and technical outcome.

Provider documentation, node schema, fixture Graph, compiler output, or runtime readiness alone is
insufficient for READY. Missing evidence leaves the slice `TRIAL` or `BLOCKED`.

## Worker, retry, and assembly

The Worker appends AuthorizationConsumption and Attempt before the first network byte. One Attempt
has at most one submission. Timeout or ambiguous result is terminal and is not retried automatically.
Artifact completion requires download, SHA-256, FFprobe, and first/middle/last review frames.
`AI_QA_UNAVAILABLE` is advisory; Owner review remains explicit.

Owner FAIL creates only a zero-call retry preview. A new authorization and new Attempt are required.
Assembly requires Owner-approved artifacts and is idempotent by ordered source digest. All prior
Attempts, consumptions, artifacts, QA, decisions, retries, and assemblies remain readable.
