import { z } from "zod";

// 매장 직무 역할 스키마
export const StoreJobRoleSchema = z.object({
  storeId: z.string().uuid(),
  name: z
    .string()
    .min(1, "역할명은 필수입니다")
    .max(48, "역할명은 48자 이하여야 합니다"),
  code: z.string().max(32, "코드는 32자 이하여야 합니다").optional(),
  description: z.string().max(160, "설명은 160자 이하여야 합니다").optional(),
  active: z.boolean().default(true),
});

// 유저 매장 직무 역할 스키마
export const UserStoreJobRolesSchema = z.object({
  storeId: z.string().uuid(),
  userId: z.string().uuid(),
  jobRoleIds: z
    .array(z.string().uuid())
    .min(1, "최소 1개의 역할을 선택해야 합니다"),
});

// 근무 항목 역할 요구 스키마
export const WorkItemRequiredRolesSchema = z.object({
  workItemId: z.string().uuid(),
  roles: z.array(
    z.object({
      jobRoleId: z.string().uuid(),
      minCount: z
        .number()
        .int()
        .min(0, "최소 인원은 0 이상이어야 합니다")
        .max(99, "최소 인원은 99 이하여야 합니다"),
    })
  ),
});

// 직무 역할 업데이트 스키마
export const UpdateStoreJobRoleSchema = z.object({
  name: z.string().min(1).max(48).optional(),
  code: z.string().max(32).optional(),
  description: z.string().max(160).optional(),
  active: z.boolean().optional(),
});

// 타입 내보내기
export type StoreJobRoleInput = z.infer<typeof StoreJobRoleSchema>;
export type UserStoreJobRolesInput = z.infer<typeof UserStoreJobRolesSchema>;
export type WorkItemRequiredRolesInput = z.infer<
  typeof WorkItemRequiredRolesSchema
>;
export type UpdateStoreJobRoleInput = z.infer<typeof UpdateStoreJobRoleSchema>;
