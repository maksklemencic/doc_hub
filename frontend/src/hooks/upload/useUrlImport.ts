import { useState, useCallback } from 'react';
import { UseUrlImportResult } from '@/types/upload';
import { validateUrl as validateUrlUtil, isYouTubeUrl as isYouTubeUrlUtil } from '@/utils/upload-validation';
import { UploadItem } from '@/types/upload';

export function useUrlImport(
  onAddToQueue: (items: Omit<UploadItem, 'id' | 'status' | 'progress'>[]) => void
): UseUrlImportResult {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const validateUrl = useCallback((url: string) => {
    return validateUrlUtil(url);
  }, []);

  const isYouTubeUrl = useCallback((url: string) => {
    return isYouTubeUrlUtil(url);
  }, []);

  const handleUrlImport = useCallback(async (url: string) => {
    if (!url.trim()) return;

    const trimmedUrl = url.trim();

    // Validate URL
    const validation = validateUrl(trimmedUrl);
    if (!validation.valid) {
      setUrlError(validation.error || 'Invalid URL');
      return;
    }

    // Clear any previous errors
    setUrlError(null);
    setIsImporting(true);

    try {
      const isYouTube = isYouTubeUrl(trimmedUrl);

      const urlItem: Omit<UploadItem, 'id' | 'status' | 'progress'> = {
        type: isYouTube ? "youtube" : "url",
        url: trimmedUrl,
        name: trimmedUrl,
      };

      onAddToQueue([urlItem]);
      setUrlInput("");
    } catch (error) {
      setUrlError('Failed to import URL. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [validateUrl, isYouTubeUrl, onAddToQueue]);

  const handleUrlInputChange = useCallback((url: string) => {
    setUrlInput(url);
    // Clear error when user types
    if (urlError) setUrlError(null);
  }, [urlError]);

  return {
    validateUrl,
    isYouTubeUrl,
    handleUrlImport,
    urlInput,
    setUrlInput: handleUrlInputChange,
    urlError,
    setUrlError,
    isImporting
  };
}