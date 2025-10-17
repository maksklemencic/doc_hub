import { useCallback } from 'react';
import { UseFileValidationResult } from '@/types/upload';
import {
  validateFile as validateFileUtil,
  validateFiles as validateFilesUtil,
  isFileSizeValid as isFileSizeValidUtil,
  isFileTypeValid as isFileTypeValidUtil,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ALLOWED_FILE_TYPES
} from '@/utils/upload-validation';

export function useFileValidation(): UseFileValidationResult {
  const validateFile = useCallback((file: File) => {
    return validateFileUtil(file, DEFAULT_MAX_FILE_SIZE, DEFAULT_ALLOWED_FILE_TYPES);
  }, []);

  const validateFiles = useCallback((files: File[]) => {
    return validateFilesUtil(files, DEFAULT_MAX_FILE_SIZE, DEFAULT_ALLOWED_FILE_TYPES);
  }, []);

  const isFileSizeValid = useCallback((file: File, maxSize: number) => {
    return isFileSizeValidUtil(file, maxSize);
  }, []);

  const isFileTypeValid = useCallback((file: File, allowedTypes: string[]) => {
    return isFileTypeValidUtil(file, allowedTypes);
  }, []);

  return {
    validateFile,
    validateFiles,
    isFileSizeValid,
    isFileTypeValid
  };
}