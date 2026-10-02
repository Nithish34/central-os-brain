import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, Check, RefreshCw } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          btnBg: '#ef4444',
          btnColor: '#ffffff',
          iconColor: '#ef4444',
          iconBg: 'rgba(239, 68, 68, 0.12)',
        };
      case 'warning':
        return {
          btnBg: '#f59e0b',
          btnColor: '#0b0f17',
          iconColor: '#f59e0b',
          iconBg: 'rgba(245, 158, 11, 0.12)',
        };
      case 'primary':
      default:
        return {
          btnBg: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)',
          btnColor: '#ffffff',
          iconColor: '#38bdf8',
          iconBg: 'rgba(56, 189, 248, 0.12)',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="surface-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          background: 'var(--bg-surface, #111927)',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: v.iconBg,
              color: v.iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="confirm-dialog-title" style={{ fontSize: '16px', fontWeight: 650, color: 'var(--text-main, #f1f5f9)' }}>
                {title}
              </h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                style={{ padding: '2px', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)', marginTop: '8px', lineHeight: 1.5 }}>
              {description}
            </p>

            {children && <div style={{ marginTop: '14px' }}>{children}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={isLoading}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                className="btn"
                onClick={onConfirm}
                disabled={isLoading}
                style={{
                  background: v.btnBg,
                  color: v.btnColor,
                  border: 'none',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="anim-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>{confirmLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
