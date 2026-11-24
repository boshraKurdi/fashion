import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { AppError } from "../auth/auth.service.js";

type ShopRequestInput = {
  name: string;
  description?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  logo?: string | null | undefined;
  coverImage?: string | null | undefined;
  facebookUrl?: string | null | undefined;
  instagramUrl?: string | null | undefined;
  whatsappUrl?: string | null | undefined;
};

const productDetail = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true } },
  images: { orderBy: [{ sort_order: "asc" }, { id: "asc" }], select: { id: true, image: true, is_primary: true, sort_order: true } },
  variants: {
    orderBy: [{ id: "asc" }],
    select: {
      id: true, color_id: true, size_id: true, price: true, sale_price: true, sku: true,
      color: { select: { id: true, name: true, hex_code: true } },
      size: { select: { id: true, name: true, type: true } },
    },
  },
} satisfies Prisma.ProductInclude;

const orderDetail = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  items: {
    orderBy: [{ id: "asc" }],
    select: {
      id: true, product_id: true, variant_id: true, product_name: true, product_image: true,
      variant_description: true, quantity: true, unit_price: true, total: true,
      product: { select: { images: { orderBy: [{ sort_order: "asc" }, { id: "asc" }], select: { id: true, image: true, is_primary: true } } } },
      variant: { select: { color: { select: { name: true } }, size: { select: { name: true, type: true } } } },
    },
  },
} satisfies Prisma.OrderInclude;

export async function getOwnedShop(ownerId: string, allowMissing = false) {
  const shops = await prisma.shop.findMany({
    where: { owner_id: BigInt(ownerId) },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: 2,
  });
  if (shops.length > 1) {
    throw new AppError("This dashboard supports exactly one shop per owner account", 409);
  }
  const shop = shops[0];
  if (!shop && !allowMissing) {
    throw new AppError("Shop not found for this owner", 404);
  }
  return shop ?? null;
}

export async function createShopRequest(ownerId: string, input: ShopRequestInput) {
  const ownerIdBigInt = BigInt(ownerId);
  const owner = await prisma.user.findUnique({
    where: { id: ownerIdBigInt },
    select: { role: true, email_verified_at: true },
  });

  if (!owner || !owner.email_verified_at) {
    throw new AppError("A verified account is required to request a shop", 403);
  }
  if (owner.role === "ADMIN") {
    throw new AppError("Administrators cannot request a shop", 403);
  }

  const shops = await prisma.shop.findMany({
    where: { owner_id: ownerIdBigInt },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: 2,
  });
  if (shops.length > 1) {
    throw new AppError("This account already has multiple shops", 409);
  }

  const existingShop = shops[0];
  if (existingShop && existingShop.status !== "REJECTED") {
    throw new AppError("A shop request already exists for this account", 409);
  }

  const data = {
    name: input.name,
    description: input.description ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    facebook_url: input.facebookUrl ?? null,
    instagram_url: input.instagramUrl ?? null,
    whatsapp_url: input.whatsappUrl ?? null,
    logo: input.logo ?? null,
    cover_image: input.coverImage ?? null,
    status: "PENDING" as const,
    rejection_reason: null,
    approved_at: null,
  };

  if (existingShop) {
    return prisma.shop.update({
      where: { id: existingShop.id },
      data,
    });
  }

  return prisma.shop.create({
    data: { owner_id: ownerIdBigInt, ...data },
  });
}

function assertCanPublish(shopStatus: string): void {
  if (shopStatus !== "APPROVED") {
    throw new AppError("Only an approved, non-suspended shop can publish dashboard content", 403);
  }
}

async function assertCategoryAndBrand(categoryId: bigint, brandId?: bigint | null): Promise<void> {
  const [category, brand] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, status: 1 }, select: { id: true } }),
    brandId ? prisma.brand.findFirst({ where: { id: brandId, status: 1 }, select: { id: true } }) : null,
  ]);
  if (!category) throw new AppError("Active category not found", 400);
  if (brandId && !brand) throw new AppError("Active brand not found", 400);
}

async function assertVariantsValid(
  variants: Array<{ colorId?: string | null | undefined; sizeId?: string | null | undefined; price?: number | null | undefined; salePrice?: number | null | undefined }>,
  productPrice: number,
): Promise<void> {
  const colorIds = [...new Set(variants.flatMap((variant) => variant.colorId ? [BigInt(variant.colorId)] : []))];
  const sizeIds = [...new Set(variants.flatMap((variant) => variant.sizeId ? [BigInt(variant.sizeId)] : []))];
  const [colors, sizes] = await Promise.all([
    colorIds.length ? prisma.color.count({ where: { id: { in: colorIds } } }) : 0,
    sizeIds.length ? prisma.size.count({ where: { id: { in: sizeIds } } }) : 0,
  ]);
  if (colors !== colorIds.length) throw new AppError("One or more colors do not exist", 400);
  if (sizes !== sizeIds.length) throw new AppError("One or more sizes do not exist", 400);
  for (const variant of variants) {
    const regularPrice = variant.price ?? productPrice;
    if (variant.salePrice != null && variant.salePrice > regularPrice) {
      throw new AppError("Variant sale price must not exceed its regular price", 400);
    }
  }
}

function variantData(variant: {
  colorId?: string | null | undefined;
  sizeId?: string | null | undefined;
  price?: number | null | undefined;
  salePrice?: number | null | undefined;
  sku?: string | null | undefined;
}) {
  return {
    color_id: variant.colorId ? BigInt(variant.colorId) : null,
    size_id: variant.sizeId ? BigInt(variant.sizeId) : null,
    price: variant.price ?? null,
    sale_price: variant.salePrice ?? null,
    sku: variant.sku ?? null,
  };
}

export async function getDashboard(ownerId: string) {
  const shop = await getOwnedShop(ownerId, true);
  if (!shop) {
    return {
      shop: null,
      statistics: {
        totalProducts: 0, activeProducts: 0, hiddenProducts: 0, totalOrders: 0,
        newOrders: 0, processingOrders: 0, shippedOrders: 0, deliveredOrders: 0,
        cancelledOrders: 0, totalSales: 0, totalPaidOrders: 0, totalReviews: 0, averageRating: 0,
      },
      currentSubscription: null,
      subscriptionExpirationDate: null,
      recentOrders: [],
    };
  }

  const now = new Date();
  const [productGroups, orderGroups, orderCount, sales, paidCount, reviewCount, ratingSummary, subscription, recentOrders] =
    await Promise.all([
      prisma.product.groupBy({ by: ["status"], where: { shop_id: shop.id }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ["status"], where: { shop_id: shop.id }, _count: { _all: true } }),
      prisma.order.count({ where: { shop_id: shop.id } }),
      prisma.order.aggregate({
        where: { shop_id: shop.id, status: { notIn: ["CANCELLED", "RETURNED"] }, payment_status: "PAID" },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { shop_id: shop.id, status: { notIn: ["CANCELLED", "RETURNED"] }, payment_status: "PAID" } }),
      prisma.shopReview.count({ where: { shop_id: shop.id } }),
      prisma.shopReview.aggregate({ where: { shop_id: shop.id, status: "APPROVED" }, _avg: { rating: true } }),
      prisma.shopSubscription.findFirst({
        where: { shop_id: shop.id, status: "ACTIVE", end_at: { gte: now } },
        orderBy: [{ end_at: "desc" }, { id: "desc" }],
        include: { plan: { select: { id: true, name: true, description: true, duration: true, duration_unit: true } } },
      }),
      prisma.order.findMany({
        where: { shop_id: shop.id },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: 5,
        select: { id: true, order_number: true, status: true, payment_status: true, total: true, created_at: true },
      }),
    ]);
  const productCount = (status: string) => productGroups.find((group) => group.status === status)?._count._all ?? 0;
  const orderCountBy = (status: string) => orderGroups.find((group) => group.status === status)?._count._all ?? 0;
  return {
    shop: {
      id: shop.id, name: shop.name, description: shop.description, logo: shop.logo,
      cover_image: shop.cover_image, phone: shop.phone, email: shop.email, status: shop.status,
      facebook_url: shop.facebook_url, instagram_url: shop.instagram_url, whatsapp_url: shop.whatsapp_url,
      rejection_reason: shop.rejection_reason, approved_at: shop.approved_at, created_at: shop.created_at,
    },
    statistics: {
      totalProducts: productCount("DRAFT") + productCount("ACTIVE") + productCount("HIDDEN"),
      activeProducts: productCount("ACTIVE"),
      hiddenProducts: productCount("HIDDEN"),
      totalOrders: orderCount,
      newOrders: orderCountBy("PENDING"),
      processingOrders: orderCountBy("PROCESSING"),
      shippedOrders: orderCountBy("SHIPPED"),
      deliveredOrders: orderCountBy("DELIVERED"),
      cancelledOrders: orderCountBy("CANCELLED"),
      totalSales: Number(sales._sum.total ?? 0),
      totalPaidOrders: paidCount,
      totalReviews: reviewCount,
      averageRating: Number(ratingSummary._avg.rating ?? 0),
    },
    currentSubscription: subscription,
    subscriptionExpirationDate: subscription?.end_at ?? null,
    recentOrders,
  };
}

export async function updateShop(ownerId: string, input: {
  name?: string | undefined; description?: string | null | undefined; phone?: string | null | undefined; email?: string | null | undefined;
  logo?: string | null | undefined; coverImage?: string | null | undefined;
  facebookUrl?: string | null | undefined; instagramUrl?: string | null | undefined; whatsappUrl?: string | null | undefined;
}) {
  const shop = await getOwnedShop(ownerId);
  const updated = await prisma.shop.update({
    where: { id: shop!.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.logo !== undefined ? { logo: input.logo } : {}),
      ...(input.coverImage !== undefined ? { cover_image: input.coverImage } : {}),
      ...(input.facebookUrl !== undefined ? { facebook_url: input.facebookUrl } : {}),
      ...(input.instagramUrl !== undefined ? { instagram_url: input.instagramUrl } : {}),
      ...(input.whatsappUrl !== undefined ? { whatsapp_url: input.whatsappUrl } : {}),
    },
  });
  return updated;
}

export async function listProducts(ownerId: string, query: {
  page: number; limit: number; search?: string | undefined; categoryId?: string | undefined; status?: "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED" | undefined;
  minPrice?: number | undefined; maxPrice?: number | undefined; sortBy: "newest" | "price"; sortOrder: "asc" | "desc";
}) {
  const shop = await getOwnedShop(ownerId);
  const where: Prisma.ProductWhereInput = {
    shop_id: shop!.id,
    ...(query.search ? { name: { contains: query.search } } : {}),
    ...(query.categoryId ? { category_id: BigInt(query.categoryId) } : {}),
    ...(query.status ? { status: query.status } : { status: { not: "ARCHIVED" } }),
    ...((query.minPrice !== undefined || query.maxPrice !== undefined) ? {
      price: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) },
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: query.sortBy === "price" ? [{ price: query.sortOrder }, { id: "desc" }] : [{ created_at: query.sortOrder }, { id: "desc" }],
      include: productDetail,
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

export async function getProduct(ownerId: string, productId: bigint) {
  const shop = await getOwnedShop(ownerId);
  const product = await prisma.product.findFirst({ where: { id: productId, shop_id: shop!.id }, include: productDetail });
  if (!product) throw new AppError("Product not found", 404);
  return product;
}

export async function createProduct(ownerId: string, input: {
  name: string; description?: string | null | undefined; categoryId: string; brandId?: string | null | undefined; price: number;
  salePrice?: number | null | undefined; status: "DRAFT" | "ACTIVE" | "HIDDEN";
  images: Array<{ image: string; isPrimary: boolean; sortOrder: number }>;
  variants: Array<{ colorId?: string | null | undefined; sizeId?: string | null | undefined; price?: number | null | undefined; salePrice?: number | null | undefined; sku?: string | null | undefined }>;
}) {
  const shop = await getOwnedShop(ownerId);
  if (input.status === "ACTIVE") assertCanPublish(shop!.status);
  if (input.salePrice != null && input.salePrice > input.price) throw new AppError("Sale price must not exceed the regular price", 400);
  await Promise.all([
    assertCategoryAndBrand(BigInt(input.categoryId), input.brandId ? BigInt(input.brandId) : null),
    assertVariantsValid(input.variants, input.price),
  ]);
  const primaries = input.images.filter((image) => image.isPrimary).length;
  if (primaries > 1) throw new AppError("Only one product image can be primary", 400);
  return prisma.product.create({
    data: {
      shop_id: shop!.id, category_id: BigInt(input.categoryId),
      brand_id: input.brandId ? BigInt(input.brandId) : null,
      name: input.name, description: input.description ?? null, price: input.price,
      sale_price: input.salePrice ?? null, status: input.status,
      images: { create: input.images.map((image) => ({ image: image.image, is_primary: image.isPrimary, sort_order: image.sortOrder })) },
      variants: { create: input.variants.map(variantData) },
    },
    include: productDetail,
  });
}

export async function updateProduct(ownerId: string, productId: bigint, input: {
  name?: string | undefined; description?: string | null | undefined; categoryId?: string | undefined; brandId?: string | null | undefined; price?: number | undefined; salePrice?: number | null | undefined;
}) {
  const product = await getProduct(ownerId, productId);
  const price = input.price ?? Number(product.price);
  const salePrice = input.salePrice !== undefined ? input.salePrice : (product.sale_price == null ? null : Number(product.sale_price));
  if (salePrice != null && salePrice > price) throw new AppError("Sale price must not exceed the regular price", 400);
  if (input.categoryId || input.brandId !== undefined) {
    await assertCategoryAndBrand(
      input.categoryId ? BigInt(input.categoryId) : product.category_id,
      input.brandId !== undefined ? (input.brandId ? BigInt(input.brandId) : null) : product.brand_id,
    );
  }
  if (product.status === "ACTIVE" && (input.price !== undefined || input.salePrice !== undefined)) {
    await assertVariantsValid(product.variants.map((variant) => ({
      price: variant.price == null ? null : Number(variant.price),
      salePrice: variant.sale_price == null ? null : Number(variant.sale_price),
    })), price);
  }
  return prisma.product.update({
    where: { id: product.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId ? { category_id: BigInt(input.categoryId) } : {}),
      ...(input.brandId !== undefined ? { brand_id: input.brandId ? BigInt(input.brandId) : null } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.salePrice !== undefined ? { sale_price: input.salePrice } : {}),
    },
    include: productDetail,
  });
}

export async function archiveProduct(ownerId: string, productId: bigint) {
  const product = await getProduct(ownerId, productId);
  return prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" }, include: productDetail });
}

export async function setProductStatus(ownerId: string, productId: bigint, status: "DRAFT" | "ACTIVE" | "HIDDEN") {
  const [shop, product] = await Promise.all([getOwnedShop(ownerId), getProduct(ownerId, productId)]);
  if (status === "ACTIVE") assertCanPublish(shop!.status);
  if (product.status === "ARCHIVED") throw new AppError("Archived products cannot be reactivated", 409);
  return prisma.product.update({ where: { id: product.id }, data: { status }, include: productDetail });
}

async function requireProduct(ownerId: string, productId: bigint) {
  return getProduct(ownerId, productId);
}

export async function createProductImage(ownerId: string, productId: bigint, input: { image: string; isPrimary: boolean; sortOrder: number }) {
  const product = await requireProduct(ownerId, productId);
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) await tx.productImage.updateMany({ where: { product_id: product.id }, data: { is_primary: false } });
    const image = await tx.productImage.create({ data: { product_id: product.id, image: input.image, is_primary: input.isPrimary, sort_order: input.sortOrder } });
    return image;
  });
}

export async function updateProductImage(ownerId: string, productId: bigint, imageId: bigint, input: { image?: string | undefined; isPrimary?: boolean | undefined; sortOrder?: number | undefined }) {
  const product = await requireProduct(ownerId, productId);
  const image = await prisma.productImage.findFirst({ where: { id: imageId, product_id: product.id } });
  if (!image) throw new AppError("Product image not found", 404);
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) await tx.productImage.updateMany({ where: { product_id: product.id }, data: { is_primary: false } });
    return tx.productImage.update({
      where: { id: image.id },
      data: {
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.isPrimary !== undefined ? { is_primary: input.isPrimary } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      },
    });
  });
}

export async function deleteProductImage(ownerId: string, productId: bigint, imageId: bigint) {
  const product = await requireProduct(ownerId, productId);
  const image = await prisma.productImage.findFirst({ where: { id: imageId, product_id: product.id } });
  if (!image) throw new AppError("Product image not found", 404);
  return prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: image.id } });
    if (image.is_primary) {
      const next = await tx.productImage.findFirst({ where: { product_id: product.id }, orderBy: [{ sort_order: "asc" }, { id: "asc" }] });
      if (next) await tx.productImage.update({ where: { id: next.id }, data: { is_primary: true } });
    }
  });
}

export async function createProductVariant(ownerId: string, productId: bigint, input: Parameters<typeof variantData>[0]) {
  const product = await requireProduct(ownerId, productId);
  await assertVariantsValid([input], Number(product.price));
  return prisma.productVariant.create({ data: { product_id: product.id, ...variantData(input) } });
}

export async function updateProductVariant(ownerId: string, productId: bigint, variantId: bigint, input: Parameters<typeof variantData>[0]) {
  const product = await requireProduct(ownerId, productId);
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, product_id: product.id } });
  if (!variant) throw new AppError("Product variant not found", 404);
  const merged = {
    colorId: input.colorId !== undefined ? input.colorId : variant.color_id?.toString(),
    sizeId: input.sizeId !== undefined ? input.sizeId : variant.size_id?.toString(),
    price: input.price !== undefined ? input.price : (variant.price == null ? null : Number(variant.price)),
    salePrice: input.salePrice !== undefined ? input.salePrice : (variant.sale_price == null ? null : Number(variant.sale_price)),
  };
  await assertVariantsValid([merged], Number(product.price));
  return prisma.productVariant.update({ where: { id: variant.id }, data: variantData({ ...merged, sku: input.sku !== undefined ? input.sku : variant.sku }) });
}

export async function deleteProductVariant(ownerId: string, productId: bigint, variantId: bigint) {
  const product = await requireProduct(ownerId, productId);
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, product_id: product.id } });
  if (!variant) throw new AppError("Product variant not found", 404);
  const [orderItems, cartItems] = await Promise.all([
    prisma.orderItem.count({ where: { variant_id: variant.id } }),
    prisma.cartItem.count({ where: { variant_id: variant.id } }),
  ]);
  if (orderItems || cartItems) throw new AppError("This variant is referenced by an order or cart and cannot be deleted", 409);
  await prisma.productVariant.delete({ where: { id: variant.id } });
}

export async function listOrders(ownerId: string, query: {
  page: number; limit: number; status?: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | undefined;
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | undefined;
  startDate?: Date | undefined; endDate?: Date | undefined; orderNumber?: string | undefined;
}) {
  const shop = await getOwnedShop(ownerId);
  const where: Prisma.OrderWhereInput = {
    shop_id: shop!.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { payment_status: query.paymentStatus } : {}),
    ...(query.orderNumber ? { order_number: { contains: query.orderNumber } } : {}),
    ...((query.startDate || query.endDate) ? { created_at: { ...(query.startDate ? { gte: query.startDate } : {}), ...(query.endDate ? { lte: query.endDate } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }], include: orderDetail,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

export async function getOrder(ownerId: string, orderId: bigint) {
  const shop = await getOwnedShop(ownerId);
  const order = await prisma.order.findFirst({ where: { id: orderId, shop_id: shop!.id }, include: orderDetail });
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

const allowedOrderTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

export async function updateOrderStatus(ownerId: string, orderId: bigint, status: "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED") {
  const shop = await getOwnedShop(ownerId);
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, shop_id: shop!.id } });
    if (!order) throw new AppError("Order not found", 404);
    if (!allowedOrderTransitions[order.status]?.includes(status)) {
      throw new AppError(`Order cannot transition from ${order.status} to ${status}`, 409);
    }
    const updated = await tx.order.updateMany({
      where: { id: order.id, shop_id: shop!.id, status: order.status },
      data: { status },
    });
    if (updated.count !== 1) throw new AppError("Order status changed concurrently; reload and try again", 409);
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetail });
  });
}

async function validateOfferProducts(shopId: bigint, productIds: string[], discountType: "PERCENTAGE" | "FIXED_AMOUNT", discountValue: number) {
  if (discountType === "PERCENTAGE" && discountValue > 100) {
    throw new AppError("Percentage discount cannot exceed 100", 400);
  }
  const ids = [...new Set(productIds.map((id) => BigInt(id)))];
  if (ids.length !== productIds.length) throw new AppError("Selected products must be unique", 400);
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, shop_id: shopId, status: { not: "ARCHIVED" } },
    select: { id: true, price: true, sale_price: true, variants: { select: { price: true, sale_price: true } } },
  });
  if (products.length !== ids.length) throw new AppError("All selected products must belong to this shop and be active records", 400);
  if (discountType === "FIXED_AMOUNT") {
    for (const product of products) {
      const prices = [Number(product.sale_price ?? product.price)];
      for (const variant of product.variants) prices.push(Number(variant.sale_price ?? variant.price ?? product.sale_price ?? product.price));
      if (prices.some((price) => discountValue > price)) {
        throw new AppError("Fixed discount would make a selected product's final price negative", 400);
      }
    }
  }
}

function validateOfferDates(startAt: string, endAt: string) {
  if (new Date(startAt) >= new Date(endAt)) throw new AppError("Offer end date must be after its start date", 400);
}

function offerResponse<T extends { status: string; end_at: Date; start_at: Date }>(offer: T) {
  const now = new Date();
  const effectiveStatus = offer.status === "ACTIVE" && offer.end_at < now
    ? "EXPIRED"
    : offer.status === "ACTIVE" && offer.start_at > now
      ? "SCHEDULED"
      : offer.status;
  return {
    ...offer,
    configured_status: offer.status,
    status: effectiveStatus,
    effective_status: effectiveStatus,
  };
}

export async function listOffers(ownerId: string, query: { page: number; limit: number; status?: "DRAFT" | "ACTIVE" | "INACTIVE" | "EXPIRED" | undefined }) {
  const shop = await getOwnedShop(ownerId);
  const where: Prisma.OfferWhereInput = {
    shop_id: shop!.id,
    ...(query.status === "EXPIRED"
      ? { status: "ACTIVE", end_at: { lt: new Date() } }
      : query.status ? { status: query.status } : {}),
  };
  const [offers, total] = await Promise.all([
    prisma.offer.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      include: { offerProducts: { select: { product: { select: { id: true, name: true, price: true, sale_price: true, status: true } } } } },
    }),
    prisma.offer.count({ where }),
  ]);
  return { items: offers.map(offerResponse), total };
}

export async function getOffer(ownerId: string, offerId: bigint) {
  const shop = await getOwnedShop(ownerId);
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, shop_id: shop!.id },
    include: { offerProducts: { select: { product: { select: { id: true, name: true, price: true, sale_price: true, status: true } } } } },
  });
  if (!offer) throw new AppError("Offer not found", 404);
  return offerResponse(offer);
}

export async function createOffer(ownerId: string, input: {
  title: string; description?: string | null | undefined; image?: string | null | undefined; discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number; startAt: string; endAt: string; productIds: string[];
}) {
  const shop = await getOwnedShop(ownerId);
  validateOfferDates(input.startAt, input.endAt);
  await validateOfferProducts(shop!.id, input.productIds, input.discountType, input.discountValue);
  const offer = await prisma.offer.create({
    data: {
      shop_id: shop!.id, title: input.title, description: input.description ?? null, image: input.image ?? null,
      discount_type: input.discountType, discount_value: input.discountValue,
      start_at: new Date(input.startAt), end_at: new Date(input.endAt), status: "DRAFT",
      offerProducts: { create: input.productIds.map((productId) => ({ product_id: BigInt(productId) })) },
    },
    include: { offerProducts: { select: { product: { select: { id: true, name: true } } } } },
  });
  return offerResponse(offer);
}

export async function updateOffer(ownerId: string, offerId: bigint, input: {
  title?: string | undefined; description?: string | null | undefined; image?: string | null | undefined; discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
  discountValue?: number | undefined; startAt?: string | undefined; endAt?: string | undefined; productIds?: string[] | undefined;
}) {
  const current = await getOffer(ownerId, offerId);
  const startAt = input.startAt ?? current.start_at.toISOString();
  const endAt = input.endAt ?? current.end_at.toISOString();
  const discountType = input.discountType ?? current.discount_type;
  const discountValue = input.discountValue ?? Number(current.discount_value);
  const productIds = input.productIds ?? current.offerProducts.map(({ product }) => product.id.toString());
  validateOfferDates(startAt, endAt);
  const shop = await getOwnedShop(ownerId);
  await validateOfferProducts(shop!.id, productIds, discountType, discountValue);
  return prisma.$transaction(async (tx) => {
    if (input.productIds) await tx.offerProduct.deleteMany({ where: { offer_id: offerId } });
    const offer = await tx.offer.update({
      where: { id: offerId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.discountType ? { discount_type: input.discountType } : {}),
        ...(input.discountValue !== undefined ? { discount_value: input.discountValue } : {}),
        ...(input.startAt ? { start_at: new Date(input.startAt) } : {}),
        ...(input.endAt ? { end_at: new Date(input.endAt) } : {}),
        ...(input.productIds ? { offerProducts: { create: input.productIds.map((productId) => ({ product_id: BigInt(productId) })) } } : {}),
      },
      include: { offerProducts: { select: { product: { select: { id: true, name: true } } } } },
    });
    return offerResponse(offer);
  });
}

export async function updateOfferStatus(ownerId: string, offerId: bigint, status: "DRAFT" | "ACTIVE" | "INACTIVE") {
  const offer = await getOffer(ownerId, offerId);
  if (status === "ACTIVE") {
    const shop = await getOwnedShop(ownerId);
    assertCanPublish(shop!.status);
    validateOfferDates(offer.start_at.toISOString(), offer.end_at.toISOString());
  }
  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: { status },
    include: { offerProducts: { select: { product: { select: { id: true, name: true } } } } },
  });
  return offerResponse(updated);
}

export async function deleteOffer(ownerId: string, offerId: bigint) {
  await getOffer(ownerId, offerId);
  await prisma.$transaction([
    prisma.offerProduct.deleteMany({ where: { offer_id: offerId } }),
    prisma.offer.delete({ where: { id: offerId } }),
  ]);
}

export async function listBranches(ownerId: string) {
  const shop = await getOwnedShop(ownerId);
  return prisma.shopBranch.findMany({ where: { shop_id: shop!.id }, orderBy: [{ created_at: "desc" }, { id: "desc" }] });
}

export async function getBranch(ownerId: string, branchId: bigint) {
  const shop = await getOwnedShop(ownerId);
  const branch = await prisma.shopBranch.findFirst({ where: { id: branchId, shop_id: shop!.id } });
  if (!branch) throw new AppError("Branch not found", 404);
  return branch;
}

export async function createBranch(ownerId: string, input: {
  name: string; address: string; phone?: string | null | undefined; city: string; area?: string | null | undefined; latitude?: number | null | undefined; longitude?: number | null | undefined;
}) {
  const shop = await getOwnedShop(ownerId);
  return prisma.shopBranch.create({
    data: {
      shop_id: shop!.id, name: input.name, address: input.address, phone: input.phone ?? null,
      city: input.city, area: input.area ?? null, latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    },
  });
}

export async function updateBranch(ownerId: string, branchId: bigint, input: {
  name?: string | undefined; address?: string | undefined; phone?: string | null | undefined; city?: string | undefined; area?: string | null | undefined; latitude?: number | null | undefined; longitude?: number | null | undefined;
}) {
  const branch = await getBranch(ownerId, branchId);
  return prisma.shopBranch.update({
    where: { id: branch.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    },
  });
}

export async function updateBranchStatus(ownerId: string, branchId: bigint, status: "ACTIVE" | "INACTIVE") {
  const branch = await getBranch(ownerId, branchId);
  return prisma.shopBranch.update({ where: { id: branch.id }, data: { status } });
}

export async function deactivateBranch(ownerId: string, branchId: bigint) {
  return updateBranchStatus(ownerId, branchId, "INACTIVE");
}

export async function listReviews(ownerId: string, query: {
  page: number; limit: number; rating?: number | undefined; sortBy: "newest" | "rating"; sortOrder: "asc" | "desc";
}) {
  const shop = await getOwnedShop(ownerId);
  const where: Prisma.ShopReviewWhereInput = { shop_id: shop!.id, ...(query.rating ? { rating: query.rating } : {}) };
  const [items, total] = await Promise.all([
    prisma.shopReview.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: query.sortBy === "rating" ? [{ rating: query.sortOrder }, { created_at: "desc" }] : [{ created_at: query.sortOrder }, { id: "desc" }],
      select: { id: true, rating: true, comment: true, status: true, created_at: true, user: { select: { name: true } } },
    }),
    prisma.shopReview.count({ where }),
  ]);
  return { items: items.map(({ user, ...review }) => ({ ...review, customerDisplayName: user.name })), total };
}

export async function getReviewSummary(ownerId: string) {
  const shop = await getOwnedShop(ownerId);
  const [approved, total, ratingGroups] = await Promise.all([
    prisma.shopReview.aggregate({ where: { shop_id: shop!.id, status: "APPROVED" }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.shopReview.count({ where: { shop_id: shop!.id } }),
    prisma.shopReview.groupBy({ by: ["rating"], where: { shop_id: shop!.id, status: "APPROVED" }, _count: { _all: true } }),
  ]);
  return {
    averageRating: Number(approved._avg.rating ?? 0),
    totalApprovedReviews: approved._count._all,
    totalReviews: total,
    ratings: Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [
      rating,
      ratingGroups.find((group) => group.rating === rating)?._count._all ?? 0,
    ])),
  };
}

export async function getCurrentSubscription(ownerId: string) {
  const shop = await getOwnedShop(ownerId);
  return prisma.shopSubscription.findFirst({
    where: { shop_id: shop!.id, status: "ACTIVE", end_at: { gte: new Date() } },
    orderBy: [{ end_at: "desc" }, { id: "desc" }],
    include: { plan: true },
  });
}

export async function listSubscriptionHistory(ownerId: string, page: number, limit: number) {
  const shop = await getOwnedShop(ownerId);
  const where = { shop_id: shop!.id };
  const [items, total] = await Promise.all([
    prisma.shopSubscription.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }], include: { plan: true },
    }),
    prisma.shopSubscription.count({ where }),
  ]);
  return { items, total };
}

export async function listSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { status: 1 },
    orderBy: [{ price: "asc" }, { id: "asc" }],
    select: { id: true, name: true, description: true, price: true, duration: true, duration_unit: true, features: true },
  });
}

function addPlanDuration(start: Date, duration: number, unit: "DAY" | "MONTH" | "YEAR"): Date {
  const end = new Date(start);
  if (unit === "DAY") {
    end.setUTCDate(end.getUTCDate() + duration);
    return end;
  }
  const originalDay = end.getUTCDate();
  const monthsToAdd = unit === "YEAR" ? duration * 12 : duration;
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + monthsToAdd);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(originalDay, lastDay));
  return end;
}

export async function requestSubscription(ownerId: string, planId: bigint) {
  const shop = await getOwnedShop(ownerId);
  const plan = await prisma.subscriptionPlan.findFirst({ where: { id: planId, status: 1 } });
  if (!plan) throw new AppError("Active subscription plan not found", 404);
  if (plan.duration < 1) throw new AppError("Subscription plan duration is invalid", 409);
  const existing = await prisma.shopSubscription.findFirst({
    where: { shop_id: shop!.id, OR: [{ status: "PENDING" }, { status: "ACTIVE", end_at: { gt: new Date() } }] },
    select: { id: true },
  });
  if (existing) throw new AppError("An active or pending subscription already exists for this shop", 409);
  const start = new Date();
  const end = addPlanDuration(start, plan.duration, plan.duration_unit);
  return prisma.shopSubscription.create({
    data: { shop_id: shop!.id, plan_id: plan.id, start_at: start, end_at: end, price: plan.price, status: "PENDING" },
    include: { plan: true },
  });
}
