import { hashPassword } from "better-auth/crypto";
import argon2 from "argon2";
import { randomBytes } from "crypto";
import { getMongoDb } from "./db-connection";
import { logger } from "./logger";

const SUPER_ADMIN_EMAIL = "prosms.au@gmail.com";
const SUPER_ADMIN_PASSWORD = "Pr0@%20SmS2026";
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

  const now = new Date();

  try {
    // 1) better-auth identity (user + credential account) — the login source of truth
    const existingUser = await db.collection("user").findOne({ email: SUPER_ADMIN_EMAIL });
    if (existingUser) {
      logger.info("[Seed] Super admin user already exists, skipping user/account");
    } else {
      logger.info("[Seed] Creating super admin (better-auth user + account)...");
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

      logger.info("[Seed] Super admin user/account created", { email: SUPER_ADMIN_EMAIL });
    }

    // 2) `auth` record — holds the 2FA config the login gate reads (/auth/verify-password).
    //    Without twoFaEnabled the login silently skips OTP (no_2fa path). The session
    //    validator may create this record first (via $setOnInsert with 2FA defaulting to
    //    OFF), so we ENFORCE the flags with $set rather than insert-if-missing.
    //    Email OTP is enabled so login emails a code; the super admin can add an
    //    authenticator (TOTP) afterwards from settings (we leave `enabled`/`devices` alone).
    const argonPassword = await argon2.hash(SUPER_ADMIN_PASSWORD);
    await db.collection("auth").updateOne(
      { email: SUPER_ADMIN_EMAIL },
      {
        $setOnInsert: {
          _id: generateId() as unknown as never,
          name: SUPER_ADMIN_NAME,
          email: SUPER_ADMIN_EMAIL,
          password: argonPassword,
          organizationId: null,
          "twoFactorAuth.enabled": false,
          "twoFactorAuth.devices": [],
          createdAt: now
        },
        $set: {
          "twoFactorAuth.twoFaEnabled": true,
          "twoFactorAuth.emailOtpEnabled": true,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    logger.info("[Seed] Super admin auth/2FA record enforced (email OTP enabled)", {
      email: SUPER_ADMIN_EMAIL
    });
  } catch (error) {
    logger.error("[Seed] Failed to create super admin", error);
  }
};
