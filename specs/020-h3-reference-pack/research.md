# Research: Remote H3 Reference Capability Pack

## Decisions

### H3 is an installed remote-node capability

**Decision**: Use `MinimaxHailuo03ReferenceNode` with selected model `MiniMax H3` through the existing ComfyUI Partner Node.

**Evidence**: Read-only runtime catalog shows H3 supports 2K, 16:9, duration 4–15, up to nine image references, seed, and watermark control.

### Compiler owns topology and static behavior

**Decision**: Add a dedicated H3 reference compiler profile. It always emits ordered loaders, one H3 node, and one MP4 `SaveVideo` node; the Pack selects the profile but cannot define graph links or literals.

**Rationale**: A generic two-node recipe cannot express remote H3 references or complete output inputs safely.

### Frozen staging names are server context

**Decision**: Asset identifiers remain intent data. The compiler receives matching staging names only as trusted server context and rejects missing, duplicate, or unsafe values.

**Rationale**: Asset IDs are not filesystem paths nor ComfyUI input names. Treating them as such would create a graph that cannot be safely submitted.

### Dynamic node schemas must be expanded safely

**Decision**: Normalize selected safe dynamic options from the runtime catalog and validate their declared nested inputs. Do not accept arbitrary metadata, selectors, or code.

**Rationale**: H3's prompt, resolution, duration, ratio, and image references are nested below its `model` selector.
