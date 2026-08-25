import { z } from "zod";
import {
  ContinuityDecisionInputV1Schema,
  CreateContinuityVersionV1Schema,
} from "@comfyuiflow/contracts";

export const createContinuityVersionSchema = CreateContinuityVersionV1Schema;
export const continuityDecisionSchema = ContinuityDecisionInputV1Schema;
export const continuitySuggestionSchema = z
  .object({
    expectedStoryboardRowVersion: z.number().int().nonnegative(),
    idempotencyKey: z.string().trim().min(1).max(120),
  })
  .strict();

export type CreateContinuityVersionInput = z.infer<typeof createContinuityVersionSchema>;
export type ContinuityDecisionInput = z.infer<typeof continuityDecisionSchema>;
export type ContinuitySuggestionInput = z.infer<typeof continuitySuggestionSchema>;
