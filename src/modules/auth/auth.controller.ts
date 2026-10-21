import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError, changePassword, getSafeUser, login, register } from "./auth.service.js";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "./auth.validation.js";

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

export const registerController: RequestHandler = async (req, res) => {
  const user = await register(parseBody(registerSchema, req.body));
  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: { user: getSafeUser(user) },
  });
};

export const loginController: RequestHandler = async (req, res) => {
  const result = await login(parseBody(loginSchema, req.body));
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: getSafeUser(result.user),
      accessToken: result.accessToken,
      tokenType: "Bearer",
      expiresIn: result.expiresIn,
    },
  });
};

export const meController: RequestHandler = (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  res.status(200).json({
    success: true,
    message: "Current user retrieved successfully",
    data: { user: req.authUser },
  });
};

export const logoutController: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out. Discard the access token on the client; it remains valid until it expires.",
  });
};

export const changePasswordController: RequestHandler = async (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  await changePassword(req.authUser.id, parseBody(changePasswordSchema, req.body));
  res.status(200).json({
    success: true,
    message: "Password changed successfully. Existing access tokens remain valid until expiry.",
  });
};

export const ownerExampleController: RequestHandler = (req, res) => {
  if (!req.authUser) {
    throw new AppError("Authentication is required", 401);
  }

  res.status(200).json({
    success: true,
    message: "Shop-owner authorization verified",
    data: { user: getSafeUser(req.authUser) },
  });
};
