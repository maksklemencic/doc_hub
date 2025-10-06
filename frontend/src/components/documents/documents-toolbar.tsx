import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Calendar,
  FileText,
  HardDrive,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentType, getFileTypeColor } from '@/utils/document-utils'

export type SortBy = 'date' | 'name' | 'size'
export type SortOrder = 'asc' | 'desc'

interface DocumentsToolbarProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  sortBy: SortBy
  sortOrder: SortOrder
  onSortChange: (sortBy: SortBy) => void
  selectedTypes: Set<DocumentType>
  onTypeFilterChange: (type: DocumentType) => void
  onClearFilters: () => void
  selectedDocumentsCount: number
  onDeselectAll: () => void
}

export function DocumentsToolbar({
  searchTerm,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  selectedTypes,
  onTypeFilterChange,
  onClearFilters,
  selectedDocumentsCount,
  onDeselectAll,
}: DocumentsToolbarProps) {
  return (
    <div className="px-6 pt-4 pb-3 border-b border-border flex-shrink-0 min-w-0">
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-8 h-9 bg-white w-full"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Selected documents indicator */}
        <div className="flex items-center gap-2 flex-1">
          {selectedDocumentsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-900 rounded-md text-sm ml-auto border-2 border-primary">
              <span className="font-medium">{selectedDocumentsCount} selected</span>
              <button
                onClick={onDeselectAll}
                className="text-teal-600 hover:text-teal-800 transition-colors"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 bg-white">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Size'}
                {sortOrder === 'asc' ? ' ↑' : ' ↓'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2">
              <DropdownMenuLabel className="text-sm font-medium text-gray-900 px-2 py-1">
                Sort by
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-2" />
              <div className="space-y-1">
                <DropdownMenuItem
                  onClick={() => onSortChange('date')}
                  className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-3 text-gray-500" />
                      <span className="text-sm">Date Added</span>
                    </div>
                    {sortBy === 'date' && (
                      sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-teal-600" />
                      )
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSortChange('name')}
                  className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-3 text-gray-500" />
                      <span className="text-sm">Name</span>
                    </div>
                    {sortBy === 'name' && (
                      sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-teal-600" />
                      )
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSortChange('size')}
                  className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 hover:text-teal-900 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <HardDrive className="h-4 w-4 mr-3 text-gray-500" />
                      <span className="text-sm">File Size</span>
                    </div>
                    {sortBy === 'size' && (
                      sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4 text-teal-600" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-teal-600" />
                      )
                    )}
                  </div>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter by Type */}
          <TypeFilterDropdown
            selectedTypes={selectedTypes}
            onTypeFilterChange={onTypeFilterChange}
            onClearFilters={onClearFilters}
          />
        </div>
      </div>
    </div>
  )
}

interface TypeFilterDropdownProps {
  selectedTypes: Set<DocumentType>
  onTypeFilterChange: (type: DocumentType) => void
  onClearFilters: () => void
}

function TypeFilterDropdown({
  selectedTypes,
  onTypeFilterChange,
  onClearFilters
}: TypeFilterDropdownProps) {
  const [typeFilterSearch, setTypeFilterSearch] = React.useState('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedTypes.size > 0 ? "default" : "outline"}
          size="sm"
          className={selectedTypes.size > 0 ? "h-9" : "h-9 bg-white"}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filter
          {selectedTypes.size > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-white/20 text-white border-0">
              {selectedTypes.size}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <DropdownMenuLabel className="text-sm font-medium text-gray-900 px-2 py-1">
          Filter by Type
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />

        {/* Search Input */}
        <div className="px-2 pb-2">
          <Input
            placeholder="Search types..."
            value={typeFilterSearch}
            onChange={(e) => setTypeFilterSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1 max-h-96 overflow-y-auto">
          {Object.values(DocumentType)
            .filter((type) =>
              type.toLowerCase().includes(typeFilterSearch.toLowerCase())
            )
            .map((type) => {
              const typeColor = getFileTypeColor(type as DocumentType)
              const isSelected = selectedTypes.has(type as DocumentType)
              const badgeClassName = cn("text-xs px-2 py-0.5", typeColor)
              return (
                <div
                  key={type}
                  onClick={() => onTypeFilterChange(type as DocumentType)}
                  className="cursor-pointer px-2 py-2 rounded-md hover:bg-teal-50 transition-colors duration-150 flex items-center justify-between"
                >
                  <Badge variant="secondary" className={badgeClassName}>
                    {type.toUpperCase()}
                  </Badge>
                  {isSelected && (
                    <Check className="h-4 w-4 text-teal-600" />
                  )}
                </div>
              )
            })}
        </div>
        {selectedTypes.size > 0 && (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              onClick={onClearFilters}
              className="cursor-pointer px-2 py-2 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
