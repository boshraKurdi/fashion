import { z } from "zod";

const id = z.string().regex(/^[1-9]\d*$/, "Must be a positive ID");
const nullableText = (max: number) => z.string().trim().max(max).nullable();
const nullableSocialUrl = z.string().trim().max(500).url()
  .refine((value) => /^https?:\/\//i.test(value), "Must use HTTP or HTTPS")
  .nullable();
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};
const pageQuery = z.object(pagination).strict();

export const shopUpdateSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  description: nullableText(65535).optional(),
  phone: nullableText(30).optional(),
  email: z.string().trim().email().max(190).nullable().optional(),
  logo: nullableText(500).optional(),
  coverImage: nullableText(500).optional(),
  facebookUrl: nullableSocialUrl.optional(),
  instagramUrl: nullableSocialUrl.optional(),
  whatsappUrl: nullableSocialUrl.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const shopRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: nullableText(65535).optional(),
  phone: nullableText(30).optional(),
  email: z.string().trim().email().max(190).nullable().optional(),
  facebookUrl: nullableSocialUrl.optional(),
  instagramUrl: nullableSocialUrl.optional(),
  whatsappUrl: nullableSocialUrl.optional(),
}).strict();

const variantInput = z.object({
  colorId: id.nullable().optional(),
  sizeId: id.nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  salePrice: z.number().min(0).nullable().optional(),
  sku: z.string().trim().max(100).nullable().optional(),
}).strict().refine((value) => value.salePrice == null || value.price == null || value.salePrice <= value.price, {
  message: "Variant sale price must not exceed its regular price",
  path: ["salePrice"],
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: nullableText(65535).optional(),
  categoryId: id,
  brandId: id.nullable().optional(),
  price: z.number().min(0),
  salePrice: z.number().min(0).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN"]).default("DRAFT"),
  images: z.array(z.object({
    image: z.string().trim().min(1).max(500),
    isPrimary: z.boolean().default(false),
    sortOrder: z.number().int().min(0).default(0),
  }).strict()).max(50).default([]),
  variants: z.array(variantInput).max(100).default([]),
}).strict().refine((value) => value.salePrice == null || value.salePrice <= value.price, {
  message: "Sale price must not exceed the regular price",
  path: ["salePrice"],
}).refine((value) => value.images.filter((image) => image.isPrimary).length <= 1, {
  message: "A product can have at most one primary image",
  path: ["images"],
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: nullableText(65535).optional(),
  categoryId: id.optional(),
  brandId: id.nullable().optional(),
  price: z.number().min(0).optional(),
  salePrice: z.number().min(0).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const productStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN"]),
}).strict();

export const productListQuerySchema = z.object({
  ...pagination,
  search: z.string().trim().max(200).optional(),
  categoryId: id.optional(),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "ARCHIVED"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(["newest", "price"]).default("newest"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: "minPrice must not exceed maxPrice",
});

export const imageCreateSchema = z.object({
  image: z.string().trim().min(1).max(500),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
}).strict();
export const imageUpdateSchema = z.object({
  image: z.string().trim().min(1).max(500).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const variantCreateSchema = variantInput;
export const variantUpdateSchema = variantInput.refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const orderListQuerySchema = z.object({
  ...pagination,
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  paymentStatus: z.enum(["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().max(50).optional(),
}).strict().refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "startDate must not be after endDate",
});
export const orderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
}).strict();

const offerFields = {
  title: z.string().trim().min(1).max(180),
  description: nullableText(65535).optional(),
  image: nullableText(500).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().positive(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  productIds: z.array(id).min(1).max(500),
};
export const offerCreateSchema = z.object(offerFields).strict();
export const offerUpdateSchema = z.object({
  title: offerFields.title.optional(),
  description: offerFields.description,
  image: offerFields.image,
  discountType: offerFields.discountType.optional(),
  discountValue: offerFields.discountValue.optional(),
  startAt: offerFields.startAt.optional(),
  endAt: offerFields.endAt.optional(),
  productIds: offerFields.productIds.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export const offerStatusSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
}).strict();
export const offerListQuerySchema = z.object({
  ...pagination,
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "EXPIRED"]).optional(),
}).strict();

const branchFields = {
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(255),
  phone: nullableText(30).optional(),
  city: z.string().trim().min(1).max(100),
  area: nullableText(100).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
};
export const branchCreateSchema = z.object(branchFields).strict();
export const branchUpdateSchema = z.object({
  name: branchFields.name.optional(),
  address: branchFields.address.optional(),
  phone: branchFields.phone,
  city: branchFields.city.optional(),
  area: branchFields.area,
  latitude: branchFields.latitude,
  longitude: branchFields.longitude,
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");
export const branchStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
}).strict();

export const reviewListQuerySchema = z.object({
  ...pagination,
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(["newest", "rating"]).default("newest"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const subscriptionRequestSchema = z.object({
  planId: id,
}).strict();
export const subscriptionHistoryQuerySchema = pageQuery;

export const pathIdSchema = id;
