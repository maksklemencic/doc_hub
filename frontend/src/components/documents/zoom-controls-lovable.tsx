import { useState } from "react";
import { Plus, Minus, Maximize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
  className?: string;
}

export function ZoomControls({ className }: ZoomControlsProps) {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleFit = () => setZoom(100);
  const handleReset = () => setZoom(100);

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-1",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-accent"
        onClick={handleZoomIn}
        title="Zoom in"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-accent"
        onClick={handleFit}
        title="Fit to view"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-center justify-center h-7 w-7 text-[10px] font-medium text-muted-foreground">
        {zoom}%
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-accent"
        onClick={handleZoomOut}
        title="Zoom out"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 hover:bg-accent"
        onClick={handleReset}
        title="Reset zoom (1:1)"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
