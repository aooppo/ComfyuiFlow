# Research: Project and Asset Workspace

## Product boundary

**Decision**: Deliver Project and Asset management only; do not add asset understanding, Director,
storyboard, ComfyUI, generation, QA, or assembly behavior.

**Rationale**: Phase 0.5 has proven the generation path, while Phase 1 must establish durable inputs
without coupling business records to any provider.

**Alternatives considered**: Running analysis automatically after import would merge two product
phases and create external-call authority that the owner did not grant.

## Business persistence

**Decision**: Use PostgreSQL through Prisma with checked-in migrations and explicit service
transactions.

**Rationale**: The constitution names PostgreSQL/Prisma, later revisions and generation records need
relational integrity, and restart persistence must be tested at the real business boundary.

**Alternatives considered**: JSON files match the spike but do not provide the lifecycle,
uniqueness, query, migration, or future relationship guarantees required for product state. SQLite
would diverge from the governed runtime.

## Immutable binary storage

**Decision**: Store originals in a configurable local content-addressed store using lowercase
SHA-256 paths, with a `StorageProvider` interface and no permanent deletion in Phase 1.

**Rationale**: Content addressing makes integrity verification and safe deduplication direct, keeps
large bytes outside PostgreSQL, and permits a later object-storage adapter without changing asset
identity.

**Alternatives considered**: Per-project mutable filenames risk overwrite and path collisions.
Database blobs violate the constitution. Copying Phase 0 evidence into the store would imply an
unapproved migration.

## Upload and trust boundary

**Decision**: Stream browser multipart bytes to a same-filesystem temporary file, hash during the
write, validate detected content and configured limits, then fsync and atomically rename.

**Rationale**: Streaming bounds memory, atomic rename prevents partial READY content, and accepting
bytes rather than paths blocks arbitrary local-file reads from the Web interface.

**Alternatives considered**: `request.formData()` can buffer large files. Accepting a client path
would expose the server filesystem and mishandle symlinks. Chunked/resumable upload is unnecessary
for the Phase 1 local limit.

## Supported formats and media facts

**Decision**: Detect allowlisted image/video/audio signatures rather than trusting extensions.
Use an image metadata reader for dimensions and FFprobe for duration/stream facts; inspection
failure becomes a warning, not source deletion.

**Rationale**: Preview and later generation need honest media facts, while the immutable input is
still valuable if optional inspection fails.

**Alternatives considered**: Extension-only validation is unsafe. Full transcoding on import would
alter provenance and add a costly worker responsibility.

## Duplicate semantics

**Decision**: Enforce one Asset per `(project, SHA-256)` and return the existing active or removed
record as a `DUPLICATE` outcome.

**Rationale**: Same-project duplicates are indistinguishable for creative use, but a shared stored
object may legitimately back assets in different projects.

**Alternatives considered**: Global asset reuse would leak project organization into storage
identity. Silently restoring a removed asset would be an unexpected mutation.

## Lifecycle and deletion

**Decision**: Projects transition `ACTIVE ↔ ARCHIVED`; assets transition `READY → REMOVED`.
No hard-delete or binary garbage collection is exposed.

**Rationale**: Archive/restore supports ordinary cleanup while preserving immutable provenance and
future downstream references.

**Alternatives considered**: Permanent deletion creates recovery and provenance risk. Allowing
removed assets to become READY implicitly during import would obscure audit history.

## Web/API boundary

**Decision**: Use one same-origin Next.js application with server-side services and explicit JSON
plus multipart routes. Ordinary pages use names, roles, previews, and confirmations rather than
technical IDs.

**Rationale**: A same-origin local app is the smallest product surface, avoids a separate service,
and still keeps a stable interface for testing and future worker integration.

**Alternatives considered**: Extending the spike CLI would contradict the requested Project/Asset
UI. A separate frontend and backend would add deployment complexity without a current boundary.

## Concurrency and idempotency

**Decision**: Database uniqueness resolves concurrent duplicate imports; archive, restore, and
remove transitions are idempotent; multi-file imports return per-item results.

**Rationale**: Double clicks and parallel local requests should not create duplicate records or
turn one bad file into a batch rollback.

**Alternatives considered**: One all-or-nothing batch transaction would discard valid preserved
work and poorly match browser retry behavior.
