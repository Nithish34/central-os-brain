import './HelpView.view.css';
import React, { useState } from 'react';
import {
  HelpCircle, Search, ChevronDown, ChevronUp, BookOpen, MessageSquare,
  Plug, Command, ArrowRight, ExternalLink, ShieldCheck, Zap
} from 'lucide-react';

interface HelpViewProps {
  onNavigate: (view: string) => void;
}

const FAQ_DATA = [
  {
    q: 'How does Axiom OS ensure Ground Truth answers?',
    a: 'Axiom synthesizes evidence from your connected workplace tools (Slack, Notion, GitHub, Jira, Teams). Every answer is mapped directly to canonical source documents and timestamped facts with clear confidence scores.'
  },
  {
    q: 'How do I connect external tools (Slack, GitHub, Notion)?',
    a: 'Navigate to the Connections tab in your sidebar. Click "Add Connector" or "Configure" on any card (e.g. GitHub, Slack, Notion) and input your workspace credentials or OAuth authorization.'
  },
  {
    q: 'What is the "Review" inbox for?',
    a: 'When contradictory information is detected between two sources (for example, outdated documentation in Notion vs. a newer PR in GitHub), Axiom flags it as a Conflict for human verification in the Review tab.'
  },
  {
    q: 'Can I switch between Light and Dark mode?',
    a: 'Yes! Use the Light and Dark toggle buttons located in the sidebar footer right above your profile card.'
  },
  {
    q: 'Is our organizational data kept secure and private?',
    a: 'All data ingested by Axiom is isolated within your private enterprise perimeter, encrypted at rest and in transit, and strictly adheres to your configured role-based access policies.'
  }
];

const SHORTCUTS = [
  { desc: 'Open Command Palette & Global Search', keys: ['⌘', 'K'] },
  { desc: 'Submit query in Chat / Ask', keys: ['Enter'] },
  { desc: 'New Line in Chat', keys: ['Shift', 'Enter'] },
  { desc: 'Close open modal or drawer', keys: ['Esc'] },
  { desc: 'Navigate to Ask page', keys: ['G', 'A'] },
  { desc: 'Navigate to Review inbox', keys: ['G', 'R'] },
];

export const HelpView: React.FC<HelpViewProps> = ({ onNavigate }) => {
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredFaqs = FAQ_DATA.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="help-view">
      {/* Hero */}
      <div className="help-hero">
        <span className="help-badge">
          <HelpCircle size={13} />
          Help & Support Center
        </span>
        <h1 className="help-title">How can we help you today?</h1>
        <p className="help-sub">
          Find instant answers, learn how to connect your knowledge sources, and discover shortcuts to boost your productivity.
        </p>
        <div className="help-search-box">
          <Search size={18} color="var(--text-dim)" />
          <input
            type="text"
            className="help-search-input"
            placeholder="Search FAQs, features, guides..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 3 Quick Cards */}
      <div className="help-grid-3">
        <div className="help-card">
          <div className="help-card-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <MessageSquare size={20} />
          </div>
          <h3 className="help-card-title">Getting Started with Ask</h3>
          <p className="help-card-desc">
            Learn how to prompt the Company Brain to get direct, cited answers across all company tools.
          </p>
          <button className="help-card-link" onClick={() => onNavigate('chat')}>
            Go to Ask <ArrowRight size={14} />
          </button>
        </div>

        <div className="help-card">
          <div className="help-card-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
            <Plug size={20} />
          </div>
          <h3 className="help-card-title">Connect Workplace Tools</h3>
          <p className="help-card-desc">
            Seamlessly integrate Slack, GitHub, Notion, Jira, and Google Workspace in seconds.
          </p>
          <button className="help-card-link" onClick={() => onNavigate('integrations')}>
            View Connections <ArrowRight size={14} />
          </button>
        </div>

        <div className="help-card">
          <div className="help-card-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
            <Zap size={20} />
          </div>
          <h3 className="help-card-title">Resolve Knowledge Conflicts</h3>
          <p className="help-card-desc">
            Review discrepancies between outdated documents and live discussions in the Review tab.
          </p>
          <button className="help-card-link" onClick={() => onNavigate('inbox')}>
            Go to Review <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* FAQs */}
      <div className="help-section">
        <h2 className="help-section-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="faq-item">
                <button
                  className="faq-trigger"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isOpen && <p className="faq-answer anim-fade-in">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="help-section">
        <h2 className="help-section-title">Keyboard Shortcuts</h2>
        <div className="shortcuts-grid">
          {SHORTCUTS.map((s, idx) => (
            <div key={idx} className="shortcut-item">
              <span className="shortcut-desc">{s.desc}</span>
              <div className="shortcut-keys">
                {s.keys.map((k, kIdx) => (
                  <kbd key={kIdx} className="shortcut-kbd">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
