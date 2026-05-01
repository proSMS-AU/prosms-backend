// import { betterAuth } from "better-auth";
// import { bearer } from "better-auth/plugins";
// import { mongodbAdapter } from "better-auth/adapters/mongodb";
// import { getMongoClient, getMongoDb } from "./db-connection";
// import config from "config";

// let authInstance: ReturnType<typeof betterAuth> | null = null;

// export function initializeAuth() {
//   if (!authInstance) {
//     const db = getMongoDb();
//     const client = getMongoClient();

//     if (!db || !client) {
//       throw new Error("Database must be connected before initializing auth");
//     }

//     const isProduction = config.get<string>("server.environment") === "production";

//     authInstance = betterAuth({
//       database: mongodbAdapter(db),
//       databaseHooks: {
//         user: {
//           create: {
//             before: async (user) => {
//               return {
//                 data: {
//                   ...user,
//                   organizationId: user.organizationId,
//                   image: user.image ?? null
//                 }
//               };
//             }
//           }
//         }
//       },
//       advanced: {
//         disableOriginCheck: !isProduction, // Allow for development
//         cookie: {
//           sameSite: "none",
//           secure: true
//         },
//         defaultCookieAttributes: {
//           secure: true,
//           // httpOnly: true,
//           sameSite: "none"
//         }
//       },
//       secret: config.get<string>("server.betterAuthSecret"),
//       debug: true,
//       trustedOrigins: [
//         config.get<string>("server.clientUrl"),
//         // Add your development origins
//         ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:3001"])
//       ],
//       emailAndPassword: {
//         enabled: true,
//         requireEmailVerification: false
//       },
//       // User model configuration
//       user: {
//         additionalFields: {
//           organizationId: {
//             fieldName: "organizationId",
//             type: "string",
//             required: false
//           },
//           role: {
//             fieldName: "role",
//             type: "string",
//             required: false,
//             defaultValue: "ADMIN"
//           },
//           image: {
//             fieldName: "image",
//             type: "string",
//             required: false
//           }
//         }
//       },
//       // Plugins
//       plugins: [bearer()]
//     });
//   }
//   return authInstance;
// }

// export function getAuth() {
//   if (!authInstance) {
//     throw new Error("Auth not initialized. Call initializeAuth() first.");
//   }
//   return authInstance;
// }

// // For backwards compatibility
// export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
//   get(target, prop) {
//     return getAuth()[prop as keyof ReturnType<typeof betterAuth>];
//   }
// });

import { betterAuth } from "better-auth";
import { bearer, emailOTP } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getMongoClient, getMongoDb } from "./db-connection";
import config from "config";
import { emailService } from "./sendEmail";
import { logger } from "./logger";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function initializeAuth() {
  if (!authInstance) {
    const db = getMongoDb();
    const client = getMongoClient();

    if (!db || !client) {
      throw new Error("Database must be connected before initializing auth");
    }

    const isProduction = config.get<string>("server.environment") === "production";

    authInstance = betterAuth({
      database: mongodbAdapter(db),
      databaseHooks: {
        user: {
          create: {
            before: async (user) => ({
              data: {
                ...user,
                organizationId: user.organizationId,
                image: user.image ?? null
              }
            })
          }
        }
      },
      advanced: {
        disableOriginCheck: !isProduction,
        cookie: { sameSite: "none", secure: true },
        defaultCookieAttributes: { secure: true, sameSite: "none" }
      },
      secret: config.get<string>("server.betterAuthSecret"),
      debug: !isProduction,
      trustedOrigins: [
        config.get<string>("server.clientUrl"),
        ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:3001"])
      ],
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false
      },
      user: {
        additionalFields: {
          organizationId: { fieldName: "organizationId", type: "string", required: false },
          role: { fieldName: "role", type: "string", required: false, defaultValue: "ADMIN" },
          image: { fieldName: "image", type: "string", required: false }
        }
      },
      plugins: [
        bearer(),
        emailOTP({
          otpLength: 6,
          expiresIn: 300, // 5 minutes
          async sendVerificationOTP({ email, otp, type }) {
            logger.info("Sending OTP", { email, otp, type }); //TODO: Remove this log before production
            // only handle sign-in 2FA here
            if (type !== "sign-in") return;

            await emailService.sendEmail({
              to: email,
              subject: "Your login verification code",
              templateName: "otp-verification",
              templateData: { otp, expiresInMinutes: 5 }
            });
          }
        })
      ]
    });
  }
  return authInstance;
}

export function getAuth() {
  if (!authInstance) {
    throw new Error("Auth not initialized. Call initializeAuth() first.");
  }
  return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(target, prop) {
    return getAuth()[prop as keyof ReturnType<typeof betterAuth>];
  }
});
