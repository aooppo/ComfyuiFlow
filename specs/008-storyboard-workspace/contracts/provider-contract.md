# Storyboard Provider Contract v1

`StoryboardGenerationRequestV1` contains:

- `taskType: STORYBOARD_GENERATION_V1`
- Provider/model reference fixed by the server registry
- project/storyboard identity for provenance
- creative brief and target `shotCount: 3`
- `promptTemplateVersion: storyboard-three-shot-v1`
- optional structured asset requirements; never local file paths or raw database access

`StoryboardProposalV1` contains:

- Provider/requested/resolved model identity and response identity
- contract and prompt-template versions
- exactly three `ShotDraftV1` entries with stable shot keys and ordinals 1–3
- `providerMetadata: { fake: true, providerCalls: 0 }`

`AiModelProvider.generateStoryboard` is optional. Capability discovery must report Storyboard support
explicitly. Existing one-shot `generateStructured` behavior is unchanged. Only the deterministic
Fake Provider is registered in this phase; missing capability fails closed without fallback.
