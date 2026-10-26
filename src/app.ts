import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { marketplaceRouter } from "./marketplace.routes.js";

function normalizeJsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    if (typeof (value as { toJSON?: unknown }).toJSON === "function" && !(value instanceof Date)) {
      const jsonValue = (value as { toJSON: () => unknown }).toJSON();
      return normalizeJsonValue(jsonValue);
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeJsonValue(item));
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeJsonValue(item)]),
    );
  }

  return value;
}

export const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(normalizeJsonValue(body))) as typeof res.json;
  next();
});
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", marketplaceRouter);
app.use(notFoundHandler);
app.use(errorHandler);

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
