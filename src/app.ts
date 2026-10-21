import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins, env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";

export const app = express();

app.disable("x-powered-by");
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
app.use(notFoundHandler);
app.use(errorHandler);

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
