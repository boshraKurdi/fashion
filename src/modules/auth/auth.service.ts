import bcrypt from "bcrypt";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env, jwtExpiresInSeconds } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { EmailDeliveryError, sendVerificationEmail } from "../../services/email.service.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
} from "./auth.validation.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  email_verified_at: true,
} satisfies Prisma.UserSelect;
const dummyPasswordHash = bcrypt.hashSync(
  "not-a-real-marketplace-account",
  env.BCRYPT_ROUNDS,
);

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "SHOP_OWNER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  email_verified_at: Date | null;
};

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function toPublicUser(user: Prisma.UserGetPayload<{ select: typeof publicUserSelect }>): PublicUser {
  return { ...user, id: user.id.toString() };
}

const emailVerificationCodeLifetimeMs = 10 * 60 * 1000;
const maxEmailVerificationAttempts = 5;

function hashEmailVerificationCode(userId: bigint, code: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

async function deliverVerificationEmail(user: { id: bigint; name: string; email: string }): Promise<void> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  await prisma.emailVerificationChallenge.upsert({
    where: { user_id: user.id },
    update: {
      code_hash: hashEmailVerificationCode(user.id, code),
      expires_at: new Date(Date.now() + emailVerificationCodeLifetimeMs),
      attempts: 0,
    },
    create: {
      user_id: user.id,
      code_hash: hashEmailVerificationCode(user.id, code),
      expires_at: new Date(Date.now() + emailVerificationCodeLifetimeMs),
    },
  });

  try {
    await sendVerificationEmail({
      name: user.name,
      email: user.email,
      code,
    });
  } catch (error) {
    if (error instanceof EmailDeliveryError) {
      throw new AppError(
        "Account exists, but its verification code could not be sent. Retry with POST /api/v1/auth/verification-email.",
        502,
      );
    }

    throw error;
  }
}

export function getSafeUser(user: PublicUser): Omit<PublicUser, "status"> {
  const { status: _status, ...safeUser } = user;
  return safeUser;
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const password = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        password,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      select: publicUserSelect,
    });

    await deliverVerificationEmail(user);
    return toPublicUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("An account with this email already exists", 409);
    }

    throw error;
  }
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, email_verified_at: true },
  });

  if (user && !user.email_verified_at) {
    await deliverVerificationEmail(user);
  }
}

export async function verifyEmail(
  input: VerifyEmailInput,
): Promise<{ alreadyVerified: boolean }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email_verified_at: true },
  });

  if (!user) {
    throw new AppError("Invalid or expired email verification code", 400);
  }

  if (user.email_verified_at) {
    return { alreadyVerified: true };
  }

  const challenge = await prisma.emailVerificationChallenge.findUnique({
    where: { user_id: user.id },
    select: { code_hash: true, expires_at: true, attempts: true },
  });
  const now = new Date();

  if (!challenge || challenge.expires_at <= now) {
    throw new AppError("Invalid or expired email verification code", 400);
  }

  if (challenge.attempts >= maxEmailVerificationAttempts) {
    throw new AppError("Too many incorrect verification codes. Request a new code.", 429);
  }

  const attempt = await prisma.emailVerificationChallenge.updateMany({
    where: {
      user_id: user.id,
      code_hash: challenge.code_hash,
      expires_at: { gt: now },
      attempts: { lt: maxEmailVerificationAttempts },
    },
    data: { attempts: { increment: 1 } },
  });

  if (attempt.count !== 1) {
    throw new AppError("Invalid or expired email verification code", 400);
  }

  const expectedHash = Buffer.from(challenge.code_hash, "hex");
  const suppliedHash = Buffer.from(hashEmailVerificationCode(user.id, input.code), "hex");

  if (!timingSafeEqual(expectedHash, suppliedHash)) {
    throw new AppError(
      challenge.attempts + 1 >= maxEmailVerificationAttempts
        ? "Too many incorrect verification codes. Request a new code."
        : "Invalid or expired email verification code",
      challenge.attempts + 1 >= maxEmailVerificationAttempts ? 429 : 400,
    );
  }

  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: { id: user.id, email_verified_at: null },
      data: { email_verified_at: new Date() },
    });

    await transaction.emailVerificationChallenge.deleteMany({
      where: { user_id: user.id },
    });

    return updated.count;
  });

  return { alreadyVerified: result === 0 };
}

export async function login(
  input: LoginInput,
): Promise<{ user: PublicUser; accessToken: string; expiresIn: string }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, password: true },
  });
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.password ?? dummyPasswordHash,
  );

  if (!user || !passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.email_verified_at) {
    throw new AppError("Verify your email address before signing in", 403);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("This account is not active", 403);
  }

  const accessToken = jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: user.id.toString(),
    expiresIn: jwtExpiresInSeconds(),
    issuer: "fashion-marketplace-api",
    audience: "fashion-marketplace",
  });

  return {
    user: toPublicUser(user),
    accessToken,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

export async function findActiveUser(id: string): Promise<PublicUser> {
  let userId: bigint;

  try {
    userId = BigInt(id);
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Invalid or expired access token", 401);
  }

  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { password: true },
  });

  if (!user || !(await bcrypt.compare(input.currentPassword, user.password))) {
    throw new AppError("Current password is incorrect", 400);
  }

  const password = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { password },
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "fashion-marketplace-api",
      audience: "fashion-marketplace",
    });

    if (typeof payload === "string" || !payload.sub) {
      throw new AppError("Invalid or expired access token", 401);
    }

    return payload.sub;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Invalid or expired access token", 401);
  }
}
