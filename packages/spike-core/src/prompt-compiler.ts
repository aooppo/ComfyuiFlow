export interface PositiveShotPrompt {
  startState?: string;
  action?: string;
  endState?: string;
  camera?: string;
  composition?: string;
  continuityRequirements?: string[];
}

/**
 * Compile only desired visual states and motion into positive conditioning.
 * Prohibitions belong in the reviewed workflow's negative conditioning.
 */
export function compileShotPositivePrompt(shot: PositiveShotPrompt): string {
  const direction = [shot.startState, shot.action, shot.endState, shot.camera, shot.composition]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n");
  return [
    "Image 1 is the character reference. Preserve its identity and appearance.",
    "Image 2 is the scene reference. Preserve its environment and design.",
    direction,
  ]
    .filter(Boolean)
    .join("\n");
}
