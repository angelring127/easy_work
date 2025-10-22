import { z } from "zod";

export const BreakRuleSchema = z.object({
  storeId: z.string().uuid(),
  thresholdHours: z.number().min(0).max(24),
  breakMin: z.number().int().min(0).max(240),
  paid: z.boolean().default(false),
});

export type BreakRuleInput = z.infer<typeof BreakRuleSchema>;














