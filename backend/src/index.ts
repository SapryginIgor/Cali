/**
 * Express server entry point
 * Sets up middleware, routes, and starts the server
 */

// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";
import analyzeRouter from "./routes/analyze";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow mobile app origins
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Allow Expo dev server URLs and localhost
    const allowedOrigins = [
      /^https?:\/\/localhost:\d+$/,
      /^https?:\/\/127\.0\.0\.1:\d+$/,
      /^https?:\/\/.*\.expo\.dev$/,
      /^exp:\/\/.*$/,
    ];
    
    const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
    callback(null, isAllowed);
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "11mb" })); // Slightly larger than 10MB to account for base64 overhead
app.use(express.urlencoded({ extended: true, limit: "11mb" }));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use("/api", analyzeRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  
  // Validate OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }
  console.log("OpenAI API key configured");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
