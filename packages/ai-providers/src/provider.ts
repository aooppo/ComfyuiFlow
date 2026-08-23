import type { AiProviderResult, AiTaskRequest } from "@comfyuiflow/contracts";

export interface AiModelCapabilities {
  providerId: string;
  modelId: string;
  inputModalities: Array<"text" | "image" | "video">;
  structuredOutput: boolean;
}

export interface AiModelProvider {
  getCapabilities(modelId: string): AiModelCapabilities;
  validateConfiguration(): Promise<{ configured: boolean; reason?: string }>;
  generateStructured(request: AiTaskRequest): Promise<AiProviderResult>;
}
