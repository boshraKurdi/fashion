import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../auth/auth.service.js";
import {
  branchCreateSchema, branchStatusSchema, branchUpdateSchema, imageCreateSchema, imageUpdateSchema,
  offerCreateSchema, offerListQuerySchema, offerStatusSchema, offerUpdateSchema, orderListQuerySchema,
  orderStatusSchema, pathIdSchema, productCreateSchema, productListQuerySchema, productStatusSchema,
  productUpdateSchema, reviewListQuerySchema, shopUpdateSchema, subscriptionHistoryQuerySchema,
  subscriptionRequestSchema, variantCreateSchema, variantUpdateSchema,
} from "./shop-owner.validation.js";
import * as service from "./shop-owner.service.js";

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw result.error;
  return result.data;
}

function getOwnerId(req: Request): string {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  return req.authUser.id;
}

function getId(req: Request, key = "id"): bigint {
  return BigInt(parse(pathIdSchema, req.params[key]));
}

function sendPage(res: Parameters<RequestHandler>[1], items: unknown[], page: number, limit: number, total: number) {
  res.status(200).json({
    success: true,
    data: items,
    meta: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
  });
}

export const dashboardController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Dashboard retrieved successfully", data: await service.getDashboard(getOwnerId(req)) });
};

export const getShopController: RequestHandler = async (req, res) => {
  const shop = await service.getOwnedShop(getOwnerId(req));
  const { owner_id: _ownerId, ...data } = shop!;
  res.status(200).json({ success: true, message: "Shop retrieved successfully", data });
};

export const updateShopController: RequestHandler = async (req, res) => {
  const data = await service.updateShop(getOwnerId(req), parse(shopUpdateSchema, req.body));
  const { owner_id: _ownerId, ...shop } = data;
  res.status(200).json({ success: true, message: "Shop updated successfully", data: shop });
};

export const listProductsController: RequestHandler = async (req, res) => {
  const query = parse(productListQuerySchema, req.query);
  const result = await service.listProducts(getOwnerId(req), query);
  sendPage(res, result.items, query.page, query.limit, result.total);
};

export const getProductController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Product retrieved successfully", data: await service.getProduct(getOwnerId(req), getId(req)) });
};

export const createProductController: RequestHandler = async (req, res) => {
  const data = await service.createProduct(getOwnerId(req), parse(productCreateSchema, req.body));
  res.status(201).json({ success: true, message: "Product created successfully", data });
};

export const updateProductController: RequestHandler = async (req, res) => {
  const data = await service.updateProduct(getOwnerId(req), getId(req), parse(productUpdateSchema, req.body));
  res.status(200).json({ success: true, message: "Product updated successfully", data });
};

export const archiveProductController: RequestHandler = async (req, res) => {
  const data = await service.archiveProduct(getOwnerId(req), getId(req));
  res.status(200).json({ success: true, message: "Product archived successfully", data });
};

export const updateProductStatusController: RequestHandler = async (req, res) => {
  const body = parse(productStatusSchema, req.body);
  const data = await service.setProductStatus(getOwnerId(req), getId(req), body.status);
  res.status(200).json({ success: true, message: "Product status updated successfully", data });
};

export const createProductImageController: RequestHandler = async (req, res) => {
  const data = await service.createProductImage(getOwnerId(req), getId(req), parse(imageCreateSchema, req.body));
  res.status(201).json({ success: true, message: "Product image added successfully", data });
};

export const updateProductImageController: RequestHandler = async (req, res) => {
  const data = await service.updateProductImage(getOwnerId(req), getId(req), getId(req, "imageId"), parse(imageUpdateSchema, req.body));
  res.status(200).json({ success: true, message: "Product image updated successfully", data });
};

export const deleteProductImageController: RequestHandler = async (req, res) => {
  await service.deleteProductImage(getOwnerId(req), getId(req), getId(req, "imageId"));
  res.status(200).json({ success: true, message: "Product image deleted successfully" });
};

export const createProductVariantController: RequestHandler = async (req, res) => {
  const data = await service.createProductVariant(getOwnerId(req), getId(req), parse(variantCreateSchema, req.body));
  res.status(201).json({ success: true, message: "Product variant created successfully", data });
};

export const updateProductVariantController: RequestHandler = async (req, res) => {
  const data = await service.updateProductVariant(getOwnerId(req), getId(req), getId(req, "variantId"), parse(variantUpdateSchema, req.body));
  res.status(200).json({ success: true, message: "Product variant updated successfully", data });
};

export const deleteProductVariantController: RequestHandler = async (req, res) => {
  await service.deleteProductVariant(getOwnerId(req), getId(req), getId(req, "variantId"));
  res.status(200).json({ success: true, message: "Product variant deleted successfully" });
};

export const listOrdersController: RequestHandler = async (req, res) => {
  const query = parse(orderListQuerySchema, req.query);
  const result = await service.listOrders(getOwnerId(req), query);
  sendPage(res, result.items, query.page, query.limit, result.total);
};

export const getOrderController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Order retrieved successfully", data: await service.getOrder(getOwnerId(req), getId(req)) });
};

export const updateOrderStatusController: RequestHandler = async (req, res) => {
  const body = parse(orderStatusSchema, req.body);
  const data = await service.updateOrderStatus(getOwnerId(req), getId(req), body.status);
  res.status(200).json({ success: true, message: "Order status updated successfully", data });
};

export const listOffersController: RequestHandler = async (req, res) => {
  const query = parse(offerListQuerySchema, req.query);
  const result = await service.listOffers(getOwnerId(req), query);
  sendPage(res, result.items, query.page, query.limit, result.total);
};

export const getOfferController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Offer retrieved successfully", data: await service.getOffer(getOwnerId(req), getId(req)) });
};

export const createOfferController: RequestHandler = async (req, res) => {
  const data = await service.createOffer(getOwnerId(req), parse(offerCreateSchema, req.body));
  res.status(201).json({ success: true, message: "Offer created successfully", data });
};

export const updateOfferController: RequestHandler = async (req, res) => {
  const data = await service.updateOffer(getOwnerId(req), getId(req), parse(offerUpdateSchema, req.body));
  res.status(200).json({ success: true, message: "Offer updated successfully", data });
};

export const deleteOfferController: RequestHandler = async (req, res) => {
  await service.deleteOffer(getOwnerId(req), getId(req));
  res.status(200).json({ success: true, message: "Offer deleted successfully" });
};

export const updateOfferStatusController: RequestHandler = async (req, res) => {
  const body = parse(offerStatusSchema, req.body);
  const data = await service.updateOfferStatus(getOwnerId(req), getId(req), body.status);
  res.status(200).json({ success: true, message: "Offer status updated successfully", data });
};

export const listBranchesController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Branches retrieved successfully", data: await service.listBranches(getOwnerId(req)) });
};

export const getBranchController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Branch retrieved successfully", data: await service.getBranch(getOwnerId(req), getId(req)) });
};

export const createBranchController: RequestHandler = async (req, res) => {
  const data = await service.createBranch(getOwnerId(req), parse(branchCreateSchema, req.body));
  res.status(201).json({ success: true, message: "Branch created successfully", data });
};

export const updateBranchController: RequestHandler = async (req, res) => {
  const data = await service.updateBranch(getOwnerId(req), getId(req), parse(branchUpdateSchema, req.body));
  res.status(200).json({ success: true, message: "Branch updated successfully", data });
};

export const deleteBranchController: RequestHandler = async (req, res) => {
  const data = await service.deactivateBranch(getOwnerId(req), getId(req));
  res.status(200).json({ success: true, message: "Branch deactivated successfully", data });
};

export const updateBranchStatusController: RequestHandler = async (req, res) => {
  const body = parse(branchStatusSchema, req.body);
  const data = await service.updateBranchStatus(getOwnerId(req), getId(req), body.status);
  res.status(200).json({ success: true, message: "Branch status updated successfully", data });
};

export const listReviewsController: RequestHandler = async (req, res) => {
  const query = parse(reviewListQuerySchema, req.query);
  const result = await service.listReviews(getOwnerId(req), query);
  sendPage(res, result.items, query.page, query.limit, result.total);
};

export const reviewSummaryController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Review summary retrieved successfully", data: await service.getReviewSummary(getOwnerId(req)) });
};

export const currentSubscriptionController: RequestHandler = async (req, res) => {
  res.status(200).json({ success: true, message: "Current subscription retrieved successfully", data: await service.getCurrentSubscription(getOwnerId(req)) });
};

export const subscriptionHistoryController: RequestHandler = async (req, res) => {
  const query = parse(subscriptionHistoryQuerySchema, req.query);
  const result = await service.listSubscriptionHistory(getOwnerId(req), query.page, query.limit);
  sendPage(res, result.items, query.page, query.limit, result.total);
};

export const subscriptionPlansController: RequestHandler = async (_req, res) => {
  res.status(200).json({ success: true, message: "Subscription plans retrieved successfully", data: await service.listSubscriptionPlans() });
};

export const createSubscriptionController: RequestHandler = async (req, res) => {
  const body = parse(subscriptionRequestSchema, req.body);
  const data = await service.requestSubscription(getOwnerId(req), BigInt(body.planId));
  res.status(201).json({ success: true, message: "Subscription request submitted for approval/payment", data });
};
