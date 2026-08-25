import { H3FullReferencePromptSchema } from "@comfyuiflow/contracts";
import { canonicalSha256 } from "./canonical-json.js";

export const H3_GENERATION_PROMPT_VERSION = "h3-generation-prompt-v1" as const;

export function compileH3GenerationPrompt(input: {
  positivePrompt: string;
  sceneName: string;
  productName: string;
  characterName: string;
}) {
  const prompt = `subject_definitions:
<Picture 1> is the approved scene reference: ${input.sceneName}.
<Picture 2> is the approved product reference: ${input.productName}.
<Picture 3> is the approved full-body character reference: ${input.characterName}.
<Picture 4> is the approved face identity reference for the same character.
<Picture 5> is the approved rear identity and silhouette reference for the same character.
summary:
Create one continuous four-second portrait product shot from the five approved references.
retention_analysis:
Preserve character identity, wardrobe, body proportions, product geometry, scene layout, lighting, and all approved state details.
detailed_description:
[Shot 1]
${input.positivePrompt.trim()}
overall_soundscape:
Use only natural ambient sound consistent with the approved scene. Do not rely on audio for story meaning.
non_diegetic_music:
No required non-diegetic music.`;
  return {
    version: H3_GENERATION_PROMPT_VERSION,
    prompt: H3FullReferencePromptSchema.parse(prompt),
    sha256: canonicalSha256({ version: H3_GENERATION_PROMPT_VERSION, prompt }),
  };
}
