import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

function getMariaDbConfig(connectionString: string) {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL");
  }

  if (!["mysql:", "mariadb:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// protocol");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL must include a MySQL host and database name");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 10,
  };
}

const adapter = new PrismaMariaDb(getMariaDbConfig(env.DATABASE_URL));

export const prisma = new PrismaClient({ adapter });
