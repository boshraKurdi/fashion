import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../modules/auth/auth.service.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ success: false, message: "A record with this value already exists" });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "Requested record was not found" });
      return;
    }
  }

  if (env.NODE_ENV !== "production") {
    const details: Record<string, unknown> = {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    };

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      details.code = error.code;
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      details.errorCode = error.errorCode;
    }

    if (error instanceof Error) {
      console.error("Unhandled request error", details, error.stack);
    } else {
      console.error("Unhandled request error", details);
    }
  }

  res.status(500).json({ success: false, message: "Internal server error" });
};
