'use client'

import { useRef, useEffect, useState } from 'react'
import { Search, Send, MoreVertical, PanelLeft, PanelRight, FileText, FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ContextManager } from './context-manager'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface QueryBarProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  contextText?: string
  disabled?: boolean
  variant?: 'default' | 'mini'
  onOpenInPane?: (pane: 'left' | 'right') => void
  onContextChange?: (type: 'all-space' | 'open-tabs' | 'active-tab' | 'clear') => void
  selectedDocuments?: Array<{ id: string; filename: string }>
  onRemoveDocument?: (docId: string) => void
  className?: string
  style?: React.CSSProperties
  // New context manager props
  documents?: Array<{ id: string; filename: string }>
  selectedDocumentIds?: string[]
  onDocumentContextChange?: (documentIds: string[]) => void
  spaceName?: string
}

export function QueryBar({
  value,
  onChange,
  onSend,
  placeholder = 'Ask about your documents...',
  contextText,
  disabled = false,
  variant = 'default',
  onOpenInPane,
  onContextChange,
  selectedDocuments = [],
  onRemoveDocument,
  className,
  style,
  documents = [],
  selectedDocumentIds = [],
  onDocumentContextChange,
  spaceName = 'Space',
}: QueryBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  // Handle click outside to close popover
  useEffect(() => {
    if (!isPopoverOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        containerRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handlePopoverOpenChange(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPopoverOpen])

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = target.scrollHeight + 'px'
  }

  // Auto-focus textarea when typing
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with special keys, shortcuts, or if already focused on input
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.key === 'Tab' ||
        e.key === 'Enter' ||
        e.key === 'Escape' ||
        e.key.startsWith('Arrow') ||
        e.key.startsWith('F') ||
        document.activeElement === textareaRef.current ||
        (document.activeElement && document.activeElement.tagName === 'INPUT') ||
        (document.activeElement && document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }

      // If it's a printable character, focus the textarea
      if (e.key.length === 1 && textareaRef.current) {
        textareaRef.current.focus()
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Calculate context text based on selected documents
  const getContextText = () => {
    if (contextText) return contextText // Use provided context text if available

    const isAllSelected = selectedDocumentIds.length === 0 || selectedDocumentIds.length === documents.length

    if (isAllSelected) {
      return `All in ${spaceName}`
    } else if (selectedDocumentIds.length === 1) {
      const doc = documents.find(d => d.id === selectedDocumentIds[0])
      if (doc) {
        // Truncate filename if too long
        return doc.filename.length > 20 ? doc.filename.substring(0, 20) + '...' : doc.filename
      }
    }
    return `${selectedDocumentIds.length} documents`
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (!open && onDocumentContextChange) {
      // Validate: at least one document must be selected
      const isAllSelected = selectedDocumentIds.length === 0 || selectedDocumentIds.length === documents.length
      if (!isAllSelected && selectedDocumentIds.length === 0) {
        toast.error('Please select at least one document')
        return
      }
    }
    setIsPopoverOpen(open)
  }

  const handleContextChange = (documentIds: string[]) => {
    if (onDocumentContextChange) {
      onDocumentContextChange(documentIds)
    }
  }

  const content = (
    <div
      ref={containerRef}
      className={cn(className, "relative")}
      style={style}
      onClick={(e) => {
        // Close popover if clicking on query bar (but not on the badge)
        if (isPopoverOpen && !(e.target as HTMLElement).closest('.context-badge')) {
          handlePopoverOpenChange(false)
        }
      }}
      onContextMenu={() => {
        // Close popover on right-click
        if (isPopoverOpen) {
          handlePopoverOpenChange(false)
        }
      }}
    >
      <div className="flex items-center gap-2 p-3 relative">
        {!value && (
          <Search className="absolute left-3 top-[16.5px] h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // Close popover when user starts typing
            if (isPopoverOpen) {
              handlePopoverOpenChange(false)
            }
          }}
          onKeyDown={handleKeyDown}
          className={`flex-1 bg-transparent text-sm resize-none focus:outline-none min-h-[24px] max-h-[200px] transition-all ${!value ? 'pl-8' : 'pl-0'}`}
          rows={1}
          disabled={disabled}
          style={{
            height: 'auto',
            overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden',
          }}
          onInput={handleInput}
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          size="icon"
          className="h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Context:</span>
          <Badge
            variant="secondary"
            className="context-badge bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer transition-colors"
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          >
            {getContextText()}
          </Badge>
          {onDocumentContextChange && documents.length > 0 && (selectedDocumentIds.length === 0 ? false : selectedDocumentIds.length !== documents.length) && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-[22px] px-2"
              onClick={() => onDocumentContextChange([])}
            >
              Use all ({documents.length})
            </Button>
          )}
        </div>

      {/* Custom positioned popover - positioned relative to query bar container */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-50 bg-popover text-popover-foreground rounded-2xl border shadow-md",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
          )}
          style={{
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: '8px',
            maxHeight: '540px',
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
              {onDocumentContextChange && documents.length > 0 ? (
                <ContextManager
                  documents={documents}
                  selectedDocumentIds={selectedDocumentIds}
                  onContextChange={handleContextChange}
                  onClose={() => setIsPopoverOpen(false)}
                />
              ) : (
                // Fallback to old UI if new props not provided
                <>
                  <div className="p-3 border-b">
                    <h4 className="font-medium text-sm">Chat Context</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select which documents to include in your chat
                    </p>
                  </div>
                  <div className="p-2">
                    {onContextChange && (
                      <div className="space-y-1 mb-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm font-normal"
                          onClick={() => onContextChange('all-space')}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          All documents in space
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm font-normal"
                          onClick={() => onContextChange('open-tabs')}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Open tabs only
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm font-normal"
                          onClick={() => onContextChange('active-tab')}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Active tab only
                        </Button>
                      </div>
                    )}
                    {selectedDocuments.length > 0 && (
                      <>
                        <div className="h-px bg-border my-2" />
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                            Selected Documents ({selectedDocuments.length})
                          </div>
                          {selectedDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded-md group"
                            >
                              <span className="text-sm truncate flex-1" title={doc.filename}>
                                {doc.filename}
                              </span>
                              {onRemoveDocument && (
                                <button
                                  onClick={() => onRemoveDocument(doc.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {onContextChange && (
                      <>
                        <div className="h-px bg-border my-2" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm font-normal text-destructive hover:text-destructive hover:bg-red-50"
                          onClick={() => onContextChange('clear')}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Clear context
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        <div className="flex items-center gap-1">
          <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            Llama 3.1 8B
          </button>
          {variant === 'mini' && onOpenInPane && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenInPane('left')} className="focus:bg-teal-50 focus:text-teal-900">
                  <PanelLeft className="mr-2 h-4 w-4" />
                  Open in Left Pane
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenInPane('right')} className="focus:bg-teal-50 focus:text-teal-900">
                  <PanelRight className="mr-2 h-4 w-4" />
                  Open in Right Pane
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )

  // Wrap with context menu for mini variant
  if (variant === 'mini' && onOpenInPane) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {content}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onOpenInPane('left')} className="focus:bg-teal-50 data-[highlighted]:bg-teal-50">
            <PanelLeft className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900" />
            <span className="text-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900">Open in Left Pane</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onOpenInPane('right')} className="focus:bg-teal-50 data-[highlighted]:bg-teal-50">
            <PanelRight className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900" />
            <span className="text-foreground group-hover:text-teal-900 data-[highlighted]:text-teal-900">Open in Right Pane</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return content
}
