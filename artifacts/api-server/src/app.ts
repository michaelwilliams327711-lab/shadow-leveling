import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiSecretKey = process.env.API_SECRET_KEY;
  if (!apiSecretKey) {
    next();
    return;
  }
  const provided = req.headers["x-api-key"];
  if (provided !== apiSecretKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz") {
    next();
    return;
  }
  authMiddleware(req, res, next);
});

app.use("/api", router);

export default app;
