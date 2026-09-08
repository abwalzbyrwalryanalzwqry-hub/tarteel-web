import { z } from "zod";

export const syncOperationSchema = z.object({
  operationId: z.string().min(8),
  entity: z.enum(["center", "circle", "teacher", "student", "session", "attendance", "memorization", "revision", "evaluation", "bookmark"]),
  entityId: z.string().min(1),
  operationType: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payloadJson: z.string().min(2),
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  baseVersion: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});

export const syncPushRequestSchema = z.object({
  deviceId: z.string().min(1),
  cursor: z.string().nullable(),
  operations: z.array(syncOperationSchema).max(100),
});

export const syncPushResponseSchema = z.object({
  acceptedOperationIds: z.array(z.string()),
  conflicts: z.array(z.object({
    operationId: z.string(),
    entity: z.string(),
    entityId: z.string(),
    localJson: z.string(),
    remoteJson: z.string(),
    remoteVersion: z.number().int().nonnegative(),
  })),
});

export const syncPullRequestSchema = z.object({
  deviceId: z.string().min(1),
  cursor: z.string().nullable(),
  scope: z.array(z.object({
    scopeType: z.string(),
    scopeId: z.string().nullable(),
  })).max(64),
  limit: z.number().int().min(1).max(200).default(100),
});

export const syncPullResponseSchema = z.object({
  changes: z.array(z.object({
    entity: z.string(),
    entityId: z.string(),
    payloadJson: z.string(),
    version: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
  })),
  nextCursor: z.string().nullable(),
});

export type SyncOperationPayload = z.infer<typeof syncOperationSchema>;
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
