import type { RequestHandler } from "express";
import { AppError } from "../modules/auth/auth.service.js";

export function authorizeRoles(
  ...allowedRoles: Array<"CUSTOMER" | "SHOP_OWNER" | "ADMIN">
): RequestHandler {
  return (req, _res, next) => {
    if (!req.authUser) {
      next(new AppError("Authentication is required", 401));
      return;
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      next(new AppError("You are not allowed to access this resource", 403));
      return;
    }

    next();
  };
}
