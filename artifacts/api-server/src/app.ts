import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(globalRateLimiter);

app.use("/api", router);

if (isProduction) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Compiled bundle lives at artifacts/api-server/dist/index.mjs — go up 3 levels to repo root
  const staticDir = path.resolve(__dirname, "../../../artifacts/finance-app/dist/public");
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use(errorHandler);

export default app;
