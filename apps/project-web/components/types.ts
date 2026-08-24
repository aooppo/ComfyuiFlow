export interface ProjectView {
  id: string;
  name: string;
  brief: string | null;
  targetAspectRatio: string;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: string;
}

export interface AssetView {
  id: string;
  projectId: string;
  originalFilename: string;
  displayName: string;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO";
  role: string;
  notes: string | null;
  status: "PRESERVED" | "READY" | "INVALID" | "REMOVED";
  sha256: string;
  byteSize: number;
  detectedMimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  inspectionWarning: string | null;
  createdAt: string;
  updatedAt: string;
}

export const roleOptions = [
  ["SCENE", "Scene"],
  ["PRODUCT", "Product"],
  ["CHARACTER_FULL_BODY", "Character · full body"],
  ["CHARACTER_FACE", "Character · face"],
  ["CHARACTER_REAR_SIDE", "Character · rear / side"],
  ["PROP", "Prop"],
  ["AUDIO", "Audio"],
  ["OTHER", "Other"],
] as const;

export function roleLabel(role: string) {
  return roleOptions.find(([value]) => value === role)?.[1] ?? role;
}
