import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  debounceMs?: number;
  shortcutHint?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 0,
  shortcutHint = '/',
  className = '',
  style,
}) => {
  const [internalVal, setInternalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setInternalVal(value);
  }, [value]);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const timer = setTimeout(() => {
      if (internalVal !== value) {
        onChange(internalVal);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [internalVal, debounceMs, onChange, value]);

  // Global hotkey to focus (e.g. '/' when not in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === shortcutHint && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutHint]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalVal(val);
    if (debounceMs <= 0) {
      onChange(val);
    }
  };

  const handleClear = () => {
    setInternalVal('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div
      className={`search-input-root ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-inset, #070a10)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-sm, 6px)',
        padding: '5px 10px',
        gap: '8px',
        width: '100%',
        maxWidth: '360px',
        transition: 'border-color 0.15s ease',
        ...style,
      }}
    >
      <Search size={14} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={internalVal}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-main, #f1f5f9)',
          fontSize: '13px',
          width: '100%',
          fontFamily: 'var(--font-sans)',
        }}
      />
      {internalVal ? (
        <button
          type="button"
          onClick={handleClear}
          title="Clear search"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={13} />
        </button>
      ) : shortcutHint ? (
        <kbd
          style={{
            fontSize: '10px',
            color: 'var(--text-dim, #64748b)',
            background: 'var(--bg-surface-sub, #162236)',
            padding: '1px 5px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {shortcutHint}
        </kbd>
      ) : null}
    </div>
  );
};
