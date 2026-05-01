import "dotenv/config";
import express, { Express, Request, Response } from "express";
import config from "config";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import { toNodeHandler } from "better-auth/node";

import v1Router from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { SendSuccessResponse, getAuth } from "./utils";

const app: Express = express();
const isProduction = config.get("server.environment") === "production";

// CORS configuration
const allowedOrigins = [config.get("server.clientUrl") as string];

const generateCorsOptions = (allowed: string[]): CorsOptions => ({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["set-cookie", "Content-Disposition", "Content-Length", "Content-Type"],
  preflightContinue: false,
  optionsSuccessStatus: 204
});

const allowedOriginsForDev = [
  ...allowedOrigins,
  "http://localhost:3000",
  "http://localhost:3001",
  "https://prosms.vercel.app"
];

const corsOptions = isProduction ? generateCorsOptions(allowedOrigins) : generateCorsOptions(allowedOriginsForDev);
app.use(cors(corsOptions));

// Better Auth endpoints - MUST be before body parsers
app.all("/api/auth/*splat", async (req, res) => {
  const authHandler = toNodeHandler(getAuth());
  return authHandler(req, res);
});

// Body parsers (after auth routes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helmet with config
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// app.use(cookieParser());

const PROJECT_NAME: string = config.get<string>("server.projectName") || "Pro SMS";
const ENVIRONMENT: string = config.get<string>("server.environment");
const v1BaseEndpoint = ENVIRONMENT && ENVIRONMENT.toLowerCase() === "development" ? "/api/v1" : "/v1";

app.get("/", (req: Request, res: Response): void => {
  SendSuccessResponse.success({ res, message: `Hello from ${PROJECT_NAME} Backend Service!!!`, data: null });
});

app.get("/health", (req: Request, res: Response): void => {
  SendSuccessResponse.success({ res, message: "OK", data: { status: "Healthy" } });
});

app.use(v1BaseEndpoint, v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
