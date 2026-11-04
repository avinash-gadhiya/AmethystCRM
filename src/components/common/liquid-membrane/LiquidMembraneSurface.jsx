import { forwardRef } from 'react';
import { LIQUID_MATERIAL as material } from './motion';

const alpha = (threshold) => `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${material.contrast} ${-material.contrast * threshold}`;

// Text and interactive content stay outside this filtered surface.
const LiquidMembraneSurface = forwardRef(function LiquidMembraneSurface(
  { id, layout, bodyRef, neckRef, dropsRef, className = '', maskTrigger = false },
  ref
) {
  const trigger = (
    <rect
      x={layout.x}
      y={layout.y}
      width={layout.triggerWidth}
      height={layout.triggerHeight}
      rx={layout.triggerRadius ?? layout.triggerHeight / 2}
    />
  );
  return (
    <svg ref={ref} className={className} width={layout.viewportWidth} height={layout.viewportHeight} aria-hidden="true">
      <defs>
        <filter id={`${id}-membrane`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={material.blur} result="blur" />
          <feColorMatrix in="blur" values={alpha(material.threshold)} result="outer" />
          <feColorMatrix in="blur" values={alpha(material.threshold + (material.rim * 0.8) / material.blur)} result="inner" />
          <feFlood floodColor="var(--membrane-rim)" />
          <feComposite in2="outer" operator="in" result="outline" />
          <feFlood floodColor="var(--membrane-surface)" />
          <feComposite in2="inner" operator="in" result="fill" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="fill" />
          </feMerge>
        </filter>
        {maskTrigger && (
          <mask id={`${id}-anchor-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={layout.viewportWidth} height={layout.viewportHeight}>
            <rect width={layout.viewportWidth} height={layout.viewportHeight} fill="white" />
            <g fill="black">{trigger}</g>
          </mask>
        )}
      </defs>
      <g mask={maskTrigger ? `url(#${id}-anchor-mask)` : undefined}>
        <g filter={`url(#${id}-membrane)`}>
          {trigger}
          <rect ref={bodyRef} x={layout.x + layout.triggerWidth / 2 - 10} y={layout.y + 12} width="20" height="16" rx="12" />
          <path ref={neckRef} />
          <g ref={dropsRef}>
            <ellipse rx="0" ry="0" />
            <ellipse rx="0" ry="0" />
          </g>
        </g>
      </g>
    </svg>
  );
});

export default LiquidMembraneSurface;
