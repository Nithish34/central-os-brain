import React from 'react';

interface ConfidenceMeterProps {
  /** Value between 0 and 1 */
  value: number;
  /** Label shown above the bar (optional) */
  label?: string;
  /** Show numeric percentage beside the label */
  showPercent?: boolean;
  /** Visual size of the meter */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * ConfidenceMeter — a gradient progress bar representing a probability or
 * confidence score.  Intentionally distinct from the pill-style StatusBadge
 * used for binary connection states (connected / disconnected / error).
 *
 * Color gradient:  red (0%) → amber (50%) → green (100%)
 */
export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  value,
  label,
  showPercent = true,
  size = 'md',
  className = '',
}) => {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  const trackHeight = size === 'sm' ? '4px' : size === 'lg' ? '10px' : '6px';
  const fontSize = size === 'sm' ? '10px' : size === 'lg' ? '13px' : '11px';

  // Gradient colour stop at this value: 0→red, 0.5→amber, 1→green
  const getColor = (p: number) => {
    if (p >= 75) return '#10b981'; // green
    if (p >= 45) return '#f59e0b'; // amber
    return '#ef4444';              // red
  };
  const fillColor = getColor(pct);

  return (
    <div className={`confidence-meter ${className}`} style={{ width: '100%' }}>
      {(label || showPercent) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            fontSize,
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          {label && <span>{label}</span>}
          {showPercent && (
            <strong style={{ color: fillColor, fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </strong>
          )}
        </div>
      )}

      {/* Track */}
      <div
        style={{
          width: '100%',
          height: trackHeight,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '9999px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: '9999px',
            background: `linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, ${fillColor} 100%)`,
            backgroundSize: `${Math.max(pct, 1)}% 100%`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
};
