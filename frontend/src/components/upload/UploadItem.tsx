import React from 'react';
import { X, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getDocumentTypeFromFile, DocumentType } from '@/utils/document-utils';
import { formatFileSize } from '@/utils/upload-validation';
import { UploadItem as UploadItemType } from '@/types/upload';

interface UploadItemProps {
  item: UploadItemType;
  onDelete: (itemId: string) => void;
  onCancel: (itemId: string) => void;
  onRetry?: (itemId: string) => void;
}

export function UploadItem({ item, onDelete, onCancel, onRetry }: UploadItemProps) {
  const getUploadIcon = () => {
    if (item.type === "youtube") {
      return (
        <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
          <span className="text-red-600 text-xs font-semibold">YT</span>
        </div>
      );
    }

    if (item.type === "url") {
      return (
        <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
          <span className="text-indigo-600 text-xs font-semibold">URL</span>
        </div>
      );
    }

    if (!item.file) return <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">FILE</div>;

    // Use centralized document type detection
    const file = item.file;
    const docType = getDocumentTypeFromFile(file);

    switch (docType) {
      case DocumentType.pdf:
        return (
          <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
            <span className="text-red-600 text-xs font-semibold">PDF</span>
          </div>
        );
      case DocumentType.image:
        return (
          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
            <span className="text-green-600 text-xs font-semibold">IMG</span>
          </div>
        );
      case DocumentType.word:
        return (
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
            <span className="text-blue-600 text-xs font-semibold">DOC</span>
          </div>
        );
      default:
        return <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">FILE</div>;
    }
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case "pending":
        return null;
      case "waiting":
        return null;
      case "uploading":
        return <Spinner size="sm" className="w-3 h-3" />;
      case "completed":
        return <Check className="w-3 h-3 text-green-600" />;
      case "error":
        return <AlertCircle className="w-3 h-3 text-red-600" />;
      case "cancelled":
        return <X className="w-3 h-3 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case "pending":
        return "Pending...";
      case "waiting":
        return <span className="text-gray-500">Waiting...</span>;
      case "uploading":
        return <span>Uploading...</span>;
      case "completed":
        return <span className="text-green-600">Completed</span>;
      case "error":
        return <span className="text-red-600">Failed</span>;
      case "cancelled":
        return <span className="text-orange-600">Cancelled</span>;
      default:
        return "";
    }
  };

  const getTypeText = () => {
    if (item.type === "file") {
      return `${formatFileSize(item.file!.size)}`;
    }
    if (item.type === "url") {
      return "Web Document";
    }
    if (item.type === "youtube") {
      return "YouTube Video";
    }
    return "";
  };

  const handleActionClick = () => {
    if (item.status === "completed" && item.documentId) {
      onDelete(item.id);
    } else if (item.status === "uploading" || item.status === "pending") {
      onCancel(item.id);
    } else if (item.status === "error" && onRetry) {
      onRetry(item.id);
    } else {
      onDelete(item.id);
    }
  };

  const getActionButtonIcon = () => {
    if (item.status === "completed") {
      return <Trash2 className="w-4 h-4" />;
    }
    if (item.status === "error" && onRetry) {
      return <div className="w-4 h-4 bg-blue-500 rounded-full text-white text-xs">↻</div>;
    }
    return <X className="w-4 h-4" />;
  };

  const getActionButtonTitle = () => {
    if (item.status === "uploading" || item.status === "pending") {
      return "Cancel upload";
    }
    if (item.status === "completed") {
      return "Delete document";
    }
    if (item.status === "error" && onRetry) {
      return "Retry upload";
    }
    return "Remove";
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg min-w-0 bg-white">
      {getUploadIcon()}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 min-w-0">
          <p
            className="text-sm font-medium truncate min-w-0 flex-1"
            title={item.type === "url" ? item.url : item.name}
          >
            {item.name}
          </p>
          <button
            onClick={handleActionClick}
            className={cn(
              "flex-shrink-0 ml-2 transition-colors",
              item.status === "completed"
                ? "text-gray-400 hover:text-red-600"
                : "text-gray-400 hover:text-red-600"
            )}
            title={getActionButtonTitle()}
          >
            {getActionButtonIcon()}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.type === "file" && item.file && (
            <>
              <span>{getTypeText()}</span>
              <span>•</span>
            </>
          )}
          {item.type !== "file" && (
            <>
              <span>{getTypeText()}</span>
              <span>•</span>
            </>
          )}

          <div className="flex items-center gap-1">
            {getStatusIcon()}
            {getStatusText()}
          </div>
        </div>

        {item.status === "error" && item.error && (
          <p className="text-xs text-red-600 mt-1">
            {item.error}
          </p>
        )}
      </div>
    </div>
  );
}