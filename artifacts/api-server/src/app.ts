import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter } from "./lib/rate-limiters.js";
import { validateDateHeader } from "@workspace/shared";

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
app.use(
  cors({
    origin: corsOrigin ?? "*",
    allowedHeaders: ["Content-Type", "Authorization", "x-local-date"],
    credentials: !!corsOrigin,
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
  const apiSecretKey = process.env.API_SECRET_KEY;
  if (!apiSecretKey) {
    next();
    return;
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token || token !== apiSecretKey) {
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

app.use("/api", router);

export default app;
