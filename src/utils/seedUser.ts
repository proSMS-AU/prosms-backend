import { Types } from "mongoose";
import { IUser } from "../interfaces";
import { AuthModel } from "../model/auth.model";
import { logger } from "./logger";

export const seedUser = async () => {
  try {
    const isUserExist = await AuthModel.findOne({ email: "user@seed.com" });
    if (isUserExist) {
      logger.info("User already exist!");
      return;
    }

    logger.info("Creating User");

    const payload: IUser = {
      name: "Seed User",
      email: "user@seed.com",
      password: "123456",
      organizationId: new Types.ObjectId()
    };
    const user = await AuthModel.create(payload);
    logger.info("User Created!", { user });
  } catch (error) {
    logger.error("Error creating user", error);
  }
};
