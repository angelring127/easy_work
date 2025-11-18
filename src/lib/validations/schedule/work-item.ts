import { z } from "zod";

export const WorkItemSchema = z
  .object({
    storeId: z.string().uuid(),
    name: z.string().min(1).max(64),
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
    unpaidBreakMin: z.number().int().min(0).default(0),
    maxHeadcount: z.number().int().min(1).max(99).default(1),
    roleHint: z.string().max(32).optional(),
  })
  .refine((v) => v.endMin > v.startMin, {
    path: ["endMin"],
    message: "End must be greater than Start",
  })
  .refine((v) => v.unpaidBreakMin <= v.endMin - v.startMin, {
    path: ["unpaidBreakMin"],
    message: "Break too long",
  });

export type WorkItemInput = z.infer<typeof WorkItemSchema>;






























