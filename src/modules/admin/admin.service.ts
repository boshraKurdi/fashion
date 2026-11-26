import { prisma } from "../../config/database.js";
import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { EmailDeliveryError, sendShopDecisionEmail } from "../../services/email.service.js";
import { AppError } from "../auth/auth.service.js";
import type { ShopDecision, ShopListQuery } from "./admin.validation.js";

const shopWithOwner = {
  owner: { select: { id: true, name: true, email: true, phone: true, email_verified_at: true } },
} as const;

export async function listShops(query: ShopListQuery) {
  const where = { status: query.status };
  const [items, total] = await Promise.all([
    prisma.shop.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      include: shopWithOwner,
    }),
    prisma.shop.count({ where }),
  ]);

  return { items, total };
}

async function notifyShopOwner(shopId: bigint): Promise<void> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: shopWithOwner,
  });

  if (!shop) {
    throw new AppError("Shop not found", 404);
  }

  if (shop.status !== "APPROVED" && shop.status !== "REJECTED") {
    throw new AppError("Only approved or rejected shops have a decision email", 409);
  }

  try {
    await sendShopDecisionEmail({
      ownerName: shop.owner.name,
      ownerEmail: shop.email || shop.owner.email,
      shopName: shop.name,
      status: shop.status,
      rejectionReason: shop.rejection_reason,
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      throw new AppError("Shop decision was saved, but its email could not be sent. Retry using the decision-email endpoint.", 502);
    }

    throw error;
  }
}

export async function decideShop(shopId: bigint, decision: ShopDecision) {
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.shop.findUnique({
      where: { id: shopId },
      select: { id: true, owner_id: true, status: true },
    });

    if (!current) {
      throw new AppError("Shop not found", 404);
    }

    if (current.status !== "PENDING") {
      throw new AppError("Only pending shops can receive a decision", 409);
    }

    const result = await transaction.shop.updateMany({
      where: { id: shopId, status: "PENDING" },
      data: decision.decision === "APPROVED"
        ? { status: "APPROVED", approved_at: new Date(), rejection_reason: null }
        : { status: "REJECTED", approved_at: null, rejection_reason: decision.rejectionReason },
    });

    if (result.count !== 1) {
      throw new AppError("Shop status changed before the decision could be saved", 409);
    }

    if (decision.decision === "APPROVED") {
      await transaction.user.updateMany({
        where: { id: current.owner_id, role: "CUSTOMER" },
        data: { role: "SHOP_OWNER" },
      });
    }
  });

  await notifyShopOwner(shopId);

  return prisma.shop.findUnique({
    where: { id: shopId },
    include: shopWithOwner,
  });
}

export async function resendShopDecisionEmail(shopId: bigint): Promise<void> {
  await notifyShopOwner(shopId);
}

export async function dashboard() {
  const [
    usersTotal, customers, shopOwners, admins, activeUsers, blockedUsers,
    shopsTotal, shopsPending, shopsApproved, shopsRejected, shopsSuspended,
    productsTotal, productsActive, productsHidden, productsArchived,
    ordersTotal, ordersPending, ordersProcessing, ordersDelivered, ordersCancelled,
    paymentsCompleted, paymentsPending, paymentsFailed, paymentsRefunded,
    subscriptionsTotal, subscriptionsActive, subscriptionsPending, subscriptionsExpired,
    reviewsTotal, reviewAggregate, shopsWithActiveSubscription,
    recentUsers, recentShops, recentOrders, recentSubscriptions, pendingShops,
    subscriptionRevenue,
  ] = await Promise.all([
    prisma.user.count(), prisma.user.count({ where: { role: "CUSTOMER" } }), prisma.user.count({ where: { role: "SHOP_OWNER" } }), prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }), prisma.user.count({ where: { status: "BLOCKED" } }),
    prisma.shop.count(), prisma.shop.count({ where: { status: "PENDING" } }), prisma.shop.count({ where: { status: "APPROVED" } }), prisma.shop.count({ where: { status: "REJECTED" } }), prisma.shop.count({ where: { status: "SUSPENDED" } }),
    prisma.product.count(), prisma.product.count({ where: { status: "ACTIVE" } }), prisma.product.count({ where: { status: "HIDDEN" } }), prisma.product.count({ where: { status: "ARCHIVED" } }),
    prisma.order.count(), prisma.order.count({ where: { status: "PENDING" } }), prisma.order.count({ where: { status: "PROCESSING" } }), prisma.order.count({ where: { status: "DELIVERED" } }), prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }), prisma.payment.count({ where: { status: "PENDING" } }), prisma.payment.count({ where: { status: "FAILED" } }), prisma.payment.count({ where: { status: "REFUNDED" } }),
    prisma.shopSubscription.count(), prisma.shopSubscription.count({ where: { status: "ACTIVE" } }), prisma.shopSubscription.count({ where: { status: "PENDING" } }), prisma.shopSubscription.count({ where: { status: "EXPIRED" } }),
    prisma.shopReview.count(), prisma.shopReview.aggregate({ _avg: { rating: true } }),
    prisma.shopSubscription.groupBy({ by: ["shop_id"], where: { status: "ACTIVE" } }),
    prisma.user.findMany({ orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 5, select: { id: true, name: true, email: true, role: true, status: true, created_at: true } }),
    prisma.shop.findMany({ orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 5, select: { id: true, name: true, status: true, created_at: true } }),
    prisma.order.findMany({ orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 5, select: { id: true, order_number: true, status: true, payment_status: true, total: true, created_at: true } }),
    prisma.shopSubscription.findMany({ orderBy: [{ created_at: "desc" }, { id: "desc" }], take: 5, include: { shop: { select: { id: true, name: true } }, plan: { select: { id: true, name: true } } } }),
    prisma.shop.findMany({ where: { status: "PENDING" }, orderBy: [{ created_at: "asc" }, { id: "asc" }], take: 10, select: { id: true, name: true, created_at: true } }),
    prisma.shopSubscription.aggregate({ _sum: { price: true }, where: { status: "ACTIVE" } }),
  ]);
  return {
    users: { total: usersTotal, customers, shopOwners, admins, active: activeUsers, blocked: blockedUsers },
    shops: { total: shopsTotal, pending: shopsPending, approved: shopsApproved, rejected: shopsRejected, suspended: shopsSuspended },
    products: { total: productsTotal, active: productsActive, hidden: productsHidden, archived: productsArchived },
    orders: { total: ordersTotal, new: ordersPending, processing: ordersProcessing, completed: ordersDelivered, cancelled: ordersCancelled },
    financial: { successfulPayments: paymentsCompleted._sum.amount ?? 0, pendingPayments: paymentsPending, failedPayments: paymentsFailed, refundedPayments: paymentsRefunded, subscriptionRevenue: subscriptionRevenue._sum.price ?? 0, commissionRevenue: 0 },
    subscriptions: { total: subscriptionsTotal, active: subscriptionsActive, pending: subscriptionsPending, expired: subscriptionsExpired, shopsWithActiveSubscription: shopsWithActiveSubscription.length },
    reviews: { total: reviewsTotal, averageRating: reviewAggregate._avg.rating ?? 0 },
    recentActivity: { users: recentUsers, shops: recentShops, orders: recentOrders, subscriptions: recentSubscriptions, pendingShopApprovals: pendingShops },
  };
}

function paginated(items: unknown[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: total ? Math.ceil(total / limit) : 0 };
}

export async function listUsers(query: any) {
  const where: any = {};
  if (query.search) where.OR = [
    { name: { contains: query.search } },
    { email: { contains: query.search } },
    { phone: { contains: query.search } },
  ];
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, name: true, email: true, phone: true, role: true, status: true, email_verified_at: true, created_at: true, updated_at: true } }),
    prisma.user.count({ where }),
  ]);
  return paginated(items, total, query.page, query.limit);
}

export async function getUser(id: bigint) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true, status: true, email_verified_at: true, created_at: true, updated_at: true, shops: true, orders: { take: 10, orderBy: { created_at: "desc" } }, reviews: true } });
  if (!user) throw new AppError("User not found", 404);
  return user;
}
export async function updateUser(id: bigint, data: any) {
  return prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, phone: true, role: true, status: true, created_at: true, updated_at: true } });
}
export async function setUserStatus(id: bigint, status: "ACTIVE" | "INACTIVE" | "BLOCKED") {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) throw new AppError("User not found", 404);
  if (user.role === "ADMIN" && status !== "ACTIVE") throw new AppError("An admin account cannot be deactivated or blocked", 409);
  return prisma.user.update({ where: { id }, data: { status }, select: { id: true, name: true, email: true, role: true, status: true } });
}
export async function setUserRole(id: bigint, role: "CUSTOMER" | "SHOP_OWNER" | "ADMIN") {
  return prisma.user.update({ where: { id }, data: { role }, select: { id: true, name: true, email: true, role: true, status: true } });
}
export async function deleteUser(id: bigint) {
  const [orders, payments, reviews] = await Promise.all([prisma.order.count({ where: { user_id: id } }), prisma.payment.count({ where: { order: { user_id: id } } }), prisma.shopReview.count({ where: { user_id: id } })]);
  if (orders || payments || reviews) {
    return prisma.user.update({ where: { id }, data: { status: "INACTIVE", email: `deleted-${id}-${Date.now()}@invalid.local` }, select: { id: true, status: true } });
  }
  await prisma.user.delete({ where: { id } });
  return { deleted: true };
}

export async function listShopsAdmin(query: any) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.search) where.OR = [{ name: { contains: query.search } }, { owner: { is: { name: { contains: query.search } } } }];
  const [items, total] = await Promise.all([
    prisma.shop.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { branches: true, products: true } } } }),
    prisma.shop.count({ where }),
  ]);
  return paginated(items, total, query.page, query.limit);
}
export async function getShop(id: bigint) {
  const shop = await prisma.shop.findUnique({ where: { id }, include: { owner: true, branches: true, products: { include: { images: true, variants: true } } } });
  if (!shop) throw new AppError("Shop not found", 404);
  return shop;
}
export async function updateShop(id: bigint, data: any) {
  return prisma.shop.update({ where: { id }, data });
}
export async function setShopStatus(id: bigint, status: "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING", rejectionReason?: string) {
  const data: any = { status };
  if (status === "APPROVED") { data.approved_at = new Date(); data.rejection_reason = null; }
  if (status === "REJECTED") { data.approved_at = null; data.rejection_reason = rejectionReason ?? "Rejected by platform admin"; }
  if (status === "SUSPENDED") data.approved_at = null;
  if (status === "PENDING") data.approved_at = null;
  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.update({ where: { id }, data, include: { owner: true } });
    if (status === "APPROVED") await tx.user.updateMany({ where: { id: shop.owner_id, role: "CUSTOMER" }, data: { role: "SHOP_OWNER" } });
    return shop;
  });
}

export async function verifyShop(id: bigint) {
  const shop = await prisma.shop.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!shop) throw new AppError("Shop not found", 404);
  if (shop.status !== "APPROVED") {
    throw new AppError("Only an approved shop can be verified", 409);
  }
  return prisma.shop.update({
    where: { id },
    data: { is_verified: true, verified_at: new Date() },
  });
}

export async function unverifyShop(id: bigint) {
  const shop = await prisma.shop.findUnique({ where: { id }, select: { id: true } });
  if (!shop) throw new AppError("Shop not found", 404);
  return prisma.shop.update({
    where: { id },
    data: { is_verified: false, verified_at: null },
  });
}

export async function listCategories(query: any) {
  const where: any = {};
  if (query.search) where.name = { contains: query.search };
  if (query.status !== undefined) where.status = Number(query.status);
  if (query.parentId) where.parent_id = BigInt(query.parentId);
  const [items, total] = await Promise.all([prisma.category.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { name: "asc" }, include: { parent: true, _count: { select: { products: true, children: true } } } }), prisma.category.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export async function getCategory(id: bigint) {
  return prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: true,
      _count: { select: { products: true } },
    },
  });
}
export async function createCategory(data: any) {
  return prisma.category.create({ data: { name: data.name, slug: data.slug, parent_id: data.parentId ? BigInt(data.parentId) : null, image: data.image ?? null } });
}
export async function updateCategory(id: bigint, data: any) {
  if (data.parentId !== undefined) {
    if (data.parentId !== null && BigInt(data.parentId) === id) throw new AppError("A category cannot be its own parent", 400);
    if (data.parentId !== null) {
      let cursor = BigInt(data.parentId);
      const visited = new Set<bigint>();
      while (cursor) {
        if (cursor === id) throw new AppError("Category hierarchy would contain a cycle", 400);
        if (visited.has(cursor)) break;
        visited.add(cursor);
        const parent = await prisma.category.findUnique({ where: { id: cursor }, select: { parent_id: true } });
        if (!parent) throw new AppError("Parent category not found", 404);
        cursor = parent.parent_id ?? 0n;
      }
    }
  }
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.parentId !== undefined) updateData.parent_id = data.parentId === null ? null : BigInt(data.parentId);
  if (data.image !== undefined) updateData.image = data.image;
  return prisma.category.update({ where: { id }, data: updateData });
}
export async function setCategoryStatus(id: bigint, status: number) {
  return prisma.category.update({ where: { id }, data: { status } });
}
export async function deleteCategory(id: bigint) {
  const related = await prisma.product.count({ where: { category_id: id } });
  if (related) throw new AppError("Category cannot be deleted because products are linked to it", 409);
  return prisma.category.delete({ where: { id } });
}

export async function listBrands(query: any) {
  const where: any = {};
  if (query.search) where.name = { contains: query.search };
  if (query.status !== undefined) where.status = Number(query.status);
  const [items, total] = await Promise.all([prisma.brand.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }), prisma.brand.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getBrand = (id: bigint) => prisma.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
export const createBrand = (data: any) => prisma.brand.create({ data: { name: data.name, logo: data.logo ?? null } });
export const updateBrand = (id: bigint, data: any) => prisma.brand.update({ where: { id }, data });
export const setBrandStatus = (id: bigint, status: number) => prisma.brand.update({ where: { id }, data: { status } });
export async function deleteBrand(id: bigint) {
  const count = await prisma.product.count({ where: { brand_id: id } });
  if (count) throw new AppError("Brand cannot be deleted because products are linked to it", 409);
  return prisma.brand.delete({ where: { id } });
}

export async function listProducts(query: any) {
  const where: any = {};
  if (query.search) where.name = { contains: query.search };
  if (query.status) where.status = query.status;
  if (query.shopId) where.shop_id = BigInt(query.shopId);
  if (query.categoryId) where.category_id = BigInt(query.categoryId);
  if (query.brandId) where.brand_id = BigInt(query.brandId);
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { shop: true, category: true, brand: true, images: true, variants: true } }),
    prisma.product.count({ where }),
  ]);
  return paginated(items, total, query.page, query.limit);
}
export async function getProduct(id: bigint) {
  const product = await prisma.product.findUnique({ where: { id }, include: { shop: true, category: true, brand: true, images: true, variants: { include: { color: true, size: true } }, offerProducts: { include: { offer: true } } } });
  if (!product) throw new AppError("Product not found", 404);
  return product;
}
export const setProductStatus = (id: bigint, status: "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED") => prisma.product.update({ where: { id }, data: { status } });
export async function deleteProduct(id: bigint) {
  const inOrders = await prisma.orderItem.count({ where: { product_id: id } });
  if (inOrders) {
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    return { archived: true };
  }
  return prisma.product.delete({ where: { id } });
}

export async function listOrders(query: any) {
  const where: any = {};
  if (query.search) where.order_number = { contains: query.search };
  if (query.shopId) where.shop_id = BigInt(query.shopId);
  if (query.userId) where.user_id = BigInt(query.userId);
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.payment_status = query.paymentStatus;
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [items, total] = await Promise.all([prisma.order.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { user: { select: { id: true, name: true, email: true, phone: true } }, shop: { select: { id: true, name: true } }, payments: true } }), prisma.order.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export async function getOrder(id: bigint) {
  const order = await prisma.order.findUnique({ where: { id }, include: { user: true, shop: true, items: { include: { product: true, variant: true } }, payments: true } });
  if (!order) throw new AppError("Order not found", 404);
  return order;
}
export async function setOrderStatus(id: bigint, status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED") {
  return prisma.order.update({ where: { id }, data: { status } });
}
export async function orderStatistics(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [total, aggregate, byStatus, cancelled, refunded] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.order.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.order.count({ where: { ...where, payment_status: "REFUNDED" } }),
  ]);
  return { totalOrders: total, totalValue: aggregate._sum.total ?? 0, byStatus, cancelled, refunded };
}

export async function listPayments(query: any) {
  const where: any = {};
  if (query.search) where.transaction_id = { contains: query.search };
  if (query.method) where.method = query.method;
  if (query.status) where.status = query.status;
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [items, total] = await Promise.all([prisma.payment.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { order: { include: { user: { select: { id: true, name: true, email: true } }, shop: { select: { id: true, name: true } } } }, payment_account: true, reviewed_by: { select: { id: true, name: true, email: true } } } }), prisma.payment.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export async function getPayment(id: bigint) {
  const payment = await prisma.payment.findUnique({ where: { id }, include: { order: { include: { user: true, shop: true, items: true } }, payment_account: true, reviewed_by: { select: { id: true, name: true, email: true } } } });
  if (!payment) throw new AppError("Payment not found", 404);
  return payment;
}
export async function paymentStatistics(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [completed, pending, failed, refunded, cancelled, aggregate] = await Promise.all([
    prisma.payment.count({ where: { ...where, status: "COMPLETED" } }), prisma.payment.count({ where: { ...where, status: "PENDING" } }), prisma.payment.count({ where: { ...where, status: "FAILED" } }), prisma.payment.count({ where: { ...where, status: "REFUNDED" } }), prisma.payment.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true } }),
  ]);
  return { completed, pending, failed, refunded, cancelled, successfulAmount: aggregate._sum.amount ?? 0 };
}
export async function reviewPayment(id: bigint, approve: boolean, adminId: bigint, transactionId?: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id }, include: { order: true } });
    if (!payment) throw new AppError("Payment not found", 404);
    if (payment.status !== "PENDING") throw new AppError("Only pending payments can be reviewed", 409);
    const status = approve ? "COMPLETED" : "FAILED";
    const updated = await tx.payment.update({ where: { id }, data: { status, paid_at: approve ? new Date() : null, transaction_id: transactionId ?? payment.transaction_id, reviewed_by_id: adminId, reviewed_at: new Date() } });
    await tx.order.update({ where: { id: payment.order_id }, data: { payment_status: approve ? "PAID" : "FAILED" } });
    return updated;
  });
}

export async function listSubscriptionPlans(query: any) {
  const where: any = {};
  if (query.search) where.name = { contains: query.search };
  if (query.status !== undefined) where.status = Number(query.status);
  const [items, total] = await Promise.all([prisma.subscriptionPlan.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { _count: { select: { subscriptions: true } } } }), prisma.subscriptionPlan.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getSubscriptionPlan = (id: bigint) => prisma.subscriptionPlan.findUnique({ where: { id }, include: { subscriptions: { include: { shop: true } } } });
export const createSubscriptionPlan = (data: any) => prisma.subscriptionPlan.create({ data: { name: data.name, description: data.description ?? null, price: data.price, duration: data.duration, duration_unit: data.durationUnit, features: data.features ?? undefined } });
export const updateSubscriptionPlan = (id: bigint, data: any) => prisma.subscriptionPlan.update({ where: { id }, data: { name: data.name, description: data.description, price: data.price, duration: data.duration, duration_unit: data.durationUnit, features: data.features } });
export const setSubscriptionPlanStatus = (id: bigint, status: number) => prisma.subscriptionPlan.update({ where: { id }, data: { status } });
export async function deleteSubscriptionPlan(id: bigint) {
  const count = await prisma.shopSubscription.count({ where: { plan_id: id } });
  if (count) throw new AppError("Subscription plan cannot be deleted because it has subscriptions; deactivate it instead", 409);
  return prisma.subscriptionPlan.delete({ where: { id } });
}

export async function listShopSubscriptions(query: any) {
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.planId) where.plan_id = BigInt(query.planId);
  if (query.shopId) where.shop_id = BigInt(query.shopId);
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [items, total] = await Promise.all([prisma.shopSubscription.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { shop: true, plan: true } }), prisma.shopSubscription.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getShopSubscription = (id: bigint) => prisma.shopSubscription.findUnique({ where: { id }, include: { shop: true, plan: true } });
export async function decideShopSubscription(id: bigint, decision: "APPROVE" | "REJECT" | "CANCEL", rejectionReason?: string) {
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.shopSubscription.findUnique({ where: { id }, include: { plan: true } });
    if (!subscription) throw new AppError("Subscription not found", 404);
    if (decision === "APPROVE") {
      if (subscription.status !== "PENDING") throw new AppError("Only pending subscriptions can be approved", 409);
      const durationMs: Record<string, number> = { DAY: 86400000, MONTH: 2592000000, YEAR: 31536000000 };
      const start = new Date();
      const duration = durationMs[subscription.plan.duration_unit] ?? durationMs.MONTH ?? 2592000000;
      const end = new Date(start.getTime() + subscription.plan.duration * duration);
      return tx.shopSubscription.update({ where: { id }, data: { status: "ACTIVE", start_at: start, end_at: end } });
    }
    if (decision === "REJECT") return tx.shopSubscription.update({ where: { id }, data: { status: "CANCELLED" } });
    if (subscription.status === "CANCELLED") throw new AppError("Subscription is already cancelled", 409);
    return tx.shopSubscription.update({ where: { id }, data: { status: "CANCELLED" } });
  });
}

export async function listOffers(query: any) {
  const where: any = {};
  if (query.search) where.title = { contains: query.search };
  if (query.shopId) where.shop_id = BigInt(query.shopId);
  if (query.status) where.status = query.status;
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [items, total] = await Promise.all([prisma.offer.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { shop: true, offerProducts: { include: { product: true } } } }), prisma.offer.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getOffer = (id: bigint) => prisma.offer.findUnique({ where: { id }, include: { shop: true, offerProducts: { include: { product: true } } } });
export async function createOffer(data: any) {
  if (data.discountType === "PERCENTAGE" && data.discountValue > 100) throw new AppError("Percentage discount cannot exceed 100", 400);
  return prisma.$transaction(async (tx) => {
    if (data.productIds.length) {
      const products = await tx.product.findMany({ where: { id: { in: data.productIds.map((id: number) => BigInt(id)) } }, select: { id: true, shop_id: true } });
      if (products.length !== data.productIds.length || products.some((product) => product.shop_id !== BigInt(data.shopId))) throw new AppError("Every offer product must belong to the selected shop", 400);
    }
    return tx.offer.create({ data: { shop_id: BigInt(data.shopId), title: data.title, description: data.description ?? null, image: data.image ?? null, discount_type: data.discountType, discount_value: data.discountValue, start_at: data.startAt, end_at: data.endAt, offerProducts: { create: data.productIds.map((id: number) => ({ product_id: BigInt(id) })) } }, include: { shop: true, offerProducts: { include: { product: true } } } });
  });
}
export async function updateOffer(id: bigint, data: any) {
  if (data.discountType === "PERCENTAGE" && data.discountValue > 100) throw new AppError("Percentage discount cannot exceed 100", 400);
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({ where: { id } });
    if (!offer) throw new AppError("Offer not found", 404);
    if (data.productIds) {
      const shopId = data.shopId ? BigInt(data.shopId) : offer.shop_id;
      const products = await tx.product.findMany({ where: { id: { in: data.productIds.map((productId: number) => BigInt(productId)) } }, select: { id: true, shop_id: true } });
      if (products.length !== data.productIds.length || products.some((product) => product.shop_id !== shopId)) throw new AppError("Every offer product must belong to the selected shop", 400);
      await tx.offerProduct.deleteMany({ where: { offer_id: id } });
    }
    const offerUpdate: any = {};
    if (data.shopId !== undefined) offerUpdate.shop_id = BigInt(data.shopId);
    if (data.title !== undefined) offerUpdate.title = data.title;
    if (data.description !== undefined) offerUpdate.description = data.description;
    if (data.image !== undefined) offerUpdate.image = data.image;
    if (data.discountType !== undefined) offerUpdate.discount_type = data.discountType;
    if (data.discountValue !== undefined) offerUpdate.discount_value = data.discountValue;
    if (data.startAt !== undefined) offerUpdate.start_at = data.startAt;
    if (data.endAt !== undefined) offerUpdate.end_at = data.endAt;
    const updated = await tx.offer.update({ where: { id }, data: offerUpdate });
    if (data.productIds) await tx.offerProduct.createMany({ data: data.productIds.map((productId: number) => ({ offer_id: id, product_id: BigInt(productId) })) });
    return updated;
  });
}
export async function deleteOffer(id: bigint) {
  return prisma.offer.delete({ where: { id } });
}
export const setOfferStatus = (id: bigint, status: "DRAFT" | "ACTIVE" | "INACTIVE" | "EXPIRED") => prisma.offer.update({ where: { id }, data: { status } });

export async function listReviews(query: any) {
  const where: any = {};
  if (query.search) where.comment = { contains: query.search };
  if (query.shopId) where.shop_id = BigInt(query.shopId);
  if (query.rating) where.rating = Number(query.rating);
  if (query.status) where.status = query.status;
  if (query.startDate || query.endDate) where.created_at = { gte: query.startDate, lte: query.endDate };
  const [items, total] = await Promise.all([prisma.shopReview.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { created_at: "desc" }, include: { user: { select: { id: true, name: true, email: true } }, shop: true } }), prisma.shopReview.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getReview = (id: bigint) => prisma.shopReview.findUnique({ where: { id }, include: { user: true, shop: true, order: true } });
export const setReviewStatus = (id: bigint, status: "PENDING" | "APPROVED" | "HIDDEN" | "REJECTED") => prisma.shopReview.update({ where: { id }, data: { status } });
export const deleteReview = (id: bigint) => prisma.shopReview.delete({ where: { id } });

export async function getSettings() {
  return prisma.platformSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, platform_name: "Fashion Marketplace" } });
}
export async function updateSettings(data: any) {
  return prisma.platformSetting.upsert({
    where: { id: 1 },
    update: {
      platform_name: data.platformName, description: data.description, logo: data.logo,
      email: data.email, phone: data.phone, support_email: data.supportEmail,
      support_phone: data.supportPhone, currency: data.currency,
      social_links: data.socialLinks, general: data.general,
    },
    create: { id: 1, platform_name: data.platformName ?? "Fashion Marketplace", description: data.description, logo: data.logo, email: data.email, phone: data.phone, support_email: data.supportEmail, support_phone: data.supportPhone, currency: data.currency ?? "USD", social_links: data.socialLinks, general: data.general },
  });
}

export async function listPaymentAccounts(query: any) {
  const where: any = {};
  if (query.status !== undefined) where.status = Number(query.status);
  if (query.search) where.OR = [{ method_name: { contains: query.search } }, { provider_name: { contains: query.search } }, { account_name: { contains: query.search } }];
  const [items, total] = await Promise.all([prisma.paymentAccount.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ sort_order: "asc" }, { id: "asc" }] }), prisma.paymentAccount.count({ where })]);
  return paginated(items, total, query.page, query.limit);
}
export const getPaymentAccount = (id: bigint) => prisma.paymentAccount.findUnique({ where: { id } });
export async function createPaymentAccount(data: any, qrPath?: string) {
  return prisma.paymentAccount.create({ data: { method_name: data.methodName, provider_name: data.providerName, account_name: data.accountName, account_number: data.accountNumber ?? null, payment_code: data.paymentCode ?? null, qr_image: qrPath ?? null, instructions: data.instructions ?? null, status: data.status === "INACTIVE" ? 0 : 1, sort_order: data.sortOrder ?? 0 } });
}
export async function updatePaymentAccount(id: bigint, data: any, qrPath?: string) {
  const current = await prisma.paymentAccount.findUnique({ where: { id } });
  if (!current) throw new AppError("Payment account not found", 404);
  if (qrPath === "__DELETE__") {
    if (current.qr_image) await rm(path.resolve(process.cwd(), current.qr_image.replace(/^\//, "")), { force: true });
  }
  const updateData: any = {};
  if (data.methodName !== undefined) updateData.method_name = data.methodName;
  if (data.providerName !== undefined) updateData.provider_name = data.providerName;
  if (data.accountName !== undefined) updateData.account_name = data.accountName;
  if (data.accountNumber !== undefined) updateData.account_number = data.accountNumber;
  if (data.paymentCode !== undefined) updateData.payment_code = data.paymentCode;
  if (data.instructions !== undefined) updateData.instructions = data.instructions;
  if (data.status !== undefined) updateData.status = data.status === "INACTIVE" ? 0 : 1;
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
  if (qrPath === "__DELETE__") updateData.qr_image = null;
  else if (qrPath !== undefined) updateData.qr_image = qrPath;
  return prisma.paymentAccount.update({ where: { id }, data: updateData });
}
export const setPaymentAccountStatus = (id: bigint, active: boolean) => prisma.paymentAccount.update({ where: { id }, data: { status: active ? 1 : 0 } });
export async function deletePaymentAccount(id: bigint) {
  const account = await prisma.paymentAccount.findUnique({ where: { id } });
  if (!account) throw new AppError("Payment account not found", 404);
  if (await prisma.payment.count({ where: { payment_account_id: id } })) throw new AppError("Payment account cannot be deleted because it is referenced by payments; deactivate it instead", 409);
  await prisma.paymentAccount.delete({ where: { id } });
  if (account.qr_image) await rm(path.resolve(process.cwd(), account.qr_image.replace(/^\//, "")), { force: true });
  return { deleted: true };
}
export async function publicPaymentMethods() {
  return prisma.paymentAccount.findMany({ where: { status: 1 }, orderBy: [{ sort_order: "asc" }, { id: "asc" }], select: { id: true, method_name: true, provider_name: true, account_name: true, account_number: true, payment_code: true, qr_image: true, instructions: true } });
}

export const getAdminProfile = (id: bigint) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true, role: true, status: true, email_verified_at: true, created_at: true, updated_at: true } });
export const updateAdminProfile = (id: bigint, data: any) => prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, phone: true, role: true, status: true, email_verified_at: true, created_at: true, updated_at: true } });
export async function changeAdminPassword(id: bigint, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { password: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new AppError("Current password is incorrect", 400);
  const password = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { password } });
  return { passwordChanged: true };
}

function dateBounds(query: any) {
  return { gte: query.startDate, lte: query.endDate };
}
export async function salesReport(query: any) {
  const where: any = { status: "COMPLETED" };
  if (query.startDate || query.endDate) where.created_at = dateBounds(query);
  const [total, rows] = await Promise.all([prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { _all: true } }), prisma.payment.findMany({ where, select: { amount: true, paid_at: true, created_at: true } })]);
  return { totalSales: total._sum.amount ?? 0, totalPayments: total._count._all, rows };
}
export async function ordersReport(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = dateBounds(query);
  const [total, amount, statuses] = await Promise.all([prisma.order.count({ where }), prisma.order.aggregate({ where, _sum: { total: true } }), prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } })]);
  return { totalOrders: total, totalValue: amount._sum.total ?? 0, statuses };
}
export async function subscriptionsReport(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = dateBounds(query);
  const [total, statuses, activeShopRows] = await Promise.all([
    prisma.shopSubscription.count({ where }),
    prisma.shopSubscription.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.shopSubscription.groupBy({ by: ["shop_id"], where: { ...where, status: "ACTIVE" } }),
  ]);
  const activeShops = activeShopRows.length;
  const revenue = await prisma.shopSubscription.aggregate({ where: { ...where, status: "ACTIVE" }, _sum: { price: true } });
  return { totalSubscriptions: total, subscriptionRevenue: revenue._sum.price ?? 0, activeShops, statuses };
}
export async function shopsReport(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = dateBounds(query);
  const [total, statuses] = await Promise.all([prisma.shop.count({ where }), prisma.shop.groupBy({ by: ["status"], where, _count: { _all: true } })]);
  return { totalShops: total, statuses };
}
export async function usersReport(query: any) {
  const where: any = {};
  if (query.startDate || query.endDate) where.created_at = dateBounds(query);
  const [total, roles, statuses] = await Promise.all([prisma.user.count({ where }), prisma.user.groupBy({ by: ["role"], where, _count: { _all: true } }), prisma.user.groupBy({ by: ["status"], where, _count: { _all: true } })]);
  return { totalUsers: total, roles, statuses };
}
