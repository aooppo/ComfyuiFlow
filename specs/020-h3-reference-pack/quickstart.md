# Validation Guide: Remote H3 Reference Capability Pack

1. Run focused Pack/compiler/catalog tests; they must prove unsafe manifests and staging contexts fail before an external action.
2. Use the administrator review endpoint to canonicalize the H3 Pack and check the server-returned digest. This makes no database or runtime write.
3. Compile the five-reference Test A intent with server-owned staged names and run zero-call preflight. Only runtime `GET` facts are permitted; verify no `/prompt` call is made.
4. Publish only the reviewed canonical manifest. Read back one immutable `TRIAL` receipt and its frozen references; verify zero external calls.
5. Do not start a worker or create a batch. A separate exact Test A preview and fresh confirmation remain required.

## Verification record — 2026-08-27

- The connected ComfyUI Partner Node was read through its runtime catalog only. It advertised
  `MinimaxHailuo03ReferenceNode` with the `MiniMax H3` option, 2K, 16:9, 4–15 seconds, references,
  seed, and watermark control.
- The five-reference Test A-shaped graph passed zero-call runtime preflight: graph digest
  `a80229b77a16eb5cda278b9712e60d2c217f2ea61a308ae0ff2b8cbce111ef54`, no diagnostics, and zero
  generation calls. No staging upload or `/prompt` request occurred.
- The audited Pack digest is
  `a18576267b9278739f82e88f17dd6ef046cf1d8252328610fa9b9b92a8d598c2`. The protected local action
  appended receipt `ed8b7a84-a934-435d-88dd-f9b42eb862bf` for
  `implementation.minimax-h3-reference-video@1.0.0` as `TRIAL`; review and publication both
  reported zero external calls.
- Completed local gates: format, lint, typecheck, 37 Vitest tests, Prisma generate/validate,
  production build, secret scan, and `git diff --check`.
