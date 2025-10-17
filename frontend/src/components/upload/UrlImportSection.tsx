import React from 'react';
import { Link, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { UrlImportSectionProps } from '@/types/upload';

export function UrlImportSection({
  onUrlImport,
  disabled = false,
  className
}: UrlImportSectionProps) {
  const [urlInput, setUrlInput] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleUrlImport = async () => {
    if (!urlInput.trim() || disabled) return;

    setIsImporting(true);
    setUrlError(null);

    try {
      await onUrlImport(urlInput.trim());
      setUrlInput("");
    } catch (error) {
      setUrlError('Failed to import URL. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && urlInput.trim() && !disabled) {
      handleUrlImport();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    // Clear error when user types
    if (urlError) setUrlError(null);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Import from Web or YouTube</h3>
          <div
            className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center"
            title="Paste any web URL or YouTube video link"
          >
            <span className="text-xs text-gray-500">?</span>
          </div>
        </div>
        <Button
          onClick={handleUrlImport}
          disabled={!urlInput.trim() || disabled || isImporting}
          size="sm"
          variant="outline"
        >
          {isImporting ? 'Importing...' : 'Import URL'}
        </Button>
      </div>

      <div className="relative">
        <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Paste web or YouTube URL"
          value={urlInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-10 bg-white border-gray-300",
            urlError && "border-red-500 focus-visible:ring-red-500",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        />
      </div>

      {urlError && (
        <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{urlError}</span>
        </div>
      )}
    </div>
  );
}