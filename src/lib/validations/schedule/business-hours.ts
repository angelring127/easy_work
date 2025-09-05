import { z } from "zod";

export const BusinessHourSchema = z
  .object({
    storeId: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    openMin: z.number().int().min(0).max(1440),
    closeMin: z.number().int().min(0).max(1440),
  })
  .refine((v) => v.closeMin !== v.openMin, {
    path: ["closeMin"],
    message: "시작 시간과 종료 시간은 같을 수 없습니다",
  });

export type BusinessHourInput = z.infer<typeof BusinessHourSchema>;
