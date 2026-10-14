import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Brain,
  Inbox,
  Sparkles,
  Layers,
  Workflow,
  ShieldCheck,
  Grid,
  Settings,
  UserCheck,
  Activity,
  Play,
  RotateCcw,
  Zap,
  ArrowRight,
  X,
  Radio,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { UserProfile } from '../../types';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenAuth?: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenAuth,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands: CommandItem[] = [
    {
      id: 'nav-chat',
      title: 'Ask AI & Copilot',
      category: 'Navigation',
      icon: <Brain size={16} color="#60a5fa" />,
      action: () => { onNavigate('chat'); onClose(); },
    },
    {
      id: 'nav-inbox',
      title: 'Review Issues & Contradiction Inbox',
      category: 'Navigation',
      icon: <Inbox size={16} color="#fbbf24" />,
      action: () => { onNavigate('inbox'); onClose(); },
    },
    {
      id: 'nav-reviewed',
      title: 'Reviewed Conflicts & Decision History',
      category: 'Navigation',
      icon: <CheckCircle2 size={16} color="#10b981" />,
      action: () => { onNavigate('reviewed'); onClose(); },
    },
    {
      id: 'nav-explore',
      title: 'Explore Verified Knowledge (What We Know)',
      category: 'Navigation',
      icon: <BookOpen size={16} color="#38bdf8" />,
      action: () => { onNavigate('explore'); onClose(); },
    },
    {
      id: 'nav-integrations',
      title: 'Connected Enterprise Apps & Webhooks',
      category: 'Navigation',
      icon: <Grid size={16} color="#10b981" />,
      action: () => { onNavigate('integrations'); onClose(); },
    },
    {
      id: 'nav-settings',
      title: 'Safety Rules & Governance Settings',
      category: 'Navigation',
      icon: <Settings size={16} color="#94a3b8" />,
      action: () => { onNavigate('settings'); onClose(); },
    },
    {
      id: 'action-auth',
      title: 'Manage Identity & Switch Demo Persona',
      category: 'Quick Actions',
      icon: <UserCheck size={16} color="#60a5fa" />,
      action: () => { if (onOpenAuth) onOpenAuth(); onClose(); },
    },
  ];

  const filtered = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, filtered, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
        zIndex: 10000,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="surface-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-surface, #111927)',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            gap: '12px',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted, #94a3b8)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to view..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main, #f1f5f9)',
              fontSize: '15px',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            style={{
              fontSize: '10px',
              color: 'var(--text-dim, #64748b)',
              background: 'var(--bg-surface-sub, #162236)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div
          style={{
            maxHeight: '340px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '13px' }}>
              No commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    background: isSelected ? 'var(--bg-surface-hover, #1c2b44)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'var(--bg-inset, #070a10)',
                        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {cmd.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 550, color: 'var(--text-main, #f1f5f9)' }}>
                        {cmd.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                        {cmd.category}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <ArrowRight size={14} style={{ color: '#38bdf8' }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            background: 'var(--bg-surface-sub, #162236)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-dim, #64748b)',
          }}
        >
          <span>Use ↑ ↓ to navigate</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
};
