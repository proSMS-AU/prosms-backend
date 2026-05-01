import { Response } from "express";
import config from "config";
import { logger } from "./logger";

const isProduction = config.get("server.environment") === "production";

interface AuthCookies {
  accessToken: string;
  refreshToken: string;
}

const parseTimeToMs = (timeString: string): number => {
  const cleanString = timeString.trim();

  const match = cleanString.match(/^(\d+)([smhd])$/);

  if (!match) {
    logger.error(`❌ Invalid time format: ${timeString}. Expected format: number + unit (e.g., 15m, 1d, 30s)`);
    return 15 * 60 * 1000;
  }

  const time = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return time * 1000;
    case "m":
      return time * 60 * 1000;
    case "h":
      return time * 60 * 60 * 1000;
    case "d":
      return time * 24 * 60 * 60 * 1000;
    default:
      logger.error(`❌ Unknown time unit: ${unit} in ${timeString}`);
      return 15 * 60 * 1000;
  }
};

export const setAuthCookie = (res: Response, tokens: AuthCookies) => {
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/"
  };

  // Get expiry times from config and convert to milliseconds
  const accessTokenExpiry = config.get("server.accessTokenExpiry") as string;
  const refreshTokenExpiry = config.get("server.refreshTokenExpiry") as string;

  const accessTokenMaxAge = parseTimeToMs(accessTokenExpiry);
  const refreshTokenMaxAge = parseTimeToMs(refreshTokenExpiry);

  // Set access token
  res.cookie("accessToken", tokens.accessToken, {
    ...cookieOptions,
    maxAge: accessTokenMaxAge
  });

  // Set refresh token
  res.cookie("refreshToken", tokens.refreshToken, {
    ...cookieOptions,
    maxAge: refreshTokenMaxAge
  });
};

export const clearAuthCookies = (res: Response) => {
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/"
  };

  // Clear both cookies by setting them with maxAge 0
  res.cookie("accessToken", "", {
    ...cookieOptions,
    maxAge: 0
  });

  res.cookie("refreshToken", "", {
    ...cookieOptions,
    maxAge: 0
  });
};
