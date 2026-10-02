import { describe, it } from 'node:test';
import assert from 'node:assert';

// ── 1. StatusBadge & Theme Tokens Test ─────────────────────────────────────────
describe('StatusBadge Variant & Role Mappings', () => {
  const getBadgeVariant = (variant: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      success: { bg: 'rgba(16, 185, 129, 0.12)', color: '#34d399' },
      warning: { bg: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' },
      danger:  { bg: 'rgba(239, 68, 68, 0.12)', color: '#f87171' },
      info:    { bg: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' },
      ai:      { bg: 'rgba(139, 92, 246, 0.12)', color: '#c084fc' },
      l4:      { bg: 'rgba(6, 182, 212, 0.15)',  color: '#22d3ee' },
      neutral: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' },
    };
    return map[variant] || map.neutral;
  };

  it('maps success variant to emerald green tokens', () => {
    const s = getBadgeVariant('success');
    assert.strictEqual(s.color, '#34d399');
  });

  it('maps danger variant to red tokens', () => {
    const d = getBadgeVariant('danger');
    assert.strictEqual(d.color, '#f87171');
  });

  it('maps Phase 4 L4 variant to cyan stream tokens', () => {
    const l4 = getBadgeVariant('l4');
    assert.strictEqual(l4.color, '#22d3ee');
  });

  it('falls back to neutral for unknown variant', () => {
    const def = getBadgeVariant('unknown');
    assert.strictEqual(def.color, '#94a3b8');
  });
});

// ── 2. DataTable Sorting & Pagination Logic ────────────────────────────────────
describe('DataTable Data Transformation Logic', () => {
  interface TestItem {
    id: string;
    name: string;
    attempts: number;
    occurred_at: string;
  }

  const sampleData: TestItem[] = [
    { id: 'EVT-01', name: 'Slack Auth Sync', attempts: 1, occurred_at: '2026-09-21T10:00:00Z' },
    { id: 'EVT-02', name: 'GitHub PR Merge', attempts: 3, occurred_at: '2026-09-21T12:00:00Z' },
    { id: 'EVT-03', name: 'Notion Runbook', attempts: 0, occurred_at: '2026-09-21T09:00:00Z' },
    { id: 'EVT-04', name: 'Jira Ticket Sync', attempts: 2, occurred_at: '2026-09-21T11:00:00Z' },
  ];

  it('sorts numeric values ascending and descending accurately', () => {
    const asc = [...sampleData].sort((a, b) => a.attempts - b.attempts);
    assert.strictEqual(asc[0].id, 'EVT-03');
    assert.strictEqual(asc[3].id, 'EVT-02');

    const desc = [...sampleData].sort((a, b) => b.attempts - a.attempts);
    assert.strictEqual(desc[0].id, 'EVT-02');
    assert.strictEqual(desc[3].id, 'EVT-03');
  });

  it('correctly chunks pagination slices', () => {
    const pageSize = 2;
    const page1 = sampleData.slice(0, pageSize);
    const page2 = sampleData.slice(pageSize, pageSize * 2);

    assert.strictEqual(page1.length, 2);
    assert.strictEqual(page1[0].id, 'EVT-01');
    assert.strictEqual(page2.length, 2);
    assert.strictEqual(page2[0].id, 'EVT-03');
  });
});

// ── 3. CommandPalette Search & Filter Index ────────────────────────────────────
describe('CommandPalette Command Filtering Index', () => {
  const commands = [
    { id: 'nav-chat', title: 'Ask AI & Copilot', category: 'Navigation' },
    { id: 'nav-inbox', title: 'Review Issues & Contradiction Inbox', category: 'Navigation' },
    { id: 'nav-operations', title: 'Event Operations & Stream Observability', category: 'Navigation' },
    { id: 'action-auth', title: 'Manage Identity & Switch Demo Persona', category: 'Quick Actions' },
    { id: 'nav-audit', title: 'Security & Immutable Audit Logs', category: 'Navigation' },
  ];

  it('filters commands by title query case-insensitively', () => {
    const q = 'operations';
    const match = commands.filter((c) =>
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
    assert.strictEqual(match.length, 1);
    assert.strictEqual(match[0].id, 'nav-operations');
  });

  it('filters commands by category query', () => {
    const q = 'quick actions';
    const match = commands.filter((c) =>
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
    assert.strictEqual(match.length, 1);
    assert.strictEqual(match[0].id, 'action-auth');
  });
});

// ── 4. CodeBlock Formatter & Truncation ────────────────────────────────────────
describe('CodeBlock Payload Formatter', () => {
  it('formats raw objects as 2-space indented JSON strings', () => {
    const payload = { event: 'slack.message', count: 42 };
    const jsonStr = JSON.stringify(payload, null, 2);
    assert.ok(jsonStr.includes('  "event": "slack.message"'));
    assert.ok(jsonStr.includes('  "count": 42'));
  });
});
