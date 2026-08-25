import type {
  AiProviderResult,
  AiTaskRequest,
  AssetUnderstandingProviderRequest,
  AssetUnderstandingProviderResult,
  StoryboardGenerationRequestV1,
  StoryboardProposalV1,
} from "@comfyuiflow/contracts";

export interface AiModelCapabilities {
  providerId: string;
  modelId: string;
  inputModalities: Array<"text" | "image" | "video">;
  structuredOutput: boolean;
  storyboardGeneration?: {
    contractVersions: string[];
    promptTemplateVersions: string[];
    supportedShotCounts: number[];
  };
}

export interface AiModelProvider {
  getCapabilities(modelId: string): AiModelCapabilities;
  validateConfiguration(): Promise<{ configured: boolean; reason?: string }>;
  generateStructured(request: AiTaskRequest): Promise<AiProviderResult>;
  understandAssets?(
    request: AssetUnderstandingProviderRequest,
  ): Promise<AssetUnderstandingProviderResult>;
  generateStoryboard?(request: StoryboardGenerationRequestV1): Promise<StoryboardProposalV1>;
}
