export interface UploadItem {
  id: string;
  type: "file" | "url" | "youtube";
  file?: File;
  url?: string;
  name: string;
  status: "pending" | "uploading" | "completed" | "error" | "waiting" | "cancelled";
  progress: number;
  error?: string;
  documentId?: string;
  abortController?: AbortController;
}

export interface UploadQueueState {
  queue: UploadItem[];
  isProcessing: boolean;
  uploadingIds: Set<string>;
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

export interface UploadQueueActions {
  addToQueue: (items: Omit<UploadItem, 'id' | 'status' | 'progress'>[]) => void;
  removeFromQueue: (itemId: string) => void;
  clearQueue: () => void;
  cancelUpload: (itemId: string) => void;
  processQueue: () => void;
}

export interface UseUploadQueueResult extends UploadQueueState, UploadQueueActions {}

export interface UseFileValidationResult {
  validateFile: (file: File) => FileValidationResult;
  validateFiles: (files: File[]) => FileValidationResult[];
  isFileSizeValid: (file: File, maxSize: number) => boolean;
  isFileTypeValid: (file: File, allowedTypes: string[]) => boolean;
}

export interface UseUrlImportResult {
  validateUrl: (url: string) => UrlValidationResult;
  isYouTubeUrl: (url: string) => boolean;
  handleUrlImport: (url: string) => Promise<void>;
  urlInput: string;
  setUrlInput: (url: string) => void;
  urlError: string | null;
  setUrlError: (error: string | null) => void;
  isImporting: boolean;
}

export interface UploadItemProps {
  item: UploadItem;
  onDelete: (itemId: string) => void;
  onCancel: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
}

export interface FileDropZoneProps {
  onFilesDrop: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface UploadProgressListProps {
  items: UploadItem[];
  onDeleteItem: (itemId: string) => void;
  onCancelUpload: (itemId: string) => void;
  onRetryUpload?: (itemId: string) => void;
  className?: string;
}

export interface UrlImportSectionProps {
  onUrlImport: (url: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}