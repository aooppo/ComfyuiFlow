# Contract: Minimum-Cost H3 Validation

## Constraint resolution

- Owner request: 2 seconds to avoid wasting credits.
- Installed H3 constraint: integer duration 4–15 seconds.
- Executable duration: 4 seconds, the minimum supported value; never silently round a LIVE request.
- Installed 768P price-badge estimate: `$0.5148` (`4 × $0.1287`). Provider settlement remains
  authoritative.

## Fixed validation scope

- Workflow: `minimax-h3-decorolala-validation-4s-v1`.
- Workflow SHA-256: `6eb380b17fd775ee15e45cc7a65b5fb80478954bc51c027faff67dcd5b0d1d7a`.
- Profile: 768×1344, 9:16, 24fps, 4 seconds, watermark off.
- References: the same five immutable Image 1–5 assets and hashes from `h3-live-attempt.md`.
- Prompt: one continuous product-led tableau; Lady LaLa stands near the fireplace holding the only
  half-filled red-wine glass; table remains the foreground hero.
- Excluded: walking, placing the glass, sitting, multiple cuts, text, logo, narration, dialogue,
  retry, fallback, replacement, 15-second submission, and 2K upgrade.

## Gates

Preparation and dry-run make zero external calls. Partner credential readiness must pass before a
new action-time handoff. A future execution still requires a fresh exact owner confirmation and new
single-use grants; the prior failed attempt grants cannot be reused.
