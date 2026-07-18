import { z } from "zod";

const uniqueValues = <T>(values: T[]): boolean =>
  new Set(values).size === values.length;

export interface OperatingPatternSegmentPayload {
  id: string;
  name: string;
  startMin: number;
  endMin: number;
  minHeadcount: number;
  sortOrder: number;
  requiredRoleIds: string[];
}

export interface OperatingPatternPayload {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  weekdays: number[];
  segments: OperatingPatternSegmentPayload[];
}

const operatingPatternSegmentObjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(1440),
  minHeadcount: z.number().int().min(1).max(99),
  sortOrder: z.number().int().min(1),
  requiredRoleIds: z
    .array(z.string().uuid())
    .refine(uniqueValues, "Required roles must be unique"),
});

const operatingPatternObjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(1),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .refine(uniqueValues, "Weekdays must be unique"),
  segments: z.array(operatingPatternSegmentObjectSchema).max(32),
});

export const operatingPatternSchema = z.custom<OperatingPatternPayload>(
  (value) => operatingPatternObjectSchema.safeParse(value).success,
  "Invalid operating pattern"
);

export const operatingPatternsSchema = z.array(operatingPatternSchema).max(16);
