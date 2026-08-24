# Workflow Registry

The registry contains only owner-reviewed API-format ComfyUI workflows and their hash-locked
manifests. A reachable ComfyUI server alone is not generation readiness. Model weights, Comfy
credentials, credits, and generated media must never be committed here.

## Active: DECOROLALA IN3725 four-second validation

`minimax-h3-decorolala-validation-4s-v1.api.json` is the sole enabled workflow. It loads five
immutable input files, then supplies them to `MinimaxHailuo03ReferenceNode` in fixed order:

- `Image 1`: rustic living-room scene
- `Image 2`: IN3725 coffee-table product
- `Image 3`: Lady LaLa full-body identity and wardrobe
- `Image 4`: Lady LaLa face identity
- `Image 5`: Lady LaLa rear/side identity and dress silhouette

The reviewer-controlled profile is fixed at 768P, 9:16, 24fps and the installed minimum 4 seconds
with watermark off. A requested 2-second duration is unsupported and must not be rounded during
LIVE execution. The exact six-section, single-shot full-reference prompt is schema-checked and
included in the authorization scope hash. H3 is a ComfyUI Partner Node: it does not use local model
weights. Its returned `VIDEO` is saved by ComfyUI core `SaveVideo` to one MP4 artifact.

The project sends the generated positive shot direction only through its allowlisted prompt binding.
It never accepts raw workflow JSON, node IDs, credentials, arbitrary endpoints, or output paths from
ordinary CLI input. A Partner Node API key (preferred) or short-lived auth token may come only from
the process environment and is injected into ComfyUI `extra_data`; it is excluded from workflow
hashes, authorization scopes, evidence, and logs. Missing credentials block readiness and submission
before grant consumption. A future paid task still needs enough Comfy Credits, one exact owner
authorization, artifact inspection, and human creative review. Login and purchased Credits are
prerequisites, not submission permission. No retry or provider fallback is permitted.

## Historical two-reference H3 workflow

`minimax-h3-reference-to-video.api.json` remains hash-locked but disabled. It preserves the prior
two-reference migration evidence and is not selectable for the DECOROLALA advertisement.

`minimax-h3-decorolala-ad-15s-v1.api.json` and its five-shot prompt are also preserved unchanged but
disabled. The minimum-cost validation must complete Human QA before any new 15-second authorization
is considered.

Wan workflows were retired from this directory during the H3 migration. Their historical feature
specification and previous failure evidence remain in `specs/003-wan22-stability-recovery/`.
