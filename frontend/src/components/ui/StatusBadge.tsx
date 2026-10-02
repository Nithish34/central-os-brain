import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral' | 'l0' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  style,
  title,
}) => {
  const getVariantStyles = (): { bg: string; color: string; border: string; dotColor: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          color: '#34d399',
          border: 'rgba(16, 185, 129, 0.3)',
          dotColor: '#10b981',
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          color: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.3)',
          dotColor: '#f59e0b',
        };
      case 'danger':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          color: '#f87171',
          border: 'rgba(239, 68, 68, 0.3)',
          dotColor: '#ef4444',
        };
      case 'info':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          color: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.3)',
          dotColor: '#0284c7',
        };
      case 'ai':
        return {
          bg: 'rgba(139, 92, 246, 0.12)',
          color: '#c084fc',
          border: 'rgba(139, 92, 246, 0.3)',
          dotColor: '#8b5cf6',
        };
      case 'l0':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.35)',
          dotColor: '#f59e0b',
        };
      case 'l2':
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: 'rgba(59, 130, 246, 0.35)',
          dotColor: '#3b82f6',
        };
      case 'l3':
        return {
          bg: 'rgba(139, 92, 246, 0.15)',
          color: '#a78bfa',
          border: 'rgba(139, 92, 246, 0.35)',
          dotColor: '#8b5cf6',
        };
      case 'l4':
        return {
          bg: 'rgba(6, 182, 212, 0.15)',
          color: '#22d3ee',
          border: 'rgba(6, 182, 212, 0.35)',
          dotColor: '#06b6d4',
        };
      case 'l5':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: 'rgba(16, 185, 129, 0.35)',
          dotColor: '#10b981',
        };
      case 'neutral':
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.1)',
          color: '#94a3b8',
          border: 'rgba(255, 255, 255, 0.08)',
          dotColor: '#64748b',
        };
    }
  };

  const getSizeStyles = (): { padding: string; fontSize: string; dotSize: string } => {
    switch (size) {
      case 'sm':
        return { padding: '2px 6px', fontSize: '10.5px', dotSize: '5px' };
      case 'lg':
        return { padding: '5px 12px', fontSize: '13px', dotSize: '8px' };
      case 'md':
      default:
        return { padding: '3px 8px', fontSize: '11.5px', dotSize: '6px' };
    }
  };

  const v = getVariantStyles();
  const s = getSizeStyles();

  return (
    <span
      className={`status-badge-root ${className}`}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: '9999px',
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: s.dotSize,
            height: s.dotSize,
            borderRadius: '50%',
            backgroundColor: v.dotColor,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  );
};
