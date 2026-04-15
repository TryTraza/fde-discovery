/**
 * SVG definitions for the Excalidraw-like hand-drawn look.
 * - Sketchy filter: feTurbulence + feDisplacementMap to wobble edges
 * - Cross-hatch pattern for the canvas background
 */
export function SketchyDefs() {
  return (
    <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden>
      <defs>
        {/* Sketchy wobble filter — distorts straight edges to look hand-drawn */}
        <filter id="sketchy-filter" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.03"
            numOctaves={3}
            seed={2}
            result="turbulence"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale={1.8}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
