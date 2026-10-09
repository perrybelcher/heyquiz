import { z } from "zod";
import { MarketingBriefSchema } from "./marketing-brief";

// A profile is a reusable brief snapshot, not a live reference from a quiz.
// Applying one copies its values so future profile edits cannot change quizzes.
export const BrandProfileInput = z.object({
  name: z.string().trim().min(1).max(100),
  brief: MarketingBriefSchema,
});
export const BrandProfileUpdate = BrandProfileInput.extend({
  revision: z.number().int().positive(),
});
export type BrandProfileData = z.infer<typeof BrandProfileInput> & { updatedAt: string };
export type BrandProfile = BrandProfileData & { id: string; revision: number };
