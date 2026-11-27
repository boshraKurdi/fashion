import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { assetImageUploadMiddleware, paymentQrUploadMiddleware } from "../../middlewares/shop-image-upload.middleware.js";
import * as admin from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles("ADMIN"));
adminRouter.get("/dashboard", admin.dashboardController);
adminRouter.get("/profile", admin.getAdminProfileController);
adminRouter.patch("/profile", admin.updateAdminProfileController);
adminRouter.patch("/profile/password", admin.changeAdminPasswordController);

adminRouter.get("/users", admin.listUsersController);
adminRouter.get("/users/:id", admin.getUserController);
adminRouter.patch("/users/:id", admin.updateUserController);
adminRouter.patch("/users/:id/status", admin.setUserStatusController);
adminRouter.patch("/users/:id/role", admin.setUserRoleController);
adminRouter.delete("/users/:id", admin.deleteUserController);

adminRouter.get("/shops", admin.listShopsAdminController);
adminRouter.get("/shops/:id", admin.getShopAdminController);
adminRouter.patch("/shops/:id", admin.updateShopAdminController);
adminRouter.patch("/shops/:id/approve", admin.approveShopController);
adminRouter.patch("/shops/:id/reject", admin.rejectShopController);
adminRouter.patch("/shops/:id/suspend", admin.suspendShopController);
adminRouter.patch("/shops/:id/activate", admin.activateShopController);
adminRouter.patch("/shops/:id/verify", admin.verifyShopController);
adminRouter.patch("/shops/:id/unverify", admin.unverifyShopController);
adminRouter.patch("/shops/:id/decision", admin.decideShopController);
adminRouter.post("/shops/:id/decision-email", admin.resendShopDecisionEmailController);

adminRouter.get("/categories", admin.listCategoriesController);
adminRouter.get("/categories/:id", admin.getCategoryController);
adminRouter.post("/categories", assetImageUploadMiddleware, admin.createCategoryController);
adminRouter.patch("/categories/:id", assetImageUploadMiddleware, admin.updateCategoryController);
adminRouter.delete("/categories/:id", admin.deleteCategoryController);
adminRouter.patch("/categories/:id/status", admin.setCategoryStatusController);

adminRouter.get("/brands", admin.listBrandsController);
adminRouter.get("/brands/:id", admin.getBrandController);
adminRouter.post("/brands", assetImageUploadMiddleware, admin.createBrandController);
adminRouter.patch("/brands/:id", assetImageUploadMiddleware, admin.updateBrandController);
adminRouter.delete("/brands/:id", admin.deleteBrandController);
adminRouter.patch("/brands/:id/status", admin.setBrandStatusController);

adminRouter.get("/products", admin.listProductsAdminController);
adminRouter.get("/products/:id", admin.getProductAdminController);
adminRouter.patch("/products/:id/status", admin.setProductStatusController);
adminRouter.delete("/products/:id", admin.deleteProductAdminController);

adminRouter.get("/orders", admin.listOrdersController);
adminRouter.get("/orders/statistics", admin.orderStatisticsController);
adminRouter.get("/orders/:id", admin.getOrderController);
adminRouter.patch("/orders/:id/status", admin.setOrderStatusController);

adminRouter.get("/payments", admin.listPaymentsController);
adminRouter.get("/payments/statistics", admin.paymentStatisticsController);
adminRouter.get("/payments/:id", admin.getPaymentController);
adminRouter.patch("/payments/:id/approve", admin.approvePaymentController);
adminRouter.patch("/payments/:id/reject", admin.rejectPaymentController);

adminRouter.get("/subscription-plans", admin.listSubscriptionPlansController);
adminRouter.get("/subscription-plans/:id", admin.getSubscriptionPlanController);
adminRouter.post("/subscription-plans", admin.createSubscriptionPlanController);
adminRouter.patch("/subscription-plans/:id", admin.updateSubscriptionPlanController);
adminRouter.delete("/subscription-plans/:id", admin.deleteSubscriptionPlanController);
adminRouter.patch("/subscription-plans/:id/status", admin.setSubscriptionPlanStatusController);

adminRouter.get("/shop-subscriptions", admin.listShopSubscriptionsController);
adminRouter.get("/shop-subscriptions/:id", admin.getShopSubscriptionController);
adminRouter.patch("/shop-subscriptions/:id/approve", admin.approveShopSubscriptionController);
adminRouter.patch("/shop-subscriptions/:id/reject", admin.rejectShopSubscriptionController);
adminRouter.patch("/shop-subscriptions/:id/cancel", admin.cancelShopSubscriptionController);

adminRouter.get("/offers", admin.listOffersController);
adminRouter.get("/offers/:id", admin.getOfferController);
adminRouter.post("/offers", admin.createOfferController);
adminRouter.patch("/offers/:id", admin.updateOfferController);
adminRouter.delete("/offers/:id", admin.deleteOfferController);
adminRouter.patch("/offers/:id/status", admin.setOfferStatusController);

adminRouter.get("/reviews", admin.listReviewsController);
adminRouter.get("/reviews/:id", admin.getReviewController);
adminRouter.patch("/reviews/:id/status", admin.setReviewStatusController);
adminRouter.delete("/reviews/:id", admin.deleteReviewController);

adminRouter.get("/settings", admin.getSettingsController);
adminRouter.patch("/settings", admin.updateSettingsController);
adminRouter.get("/settings/payment-accounts", admin.listPaymentAccountsController);
adminRouter.get("/settings/payment-accounts/:id", admin.getPaymentAccountController);
adminRouter.post("/settings/payment-accounts", paymentQrUploadMiddleware, admin.createPaymentAccountController);
adminRouter.patch("/settings/payment-accounts/:id", paymentQrUploadMiddleware, admin.updatePaymentAccountController);
adminRouter.delete("/settings/payment-accounts/:id", admin.deletePaymentAccountController);
adminRouter.patch("/settings/payment-accounts/:id/status", admin.setPaymentAccountStatusController);

adminRouter.get("/reports/sales", admin.salesReportController);
adminRouter.get("/reports/orders", admin.ordersReportController);
adminRouter.get("/reports/subscriptions", admin.subscriptionsReportController);
adminRouter.get("/reports/shops", admin.shopsReportController);
adminRouter.get("/reports/users", admin.usersReportController);
