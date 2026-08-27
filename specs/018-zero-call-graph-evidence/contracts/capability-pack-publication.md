# Capability Pack publication API

## Local administrator authentication

All methods require `x-capability-publication-token`, matched only against the server deployment
environment variable `CAPABILITY_PUBLICATION_ADMIN_TOKEN`. The token is never persisted or returned.
Missing configuration returns `503 CAPABILITY_PUBLICATION_DISABLED`; invalid/missing token returns
`403 CAPABILITY_PUBLICATION_ADMIN_REQUIRED`.

## `PUT /api/admin/capability-packs`

Input: unsigned Pack JSON or Pack JSON containing any prior `expectedManifestSha256` value.

Output `200`:

```json
{
  "manifest": { "schemaVersion": 1, "expectedManifestSha256": "<canonical sha256>" },
  "externalCalls": 0
}
```

This endpoint validates and supplies the canonical digest for review. It does not write the
database or contact ComfyUI/provider services.

## `POST /api/admin/capability-packs`

Input:

```json
{
  "actorRef": "local-admin",
  "manifest": { "schemaVersion": 1, "expectedManifestSha256": "<canonical sha256>" }
}
```

Output `201`: receipt id, Pack digest, derived capability/implementation refs, lifecycle `TRIAL`,
timestamp and `externalCalls: 0`.

The manifest must be exact, strict v1 JSON. A client cannot supply lifecycle, provider/adapter/
validator refs, registry IDs, receipt fields, raw graph, secret or authorization. The server always
derives those values and the lifecycle is always `TRIAL`.

## `GET /api/admin/capability-packs`

Output `200`: at most 100 safe receipt facts in newest-first order. It excludes Pack JSON, tokens,
credentials, endpoint URLs and graph data.
