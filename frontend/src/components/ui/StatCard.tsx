import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  accentColor = '#38bdf8',
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      className={`kpi-card ${onClick ? 'interactive-card' : ''} ${className}`}
      onClick={onClick}
      style={{
        background: 'var(--bg-surface, #111927)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-md, 8px)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-md, 8px)',
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted, #94a3b8)',
            marginBottom: '2px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-main, #f1f5f9)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        {subtext && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-dim, #64748b)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
