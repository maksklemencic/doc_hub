import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Maximize2, RotateCcw, Plus, Minus } from 'lucide-react'

interface ZoomControlsProps {
  manualZoomInput: string
  setManualZoomInput: (value: string) => void
  adjustZoom: (delta: number) => void
  setScale: (scale: number) => void
  setIsFitToWidth: (isFit: boolean) => void
  scale: number
  isFitToWidth: boolean
}

export function ZoomControls({
  manualZoomInput,
  setManualZoomInput,
  adjustZoom,
  setScale,
  setIsFitToWidth,
  scale,
  isFitToWidth
}: ZoomControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-0.5 bg-white backdrop-blur-sm rounded-lg border border-gray-200 shadow shadow-secondary p-1 opacity-60 hover:opacity-100">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => adjustZoom(0.1)}
        disabled={!isFitToWidth && scale >= 5.0}
        className="h-7 w-7 hover:bg-secondary hover:text-primary"
        title="Zoom in (10%)"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => adjustZoom(-0.1)}
        disabled={!isFitToWidth && scale <= 0.5}
        className="h-7 w-7 hover:bg-secondary hover:text-primary"
        title="Zoom out (10%)"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      {/* Manual zoom input - bigger text */}
      <div className="flex items-center justify-center h-7 w-7 px-0.5">
        <input
          type="text"
          value={manualZoomInput}
          onChange={(e) => {
            const value = e.target.value
            setManualZoomInput(value)
          }}
          onBlur={() => {
            const numValue = parseInt(manualZoomInput)
            if (!isNaN(numValue) && numValue >= 50 && numValue <= 500) {
              setScale(numValue / 100)
              setIsFitToWidth(false)
            } else {
              setManualZoomInput(isFitToWidth ? 'Fit' : Math.round(scale * 100).toString())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const numValue = parseInt(manualZoomInput)
              if (!isNaN(numValue) && numValue >= 50 && numValue <= 500) {
                setScale(numValue / 100)
                setIsFitToWidth(false)
              } else {
                setManualZoomInput(isFitToWidth ? 'Fit' : Math.round(scale * 100).toString())
              }
              e.currentTarget.blur()
            }
          }}
          className="h-6 w-6 text-[11px] text-center px-0 border-0 bg-transparent focus:outline-none"
        />
      </div>

      <div className="h-px bg-border mx-1" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsFitToWidth(true)
                setManualZoomInput('Fit')
              }}
              className="h-7 w-7 hover:bg-secondary hover:text-primary"
              title="Fit to width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Fit document to container width</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setScale(1.0)
                setManualZoomInput('100')
                setIsFitToWidth(false)
              }}
              className="h-7 w-7 hover:bg-secondary hover:text-primary"
              title="Reset to 100%"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Reset zoom to 100%</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
