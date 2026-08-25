export const PHASE2_STORYBOARD_BINDINGS_ENV = "PHASE2_STORYBOARD_BINDINGS_ENABLED";

export interface StoryboardGate {
  phase2BindingsEnabled: boolean;
}

export function storyboardGate(
  environment: Record<string, string | undefined> = process.env,
): StoryboardGate {
  return {
    phase2BindingsEnabled: environment[PHASE2_STORYBOARD_BINDINGS_ENV] === "true",
  };
}
