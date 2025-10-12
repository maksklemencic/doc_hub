import { QueryBar } from './query-bar'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  documents?: Array<{ id: string; filename: string }>
  selectedDocumentIds?: string[]
  onDocumentContextChange?: (documentIds: string[]) => void
  spaceName?: string
  className?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  documents = [],
  selectedDocumentIds = [],
  onDocumentContextChange,
  spaceName,
  className
}: ChatInputProps) {
  return (
    <div className="p-4 bg-background flex justify-center">
      <QueryBar
        value={value}
        onChange={onChange}
        onSend={onSend}
        disabled={disabled}
        variant="default"
        className={`relative bg-white border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow w-full max-w-[min(100%,1200px)] ${className || ''}`}
        style={{ width: 'min(100%, 800px)' }}
        documents={documents}
        selectedDocumentIds={selectedDocumentIds}
        onDocumentContextChange={onDocumentContextChange}
        spaceName={spaceName}
      />
    </div>
  )
}
