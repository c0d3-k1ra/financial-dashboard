import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
  : {};

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

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const httpErr = err as { status?: number; statusCode?: number; type?: string; message?: string; expose?: boolean };
  const status = httpErr.status || httpErr.statusCode || 500;

  if (status >= 500) {
    logger.error({ err }, "Unhandled error");
  } else {
    logger.warn({ err }, "Client error");
  }

  const message =
    status < 500 && httpErr.expose && httpErr.message
      ? httpErr.message
      : "Internal server error";

  res.status(status).json({ error: message });
});

export default app;
