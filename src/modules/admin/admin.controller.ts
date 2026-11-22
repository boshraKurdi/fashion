import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../auth/auth.service.js";
import {
  shopDecisionSchema,
  shopIdSchema,
  shopListQuerySchema,
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
