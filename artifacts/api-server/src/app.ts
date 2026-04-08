import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalRateLimiter } from "./lib/rate-limit";
import { errorHandler } from "./lib/error-middleware";

const app: Express = express();

app.set("trust proxy", 1);

const isProduction = process.env["NODE_ENV"] === "production";

if (isProduction && !process.env["CORS_ORIGIN"]) {
  logger.warn("CORS_ORIGIN is not set in production — all cross-origin requests will be blocked");
}

const corsOptions: cors.CorsOptions = isProduction
  ? {
      origin: process.env["CORS_ORIGIN"] || false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }
  : { credentials: true, origin: true };

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(globalRateLimiter);
app.use(authMiddleware);

app.use("/api", router);

app.use(errorHandler);

export default app;
