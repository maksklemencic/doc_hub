import { UrlValidationResult, FileValidationResult } from '@/types/upload';

// URL validation constants
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// File validation constants
export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const DEFAULT_ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'text/plain'
];

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\//,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\//,
  /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch/
];

/**
 * Validates a URL string
 */
export function validateUrl(urlString: string): UrlValidationResult {
  try {
    const url = new URL(urlString);

    // Check if protocol is whitelisted
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return {
        valid: false,
        error: `Invalid protocol. Only HTTP and HTTPS are allowed.`
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format. Please enter a valid web address.'
    };
  }
}

/**
 * Checks if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Validates a single file
 */
export function validateFile(
  file: File,
  maxSize: number = DEFAULT_MAX_FILE_SIZE,
  allowedTypes: string[] = DEFAULT_ALLOWED_FILE_TYPES
): FileValidationResult {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}.`,
      maxSize,
      allowedTypes
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: ${allowedTypes.map(type => type.split('/')[1]).join(', ')}.`,
      maxSize,
      allowedTypes
    };
  }

  return {
    valid: true,
    maxSize,
    allowedTypes
  };
}

/**
 * Validates multiple files
 */
export function validateFiles(
  files: File[],
  maxSize: number = DEFAULT_MAX_FILE_SIZE,
  allowedTypes: string[] = DEFAULT_ALLOWED_FILE_TYPES
): FileValidationResult[] {
  return files.map(file => validateFile(file, maxSize, allowedTypes));
}

/**
 * Checks if file size is valid
 */
export function isFileSizeValid(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * Checks if file type is valid
 */
export function isFileTypeValid(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + " " + sizes[i]
  );
}

/**
 * Sanitizes filename for display
 */
export function sanitizeFileName(fileName: string, maxLength: number = 50): string {
  if (fileName.length <= maxLength) return fileName;

  const extension = fileName.split('.').pop();
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  const truncatedName = nameWithoutExt.substring(0, maxLength - extension!.length - 4);

  return `${truncatedName}...${extension}`;
}

/**
 * Gets file type label for display
 */
export function getFileTypeLabel(file: File): string {
  const type = file.type.toLowerCase();

  if (type.includes('pdf')) return 'PDF';
  if (type.includes('word') || type.includes('document')) return 'Word';
  if (type.includes('image')) return 'Image';
  if (type.includes('text')) return 'Text';

  return 'File';
}

/**
 * Validates and extracts URL from pasted content
 */
export function extractUrlFromText(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
}