export interface StoryboardShotView {
  id?: string;
  shotKey: string;
  ordinal: number;
  title: string;
  creativeDescription: string;
  startState: string;
  action: string;
  endState: string;
  camera: string;
  composition: string;
  continuityRequirements: string[];
  durationSeconds: number;
  requirements: Array<{
    id: string;
    requirementKey: string;
    contractVersion: "asset-candidate-v1";
    inputJson: Record<string, unknown>;
  }>;
}

export interface StoryboardVersionView {
  id: string;
  versionNumber: number;
  parentVersionId: string | null;
  source: "OWNER" | "FAKE_DIRECTOR";
  creativeBrief: string;
  contentHash: string;
  createdAt: string;
  shots: StoryboardShotView[];
  manifest: null | { id: string; bindings: Array<{ requirementId: string }> };
  decisions: Array<{ id: string; decision: "APPROVED" | "REVOKED"; createdAt: string }>;
}

export interface StoryboardView {
  id: string;
  projectId: string;
  title: string;
  creativeBrief: string;
  rowVersion: number;
  headVersionId: string | null;
  approvedVersionId: string | null;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt: string | null;
  formalAssetBindingEnabled: boolean;
  headVersion: StoryboardVersionView | null;
}

export interface StoryboardListItem {
  id: string;
  title: string;
  creativeBrief: string;
  rowVersion: number;
  approvedVersionId: string | null;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt: string | null;
  headVersion: null | { versionNumber: number; shots: Array<{ id: string }> };
  _count: { versions: number; runs: number; decisions: number; generationPlans: number };
  updatedAt: string;
}
