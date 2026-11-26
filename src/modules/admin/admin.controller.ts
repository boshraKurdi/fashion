import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../auth/auth.service.js";
import {
  adminPasswordSchema,
  adminProfileSchema,
  brandSchema,
  categorySchema,
  dateRangeSchema,
  offerSchema,
  orderStatusSchema,
  paginationSchema,
  paymentAccountSchema,
  paymentAccountUpdateSchema,
  paymentReviewSchema,
  platformSettingsSchema,
  positiveIdSchema,
  productStatusSchema,
  rejectionSchema,
  reviewStatusSchema,
  shopDecisionSchema,
  shopIdSchema,
  shopListQuerySchema,
  shopUpdateSchema,
  statusSchema,
  subscriptionDecisionSchema,
  subscriptionPlanSchema,
  userRoleSchema,
  userStatusSchema,
  userUpdateSchema,
} from "./admin.validation.js";
import * as service from "./admin.service.js";

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw result.error;
  return result.data;
}

function getShopId(req: Request): bigint {
  if (!req.params.id) {
    throw new AppError("Invalid shop ID", 400);
  }

  return BigInt(parse(shopIdSchema, { id: req.params.id }).id);
}

export const listShopsController: RequestHandler = async (req, res) => {
  const query = parse(shopListQuerySchema, req.query);
  const result = await service.listShops(query);

  res.status(200).json({
    success: true,
    data: result.items,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total ? Math.ceil(result.total / query.limit) : 0,
    },
  });
};

export const decideShopController: RequestHandler = async (req, res) => {
  const data = await service.decideShop(getShopId(req), parse(shopDecisionSchema, req.body));
  res.status(200).json({
    success: true,
    message: "Shop decision saved and owner notified",
    data,
  });
};

export const resendShopDecisionEmailController: RequestHandler = async (req, res) => {
  await service.resendShopDecisionEmail(getShopId(req));
  res.status(200).json({
    success: true,
    message: "Shop decision email sent successfully",
  });
};

function getId(req: Request): bigint {
  if (!req.params.id) throw new AppError("Invalid ID", 400);
  return BigInt(parse(positiveIdSchema, { id: req.params.id }).id);
}

function sendSuccess(res: Parameters<RequestHandler>[1], data: unknown, message = "Operation completed successfully") {
  res.status(200).json({ success: true, message, data });
}

function sendCreated(res: Parameters<RequestHandler>[1], data: unknown, message = "Resource created successfully") {
  res.status(201).json({ success: true, message, data });
}

function sendPaginated(res: Parameters<RequestHandler>[1], result: any) {
  res.status(200).json({ success: true, data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export const dashboardController: RequestHandler = async (_req, res) => sendSuccess(res, await service.dashboard());

export const listUsersController: RequestHandler = async (req, res) => sendPaginated(res, await service.listUsers(parse(paginationSchema, req.query)));
export const getUserController: RequestHandler = async (req, res) => sendSuccess(res, await service.getUser(getId(req)));
export const updateUserController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateUser(getId(req), parse(userUpdateSchema, req.body)));
export const setUserStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setUserStatus(getId(req), parse(userStatusSchema, req.body).status));
export const setUserRoleController: RequestHandler = async (req, res) => sendSuccess(res, await service.setUserRole(getId(req), parse(userRoleSchema, req.body).role));
export const deleteUserController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteUser(getId(req)), "User removed or inactivated safely");

export const listShopsAdminController: RequestHandler = async (req, res) => sendPaginated(res, await service.listShopsAdmin(parse(paginationSchema, req.query)));
export const getShopAdminController: RequestHandler = async (req, res) => sendSuccess(res, await service.getShop(getId(req)));
export const updateShopAdminController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateShop(getId(req), parse(shopUpdateSchema, req.body)));
export const approveShopController: RequestHandler = async (req, res) => sendSuccess(res, await service.setShopStatus(getId(req), "APPROVED"));
export const rejectShopController: RequestHandler = async (req, res) => sendSuccess(res, await service.setShopStatus(getId(req), "REJECTED", parse(rejectionSchema, req.body).rejectionReason));
export const suspendShopController: RequestHandler = async (req, res) => sendSuccess(res, await service.setShopStatus(getId(req), "SUSPENDED"));
export const activateShopController: RequestHandler = async (req, res) => sendSuccess(res, await service.setShopStatus(getId(req), "APPROVED"));

export const listCategoriesController: RequestHandler = async (req, res) => sendPaginated(res, await service.listCategories(parse(paginationSchema, req.query)));
export const getCategoryController: RequestHandler = async (req, res) => sendSuccess(res, await service.getCategory(getId(req)));
export const createCategoryController: RequestHandler = async (req, res) => sendCreated(res, await service.createCategory(parse(categorySchema, req.body)));
export const updateCategoryController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateCategory(getId(req), parse(categorySchema.partial(), req.body)));
export const deleteCategoryController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteCategory(getId(req)), "Category deleted");
export const setCategoryStatusController: RequestHandler = async (req, res) => {
  const status = parse(statusSchema, req.body).status;
  sendSuccess(res, await service.setCategoryStatus(getId(req), Number(status)));
};

export const listBrandsController: RequestHandler = async (req, res) => sendPaginated(res, await service.listBrands(parse(paginationSchema, req.query)));
export const getBrandController: RequestHandler = async (req, res) => sendSuccess(res, await service.getBrand(getId(req)));
export const createBrandController: RequestHandler = async (req, res) => sendCreated(res, await service.createBrand(parse(brandSchema, req.body)));
export const updateBrandController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateBrand(getId(req), parse(brandSchema.partial(), req.body)));
export const deleteBrandController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteBrand(getId(req)), "Brand deleted");
export const setBrandStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setBrandStatus(getId(req), Number(parse(statusSchema, req.body).status)));

export const listProductsAdminController: RequestHandler = async (req, res) => sendPaginated(res, await service.listProducts(parse(paginationSchema, req.query)));
export const getProductAdminController: RequestHandler = async (req, res) => sendSuccess(res, await service.getProduct(getId(req)));
export const setProductStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setProductStatus(getId(req), parse(productStatusSchema, req.body).status));
export const deleteProductAdminController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteProduct(getId(req)), "Product deleted or archived");

export const listOrdersController: RequestHandler = async (req, res) => sendPaginated(res, await service.listOrders(parse(paginationSchema, req.query)));
export const getOrderController: RequestHandler = async (req, res) => sendSuccess(res, await service.getOrder(getId(req)));
export const setOrderStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setOrderStatus(getId(req), parse(orderStatusSchema, req.body).status));
export const orderStatisticsController: RequestHandler = async (req, res) => sendSuccess(res, await service.orderStatistics(parse(dateRangeSchema, req.query)));

export const listPaymentsController: RequestHandler = async (req, res) => sendPaginated(res, await service.listPayments(parse(paginationSchema, req.query)));
export const getPaymentController: RequestHandler = async (req, res) => sendSuccess(res, await service.getPayment(getId(req)));
export const paymentStatisticsController: RequestHandler = async (req, res) => sendSuccess(res, await service.paymentStatistics(parse(dateRangeSchema, req.query)));
export const approvePaymentController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  const body = parse(paymentReviewSchema, req.body);
  sendSuccess(res, await service.reviewPayment(getId(req), true, BigInt(req.authUser.id), body.transactionId));
};
export const rejectPaymentController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  const body = parse(paymentReviewSchema, req.body);
  sendSuccess(res, await service.reviewPayment(getId(req), false, BigInt(req.authUser.id), body.transactionId));
};

export const listSubscriptionPlansController: RequestHandler = async (req, res) => sendPaginated(res, await service.listSubscriptionPlans(parse(paginationSchema, req.query)));
export const getSubscriptionPlanController: RequestHandler = async (req, res) => sendSuccess(res, await service.getSubscriptionPlan(getId(req)));
export const createSubscriptionPlanController: RequestHandler = async (req, res) => sendCreated(res, await service.createSubscriptionPlan(parse(subscriptionPlanSchema, req.body)));
export const updateSubscriptionPlanController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateSubscriptionPlan(getId(req), parse(subscriptionPlanSchema.partial(), req.body)));
export const deleteSubscriptionPlanController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteSubscriptionPlan(getId(req)), "Subscription plan deleted");
export const setSubscriptionPlanStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setSubscriptionPlanStatus(getId(req), Number(parse(statusSchema, req.body).status)));

export const listShopSubscriptionsController: RequestHandler = async (req, res) => sendPaginated(res, await service.listShopSubscriptions(parse(paginationSchema, req.query)));
export const getShopSubscriptionController: RequestHandler = async (req, res) => sendSuccess(res, await service.getShopSubscription(getId(req)));
export const approveShopSubscriptionController: RequestHandler = async (req, res) => sendSuccess(res, await service.decideShopSubscription(getId(req), "APPROVE"));
export const rejectShopSubscriptionController: RequestHandler = async (req, res) => sendSuccess(res, await service.decideShopSubscription(getId(req), "REJECT", parse(subscriptionDecisionSchema, req.body).rejectionReason));
export const cancelShopSubscriptionController: RequestHandler = async (req, res) => sendSuccess(res, await service.decideShopSubscription(getId(req), "CANCEL"));

export const listOffersController: RequestHandler = async (req, res) => sendPaginated(res, await service.listOffers(parse(paginationSchema, req.query)));
export const getOfferController: RequestHandler = async (req, res) => sendSuccess(res, await service.getOffer(getId(req)));
export const createOfferController: RequestHandler = async (req, res) => sendCreated(res, await service.createOffer(parse(offerSchema, req.body)));
export const updateOfferController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateOffer(getId(req), parse(z.object({
  shopId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  discountValue: z.coerce.number().positive().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  productIds: z.array(z.coerce.number().int().positive()).optional(),
}).strict().refine((value) => !value.startAt || !value.endAt || value.endAt > value.startAt, { message: "endAt must be after startAt" }), req.body)));
export const deleteOfferController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteOffer(getId(req)), "Offer deleted");
export const setOfferStatusController: RequestHandler = async (req, res) => {
  const body = parse(z.object({ status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "EXPIRED"]) }).strict(), req.body);
  sendSuccess(res, await service.setOfferStatus(getId(req), body.status));
};

export const listReviewsController: RequestHandler = async (req, res) => sendPaginated(res, await service.listReviews(parse(paginationSchema, req.query)));
export const getReviewController: RequestHandler = async (req, res) => sendSuccess(res, await service.getReview(getId(req)));
export const setReviewStatusController: RequestHandler = async (req, res) => sendSuccess(res, await service.setReviewStatus(getId(req), parse(reviewStatusSchema, req.body).status));
export const deleteReviewController: RequestHandler = async (req, res) => sendSuccess(res, await service.deleteReview(getId(req)), "Review deleted");

export const getSettingsController: RequestHandler = async (_req, res) => sendSuccess(res, await service.getSettings());
export const updateSettingsController: RequestHandler = async (req, res) => sendSuccess(res, await service.updateSettings(parse(platformSettingsSchema, req.body)));

export const listPaymentAccountsController: RequestHandler = async (req, res) => sendPaginated(res, await service.listPaymentAccounts(parse(paginationSchema, req.query)));
export const getPaymentAccountController: RequestHandler = async (req, res) => sendSuccess(res, await service.getPaymentAccount(getId(req)));
export const createPaymentAccountController: RequestHandler = async (req, res) => {
  const data = parse(paymentAccountSchema, req.body);
  const qrPath = req.file ? `/uploads/payment-accounts/${req.file.filename}` : undefined;
  sendCreated(res, await service.createPaymentAccount(data, qrPath));
};
export const updatePaymentAccountController: RequestHandler = async (req, res) => {
  const data = parse(paymentAccountUpdateSchema, req.body);
  let qrPath: string | undefined;
  if (req.file) qrPath = `/uploads/payment-accounts/${req.file.filename}`;
  if (typeof (req.body as any).deleteQr === "boolean" && (req.body as any).deleteQr) qrPath = "__DELETE__";
  sendSuccess(res, await service.updatePaymentAccount(getId(req), data, qrPath));
};
export const deletePaymentAccountController: RequestHandler = async (req, res) => sendSuccess(res, await service.deletePaymentAccount(getId(req)), "Payment account deleted");
export const setPaymentAccountStatusController: RequestHandler = async (req, res) => {
  const status = parse(z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }).strict(), req.body).status;
  sendSuccess(res, await service.setPaymentAccountStatus(getId(req), status === "ACTIVE"));
};

export const publicPaymentMethodsController: RequestHandler = async (_req, res) => sendSuccess(res, await service.publicPaymentMethods());

export const getAdminProfileController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  sendSuccess(res, await service.getAdminProfile(BigInt(req.authUser.id)));
};
export const updateAdminProfileController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  sendSuccess(res, await service.updateAdminProfile(BigInt(req.authUser.id), parse(adminProfileSchema, req.body)));
};
export const changeAdminPasswordController: RequestHandler = async (req, res) => {
  if (!req.authUser) throw new AppError("Authentication is required", 401);
  const body = parse(adminPasswordSchema, req.body);
  sendSuccess(res, await service.changeAdminPassword(BigInt(req.authUser.id), body.currentPassword, body.newPassword));
};

export const salesReportController: RequestHandler = async (req, res) => sendSuccess(res, await service.salesReport(parse(dateRangeSchema, req.query)));
export const ordersReportController: RequestHandler = async (req, res) => sendSuccess(res, await service.ordersReport(parse(dateRangeSchema, req.query)));
export const subscriptionsReportController: RequestHandler = async (req, res) => sendSuccess(res, await service.subscriptionsReport(parse(dateRangeSchema, req.query)));
export const shopsReportController: RequestHandler = async (req, res) => sendSuccess(res, await service.shopsReport(parse(dateRangeSchema, req.query)));
export const usersReportController: RequestHandler = async (req, res) => sendSuccess(res, await service.usersReport(parse(dateRangeSchema, req.query)));
