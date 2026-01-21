import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AutoFocusRegion } from '@/ui/focus/AutoFocusRegion';
import { trapFocusOnTab } from '@/ui/focus/focusUtils';

export interface ModalFrameProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  closeOnOverlayClick?: boolean;
}

export function ModalFrame({
  isOpen,
  title,
  onClose,
  children,
  maxWidth = '500px',
  maxHeight,
  closeOnOverlayClick = true,
}: ModalFrameProps) {
  if (!isOpen) return null;

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const card = cardRef.current;
      if (!card) return;
      // Trap Tab within the modal. (Escape close behavior varies by modal; don't introduce it here.)
      trapFocusOnTab(e, card);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const modal = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={cardRef}
        className="cs-liquid-card"
        style={{
          maxWidth,
          width: '90%',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <AutoFocusRegion active={isOpen}>
          <div style={{ padding: '2rem', paddingBottom: '1rem', flex: '0 0 auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>{title}</h2>
              <button
                onClick={onClose}
                className="cs-liquid-button cs-liquid-button--secondary"
                style={{
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
          <div
            style={{
              padding: '0 2rem 2rem',
              overflowY: maxHeight ? 'auto' : undefined,
              flex: maxHeight ? '1 1 auto' : undefined,
              minHeight: maxHeight ? 0 : undefined,
            }}
          >
            {children}
          </div>
        </AutoFocusRegion>
      </div>
    </div>
  );

  // Render in a portal so it's not clipped/stacked under panels that use overflow/transform.
  return createPortal(modal, document.body);
}

