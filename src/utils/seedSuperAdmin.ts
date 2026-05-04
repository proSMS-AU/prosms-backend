import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "crypto";
import { getMongoDb } from "./db-connection";
import { logger } from "./logger";

const SUPER_ADMIN_EMAIL = "prosms.au@gmail.com";
const SUPER_ADMIN_PASSWORD = "Pr0SMS@%202026";
const SUPER_ADMIN_NAME = "Super Admin";

const generateId = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(32);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
};

export const seedSuperAdmin = async (): Promise<void> => {
  const db = getMongoDb();
  if (!db) {
    logger.error("[Seed] Database not available");
    return;
  }

  try {
    const existing = await db.collection("user").findOne({ email: SUPER_ADMIN_EMAIL });
    if (existing) {
      logger.info("[Seed] Super admin already exists, skipping");
      return;
    }

    logger.info("[Seed] Creating super admin...");

    const now = new Date();
    const userId = generateId();

    await db.collection("user").insertOne({
      _id: userId as unknown as never,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      emailVerified: true,
      role: "SUPER_ADMIN",
      organizationId: null,
      image: null,
      createdAt: now,
      updatedAt: now
    });

    const hashedPassword = await hashPassword(SUPER_ADMIN_PASSWORD);

    await db.collection("account").insertOne({
      _id: generateId() as unknown as never,
      userId,
      accountId: SUPER_ADMIN_EMAIL,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now
    });

    logger.info("[Seed] Super admin created successfully", { email: SUPER_ADMIN_EMAIL });
  } catch (error) {
    logger.error("[Seed] Failed to create super admin", error);
  }
};
