# Workflow Registry

The registry is intentionally empty. A reachable ComfyUI server is not generation readiness.

Before enabling a workflow, export it in ComfyUI API format and review every node. The manifest
must declare the exact workflow hash, required node classes and model filenames, allowlisted JSON
Pointer bindings for character, scene, prompt, duration, width, height, and fps, plus one video
output node/media key. Hidden network/API nodes and arbitrary paths are not permitted.

Model weights, secrets, and generated media must never be committed here.
