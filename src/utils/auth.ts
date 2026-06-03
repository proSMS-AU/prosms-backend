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

let authInstance: ReturnType<typeof betterAuth> | null = null;

export const pendingOtpCaptures = new Map<string, string>();

function parseDeviceFromUA(ua: string | undefined): string {
  if (!ua) return "Unknown device";
  const browsers = [
    { name: "Chrome", pattern: /Chrome\/[\d.]+/ },
    { name: "Firefox", pattern: /Firefox\/[\d.]+/ },
    { name: "Safari", pattern: /Version\/[\d.]+ Safari/ },
    { name: "Edge", pattern: /Edg\/[\d.]+/ }
  ];
  const oses = [
    { name: "Windows", pattern: /Windows/ },
    { name: "macOS", pattern: /Mac OS X/ },
    { name: "iOS", pattern: /iPhone|iPad/ },
    { name: "Android", pattern: /Android/ },
    { name: "Linux", pattern: /Linux/ }
  ];
  const browser = browsers.find((b) => b.pattern.test(ua))?.name ?? "Browser";
  const os = oses.find((o) => o.pattern.test(ua))?.name ?? "Desktop";
  return `${browser} on ${os}`;
}

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
        },
        session: {
          create: {
            after: async (session) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const baUser = await db!.collection("user").findOne({ id: (session as any).userId });
                if (!baUser?.email) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ua = (session as any).userAgent as string | undefined;
                const device = parseDeviceFromUA(ua);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ip = (session as any).ipAddress as string | undefined;
                const time = new Date().toLocaleString("en-AU", {
                  timeZone: "Australia/Sydney",
                  dateStyle: "medium",
                  timeStyle: "short"
                });
                emailService
                  .sendEmail({
                    to: baUser.email,
                    subject: "New sign-in to your ProSMS account",
                    templateName: "new-login",
                    templateData: { name: baUser.name || baUser.email, device, time, ipAddress: ip || null }
                  })
                  .catch(() => {});
              } catch {
                /* never block session creation */
              }
            }
          }
        }
      },
      advanced: {
        disableOriginCheck: !isProduction,
        cookie: { sameSite: "none", secure: true },
        defaultCookieAttributes: { secure: true, sameSite: "none" }
      },
      // Max session lifetime. "Remember me" is enforced client-side via the
      // bearer_token cookie maxAge; the server session must stay valid at least
      // as long as a remembered cookie (30 days).
      session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24 // refresh expiry at most once per day
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
            // only handle sign-in 2FA here
            if (type !== "sign-in") return;

            // If a TOTP capture is pending for this email, intercept instead of emailing
            if (pendingOtpCaptures.has(email)) {
              pendingOtpCaptures.set(email, otp);
              return;
            }

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
