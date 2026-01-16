import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import './slideOutDrawer.css';

export type SlideOutDrawerSide = 'left' | 'right';

export interface SlideOutDrawerProps {
  side: SlideOutDrawerSide;
  label: string;
  isOpen: boolean;
  onOpenChange(next: boolean): void;
  widthPx?: number;
  tabWidthPx?: number;
  tabVariant?: 'secondary' | 'success' | 'warning' | 'danger';
  tabPulseVariant?: 'success' | 'danger' | null;
  zIndex?: number;
  attention?: boolean;
  children: ReactNode;
}

const DEFAULT_WIDTH_PX = 520;
const DEFAULT_TAB_WIDTH_PX = 54;
const DEFAULT_Z_INDEX = 1500;

const DRAG_START_THRESHOLD_PX = 6;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function snapOpenFromTranslate(translatePx: number, closedOffsetPx: number) {
  const closedDistance = Math.abs(closedOffsetPx);
  if (closedDistance === 0) return true;
  const openRatio = 1 - Math.abs(translatePx) / closedDistance;
  return openRatio > 0.5;
}

export function SlideOutDrawer({
  side,
  label,
  isOpen,
  onOpenChange,
  widthPx = DEFAULT_WIDTH_PX,
  tabWidthPx = DEFAULT_TAB_WIDTH_PX,
  tabVariant = 'secondary',
  tabPulseVariant = null,
  zIndex = DEFAULT_Z_INDEX,
  attention = false,
  children,
}: SlideOutDrawerProps) {
  const panelId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [dragTranslatePx, setDragTranslatePx] = useState(0);
  const dragTranslateRef = useRef(0);

  const suppressNextClickRef = useRef(false);

  const pointerRef = useRef<{
    pointerId: number;
    startClientX: number;
    baseTranslatePx: number;
    hasDragged: boolean;
  } | null>(null);

  const closedOffsetPx = useMemo(() => {
    const hidden = Math.max(0, widthPx - tabWidthPx);
    return side === 'left' ? -hidden : hidden;
  }, [side, widthPx, tabWidthPx]);

  const minTranslate = Math.min(0, closedOffsetPx);
  const maxTranslate = Math.max(0, closedOffsetPx);

  const translatePx = isDragging ? dragTranslatePx : isOpen ? 0 : closedOffsetPx;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onOpenChange]);

  // Prevent underlying page scroll while drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onOpenChange(!isOpen);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button for mouse.
    const anyE = e as unknown as { button?: number; pointerId?: number };
    if (typeof anyE.button === 'number' && anyE.button !== 0) return;

    const pid = anyE.pointerId ?? 1;
    e.currentTarget.setPointerCapture?.(pid);

    pointerRef.current = {
      pointerId: pid,
      startClientX: e.clientX,
      baseTranslatePx: isOpen ? 0 : closedOffsetPx,
      hasDragged: false,
    };
    suppressNextClickRef.current = false;
    setIsDragging(false);
    dragTranslateRef.current = isOpen ? 0 : closedOffsetPx;
    setDragTranslatePx(dragTranslateRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const anyE = e as unknown as { pointerId?: number };
    const pid = anyE.pointerId ?? 1;
    if (!pointerRef.current || pointerRef.current.pointerId !== pid) return;

    const deltaX = e.clientX - pointerRef.current.startClientX;
    if (!pointerRef.current.hasDragged && Math.abs(deltaX) >= DRAG_START_THRESHOLD_PX) {
      pointerRef.current.hasDragged = true;
      setIsDragging(true);
    }

    if (!pointerRef.current.hasDragged) return;

    const nextTranslate = clamp(
      pointerRef.current.baseTranslatePx + deltaX,
      minTranslate,
      maxTranslate
    );
    dragTranslateRef.current = nextTranslate;
    setDragTranslatePx(nextTranslate);
  };

  const endPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const anyE = e as unknown as { pointerId?: number };
    const pid = anyE.pointerId ?? 1;
    if (!pointerRef.current || pointerRef.current.pointerId !== pid) return;

    e.currentTarget.releasePointerCapture?.(pid);

    const didDrag = pointerRef.current.hasDragged;
    pointerRef.current = null;

    if (didDrag) {
      suppressNextClickRef.current = true;
      const nextOpen = snapOpenFromTranslate(dragTranslateRef.current, closedOffsetPx);
      onOpenChange(nextOpen);
    }

    setIsDragging(false);
  };

  const rootStyle: React.CSSProperties = {
    width: `${widthPx}px`,
    zIndex,
    transform: `translateX(${translatePx}px)`,
    ['--sod-tab-width' as never]: `${tabWidthPx}px`,
  };

  const rootClasses = [
    'sod-root',
    side === 'left' ? 'sod-left' : 'sod-right',
    isDragging ? 'sod-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tabVariantClass =
    tabVariant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40'
      : tabVariant === 'warning'
        ? 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600/40'
        : tabVariant === 'success'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/40'
          : 'bg-slate-900/80 text-white ring-1 ring-inset ring-slate-700 hover:bg-slate-900 focus-visible:ring-indigo-600/30';

  const tabClasses = [
    'sod-tab',
    side === 'left' ? 'sod-tab--left' : 'sod-tab--right',
    tabPulseVariant ? `er-pulse-${tabPulseVariant}` : '',
    attention ? 'gold-pulse' : '',
    // Button-like styling (touch-first)
    'inline-flex items-center justify-center rounded-md font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    'h-12 px-3',
    tabVariantClass,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {isOpen && (
        <div
          className="sod-backdrop"
          style={{ zIndex: zIndex - 1 }}
          onClick={() => onOpenChange(false)}
          data-testid="slideout-backdrop"
        />
      )}

      <aside className={rootClasses} style={rootStyle}>
        <button
          type="button"
          className={tabClasses}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <span className="sod-tabLabel">{label}</span>
        </button>

        <div
          id={panelId}
          className="sod-panel rounded-xl bg-slate-900/70 text-white ring-1 ring-slate-700"
          role="region"
          aria-label={label}
          hidden={!isOpen && !isDragging}
          aria-hidden={!isOpen && !isDragging}
        >
          {children}
        </div>
      </aside>
    </>
  );
}


