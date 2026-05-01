import "./types";
import "dotenv/config";

import config from "config";
import app from "./app";
import { logger, dbConnection } from "./utils";
import { initializeAuth } from "./utils/auth";

const port: number = config.get("server.port");

const start = async () => {
  try {
    await dbConnection();
    initializeAuth();

    app.listen(port, async () => {
      logger.info(`Server is up & running on http://localhost:${port}`);
    });
  } catch (error) {
    logger.error("An error occurred while connecting to the database", (error as Error).message);
  }
};

start();
