import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import LiquidMembraneSurface from './LiquidMembraneSurface';
import { createLiquidMotion, stepLiquidMotion } from './motion';
import './liquid-overlay.css';

export default function useLiquidOverlay({ open, onOpenChange, anchorRef, forwardedRef, placement = 'popper', zIndex = 11000 }) {
  const forwardedRefRef = useRef(forwardedRef);
  forwardedRefRef.current = forwardedRef;
  const id = useId().replace(/:/g, '');
  const [layout, setLayout] = useState(null);
  const [present, setPresent] = useState(false);
  const [contentNode, setContentNode] = useState(null);
  const contentRef = useRef(null);
  const mountContent = useCallback(
    (node) => {
      contentRef.current = node;
      if (typeof forwardedRefRef.current === 'function') forwardedRefRef.current(node);
      else if (forwardedRefRef.current) forwardedRefRef.current.current = node;
      if (node) {
        node.style.setProperty('z-index', String(zIndex + 1), 'important');
        node.style.opacity = '0';
      }
      setContentNode(node);
    },
    [zIndex]
  );
  const surfaceRef = useRef(null);
  const bodyRef = useRef(null);
  const neckRef = useRef(null);
  const dropsRef = useRef(null);
  const motion = useRef(createLiquidMotion());
  const openRef = useRef(open);
  const dismissed = useRef(false);
  const changeRef = useRef(onOpenChange);
  openRef.current = open;
  changeRef.current = onOpenChange;

  const dismiss = useCallback(() => {
    dismissed.current = true;
    openRef.current = false;
    motion.current = createLiquidMotion();
    setPresent(false);
    setLayout(null);
    changeRef.current(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    dismissed.current = false;
    setPresent(true);
    const content = contentNode;
    const anchor = anchorRef.current;
    if (!content || !anchor) return;
    const wrapper = content.parentElement;
    const measure = () => {
      const origin = anchor.getBoundingClientRect();
      // Popper positions its wrapper. Reading it avoids our animated translate
      // feeding back into placement or changing the measured calendar height.
      const measured = placement === 'popper' ? wrapper.getBoundingClientRect() : content.getBoundingClientRect();
      const offset = placement === 'popper' ? 0 : parseFloat(content.style.translate.split(' ')[1]) || 0;
      const rect = {
        left: measured.left,
        top: measured.top - offset,
        width: measured.width,
        height: measured.height,
        bottom: measured.bottom - offset
      };
      if (!rect.width || !rect.height || rect.bottom < 0) return;
      const next = {
        x: origin.x,
        y: origin.y,
        triggerWidth: origin.width,
        triggerHeight: origin.height,
        triggerRadius: Math.min(parseFloat(getComputedStyle(anchor).borderTopLeftRadius) || 8, origin.height / 2),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        upwards: content.dataset.side === 'top' || rect.top + rect.height <= origin.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
      setLayout((current) => (current && Object.keys(next).every((key) => current[key] === next[key]) ? current : next));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(content);
    resize.observe(anchor);
    const observer = new MutationObserver(measure);
    if (placement === 'popper') observer.observe(wrapper, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    return () => {
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, anchorRef, contentNode, placement]);

  useEffect(() => {
    if (!present) return;
    const scroll = (event) => {
      if (!contentRef.current?.contains(event.target)) dismiss();
    };
    window.addEventListener('scroll', scroll, true);
    return () => window.removeEventListener('scroll', scroll, true);
  }, [present, dismiss]);

  useEffect(() => {
    if (!present || !layout) return;
    let frame, previous;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const paint = (time) => {
      const target = openRef.current ? 1 : 0;
      const result = stepLiquidMotion(motion.current, target, layout, previous ? (time - previous) / 1000 : 1 / 60, reduced.matches);
      previous = time;
      const { body, droplets } = result;
      for (const [key, value] of Object.entries({ x: body.x, y: body.y, width: body.width, height: body.height, rx: body.radius })) {
        bodyRef.current?.setAttribute(key, value);
      }
      neckRef.current?.setAttribute('d', result.neck);
      const elements = dropsRef.current?.children || [];
      for (let index = 0; index < elements.length; index++) {
        const drop = droplets[index],
          element = elements[index];
        element.setAttribute('rx', drop?.rx || 0);
        element.setAttribute('ry', drop?.ry || 0);
        if (!drop) continue;
        element.setAttribute('cx', drop.x);
        element.setAttribute('cy', drop.y);
        element.setAttribute('transform', `rotate(${drop.angle} ${drop.x} ${drop.y})`);
      }
      if (contentRef.current) {
        const content = contentRef.current;
        content.style.opacity = String(result.opacity);
        content.style.translate = `0 ${body.y - layout.top}px`;
        content.style.clipPath = `inset(0 ${Math.max(0, (layout.width - body.width) / 2)}px ${Math.max(0, layout.height - body.height)}px round 16px)`;
      }
      if (result.settled) {
        motion.current.progress = target;
        motion.current.velocity = 0;
        if (!target) {
          setPresent(false);
          setLayout(null);
        }
      } else frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [present, layout, open]);

  const surface =
    present && layout
      ? createPortal(
          <div className="liquid-overlay-layer" style={{ zIndex }} aria-hidden="true">
            <LiquidMembraneSurface
              ref={surfaceRef}
              id={id}
              layout={layout}
              bodyRef={bodyRef}
              neckRef={neckRef}
              dropsRef={dropsRef}
              maskTrigger
              className="liquid-overlay-surface"
            />
          </div>,
          document.body
        )
      : null;
  return { surface, mountContent, dismissed, ready: Boolean(layout) };
}
