import type { RequestHandler } from "express";
import { AppError, findActiveUser, verifyAccessToken } from "../modules/auth/auth.service.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    next(new AppError("A Bearer access token is required", 401));
    return;
  }

  try {
    const token = match[1];
    if (!token) {
      throw new AppError("A Bearer access token is required", 401);
    }

    const userId = verifyAccessToken(token);
    req.authUser = await findActiveUser(userId);
    next();
  } catch (error) {
    next(error);
  }
};
