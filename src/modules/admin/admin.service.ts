import { prisma } from "../../config/database.js";
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
