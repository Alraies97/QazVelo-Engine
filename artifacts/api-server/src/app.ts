import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware, type RequestHandler } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

// ── FastAPI backend origin ────────────────────────────────────────────────────
// FASTAPI_URL can be overridden per environment:
//   Local dev:     FASTAPI_URL=http://127.0.0.1:8000  (default)
//   Docker:        FASTAPI_URL=http://backend:8000
//   Remote/cloud:  FASTAPI_URL=https://api.example.com
const fastapiUrl = process.env.FASTAPI_URL ?? "http://127.0.0.1:8000";

const app: Express = express();

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
app.use(cors());

// ⚠️  The proxy MUST be registered before express.json() / urlencoded().
// Body-parser middleware consumes the request stream; if it runs first, the
// proxied POST body arrives empty at the FastAPI backend.
export const pythonProxy: RequestHandler = createProxyMiddleware({
  target: fastapiUrl,
  changeOrigin: true,
  ws: true,
  pathFilter: "/api/v1",
  on: {
    error: (err, _req, res) => {
      logger.warn(
        { err: (err as Error).message, target: fastapiUrl },
        "FastAPI proxy error",
      );
      if (
        res &&
        "writeHead" in res &&
        typeof (res as import("http").ServerResponse).writeHead === "function"
      ) {
        const srv = res as import("http").ServerResponse;
        if (!srv.headersSent) {
          srv.writeHead(502, { "Content-Type": "application/json" });
          srv.end(
            JSON.stringify({
              detail: `Python backend unavailable at ${fastapiUrl} — is it running?`,
            }),
          );
        }
      }
    },
  },
});

app.use(pythonProxy);

// Body parsers are only reached by Express-native routes (e.g. /api/healthz)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
