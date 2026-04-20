import crypto from "crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters.js";
import { validateDateHeader } from "@workspace/shared";
import { ZodError } from "zod";

const DEV_SECRET = "shadow-dev-access-key";
const apiSecretKey = process.env.API_SECRET_KEY;
const effectiveApiSecretKey =
  apiSecretKey ?? (process.env.NODE_ENV === "production" ? undefined : DEV_SECRET);

if (!effectiveApiSecretKey) {
  logger.error("FATAL: API_SECRET_KEY environment variable is required but was not set.");
  logger.error("Set API_SECRET_KEY in your environment secrets before starting the server.");
  process.exit(1);
}

if (!apiSecretKey && process.env.NODE_ENV !== "production") {
  logger.warn("API_SECRET_KEY is not set; using development fallback API auth secret.");
}

const app: Express = express();

app.set("trust proxy", 1);

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

const corsOrigin = process.env.CORS_ORIGIN;

if (process.env.NODE_ENV === "production") {
  if (!corsOrigin || corsOrigin === "*") {
    logger.error(
      "FATAL: CORS_ORIGIN must be set to the exact production domain in production mode " +
      "(e.g. https://yourapp.replit.app). Wildcard '*' and undefined are both rejected. " +
      "Set CORS_ORIGIN in your deployment environment secrets."
    );
    process.exit(1);
  }
}

if (corsOrigin === "*") {
  logger.warn(
    "CORS_ORIGIN is set to '*' — credentials will be disabled to comply with browser CORS spec. " +
    "Set CORS_ORIGIN to the exact frontend origin (e.g. https://yourapp.replit.app) to enable credentials."
  );
}

const credentialsEnabled = !!corsOrigin && corsOrigin !== "*";

app.use(
  cors({
    origin: corsOrigin ?? "*",
    allowedHeaders: ["Content-Type", "Authorization", "x-local-date"],
    credentials: credentialsEnabled,
  }),
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers["x-local-date"];
  const headerVal = Array.isArray(header) ? header[0] : header;
  if (headerVal) {
    const result = validateDateHeader(headerVal);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
  }
  next();
});

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let authorized = false;
  try {
    // Hash both values with HMAC-SHA256 so the resulting buffers are always
    // 32 bytes regardless of input length. This allows timingSafeEqual to run
    // unconditionally and prevents timing leaks caused by early-exit length checks.
    const hmacKey = "shadow-leveling-auth-hmac";
    const tokenHmac = crypto.createHmac("sha256", hmacKey).update(token).digest();
    const keyHmac = crypto.createHmac("sha256", hmacKey).update(effectiveApiSecretKey).digest();
    authorized = crypto.timingSafeEqual(tokenHmac, keyHmac);
  } catch {
    authorized = false;
  }

  if (!authorized) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.use("/api", globalLimiter);

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz") {
    next();
    return;
  }
  authMiddleware(req, res, next);
});

// Defense-in-depth: tell every cache layer (browser, SW, CDN) never to store API responses.
app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  next();
});

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.flatten() });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
