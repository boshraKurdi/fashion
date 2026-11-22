import type { RequestHandler } from "express";
import { z } from "zod";
import {
  AppError,
  changePassword,
  getSafeUser,
  login,
  register,
  resendVerificationEmail,
  verifyEmail,
} from "./auth.service.js";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  verificationEmailSchema,
  verifyEmailSchema,
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

export const resendVerificationEmailController: RequestHandler = async (req, res) => {
  const { email } = parseBody(verificationEmailSchema, req.body);
  await resendVerificationEmail(email);
  res.status(200).json({
    success: true,
    message: "If the account exists and is not verified, a verification email has been sent",
  });
};

export const verifyEmailController: RequestHandler = async (req, res) => {
  const result = await verifyEmail(parseBody(verifyEmailSchema, req.body));
  res.status(200).json({
    success: true,
    message: result.alreadyVerified ? "Email address was already verified" : "Email address verified successfully",
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
