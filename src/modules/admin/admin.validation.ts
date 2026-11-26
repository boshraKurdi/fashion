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

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).passthrough();

export const positiveIdSchema = z.object({ id }).strict();
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
}).strict();

export const adminProfileSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email().max(190).optional(),
  phone: z.string().trim().max(30).optional(),
}).strict();

export const adminPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
}).strict();

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email().max(190).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
}).strict();
export const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
}).strict();
export const userRoleSchema = z.object({
  role: z.enum(["CUSTOMER", "SHOP_OWNER", "ADMIN"]),
}).strict();

export const shopUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(190).nullable().optional(),
  facebook_url: z.string().trim().url().max(500).nullable().optional(),
  instagram_url: z.string().trim().url().max(500).nullable().optional(),
  whatsapp_url: z.string().trim().url().max(500).nullable().optional(),
}).strict();

export const rejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(2000),
}).strict();
export const statusSchema = z.object({ status: z.union([z.enum(["ACTIVE", "INACTIVE"]), z.coerce.number().int().min(0).max(1)]) }).strict();

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
}).strict();

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  logo: z.string().trim().max(500).nullable().optional(),
}).strict();

export const productStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "ARCHIVED"]),
}).strict();

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
}).strict();

export const subscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.coerce.number().min(0),
  duration: z.coerce.number().int().min(1),
  durationUnit: z.enum(["DAY", "MONTH", "YEAR"]),
  features: z.any().optional(),
}).strict();

export const subscriptionDecisionSchema = z.object({
  rejectionReason: z.string().trim().max(2000).optional(),
}).strict();

export const offerSchema = z.object({
  shopId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  productIds: z.array(z.coerce.number().int().positive()).default([]),
}).strict().refine((value) => value.endAt > value.startAt, { message: "endAt must be after startAt" });

export const reviewStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN", "REJECTED"]),
}).strict();

export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  logo: z.string().trim().max(500).nullable().optional(),
  email: z.string().trim().email().max(190).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  supportEmail: z.string().trim().email().max(190).nullable().optional(),
  supportPhone: z.string().trim().max(30).nullable().optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  socialLinks: z.record(z.string(), z.string().nullable()).optional(),
  general: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const paymentAccountSchema = z.object({
  methodName: z.string().trim().min(1).max(100),
  providerName: z.string().trim().min(1).max(150),
  accountName: z.string().trim().min(1).max(150),
  accountNumber: z.string().trim().max(190).nullable().optional(),
  paymentCode: z.string().trim().max(190).nullable().optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.union([z.literal("ACTIVE"), z.literal("INACTIVE")]).optional(),
}).strict().refine((value) => value.accountNumber || value.paymentCode, { message: "Account number or payment code is required" });

export const paymentAccountUpdateSchema = z.object({
  methodName: z.string().trim().min(1).max(100).optional(),
  providerName: z.string().trim().min(1).max(150).optional(),
  accountName: z.string().trim().min(1).max(150).optional(),
  accountNumber: z.string().trim().max(190).nullable().optional(),
  paymentCode: z.string().trim().max(190).nullable().optional(),
  instructions: z.string().trim().max(5000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict();

export const paymentReviewSchema = z.object({
  transactionId: z.string().trim().max(190).optional(),
}).strict();
