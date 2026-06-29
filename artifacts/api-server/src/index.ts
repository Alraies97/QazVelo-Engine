import app, { pythonProxy } from "./app";
import { logger } from "./lib/logger";

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

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Attach WebSocket upgrade handler so the proxy can forward WS connections
// (e.g., /api/v1/ws/analytics) to the FastAPI backend.
if (typeof (pythonProxy as { upgrade?: unknown }).upgrade === "function") {
  server.on("upgrade", (pythonProxy as unknown as { upgrade: (...args: unknown[]) => void }).upgrade);
}
