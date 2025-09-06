// src/app.ts
import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import helmet from "helmet";
import morgan from "morgan";
import toobusy from "toobusy-js";
import rateLimit from "express-rate-limit";
import cors, { CorsOptionsDelegate } from "cors";
import express, { Request, Response } from "express";


// Custom modules
import morganLogger from "./logger/morgan-logger.js";
import errorHandler from "./middlewares/errorHandler.js";
import { metricsMiddleware, exposeMetricsEndpoint } from "./metrics.js";

// import r from "./routes/index.js";

const app = express();

// security header
app.use(helmet());
// CSP: relax in dev so Apollo Sandbox and WebSocket can connect from the browser
if (process.env.NODE_ENV !== "production") {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "connect-src": ["'self'", "http:", "https:", "ws:", "wss:", "http://localhost:8888"],
        "img-src": ["'self'", "data:", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    })
  );
} else {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "connect-src": ["'self'"],
      },
    })
  );
}

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  })
);
app.disable("x-powered-by");

// Metrics
app.use(metricsMiddleware);

// DDOS - Load Protection
app.use((req, res, next) => {
  if (toobusy()) {
    res.status(503).send("Server too busy!");
  } else {
    next();
  }
});


// Logging middleware
if (process.env.NODE_ENV === "production") {
  const accessLogPath = path.join(process.cwd(), "access.log");
  const accessLogStream = fs.createWriteStream(accessLogPath, { flags: "a" });
  app.use(morgan("combined", { stream: accessLogStream }));
} else {
  app.use(morganLogger);
}

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);


// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:8888").split(",");
const corsOptions: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error("Not allowed by CORS"), { origin: false });
  }
};
app.use(cors(corsOptions));


// Body Parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));


// Routes
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "algoo-api",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime().toFixed(2) + "s",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the Secure Algoo API!" });
});

// Routes
// app.use("/v1", r);


// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});


// Error Handler Middleware
app.use(errorHandler);


// Expose metrics endpoint
exposeMetricsEndpoint(app);

export default app;



