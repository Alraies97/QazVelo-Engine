import app, { pythonProxy } from "./app";
import { logger } from "./lib/logger";

// PORT is optional; defaults to 8080 so `node dist/index.mjs` works without
// any environment configuration (useful for local Cursor / Docker runs).
const port = Number(process.env.PORT ?? "8080");

if (Number.isNaN(port) || port <= 0) {
  logger.error({ port: process.env.PORT }, "Invalid PORT value");
  process.exit(1);
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port, fastapi: process.env.FASTAPI_URL ?? "http://127.0.0.1:8000" }, "Server listening");
});

// Attach WebSocket upgrade handler so the proxy can forward WS connections
// (e.g., /api/v1/ws/analytics) to the FastAPI backend.
if (typeof (pythonProxy as { upgrade?: unknown }).upgrade === "function") {
  server.on("upgrade", (pythonProxy as unknown as { upgrade: (...args: unknown[]) => void }).upgrade);
}
