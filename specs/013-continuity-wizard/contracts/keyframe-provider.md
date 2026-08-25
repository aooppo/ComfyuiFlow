# Contract: KeyframeImageProvider

`KeyframeImageProvider` is independent from `AiModelProvider`, `VideoQaProvider`, and
`GenerationProvider` even when all adapters share Codex Manager transport.

## Capabilities

The immutable capability snapshot includes:

- `providerProfileId`, `providerId`, `modelId`, `modelSnapshot`
- `generation`, `editing`, `multipleReferenceImages`, `highFidelityInput`
- supported MIME types, dimensions, qualities, and maximum reference count
- `priceAvailable`, currency, estimate, price-as-of, and expiry
- `externalCalls` for preview, always zero

LIVE readiness requires editing, multiple references, the Provider-supported 1024×1536 portrait
request, deterministic verified 768×1344 local normalization, registered model snapshot, non-expired
price, gateway credentials, and explicit live enablement.

## Operations

```ts
interface KeyframeImageProvider {
  readonly profileId: KeyframeProviderProfileId;
  preview(input: KeyframePreviewInput): Promise<KeyframeCapabilitySnapshot>;
  generateOnce(input: KeyframeGenerationInput): Promise<KeyframeGenerationResult>;
}
```

`generateOnce` accepts one target, exact prompt, ordered verified input images, a 1024×1536 Provider
request, low quality, and idempotency/request identity. It returns exactly one image plus safe model/
usage/cost facts; project-core verifies the actual image and normalizes it to 768×1344. It
must not retry, fall back, loop over alternative models, or approve the result.

## Adapters

- `FakeKeyframeImageProvider`: deterministic fixture image, zero external calls, cost zero, full
  capability for tests and local product walkthrough.
- `CodexManagerKeyframeImageProvider`: server-only multipart request to the configured
  `/v1/images/edits` gateway route, model snapshot registered by environment/config, strict timeout,
  exactly one requested/accepted image, and no retry/fallback.

Raw gateway response bodies, credentials, Base64, and local paths never cross the provider boundary.
