import { z } from "zod";

const id = z.string().regex(/^[1-9]\d*$/, "Must be a positive ID");

export const shopListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).default("PENDING"),
}).strict();

export const shopIdSchema = z.object({ id }).strict();

export const shopDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED") }).strict(),
  z.object({
    decision: z.literal("REJECTED"),
    rejectionReason: z.string().trim().min(1).max(2000),
  }).strict(),
]);

export type ShopListQuery = z.infer<typeof shopListQuerySchema>;
export type ShopDecision = z.infer<typeof shopDecisionSchema>;
