/**
 * Centralized error handling middleware
 * Provides user-friendly error messages without exposing internal details
 */

import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../types/api";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details internally
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    const errorResponse: ErrorResponse = {
      error: getErrorName(err.statusCode),
      message: err.message,
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle OpenAI API errors
  if (err.message.includes("OpenAI") || err.message.includes("API")) {
    // Map OpenAI errors to appropriate status codes
    if (err.message.includes("401") || err.message.includes("authentication")) {
      res.status(500).json({
        error: "Internal Server Error",
        message: "Authentication failed. Please contact support.",
      });
      return;
    }
    if (err.message.includes("429") || err.message.includes("rate limit")) {
      res.status(503).json({
        error: "Service Unavailable",
        message: "Service is temporarily unavailable. Please try again later.",
      });
      return;
    }
    if (err.message.includes("timeout")) {
      res.status(503).json({
        error: "Service Unavailable",
        message: "Request timed out. Please try again later.",
      });
      return;
    }
    // Generic OpenAI error
    res.status(503).json({
      error: "Service Unavailable",
      message: "Service is temporarily unavailable. Please try again later.",
    });
    return;
  }

  // Handle validation errors (from Zod)
  if (err.name === "ZodError") {
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid request data. Please check your input.",
    });
    return;
  }

  // Default: Internal Server Error
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred. Please try again later.",
  });
};

function getErrorName(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 429:
      return "Too Many Requests";
    case 500:
      return "Internal Server Error";
    case 503:
      return "Service Unavailable";
    default:
      return "Error";
  }
}
