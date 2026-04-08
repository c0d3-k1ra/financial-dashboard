import app from "./app";
import { logger } from "./lib/logger";
import { seedBudgetCategories, seedAccountsAndCategories } from "./lib/seed";
import { runStartupMigrations } from "@workspace/db/migrate";

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  logger.info("Running startup migrations...");
  await runStartupMigrations();
  logger.info("Startup migrations complete");

  await Promise.all([seedBudgetCategories(), seedAccountsAndCategories()]);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
