import type { RequestHandler } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./config/database.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { authorizeRoles } from "./middlewares/role.middleware.js";
import { AppError } from "./modules/auth/auth.service.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

const parsePaginatedQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  shopId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  colorId: z.coerce.number().int().positive().optional(),
  sizeId: z.coerce.number().int().positive().optional(),
  onSale: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["newest", "price", "name"]).default("newest"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const categoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  parentId: z.coerce.number().int().positive().optional(),
});

const reviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sortBy: z.enum(["newest", "rating"]).default("newest"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const reviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  orderId: z.coerce.number().int().positive().optional(),
});

const subscriptionSchema = z.object({
  planId: z.coerce.number().int().positive(),
});

const publicShopSelect = {
  id: true,
  name: true,
  description: true,
  logo: true,
  cover_image: true,
  status: true,
  created_at: true,
  approved_at: true,
} satisfies Prisma.ShopSelect;

const topProductSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  sale_price: true,
  status: true,
  created_at: true,
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true } },
  shop: { select: { id: true, name: true, logo: true, status: true } },
  images: { orderBy: [{ sort_order: "asc" }, { id: "asc" }], select: { id: true, image: true, is_primary: true, sort_order: true } },
  variants: { orderBy: [{ id: "asc" }], select: { id: true, price: true, sale_price: true, sku: true, color: { select: { id: true, name: true, hex_code: true } }, size: { select: { id: true, name: true, type: true } } } },
} satisfies Prisma.ProductSelect;

function parseQuery<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

function sendPaginated<T>(res: Parameters<RequestHandler>[1], items: T[], page: number, limit: number, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

function toBigInt(value: string | string[] | undefined, label: string): bigint {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized || Number.isNaN(Number(normalized))) {
    throw new AppError(`${label} is invalid`, 400);
  }

  return BigInt(normalized);
}

function getProductOrderBy(
  sortBy: "newest" | "price" | "name",
  sortOrder: "asc" | "desc",
): Prisma.ProductOrderByWithRelationInput[] {
  if (sortBy === "price") {
    return [{ price: sortOrder }, { id: "desc" }];
  }

  if (sortBy === "name") {
    return [{ name: sortOrder }, { id: "desc" }];
  }

  return [{ created_at: sortOrder }, { id: "desc" }];
}

function getReviewOrderBy(
  sortBy: "newest" | "rating",
  sortOrder: "asc" | "desc",
): Prisma.ShopReviewOrderByWithRelationInput[] {
  if (sortBy === "rating") {
    return [{ rating: sortOrder }, { created_at: "desc" }];
  }

  return [{ created_at: sortOrder }, { id: "desc" }];
}

function productVisibleWhere() {
  return {
    status: "ACTIVE",
    shop: { is: { status: "APPROVED" } },
  } satisfies Prisma.ProductWhereInput;
}

function activeOfferWhere() {
  return {
    status: "ACTIVE",
    start_at: { lte: new Date() },
    end_at: { gte: new Date() },
    shop: { is: { status: "APPROVED" } },
  } satisfies Prisma.OfferWhereInput;
}

async function getActiveOfferProductsForProduct(productId: bigint) {
  return prisma.offer.findMany({
    where: {
      status: "ACTIVE",
      start_at: { lte: new Date() },
      end_at: { gte: new Date() },
      shop: { is: { status: "APPROVED" } },
      offerProducts: { some: { product_id: productId } },
    },
    select: {
      id: true,
      title: true,
      description: true,
      discount_type: true,
      discount_value: true,
      start_at: true,
      end_at: true,
      shop: { select: { id: true, name: true } },
    },
  });
}

const marketplaceRouter = Router();

marketplaceRouter.get("/home", async (_req, res) => {
  const [categories, featuredProducts, newArrivals, onSaleProducts, featuredShops, activeOffers, brands] = await Promise.all([
    prisma.category.findMany({
      where: { status: 1 },
      orderBy: { name: "asc" },
      take: 12,
      select: { id: true, name: true, slug: true, image: true, parent_id: true },
    }),
    prisma.product.findMany({
      where: productVisibleWhere(),
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 8,
      select: topProductSelect,
    }),
    prisma.product.findMany({
      where: productVisibleWhere(),
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 8,
      select: topProductSelect,
    }),
    prisma.product.findMany({
      where: {
        ...productVisibleWhere(),
        OR: [{ sale_price: { not: null } }, { offerProducts: { some: { offer: { status: "ACTIVE", start_at: { lte: new Date() }, end_at: { gte: new Date() } } } } }],
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 8,
      select: topProductSelect,
    }),
    prisma.shop.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 8,
      select: publicShopSelect,
    }),
    prisma.offer.findMany({
      where: activeOfferWhere(),
      orderBy: [{ start_at: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        discount_type: true,
        discount_value: true,
        start_at: true,
        end_at: true,
        shop: { select: { id: true, name: true, logo: true } },
      },
    }),
    prisma.brand.findMany({
      where: { status: 1 },
      orderBy: [{ name: "asc" }],
      take: 12,
      select: { id: true, name: true, logo: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    message: "Home content retrieved successfully",
    data: {
      categories,
      featuredProducts,
      newArrivals,
      onSaleProducts,
      featuredShops,
      activeOffers,
      brands,
    },
  });
});

marketplaceRouter.get("/home/featured-products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: productVisibleWhere(),
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 8,
    select: topProductSelect,
  });

  res.status(200).json({ success: true, message: "Featured products retrieved successfully", data: products });
});

marketplaceRouter.get("/home/new-arrivals", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: productVisibleWhere(),
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 8,
    select: topProductSelect,
  });

  res.status(200).json({ success: true, message: "New arrivals retrieved successfully", data: products });
});

marketplaceRouter.get("/home/on-sale", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: {
      ...productVisibleWhere(),
      OR: [{ sale_price: { not: null } }, { offerProducts: { some: { offer: { status: "ACTIVE", start_at: { lte: new Date() }, end_at: { gte: new Date() } } } } }],
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 8,
    select: topProductSelect,
  });

  res.status(200).json({ success: true, message: "On-sale products retrieved successfully", data: products });
});

marketplaceRouter.get("/home/featured-shops", async (_req, res) => {
  const shops = await prisma.shop.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 8,
    select: publicShopSelect,
  });

  res.status(200).json({ success: true, message: "Featured shops retrieved successfully", data: shops });
});

marketplaceRouter.get("/home/active-offers", async (_req, res) => {
  const offers = await prisma.offer.findMany({
    where: activeOfferWhere(),
    orderBy: [{ start_at: "desc" }, { id: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      discount_type: true,
      discount_value: true,
      start_at: true,
      end_at: true,
      shop: { select: { id: true, name: true, logo: true } },
    },
  });

  res.status(200).json({ success: true, message: "Active offers retrieved successfully", data: offers });
});

marketplaceRouter.get("/categories", async (req, res) => {
  const query = parseQuery(categoryListQuerySchema, req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: Prisma.CategoryWhereInput = {
    status: 1,
    ...(query.parentId !== undefined ? { parent_id: BigInt(query.parentId) } : { parent_id: null }),
  };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: limit,
      select: { id: true, name: true, slug: true, image: true, parent_id: true },
    }),
    prisma.category.count({ where }),
  ]);

  sendPaginated(res, categories, page, limit, total);
});

marketplaceRouter.get("/categories/:id", async (req, res) => {
  const categoryId = toBigInt(req.params.id, "Category ID");
  const [category, children] = await Promise.all([
    prisma.category.findFirst({
      where: { id: categoryId, status: 1 },
      select: { id: true, name: true, slug: true, image: true, parent_id: true, parent: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.category.findMany({
      where: { parent_id: categoryId, status: 1 },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, image: true },
    }),
  ]);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  res.status(200).json({ success: true, message: "Category retrieved successfully", data: { ...category, children } });
});

marketplaceRouter.get("/categories/:id/products", async (req, res) => {
  const categoryId = toBigInt(req.params.id, "Category ID");
  const category = await prisma.category.findFirst({ where: { id: categoryId, status: 1 } });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const query = parseQuery(listProductsQuerySchema, req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const relatedCategories = await prisma.category.findMany({
    where: { OR: [{ id: categoryId }, { parent_id: categoryId }, { parent: { id: categoryId } }] },
    select: { id: true },
  });

  const categoryIdList = relatedCategories.map((item) => item.id);
  const where: Prisma.ProductWhereInput = {
    ...productVisibleWhere(),
    category_id: { in: categoryIdList },
    ...(query.search ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }, { brand: { is: { name: { contains: query.search } } } }, { shop: { is: { name: { contains: query.search } } } }] } : {}),
    ...(query.brandId ? { brand_id: BigInt(query.brandId) } : {}),
    ...(query.shopId ? { shop_id: BigInt(query.shopId) } : {}),
    ...(query.minPrice !== undefined ? { price: { gte: new Prisma.Decimal(query.minPrice) } } : {}),
    ...(query.maxPrice !== undefined ? { price: { lte: new Prisma.Decimal(query.maxPrice) } } : {}),
    ...(query.colorId ? { variants: { some: { color_id: BigInt(query.colorId) } } } : {}),
    ...(query.sizeId ? { variants: { some: { size_id: BigInt(query.sizeId) } } } : {}),
    ...(query.onSale === "true" ? { OR: [{ sale_price: { not: null } }, { offerProducts: { some: { offer: { status: "ACTIVE", start_at: { lte: new Date() }, end_at: { gte: new Date() } } } } }] } : {}),
  };

  const orderBy = getProductOrderBy(query.sortBy, query.sortOrder);

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit, select: topProductSelect }),
    prisma.product.count({ where }),
  ]);

  sendPaginated(res, products, page, limit, total);
});

marketplaceRouter.get("/products", async (req, res) => {
  const query = parseQuery(listProductsQuerySchema, req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    ...productVisibleWhere(),
    ...(query.search ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }, { brand: { is: { name: { contains: query.search } } } }, { shop: { is: { name: { contains: query.search } } } }] } : {}),
    ...(query.categoryId ? { category_id: BigInt(query.categoryId) } : {}),
    ...(query.brandId ? { brand_id: BigInt(query.brandId) } : {}),
    ...(query.shopId ? { shop_id: BigInt(query.shopId) } : {}),
    ...(query.minPrice !== undefined ? { price: { gte: new Prisma.Decimal(query.minPrice) } } : {}),
    ...(query.maxPrice !== undefined ? { price: { lte: new Prisma.Decimal(query.maxPrice) } } : {}),
    ...(query.colorId ? { variants: { some: { color_id: BigInt(query.colorId) } } } : {}),
    ...(query.sizeId ? { variants: { some: { size_id: BigInt(query.sizeId) } } } : {}),
    ...(query.onSale === "true" ? { OR: [{ sale_price: { not: null } }, { offerProducts: { some: { offer: { status: "ACTIVE", start_at: { lte: new Date() }, end_at: { gte: new Date() } } } } }] } : {}),
  };

  const orderBy = getProductOrderBy(query.sortBy, query.sortOrder);

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit, select: topProductSelect }),
    prisma.product.count({ where }),
  ]);

  sendPaginated(res, products, page, limit, total);
});

marketplaceRouter.get("/products/:id", async (req, res) => {
  const productId = toBigInt(req.params.id, "Product ID");
  const product = await prisma.product.findFirst({
    where: { id: productId, ...productVisibleWhere() },
    select: {
      ...topProductSelect,
      variants: {
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          price: true,
          sale_price: true,
          sku: true,
          color: { select: { id: true, name: true, hex_code: true } },
          size: { select: { id: true, name: true, type: true } },
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
          description: true,
          logo: true,
          cover_image: true,
          status: true,
          branches: { where: { status: "ACTIVE" }, select: { id: true, name: true, city: true, area: true, address: true, phone: true } },
        },
      },
    },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const activeOffers = await getActiveOfferProductsForProduct(productId);

  res.status(200).json({
    success: true,
    message: "Product retrieved successfully",
    data: {
      ...product,
      activeOffers,
    },
  });
});

marketplaceRouter.get("/products/:id/related", async (req, res) => {
  const productId = toBigInt(req.params.id, "Product ID");
  const product = await prisma.product.findFirst({
    where: { id: productId, ...productVisibleWhere() },
    select: { category_id: true, shop_id: true },
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const related = await prisma.product.findMany({
    where: {
      ...productVisibleWhere(),
      OR: [{ category_id: product.category_id }, { shop_id: product.shop_id }],
      NOT: { id: productId },
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 6,
    select: topProductSelect,
  });

  res.status(200).json({ success: true, message: "Related products retrieved successfully", data: related });
});

marketplaceRouter.get("/brands", async (_req, res) => {
  const brands = await prisma.brand.findMany({
    where: { status: 1 },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, logo: true },
  });

  res.status(200).json({ success: true, message: "Brands retrieved successfully", data: brands });
});

marketplaceRouter.get("/brands/:id/products", async (req, res) => {
  const brandId = toBigInt(req.params.id, "Brand ID");
  const brand = await prisma.brand.findFirst({ where: { id: brandId, status: 1 } });

  if (!brand) {
    throw new AppError("Brand not found", 404);
  }

  const query = parseQuery(listProductsQuerySchema, req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {
    ...productVisibleWhere(),
    brand_id: brandId,
    ...(query.search ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }, { brand: { is: { name: { contains: query.search } } } }, { shop: { is: { name: { contains: query.search } } } }] } : {}),
    ...(query.categoryId ? { category_id: BigInt(query.categoryId) } : {}),
    ...(query.shopId ? { shop_id: BigInt(query.shopId) } : {}),
    ...(query.minPrice !== undefined ? { price: { gte: new Prisma.Decimal(query.minPrice) } } : {}),
    ...(query.maxPrice !== undefined ? { price: { lte: new Prisma.Decimal(query.maxPrice) } } : {}),
    ...(query.colorId ? { variants: { some: { color_id: BigInt(query.colorId) } } } : {}),
    ...(query.sizeId ? { variants: { some: { size_id: BigInt(query.sizeId) } } } : {}),
    ...(query.onSale === "true" ? { OR: [{ sale_price: { not: null } }, { offerProducts: { some: { offer: { status: "ACTIVE", start_at: { lte: new Date() }, end_at: { gte: new Date() } } } } }] } : {}),
  };

  const orderBy = getProductOrderBy(query.sortBy, query.sortOrder);

  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit, select: topProductSelect }),
    prisma.product.count({ where }),
  ]);

  sendPaginated(res, products, page, limit, total);
});

marketplaceRouter.get("/shops", async (req, res) => {
  const query = parseQuery(parsePaginatedQuery.extend({ search: z.string().trim().optional() }), req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const where: Prisma.ShopWhereInput = {
    status: "APPROVED",
    ...(query.search ? { name: { contains: query.search } } : {}),
  };

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: publicShopSelect,
    }),
    prisma.shop.count({ where }),
  ]);

  sendPaginated(res, shops, page, limit, total);
});

marketplaceRouter.get("/shops/:shopId", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, status: "APPROVED" },
    select: {
      ...publicShopSelect,
      branches: { where: { status: "ACTIVE" }, select: { id: true, name: true, address: true, city: true, area: true, phone: true, latitude: true, longitude: true } },
    },
  });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  res.status(200).json({ success: true, message: "Shop retrieved successfully", data: shop });
});

marketplaceRouter.get("/shops/:shopId/branches", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const shop = await prisma.shop.findFirst({ where: { id: shopId, status: "APPROVED" } });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  const branches = await prisma.shopBranch.findMany({
    where: { shop_id: shopId, status: "ACTIVE" },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, city: true, area: true, phone: true, latitude: true, longitude: true },
  });

  res.status(200).json({ success: true, message: "Shop branches retrieved successfully", data: branches });
});

marketplaceRouter.get("/shops/:shopId/branches/:branchId", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const branchId = toBigInt(req.params.branchId, "Branch ID");

  const branch = await prisma.shopBranch.findFirst({
    where: { id: branchId, shop_id: shopId, status: "ACTIVE" },
    select: { id: true, shop_id: true, name: true, address: true, city: true, area: true, phone: true, latitude: true, longitude: true },
  });

  if (!branch) {
    throw new AppError("Branch not found", 404);
  }

  res.status(200).json({ success: true, message: "Branch retrieved successfully", data: branch });
});

marketplaceRouter.get("/shops/:shopId/reviews", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const shop = await prisma.shop.findFirst({ where: { id: shopId, status: "APPROVED" } });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  const query = parseQuery(reviewQuerySchema, req.query);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;
  const orderBy = getReviewOrderBy(query.sortBy, query.sortOrder);

  const [reviews, total] = await Promise.all([
    prisma.shopReview.findMany({
      where: { shop_id: shopId, status: "APPROVED" },
      orderBy,
      skip,
      take: limit,
      select: { id: true, rating: true, comment: true, created_at: true, user: { select: { id: true, name: true } } },
    }),
    prisma.shopReview.count({ where: { shop_id: shopId, status: "APPROVED" } }),
  ]);

  sendPaginated(res, reviews, page, limit, total);
});

marketplaceRouter.get("/shops/:shopId/reviews/summary", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const shop = await prisma.shop.findFirst({ where: { id: shopId, status: "APPROVED" } });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  const total = await prisma.shopReview.count({ where: { shop_id: shopId, status: "APPROVED" } });
  const averages = await prisma.shopReview.groupBy({
    by: ["rating"],
    where: { shop_id: shopId, status: "APPROVED" },
    _count: { rating: true },
  });

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  for (const item of averages) {
    counts[item.rating] = item._count.rating;
  }

  const avgResult = await prisma.shopReview.aggregate({
    where: { shop_id: shopId, status: "APPROVED" },
    _avg: { rating: true },
  });

  res.status(200).json({
    success: true,
    message: "Shop review summary retrieved successfully",
    data: {
      averageRating: Number(avgResult._avg.rating ?? 0),
      totalReviews: total,
      counts,
    },
  });
});

marketplaceRouter.post("/shops/:shopId/reviews", authenticate, authorizeRoles("CUSTOMER"), async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const body = parseQuery(reviewBodySchema, req.body);
  const shop = await prisma.shop.findFirst({ where: { id: shopId, status: "APPROVED" } });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  if (body.orderId) {
    const order = await prisma.order.findFirst({
      where: {
        id: BigInt(body.orderId),
        user_id: BigInt(req.authUser.id),
        shop_id: shopId,
      },
      select: { id: true },
    });

    if (!order) {
      throw new AppError("A qualifying order is required to leave a review", 400);
    }
  }

  const existing = await prisma.shopReview.findFirst({
    where: { user_id: BigInt(req.authUser.id), shop_id: shopId },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("You have already reviewed this shop", 409);
  }

  const review = await prisma.shopReview.create({
    data: {
      user_id: BigInt(req.authUser.id),
      shop_id: shopId,
      order_id: body.orderId ? BigInt(body.orderId) : null,
      rating: body.rating,
      comment: body.comment ?? null,
      status: "PENDING",
    },
    select: { id: true, rating: true, comment: true, status: true, created_at: true },
  });

  res.status(201).json({ success: true, message: "Shop review submitted successfully", data: review });
});

marketplaceRouter.get("/users/me/reviews", authenticate, async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  const reviews = await prisma.shopReview.findMany({
    where: { user_id: BigInt(req.authUser.id) },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: { id: true, rating: true, comment: true, status: true, created_at: true, shop: { select: { id: true, name: true, logo: true } } },
  });

  res.status(200).json({ success: true, message: "Your reviews retrieved successfully", data: reviews });
});

marketplaceRouter.get("/offers", async (_req, res) => {
  const offers = await prisma.offer.findMany({
    where: activeOfferWhere(),
    orderBy: [{ start_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      discount_type: true,
      discount_value: true,
      start_at: true,
      end_at: true,
      shop: { select: { id: true, name: true, logo: true } },
    },
  });

  res.status(200).json({ success: true, message: "Offers retrieved successfully", data: offers });
});

marketplaceRouter.get("/offers/:id", async (req, res) => {
  const offerId = toBigInt(req.params.id, "Offer ID");
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, ...activeOfferWhere() },
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      discount_type: true,
      discount_value: true,
      start_at: true,
      end_at: true,
      shop: { select: { id: true, name: true, logo: true } },
      offerProducts: { select: { product: { select: topProductSelect } } },
    },
  });

  if (!offer) {
    throw new AppError("Offer not found", 404);
  }

  res.status(200).json({ success: true, message: "Offer retrieved successfully", data: offer });
});

marketplaceRouter.get("/shops/:shopId/offers", async (req, res) => {
  const shopId = toBigInt(req.params.shopId, "Shop ID");
  const shop = await prisma.shop.findFirst({ where: { id: shopId, status: "APPROVED" } });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  const offers = await prisma.offer.findMany({
    where: { shop_id: shopId, ...activeOfferWhere() },
    orderBy: [{ start_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      discount_type: true,
      discount_value: true,
      start_at: true,
      end_at: true,
      offerProducts: { select: { product: { select: topProductSelect } } },
    },
  });

  res.status(200).json({ success: true, message: "Shop offers retrieved successfully", data: offers });
});

marketplaceRouter.get("/subscription-plans", async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { status: 1 },
    orderBy: [{ price: "asc" }, { id: "asc" }],
    select: { id: true, name: true, description: true, price: true, duration: true, duration_unit: true, features: true },
  });

  res.status(200).json({ success: true, message: "Subscription plans retrieved successfully", data: plans });
});

marketplaceRouter.get("/subscription-plans/:id", async (req, res) => {
  const planId = toBigInt(req.params.id, "Plan ID");
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: planId, status: 1 },
    select: { id: true, name: true, description: true, price: true, duration: true, duration_unit: true, features: true },
  });

  if (!plan) {
    throw new AppError("Subscription plan not found", 404);
  }

  res.status(200).json({ success: true, message: "Subscription plan retrieved successfully", data: plan });
});

marketplaceRouter.get("/shop-subscriptions/me", authenticate, authorizeRoles("SHOP_OWNER", "ADMIN"), async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  const shop = await prisma.shop.findFirst({
    where: { owner_id: BigInt(req.authUser.id) },
    select: { id: true },
  });

  if (!shop) {
    res.status(200).json({ success: true, message: "No shop subscriptions found", data: [] });
    return;
  }

  const subscriptions = await prisma.shopSubscription.findMany({
    where: { shop_id: shop.id },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: { id: true, shop_id: true, plan_id: true, start_at: true, end_at: true, price: true, status: true, created_at: true, plan: { select: { id: true, name: true, duration: true, duration_unit: true } } },
  });

  res.status(200).json({ success: true, message: "Shop subscriptions retrieved successfully", data: subscriptions });
});

marketplaceRouter.post("/shop-subscriptions", authenticate, authorizeRoles("SHOP_OWNER", "ADMIN"), async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  const body = parseQuery(subscriptionSchema, req.body);
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: BigInt(body.planId), status: 1 } });

  if (!plan) {
    throw new AppError("Subscription plan not found", 404);
  }

  const shop = await prisma.shop.findFirst({ where: { owner_id: BigInt(req.authUser.id) } });

  if (!shop) {
    throw new AppError("Shop not found for this account", 404);
  }

  const existing = await prisma.shopSubscription.findFirst({
    where: { shop_id: shop.id, status: { in: ["PENDING", "ACTIVE"] } },
  });

  if (existing) {
    throw new AppError("This shop already has an active or pending subscription", 409);
  }

  const startAt = new Date();
  const endAt = new Date(startAt);

  switch (plan.duration_unit) {
    case "DAY":
      endAt.setDate(endAt.getDate() + Number(plan.duration));
      break;
    case "MONTH":
      endAt.setMonth(endAt.getMonth() + Number(plan.duration));
      break;
    case "YEAR":
      endAt.setFullYear(endAt.getFullYear() + Number(plan.duration));
      break;
    default:
      break;
  }

  const subscription = await prisma.shopSubscription.create({
    data: {
      shop_id: shop.id,
      plan_id: plan.id,
      start_at: startAt,
      end_at: endAt,
      price: plan.price,
      status: "PENDING",
    },
    select: { id: true, shop_id: true, plan_id: true, start_at: true, end_at: true, price: true, status: true, created_at: true },
  });

  res.status(201).json({ success: true, message: "Subscription request created successfully", data: subscription });
});

marketplaceRouter.get("/shop-subscriptions/:id", authenticate, async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  const subscriptionId = toBigInt(req.params.id, "Subscription ID");
  const subscription = await prisma.shopSubscription.findFirst({
    where: { id: subscriptionId },
    select: {
      id: true,
      shop_id: true,
      plan_id: true,
      start_at: true,
      end_at: true,
      price: true,
      status: true,
      created_at: true,
      shop: { select: { id: true, owner_id: true, name: true } },
      plan: { select: { id: true, name: true, duration: true, duration_unit: true, price: true } },
    },
  });

  if (!subscription) {
    throw new AppError("Subscription not found", 404);
  }

  const isOwner = subscription.shop.owner_id.toString() === req.authUser.id;
  const isAdmin = req.authUser.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new AppError("You are not allowed to access this subscription", 403);
  }

  res.status(200).json({ success: true, message: "Subscription retrieved successfully", data: subscription });
});

export { marketplaceRouter };
