import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  changePasswordController,
  loginController,
  logoutController,
  meController,
  ownerExampleController,
  registerController,
} from "./auth.controller.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.AUTH_REGISTER_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Try again later." },
});

authRouter.post("/register", registerLimiter, registerController);
authRouter.post("/login", loginLimiter, loginController);
authRouter.get("/me", authenticate, meController);
authRouter.post("/logout", authenticate, logoutController);
authRouter.patch("/change-password", authenticate, changePasswordController);
authRouter.get(
  "/owner-example",
  authenticate,
  authorizeRoles("SHOP_OWNER", "ADMIN"),
  ownerExampleController,
);
