# Validation Guide: Remote H3 Reference Capability Pack

1. Run focused Pack/compiler/catalog tests; they must prove unsafe manifests and staging contexts fail before an external action.
2. Use the administrator review endpoint to canonicalize the H3 Pack and check the server-returned digest. This makes no database or runtime write.
3. Compile the five-reference Test A intent with server-owned staged names and run zero-call preflight. Only runtime `GET` facts are permitted; verify no `/prompt` call is made.
4. Publish only the reviewed canonical manifest. Read back one immutable `TRIAL` receipt and its frozen references; verify zero external calls.
5. Do not start a worker or create a batch. A separate exact Test A preview and fresh confirmation remain required.
