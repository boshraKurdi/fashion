import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, "JWT_ACCESS_EXPIRES_IN must use s, m, h, or d (e.g. 15m)")
    .default("15m"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_REGISTER_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(process.env.NODE_ENV === "production" ? 5 : 100),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration.\n` +
      `Set the required values in the hosting environment or add a .env file to the project root ` +
      `(copy .env.example to .env locally):\n` +
      details,
  );
}

export const env = parsedEnvironment.data;
export const corsOrigins = new Set(
  env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
);

export function jwtExpiresInSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_ACCESS_EXPIRES_IN);

  if (!match) {
    throw new Error("JWT_ACCESS_EXPIRES_IN has an invalid duration");
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  const seconds = amount * multiplier;

  if (!Number.isSafeInteger(seconds) || seconds < 1) {
    throw new Error("JWT_ACCESS_EXPIRES_IN is outside the supported range");
  }

  return seconds;
}
