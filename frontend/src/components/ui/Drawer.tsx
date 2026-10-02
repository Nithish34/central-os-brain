import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  maxWidth = '680px',
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 9999,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={drawerRef}
        className={`drawer-container animate-slide-left ${className}`}
        style={{
          width: '100%',
          maxWidth,
          height: '100%',
          background: 'var(--bg-surface, #111927)',
          borderLeft: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflowY: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'var(--bg-surface-sub, #162236)',
            flexShrink: 0,
          }}
        >
          <div>
            {eyebrow && <div style={{ marginBottom: '4px' }}>{eyebrow}</div>}
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 650,
                color: 'var(--text-main, #f1f5f9)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close drawer"
            style={{ padding: '6px', color: 'var(--text-muted, #94a3b8)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div
          style={{
            padding: '24px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {children}
        </div>

        {/* Drawer Footer */}
        {footer && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              background: 'var(--bg-surface-sub, #162236)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
