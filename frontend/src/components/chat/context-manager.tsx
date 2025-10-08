'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Check, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  filename: string
}

interface ContextManagerProps {
  documents: Document[]
  selectedDocumentIds: string[]
  onContextChange: (documentIds: string[]) => void
  onClose?: () => void
}

export function ContextManager({
  documents,
  selectedDocumentIds,
  onContextChange,
  onClose
}: ContextManagerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isListExpanded, setIsListExpanded] = useState(false)

  // Filter documents based on search
  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents
    return documents.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [documents, searchTerm])

  // Check if all documents are selected (empty array means all)
  const isAllSelected = selectedDocumentIds.length === 0 || selectedDocumentIds.length === documents.length

  const handleAddAll = () => {
    onContextChange([])
  }

  const handleToggleDocument = (docId: string) => {
    const currentSet = new Set(selectedDocumentIds.length === 0 ? documents.map(d => d.id) : selectedDocumentIds)

    if (currentSet.has(docId)) {
      currentSet.delete(docId)
    } else {
      currentSet.add(docId)
    }

    onContextChange(Array.from(currentSet))
  }

  const handleKeepOnly = (docId: string) => {
    onContextChange([docId])
  }

  const isDocumentInContext = (docId: string) => {
    if (selectedDocumentIds.length === 0) return true // All selected
    return selectedDocumentIds.includes(docId)
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col overflow-hidden">
      {/* Header with Chat Context only - Fixed */}
      <div className="p-3 border-b flex-shrink-0">
        <h4 className="font-medium text-sm">Chat Context</h4>
      </div>

      {/* Document List Toggle - Fixed */}
      <div className="border-b flex-shrink-0">
        <button
          onClick={() => setIsListExpanded(!isListExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            {isListExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Show documents
          </span>
          <span className="text-xs text-muted-foreground">
            {isAllSelected ? `All ${documents.length}` : `${selectedDocumentIds.length} of ${documents.length}`}
          </span>
        </button>
      </div>

      {/* Expandable content - Scrollable */}
      {isListExpanded && (
        <div className="flex flex-col flex-shrink-0">
          {/* Search Bar - Fixed */}
          <div className="px-3 py-2 border-b flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          {/* Document list with scroll - max 8 items (each ~40px = 320px) before scrolling */}
          <div className={cn(
            filteredDocuments.length > 8 ? "h-[320px]" : "h-auto"
          )}>
            <ScrollArea className={cn(
              filteredDocuments.length > 8 ? "h-full" : "h-auto"
            )}>
              <div className="py-1 pr-1">
                {filteredDocuments.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No documents found
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-1.5 hover:bg-muted/50 group"
                    >
                      <Checkbox
                        checked={isDocumentInContext(doc.id)}
                        onCheckedChange={() => handleToggleDocument(doc.id)}
                        className="h-4 w-4"
                      />
                      <button
                        onClick={() => handleToggleDocument(doc.id)}
                        className="text-left text-sm overflow-hidden min-w-0"
                        title={doc.filename}
                      >
                        <div className={cn(
                          "truncate transition-colors",
                          isDocumentInContext(doc.id) ? "text-foreground font-medium" : "text-muted-foreground"
                        )}>
                          {doc.filename}
                        </div>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleKeepOnly(doc.id)
                            }}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Target className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Keep only this document
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Current selection summary with Close button - Fixed */}
      <div className="p-3 border-t flex-shrink-0 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {isAllSelected ? (
            <span>Using all {documents.length} documents</span>
          ) : (
            <span>Using {selectedDocumentIds.length} of {documents.length} documents</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-shrink-0"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
          </div>
        </TooltipProvider>
      )
    }
