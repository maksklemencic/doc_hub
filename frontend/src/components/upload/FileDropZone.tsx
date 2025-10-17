import React, { useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileDropZoneProps } from '@/types/upload';

export function FileDropZone({ onFilesDrop, disabled = false, className, children }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;

    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesDrop(droppedFiles);
    }
  }, [disabled, onFilesDrop]);

  const handleBrowseClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;

    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesDrop(files);
    }

    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  }, [disabled, onFilesDrop]);

  const defaultContent = (
    <>
      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">
        Choose a file or drag & drop it here.
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        PDF, Word documents, and images up to 50 MB.
      </p>
      <Button
        variant="outline"
        onClick={handleBrowseClick}
        className="bg-white border-gray-300 hover:bg-gray-50"
        disabled={disabled}
      >
        Browse File
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.tiff"
        onChange={handleFileInputChange}
        disabled={disabled}
      />
    </>
  );

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors bg-white",
        isDragOver
          ? "border-blue-400 bg-blue-50"
          : "border-gray-300 hover:border-gray-400 bg-white",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children || defaultContent}
    </div>
  );
}