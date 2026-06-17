"""
Image processing utilities
"""

import base64
from typing import Optional
from fastapi import UploadFile
from PIL import Image
import io

# Maximum image size: 10MB (in bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024

# Supported image formats
SUPPORTED_IMAGE_FORMATS = ["image/jpeg", "image/png", "image/webp"]
SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]


def validate_image_format(image_data: bytes, mime_type: Optional[str] = None) -> bool:
    """
    Validate image format using PIL/Pillow
    
    Args:
        image_data: Image binary data
        mime_type: Optional MIME type hint
        
    Returns:
        True if format is supported, False otherwise
    """
    try:
        img = Image.open(io.BytesIO(image_data))
        # Check if format is supported
        if img.format and img.format.lower() in ["jpeg", "png", "webp"]:
            return True
        
        # Also check MIME type if provided
        if mime_type and mime_type.lower() in SUPPORTED_IMAGE_FORMATS:
            return True
        
        return False
    except Exception:
        return False


def validate_image_size(image_data: bytes) -> bool:
    """
    Validate image size does not exceed limit
    
    Args:
        image_data: Image binary data
        
    Returns:
        True if size is within limit, False otherwise
    """
    return len(image_data) <= MAX_IMAGE_SIZE


def validate_base64_image_format(image_base64: str) -> bool:
    """
    Validate base64 image format
    
    Args:
        image_base64: Base64 encoded image string
        
    Returns:
        True if format is valid, False otherwise
    """
    try:
        # Remove data URL prefix if present
        image_data = image_base64.split(",")[-1] if "," in image_base64 else image_base64
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        
        # Validate using PIL
        return validate_image_format(image_bytes)
    except Exception:
        return False


async def upload_file_to_base64(upload_file: UploadFile) -> str:
    """
    Convert UploadFile to base64 string
    
    Args:
        upload_file: FastAPI UploadFile object
        
    Returns:
        Base64 encoded image string
    """
    # Read file content
    file_content = await upload_file.read()
    
    # Validate size
    if not validate_image_size(file_content):
        raise ValueError("Image size exceeds 10MB limit")
    
    # Validate format
    mime_type = upload_file.content_type
    if not validate_image_format(file_content, mime_type):
        raise ValueError("Unsupported image format. Supported formats: JPEG, PNG, WebP")
    
    # Encode to base64
    image_base64 = base64.b64encode(file_content).decode("utf-8")
    
    # Return with data URL prefix for consistency
    return f"data:{mime_type or 'image/jpeg'};base64,{image_base64}"
