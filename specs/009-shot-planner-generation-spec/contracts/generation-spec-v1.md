# GenerationSpec v1 Contract

`GenerationSpecV1` contains schema/Planner versions; project, Storyboard, Manifest and shot identities; narrative/camera/continuity/duration; normalized positive prompt; exact reference identities and SHA-256; provider-neutral mode/aspect/duration/reference-count/audio requirements; and canonical input/reference/output hashes.

The strict schema rejects unknown fields. Provider, model, workflow, node, credential, absolute path, Base64, and binary fields are never valid members. Canonical hashes recursively sort object keys and preserve array order.
