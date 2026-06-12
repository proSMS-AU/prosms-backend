import { DATA_NOT_FOUND, httpStatus, PASSWORD_INCORRECT_ERROR } from "../constants";
import { AuthModel } from "../model/auth.model";
import { AppError } from "../utils/appError";
import { jwtProvider } from "../utils/jwtProvider";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import config from "config";

// login service
const login = async (email: string, password: string) => {
  const user = await AuthModel.findOne({ email }).select("+password");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  // Deleted-org users cannot log in.
  if (user.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "ORG_DISABLED",
      "Your organisation account has been disabled. Please contact the authority."
    );
  }

  // Compare passwords
  const isMatch = await argon2.verify(user?.password || "", password);

  if (!isMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, PASSWORD_INCORRECT_ERROR.code, PASSWORD_INCORRECT_ERROR.message);
  }

  // Check if 2FA is enabled — return temp token instead of full session
  // twoFaEnabled is the master switch; individual method flags are irrelevant when it is false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twoFa = (user as any).twoFactorAuth;
  if (twoFa?.twoFaEnabled && (twoFa?.enabled || twoFa?.emailOtpEnabled)) {
    const tempToken = jwt.sign(
      { userId: String(user._id), purpose: "2fa_gate" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).get("server.accessTokenSecret") as string,
      { expiresIn: "10m" }
    );
    const methods: string[] = [];
    if (twoFa.enabled) methods.push("totp");
    if (twoFa.emailOtpEnabled) methods.push("email");
    return { status: "2fa_required" as const, tempToken, methods };
  }

  // Generate tokens
  const { accessToken, refreshToken } = jwtProvider(user);

  const userWithoutPassword = user.toJSON();

  return {
    status: "ok" as const,
    user: userWithoutPassword,
    accessToken,
    refreshToken
  };
};

// change Password
const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const user = await AuthModel.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
  }

  // Compare passwords
  const isMatch = await argon2.verify(user?.password || "", oldPassword);

  if (!isMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, PASSWORD_INCORRECT_ERROR.code, PASSWORD_INCORRECT_ERROR.message);
  }

  // Hash new password
  const hashedPassword = await argon2.hash(newPassword);

  // Update password
  user.password = hashedPassword;
  await user.save();

  return user;
};

// refresh tokens service
const refreshTokens = async (currentRefreshToken: string) => {
  try {
    // Verify the refresh token using JWT
    const decoded = jwt.verify(currentRefreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
      userId: string;
      name: string;
      email: string;
    };

    // Get user from database using the userId from the JWT
    const user = await AuthModel.findById(decoded.userId);

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, DATA_NOT_FOUND.code, DATA_NOT_FOUND.message);
    }

    // Generate new tokens
    const { accessToken, refreshToken } = jwtProvider(user);

    return {
      accessToken,
      refreshToken,
      user: user.toJSON()
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(httpStatus.UNAUTHORIZED, "REFRESH_TOKEN_EXPIRED", "Refresh token has expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(httpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
    } else {
      throw new AppError(httpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }
  }
};

export const AuthServices = {
  login,
  refreshTokens,
  changePassword
};
