import { IUser } from "../interfaces";
import { generateToken } from "./jwtHelper";
import config from "config";

export const jwtProvider = (user: Partial<IUser>) => {
  const jwtPayload = {
    userId: user._id,
    name: user.name,
    email: user.email
  };

  const accessToken = generateToken(
    jwtPayload,
    config.get("server.accessTokenSecret") as string,
    config.get("server.accessTokenExpiry") as string
  );
  const refreshToken = generateToken(
    jwtPayload,
    config.get("server.refreshTokenSecret") as string,
    config.get("server.refreshTokenExpiry") as string
  );

  return { accessToken, refreshToken };
};
