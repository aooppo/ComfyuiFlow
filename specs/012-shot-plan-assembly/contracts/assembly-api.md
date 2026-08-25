# Contract: Shot Plan Assembly API

## GET `/api/generation-plans/{planId}/assemblies`

Returns the assembly projection for the currently approved version.

```json
{
  "eligible": false,
  "approvedVersionId": "uuid",
  "missingOrdinals": [3],
  "sourceSetHash": null,
  "sources": [{ "ordinal": 1, "generationSpecId": "uuid", "artifactId": "uuid", "sha256": "hex" }],
  "currentAssembly": null,
  "assemblies": []
}
```

Assembly views contain `id`, `createdAt`, `sha256`, `byteSize`, `detectedMimeType`, media facts,
`assemblerVersion`, ordered sources, and computed `stale`. They never contain `storageKey` or an
absolute path.

Safe failures: `PLAN_NOT_FOUND`, `PLAN_NOT_APPROVED`, `APPROVED_VERSION_NOT_FOUND`.

## POST `/api/generation-plans/{planId}/assemblies`

Header: `Idempotency-Key: <non-empty <=120 characters>`

Body:

```json
{ "expectedSourceSetHash": "optional 64-character hex" }
```

The server re-resolves the approved version and owner-PASS sources. If
`expectedSourceSetHash` is supplied and no longer matches, it fails closed. An identical existing
assembly is returned idempotently; otherwise the server performs one local FFmpeg operation,
validates, stores, and appends the result.

Success: `201` for a newly created assembly or `200` for an existing exact assembly, with the full
safe assembly state and `assembly` identity.

Safe failures: `ASSEMBLY_NOT_READY`, `SOURCE_SET_CHANGED`, `SOURCE_CONTENT_INVALID`,
`LOCAL_ASSEMBLER_UNAVAILABLE`, `ASSEMBLY_MEDIA_INVALID`, `ASSEMBLY_PERSISTENCE_FAILED`.

This route cannot submit H3/ComfyUI, call AI QA, consume an ExecutionAuthorization, record Human QA,
or change a retry prompt.

## GET `/api/generation-plan-assemblies/{assemblyId}/content`

Returns hash-verified `video/mp4` bytes and supports valid single `Range` requests using `206`,
`Content-Range`, `Accept-Ranges`, `Content-Length`, and `Cache-Control: private, no-store`.

Safe failures: `ASSEMBLY_NOT_FOUND`, `ASSEMBLY_CONTENT_MISSING`, `ASSEMBLY_CONTENT_MISMATCH`,
`INVALID_RANGE`.
