import { z } from "zod";

export const HolidaySchema = z.object({
  storeId: z.string().uuid(),
  date: z.string(), // ISO date (YYYY-MM-DD)
});

export type HolidayInput = z.infer<typeof HolidaySchema>;






























