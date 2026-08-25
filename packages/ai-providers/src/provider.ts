import type {
  AiProviderResult,
  AiTaskRequest,
  AssetUnderstandingProviderRequest,
  AssetUnderstandingProviderResult,
  StoryboardGenerationRequestV1,
  StoryboardProposalV1,
  StoryboardGenerationRequestV2,
  StoryboardProposalV2,
  AiQaRequestV1,
  AiQaResultV1,
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
    maxShotCount?: number;
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
  generateStoryboardV2?(request: StoryboardGenerationRequestV2): Promise<StoryboardProposalV2>;
  reviewVideoFrames?(request: AiQaRequestV1): Promise<AiQaResultV1>;
}
