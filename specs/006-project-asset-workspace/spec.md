# Feature Specification: Project and Asset Workspace

**Feature Branch**: `codex/phase-0-discovery`

**Created**: 2026-08-24

**Status**: Approved for implementation

**Input**: User description: "进入 Phase 1 Project/Asset 开发"

## User Scenarios & Testing

### User Story 1 - Create and reopen a video project (Priority: P1)

As the local owner, I can create a named video project with a short creative brief and target
format, see it in a project library, and reopen it later without using technical identifiers.

**Why this priority**: Every later storyboard, generation, and QA record needs a durable project
boundary that an ordinary user can recognize.

**Independent Test**: From an empty workspace, create a project, return to the project library,
reopen the project card, and confirm its name, brief, target format, timestamps, and empty asset
library remain intact.

**Acceptance Scenarios**:

1. **Given** an empty workspace, **When** the owner provides a valid name and optional brief and
   target format, **Then** one project is created and opened.
2. **Given** several projects, **When** the owner views the library, **Then** active projects appear
   newest-updated first with a useful empty state and no raw internal identifiers.
3. **Given** an existing project, **When** the owner changes its name, brief, or target format,
   **Then** the revised details are visible after leaving and reopening the project.

---

### User Story 2 - Import and organize source assets (Priority: P1)

As the local owner, I can add image, video, or audio source files to a project, assign each a clear
creative role, and inspect visual or media facts before using it in later phases.

**Why this priority**: Project creation has little value unless the original creative sources are
safe, understandable, and reusable.

**Independent Test**: Import representative image, video, and audio files, then confirm each asset
card shows its filename, type, role, size, integrity fingerprint, import state, and available media
facts while preserving the original file bytes.

**Acceptance Scenarios**:

1. **Given** a supported local file, **When** the owner imports it and chooses a role, **Then** the
   asset appears only after an intact immutable copy and integrity fingerprint are recorded.
2. **Given** multiple files, **When** the owner imports them together, **Then** valid items succeed
   independently and each invalid item receives a specific non-destructive error.
3. **Given** an imported asset, **When** the owner changes its display name, role, or notes, **Then**
   only descriptive metadata changes and the original bytes and fingerprint remain unchanged.
4. **Given** the same file is selected again in the same project, **When** import completes, **Then**
   the owner is shown the existing asset instead of receiving a second indistinguishable record.

---

### User Story 3 - Browse and safely remove workspace items (Priority: P2)

As the local owner, I can filter a project's assets, preview them, and remove unwanted project
associations without silently destroying provenance that later records may depend on.

**Why this priority**: A growing creative library must remain understandable, while provenance
rules prohibit casual destructive deletion.

**Independent Test**: Filter assets by role and media type, open image/video/audio details, remove
an unreferenced asset after confirmation, and confirm it disappears from the active library while
its audit and integrity record remain recoverable.

**Acceptance Scenarios**:

1. **Given** a mixed asset library, **When** the owner filters by media type or creative role,
   **Then** only matching assets remain and the current result count is clear.
2. **Given** a supported asset, **When** the owner opens it, **Then** an appropriate image, video,
   or audio preview is shown together with its provenance and media facts.
3. **Given** an asset that is not referenced by later work, **When** the owner confirms removal,
   **Then** it is removed from the active project library without deleting its immutable source
   evidence.
4. **Given** a project, **When** the owner archives it after confirmation, **Then** it leaves the
   active library and can be restored without data loss.

### Edge Cases

- A selected file is empty, unreadable, changes while being copied, exceeds the configured local
  size limit, or has a supported extension but invalid contents.
- Two files have the same name but different bytes, or different names but identical bytes.
- A batch contains a mix of supported and unsupported items.
- Media metadata or preview extraction fails even though the original can be preserved.
- The storage directory is unavailable or lacks enough free space during import.
- A project is archived while one of its pages is open, or an already removed asset URL is used.
- A filename, project name, brief, or note contains HTML, unusual Unicode, or path-like text.
- A source asset resides outside the project workspace or is a symbolic link.

## Requirements

### Functional Requirements

- **FR-001**: The workspace MUST support creating, listing, opening, editing, archiving, restoring,
  and viewing local single-owner projects.
- **FR-002**: Each project MUST have a stable identity, name, optional creative brief, target aspect
  ratio, lifecycle status, and created/updated timestamps.
- **FR-003**: Active project lists MUST be ordered by most recent activity and MUST provide useful
  loading, empty, and failure states.
- **FR-004**: A project MUST accept image, video, and audio imports through a non-technical file
  selection or drag-and-drop experience.
- **FR-005**: Every asset MUST record its original filename, media type, byte size, SHA-256
  fingerprint, creative role, display name, notes, import status, timestamps, and owning project.
- **FR-006**: Supported creative roles MUST include scene, product, character full body, character
  face, character rear/side, prop, audio, and other; role choices MUST be constrained rather than
  arbitrary provider terms.
- **FR-007**: An asset MUST NOT become ready until the stored bytes are verified against the
  recorded fingerprint.
- **FR-008**: Editing asset metadata MUST NOT overwrite the original source bytes, fingerprint, or
  historical import evidence.
- **FR-009**: Reimporting identical bytes into the same project MUST resolve to the existing active
  or removed asset and MUST NOT create an indistinguishable duplicate.
- **FR-010**: A multi-file import MUST isolate failures so one invalid file does not roll back
  successfully preserved files.
- **FR-011**: The workspace MUST reject unsupported, empty, unreadable, unsafe, or over-limit files
  with a specific owner-facing reason and without leaving a ready asset record.
- **FR-012**: The workspace MUST extract available dimensions and duration without treating
  metadata extraction failure as permission to alter or discard a preserved original.
- **FR-013**: The owner MUST be able to filter assets by media type and creative role and see the
  number of matching results.
- **FR-014**: The owner MUST be able to preview supported assets and inspect their filename, media
  facts, fingerprint, role, notes, and import time.
- **FR-015**: Removing an asset MUST require confirmation, hide it from the active project library,
  and retain immutable source and audit evidence; referenced assets MUST fail closed rather than
  break downstream provenance.
- **FR-016**: Archiving a project MUST require confirmation, retain all project data, and support
  explicit restoration.
- **FR-017**: Project and asset names, briefs, notes, and filenames MUST be displayed as untrusted
  text and MUST NOT be treated as markup or executable paths.
- **FR-018**: Binary assets MUST remain outside business records behind a replaceable local storage
  boundary; project state and asset metadata MUST survive application restart.
- **FR-019**: All Phase 1 interactions MUST make zero external AI, upload, ComfyUI generation, or
  paid-provider calls.
- **FR-020**: The Project/Asset interface MUST hide CLI commands, workflow graphs, provider task
  identifiers, dry-run manifests, and internal record identifiers from ordinary use.
- **FR-021**: All state-changing operations MUST return an explicit success or actionable failure
  result and MUST be safe against accidental duplicate submission.
- **FR-022**: Phase 1 MUST preserve the retained Phase 0/0.5 workflows, artifacts, hashes, and
  owner review evidence without rewriting or migrating them into unverified business state.

### Key Entities

- **Project**: A durable creative workspace with owner-facing details, target format, lifecycle
  status, and activity timestamps.
- **Asset**: A project-owned source reference with descriptive metadata, media facts, lifecycle
  state, and a link to immutable stored content.
- **Stored Object**: The preserved original bytes identified by fingerprint, size, media type, and
  storage location without exposing a filesystem path to the ordinary interface.
- **Asset Import Attempt**: Append-only evidence of a selected file, validation outcome, failure
  reason if any, and resulting asset or existing duplicate.
- **Project Activity**: A concise audit entry for creation, edits, import, removal, archive, and
  restore actions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A first-time owner can create a project and import the first valid asset in under
  three minutes without consulting command-line documentation.
- **SC-002**: A project with 500 assets opens with its first useful library view in under two
  seconds on the supported local development machine.
- **SC-003**: For a mixed batch of up to 20 files, every item receives an independent success,
  duplicate, or actionable failure result and no successful import is lost because another fails.
- **SC-004**: 100% of ready assets pass a byte-for-byte fingerprint check against their preserved
  source after an application restart.
- **SC-005**: Reimporting identical bytes into the same project produces zero additional active
  asset records.
- **SC-006**: Archive, restore, and asset removal acceptance tests demonstrate zero loss of project
  metadata, original bytes, fingerprints, and audit evidence.
- **SC-007**: Automated and interactive verification observes zero external AI, external upload,
  generation, or paid-provider calls throughout Phase 1.
- **SC-008**: A user can locate an asset by media type and role within two filter actions and can
  distinguish image, video, and audio assets without seeing internal identifiers.

## Assumptions

- Phase 1 serves one trusted local owner and does not add login, multi-user permissions,
  collaboration, sharing, or tenant isolation.
- The initial interface is desktop-first and responsive enough for inspection on a tablet;
  dedicated mobile authoring is outside this phase.
- Default accepted formats are common browser-previewable images, MP4/WebM video, and MP3/WAV/M4A
  audio; exact signatures and size limits are configuration governed.
- Project deletion and permanent binary garbage collection are outside Phase 1; archive and
  provenance-safe removal are sufficient.
- Asset understanding, AI Director, storyboard editing, generation, AI QA, assembly, and publishing
  remain later phases and are not triggered implicitly by import.
- Existing Phase 0/0.5 files remain historical evidence; Phase 1 starts with new business records
  unless a later explicitly specified import/migration is approved.

## Dependencies

- The Phase 0.5 H3 gate is open through the retained owner `PASS` decision.
- The existing constitution remains authoritative for local storage, durable provenance,
  provider-neutral later phases, and zero-call execution boundaries.

## Out of Scope

- External AI analysis, prompt generation, storyboards, shot planning, video generation, QA, retry,
  assembly, export, or provider selection.
- Accounts, permissions, cloud sync, collaboration, public links, billing, and remote deployment.
- Permanent deletion of original assets or historical Phase 0/0.5 evidence.
- Arbitrary ComfyUI workflow editing or display inside the Project/Asset interface.
