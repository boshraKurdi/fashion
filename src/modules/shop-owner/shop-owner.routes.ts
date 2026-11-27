import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { assetImageUploadMiddleware } from "../../middlewares/shop-image-upload.middleware.js";
import {
  archiveProductController, createBranchController, createOfferController, createProductController,
  createProductImageController, createProductVariantController, createSubscriptionController,
  currentSubscriptionController, dashboardController, deleteBranchController, deleteOfferController,
  deleteProductImageController, deleteProductVariantController, getBranchController, getOfferController,
  getOrderController, getProductController, getShopController, listBranchesController, listOffersController,
  listOrdersController, listProductsController, listReviewsController, reviewSummaryController,
  subscriptionHistoryController, subscriptionPlansController, updateBranchController,
  updateBranchStatusController, updateOfferController, updateOfferStatusController,
  updateOrderStatusController, updateProductController, updateProductImageController,
  updateProductStatusController, updateProductVariantController, updateShopController,
} from "./shop-owner.controller.js";

export const shopOwnerRouter = Router();

shopOwnerRouter.use(authenticate, authorizeRoles("SHOP_OWNER"));

shopOwnerRouter.get("/dashboard", dashboardController);
shopOwnerRouter.get("/shop", getShopController);
shopOwnerRouter.patch("/shop", updateShopController);

shopOwnerRouter.get("/products", listProductsController);
shopOwnerRouter.get("/products/:id", getProductController);
shopOwnerRouter.post("/products", assetImageUploadMiddleware, createProductController);
shopOwnerRouter.patch("/products/:id", updateProductController);
shopOwnerRouter.delete("/products/:id", archiveProductController);
shopOwnerRouter.patch("/products/:id/status", updateProductStatusController);
shopOwnerRouter.post("/products/:id/images", assetImageUploadMiddleware, createProductImageController);
shopOwnerRouter.delete("/products/:id/images/:imageId", deleteProductImageController);
shopOwnerRouter.patch("/products/:id/images/:imageId", assetImageUploadMiddleware, updateProductImageController);
shopOwnerRouter.post("/products/:id/variants", createProductVariantController);
shopOwnerRouter.patch("/products/:id/variants/:variantId", updateProductVariantController);
shopOwnerRouter.delete("/products/:id/variants/:variantId", deleteProductVariantController);

shopOwnerRouter.get("/orders", listOrdersController);
shopOwnerRouter.get("/orders/:id", getOrderController);
shopOwnerRouter.patch("/orders/:id/status", updateOrderStatusController);

shopOwnerRouter.get("/offers", listOffersController);
shopOwnerRouter.get("/offers/:id", getOfferController);
shopOwnerRouter.post("/offers", createOfferController);
shopOwnerRouter.patch("/offers/:id", updateOfferController);
shopOwnerRouter.delete("/offers/:id", deleteOfferController);
shopOwnerRouter.patch("/offers/:id/status", updateOfferStatusController);

shopOwnerRouter.get("/branches", listBranchesController);
shopOwnerRouter.get("/branches/:id", getBranchController);
shopOwnerRouter.post("/branches", createBranchController);
shopOwnerRouter.patch("/branches/:id", updateBranchController);
shopOwnerRouter.delete("/branches/:id", deleteBranchController);
shopOwnerRouter.patch("/branches/:id/status", updateBranchStatusController);

shopOwnerRouter.get("/reviews", listReviewsController);
shopOwnerRouter.get("/reviews/summary", reviewSummaryController);

shopOwnerRouter.get("/subscription", currentSubscriptionController);
shopOwnerRouter.get("/subscription/history", subscriptionHistoryController);
shopOwnerRouter.get("/subscription/plans", subscriptionPlansController);
shopOwnerRouter.post("/subscription", createSubscriptionController);
