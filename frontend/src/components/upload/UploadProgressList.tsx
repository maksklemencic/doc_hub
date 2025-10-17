import React from 'react';
import { cn } from '@/lib/utils';
import { UploadItem } from './UploadItem';
import { UploadProgressListProps } from '@/types/upload';

export function UploadProgressList({
  items,
  onDeleteItem,
  onCancelUpload,
  onRetryUpload,
  className
}: UploadProgressListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "space-y-3 max-h-[320px] overflow-y-auto overflow-x-hidden pr-1",
      className
    )}>
      {items.map((item) => (
        <UploadItem
          key={item.id}
          item={item}
          onDelete={onDeleteItem}
          onCancel={onCancelUpload}
          onRetry={onRetryUpload}
        />
      ))}
    </div>
  );
}