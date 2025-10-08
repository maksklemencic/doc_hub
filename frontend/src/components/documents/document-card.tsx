'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Video,
  Mic,
  Sparkles,
  Edit3,
  Image as ImageIcon,
  Globe,
  Eye,
  Target,
  Share2,
  Trash2,
  ExternalLink,
  PanelRightOpen,
  Youtube
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DocumentType } from '@/utils/document-utils'
import { isValidUrl } from '@/utils'

interface DocumentCardProps {
  id: string
  filename: string
  type: DocumentType
  size?: string
  timestamp?: string
  pageCount?: string
  url?: string
  isSelected: boolean
  selectedCount?: number
  onSelect: () => void
  onClick: () => void
  onDelete?: () => void
  onDeleteSelected?: () => void
  onBulkOpen?: () => void
  onBulkOpenInRightPane?: () => void
  onBulkAddToContext?: () => void
  onOpenInRightPane?: () => void
  onAddToContext?: (documentId: string) => void
}

// Get icon for document type - small size for card
const getDocumentIcon = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return <FileText className="w-6 h-6 text-gray-600" />
    case DocumentType.word:
      return <FileText className="w-6 h-6 text-blue-600" />
    case DocumentType.video:
      return <Video className="w-6 h-6 text-gray-600" />
    case DocumentType.audio:
      return <Mic className="w-6 h-6 text-gray-600" />
    case DocumentType.image:
      return <ImageIcon className="w-6 h-6 text-gray-600" />
    case DocumentType.web:
      return <Globe className="w-6 h-6 text-gray-600" />
    case DocumentType.youtube:
      return <Youtube className="w-6 h-6 text-red-600" />
    default:
      return <FileText className="w-6 h-6 text-gray-600" />
  }
}

// Get badge color and text for document type
const getTypeBadge = (type: DocumentType) => {
  switch (type) {
    case DocumentType.pdf:
      return { text: 'PDF', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    case DocumentType.word:
      return { text: 'WORD', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.video:
      return { text: 'Video', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    case DocumentType.audio:
      return { text: 'Audio', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    case DocumentType.image:
      return { text: 'Image', className: 'bg-green-100 text-green-700 border-green-200' }
    case DocumentType.web:
      return { text: 'Web', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    case DocumentType.youtube:
      return { text: 'YouTube', className: 'bg-red-100 text-red-700 border-red-200' }
    default:
      return { text: 'Other', className: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
}

export function DocumentCard({
  id,
  filename,
  type,
  size,
  timestamp,
  pageCount,
  url,
  isSelected,
  selectedCount = 0,
  onSelect,
  onClick,
  onDelete,
  onDeleteSelected,
  onBulkOpen,
  onBulkOpenInRightPane,
  onBulkAddToContext,
  onOpenInRightPane,
  onAddToContext
}: DocumentCardProps) {
  const badge = getTypeBadge(type)

  // Helper to check if document type is URL-based
  const isUrlBasedType = type === DocumentType.youtube || type === DocumentType.web

  const cardContent = (
    <div
      className={cn(
        "group relative bg-card border rounded-lg p-4 card-hover cursor-pointer",
        isSelected ? "border-teal-500 bg-teal-50" : "border-border"
      )}
      onClick={onClick}
    >
      {/* Checkbox - top left */}
      <div
        className="absolute top-3 left-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-white"
        />
      </div>

      {/* Badge - top right */}
      <Badge
        variant="outline"
        className={cn(
          "absolute top-3 right-3 text-xs font-medium",
          badge.className
        )}
      >
        {badge.text}
      </Badge>

      {/* Icon - shifted right when checkbox present */}
      <div className="mb-3">
        <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center ml-7">
          {getDocumentIcon(type)}
        </div>
      </div>

      {/* Content - aligned under icon */}
      <div className="space-y-1">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 pr-16 ml-7">
          {filename}
        </h3>
        {/* URL - shown for YouTube and Web documents */}
        {isUrlBasedType && url && isValidUrl(url) && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline ml-7 block truncate pr-16"
            title={url}
          >
            {url}
          </a>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500 ml-7">
          {pageCount && <span>{pageCount}</span>}
          {pageCount && size && !isUrlBasedType && <span>•</span>}
          {size && !isUrlBasedType && <span>{size}</span>}
        </div>
        {timestamp && (
          <p className="text-xs text-gray-400 ml-7">
            {timestamp}
          </p>
        )}
      </div>

      {/* Quick actions - shown on hover, bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {isUrlBasedType && url ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-teal-100 hover:text-teal-600"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open in new tab</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-teal-100 hover:text-teal-600"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View document</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-teal-100 hover:text-teal-600"
              onClick={(e) => {
                e.stopPropagation()
                onAddToContext?.(id)
              }}
            >
              <Target className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add to chat context</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-red-100 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete document</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {/* Header showing document name/type or selection count */}
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b mb-1">
          {selectedCount > 1 ? (
            <span>{selectedCount} documents</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate" title={filename}>
                {filename.length > 30 ? filename.substring(0, 30) + '...' : filename}
              </span>
              <Badge variant="secondary" className="text-xs">
                {type.toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
        {selectedCount > 1 ? (
          <>
            <ContextMenuItem
              onClick={onBulkOpen}
              className="focus:bg-teal-50 focus:text-teal-900"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Selected Documents
            </ContextMenuItem>
            <ContextMenuItem
              onClick={onBulkOpenInRightPane}
              className="focus:bg-teal-50 focus:text-teal-900"
            >
              <Eye className="mr-2 h-4 w-4" />
              Open Selected in Right Pane
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onBulkAddToContext}
              className="focus:bg-teal-50 focus:text-teal-900"
            >
              <Target className="mr-2 h-4 w-4" />
              Add Selected to Chat Context
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => onDeleteSelected?.()}
              className="text-destructive focus:bg-red-50 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected Documents
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              onClick={onClick}
              className="focus:bg-teal-50 focus:text-teal-900"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </ContextMenuItem>
            {onOpenInRightPane && (
              <ContextMenuItem
                onClick={onOpenInRightPane}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <PanelRightOpen className="mr-2 h-4 w-4" />
                Open in Right Pane
              </ContextMenuItem>
            )}
            {isUrlBasedType && url && (
              <ContextMenuItem
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="focus:bg-teal-50 focus:text-teal-900"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Link in New Tab
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onAddToContext && (
              <>
                <ContextMenuItem
                  onClick={() => onAddToContext?.(id)}
                  className="focus:bg-teal-50 focus:text-teal-900"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Add to Chat Context
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            {onDelete && (
              <ContextMenuItem
                onClick={() => onDelete()}
                className="text-destructive focus:bg-red-50 focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
