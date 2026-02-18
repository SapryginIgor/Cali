/**
 * Analyze food endpoint
 * Handles POST /api/analyze-food with image uploads (base64 or multipart)
 */

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { analyzeFoodImage } from "../services/openai";
import { analyzeFoodRequestSchema, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_FORMATS } from "../types/validation";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Configure multer for multipart form data (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (SUPPORTED_IMAGE_FORMATS.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `Unsupported image format. Supported formats: JPEG, PNG, WebP`));
    }
  },
});

/**
 * POST /api/analyze-food
 * Accepts either:
 * - JSON body with base64 image: { image: "base64string", description?: "text" }
 * - Multipart form data with image file and optional description field
 */
router.post("/analyze-food", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let imageBase64: string;
    let description: string | undefined;
    let userId: string | undefined;

    // Check if request is multipart/form-data
    const contentType = req.headers["content-type"] || "";
    const isMultipart = contentType.includes("multipart/form-data");

    if (isMultipart) {
      // Handle multipart form data
      await new Promise<void>((resolve, reject) => {
        upload.single("image")(req, res, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      const file = (req as any).file;
      if (!file) {
        throw new AppError(400, "Image file is required");
      }

      // Convert buffer to base64
      imageBase64 = file.buffer.toString("base64");
      description = req.body.description;
      userId = req.body.userId;
    } else {
      // Handle JSON body with base64 image
      const body = req.body;
      
      // Validate request body
      const validationResult = analyzeFoodRequestSchema.safeParse(body);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
        throw new AppError(400, `Validation failed: ${errors}`);
      }

      imageBase64 = body.image;
      description = body.description;
      userId = body.userId;
    }

    // Validate image size (for base64, approximate check)
    if (!isMultipart) {
      // Base64 is ~33% larger than binary, so check approximate size
      const approximateSize = (imageBase64.length * 3) / 4;
      if (approximateSize > MAX_IMAGE_SIZE) {
        throw new AppError(400, `Image size exceeds maximum of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      }
    }

    // Validate base64 format
    if (!imageBase64 || imageBase64.trim().length === 0) {
      throw new AppError(400, "Image is required");
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      throw new AppError(400, "Description must be 500 characters or less");
    }

    // Extract optional userId from Authorization header if not in body
    if (!userId && req.headers.authorization) {
      // For future auth support - just extract for logging
      userId = req.headers.authorization;
    }

    // Call OpenAI service
    const result = await analyzeFoodImage(imageBase64, description);

    // Return success response
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
