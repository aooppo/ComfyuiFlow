# Quickstart Validation: Shot Planner and GenerationSpec

1. Apply migrations to an isolated `*_test` PostgreSQL database.
2. Create and approve a three-shot Storyboard with a frozen Manifest.
3. Create two plans with distinct idempotency keys; verify distinct IDs and identical content/hashes.
4. Replay one key with the same request, then mismatched input; verify replay and conflict behavior.
5. Edit in two sessions; verify one append and one zero-write conflict.
6. Compare history and run a zero-write, zero-call preflight.
7. Invalidate one reference and verify `REFERENCE_NOT_READY`.
8. Approve and revoke; verify immutable decisions and `generationAuthorized: false`.
9. Confirm no grant, Provider attempt, GenerationJob, Artifact, QA result, ComfyUI request, or network call exists.
10. Run all repository, database, migration, build-with-dev-running, secret, diff, and browser gates; record exact evidence in `verification.md`.
