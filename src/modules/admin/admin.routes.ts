import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  decideShopController,
  listShopsController,
  resendShopDecisionEmailController,
} from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles("ADMIN"));
adminRouter.get("/shops", listShopsController);
adminRouter.patch("/shops/:id/decision", decideShopController);
adminRouter.post("/shops/:id/decision-email", resendShopDecisionEmailController);
