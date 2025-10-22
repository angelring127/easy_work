import { z } from "zod";

export const StaffingTargetSchema = z
  .object({
    storeId: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
    roleHint: z.string().max(32).optional(),
    minHeadcount: z.number().int().min(0).max(99).default(0),
    maxHeadcount: z.number().int().min(0).max(99).default(0),
  })
  .refine((v) => v.endMin > v.startMin, { path: ["endMin"] })
  .refine((v) => v.minHeadcount <= v.maxHeadcount, {
    path: ["minHeadcount"],
    message: "min ≤ max",
  });

export type StaffingTargetInput = z.infer<typeof StaffingTargetSchema>;


















