import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from './ToastContainer';

export interface CodeBlockProps {
  code: string | Record<string, any>;
  language?: string;
  maxHeight?: string;
  collapsible?: boolean;
  initialCollapsed?: boolean;
  title?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'json',
  maxHeight = '280px',
  collapsible = false,
  initialCollapsed = false,
  title,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const { showToast } = useToast();

  const formattedCode =
    typeof code === 'string'
      ? code
      : JSON.stringify(code, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    showToast('Copied payload to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`code-block-root ${className}`}
      style={{
        background: 'var(--bg-inset, #070a10)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-sm, 6px)',
        overflow: 'hidden',
      }}
    >
      {(title || collapsible || true) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px',
            background: 'var(--bg-surface-sub, #162236)',
            borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            fontSize: '11px',
            color: 'var(--text-muted, #94a3b8)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {collapsible && (
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            )}
            <span style={{ fontWeight: 600, color: '#94a3b8' }}>{title || language.toUpperCase()}</span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            style={{
              background: 'none',
              border: 'none',
              color: copied ? '#34d399' : 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      {!isCollapsed && (
        <pre
          style={{
            margin: 0,
            padding: '12px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11.5px',
            lineHeight: 1.5,
            color: '#cbd5e1',
            maxHeight,
            overflowY: 'auto',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          <code>{formattedCode}</code>
        </pre>
      )}
    </div>
  );
};
