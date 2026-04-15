import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

const btnClass =
  'flex items-center justify-center w-8 h-8 rounded-lg bg-background/90 border-[1.5px] border-border text-muted-foreground hover:text-foreground hover:bg-background transition-colors shadow-[1px_2px_0px_0px_rgba(0,0,0,0.06)]';

export function FlowControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div
      className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10"
      style={{ fontFamily: 'var(--font-hand), cursive' }}
    >
      <button onClick={() => zoomIn({ duration: 200 })} className={btnClass} title="Zoom in">
        <ZoomIn className="size-4" />
      </button>
      <button onClick={() => zoomOut({ duration: 200 })} className={btnClass} title="Zoom out">
        <ZoomOut className="size-4" />
      </button>
      <button onClick={() => fitView({ padding: 0.35, duration: 300 })} className={btnClass} title="Fit to view">
        <Maximize className="size-4" />
      </button>
    </div>
  );
}
