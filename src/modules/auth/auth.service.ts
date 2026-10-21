import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env, jwtExpiresInSeconds } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
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
