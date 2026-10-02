import './CommandCenterView.view.css';
import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Plus, Search, Trash2, Copy, Check,
  BookOpen, Edit2, Flag, Sparkles, Paperclip, Mic,
  Compass, Zap, HelpCircle, Gift, MoreHorizontal, ArrowUpRight
} from 'lucide-react';
import { apiService } from '../../services/api';
import { ChatMessage, ChatSession, ChatCitation } from '../../types';
import { useToast } from '../ui/ToastContainer';

interface CommandCenterViewProps {
  onNavigateInbox: () => void;
  onRefreshAll: () => void;
}

// 2x2 Action Cards matching the Script.io reference
const SCRIPT_ACTION_CARDS = [
  {
    icon: '📋',
    colorClass: 'amber',
    label: 'Write copy & policy summaries',
    query: 'Summarize our current company refund and expense policies.',
  },
  {
    icon: '🪄',
    colorClass: 'blue',
    label: 'Query API & tech specs',
    query: 'What were the latest API changes, endpoints, or migrations?',
  },
  {
    icon: '👤',
    colorClass: 'green',
    label: 'Team & onboarding guide',
    query: 'Who handles enterprise customer onboarding and support escalation?',
  },
  {
    icon: '💻',
    colorClass: 'pink',
    label: 'Write code & verify PRs',
    query: 'What are our standard deployment schedules and recent PR merges?',
  },
];

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  onNavigateInbox,
  onRefreshAll,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'thinking' | 'retrieving'>('thinking');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => localStorage.getItem('cbos_active_session') || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [expandedCitationIdx, setExpandedCitationIdx] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) loadSessionHistory(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!loading) return;
    setLoadingPhase('thinking');
    const timer = setTimeout(() => setLoadingPhase('retrieving'), 1500);
    return () => clearTimeout(timer);
  }, [loading]);

  const loadSessions = async () => {
    try {
      const data = await apiService.getChatSessions();
      setSessions(data.sessions || []);
    } catch {
      // fallback
    }
  };

  const loadSessionHistory = async (sessionId: string) => {
    try {
      const data = await apiService.getChatSession(sessionId);
      if (data?.history) {
        setMessages(
          data.history.map((m: any) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
            engine: m.engine,
            sources: m.sources,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputVal.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: query, timestamp: new Date().toISOString() };
    const initialBotMsg: ChatMessage = { role: 'bot', text: '', timestamp: new Date().toISOString(), isStreaming: true };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    if (!textToSend) setInputVal('');
    setLoading(true);

    try {
      await apiService.streamChatMessage(
        { message: query, session_id: activeSessionId },
        (chunkText: string) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = { ...updated[lastIdx], text: updated[lastIdx].text + chunkText, isStreaming: true };
            }
            return updated;
          });
        },
        (data) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: data.full_text || updated[lastIdx].text,
                engine: data.engine,
                sources: data.sources,
                isStreaming: false,
              };
            }
            return updated;
          });

          if (data.session_id && data.session_id !== activeSessionId) {
            setActiveSessionId(data.session_id);
            localStorage.setItem('cbos_active_session', data.session_id);
          }
          loadSessions();

          if (['approve', 'reject', 'reopen', 'reset'].some((kw) => query.toLowerCase().includes(kw))) {
            onRefreshAll();
          }
          setLoading(false);
        },
        (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = { ...updated[lastIdx], text: `⚠️ Something went wrong: ${err.message}`, isStreaming: false };
            }
            return updated;
          });
          setLoading(false);
        }
      );
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: `⚠️ Could not reach the server. Please try again.`, timestamp: new Date().toISOString() },
      ]);
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    showToast('Response copied!', 'info');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFlagConflict = (_msgText: string) => {
    showToast('⚑ Flagged — navigate to Review to add details.', 'warning');
    onNavigateInbox();
  };

  const handleNewChat = async () => {
    try {
      const res = await apiService.createChatSession('New Conversation');
      setActiveSessionId(res.session_id);
      localStorage.setItem('cbos_active_session', res.session_id);
      setMessages([]);
      loadSessions();
      showToast('Started a new conversation', 'info');
    } catch {
      setActiveSessionId(null);
      localStorage.removeItem('cbos_active_session');
      setMessages([]);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await apiService.deleteChatSession(sid);
      if (activeSessionId === sid) {
        setActiveSessionId(null);
        localStorage.removeItem('cbos_active_session');
        setMessages([]);
      }
      loadSessions();
      showToast('Conversation deleted', 'info');
    } catch {
      showToast('Failed to delete conversation', 'error');
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) return <h4 key={idx} className="cc-md-h3">{line.replace('### ', '')}</h4>;
      if (line.startsWith('## ')) return <h3 key={idx} className="cc-md-h2">{line.replace('## ', '')}</h3>;
      if (line.startsWith('# ')) return <h2 key={idx} className="cc-md-h1">{line.replace('# ', '')}</h2>;
      if (/^[-•*]\s/.test(line)) {
        return <li key={idx} className="cc-md-li"><span dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^[-•*]\s+/, '')) }} /></li>;
      }
      if (line.startsWith('> ')) return <blockquote key={idx} className="cc-md-quote"><span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} /></blockquote>;
      if (line.trim() === '---') return <hr key={idx} className="cc-md-hr" />;
      if (!line.trim()) return <div key={idx} className="cc-md-gap" />;
      return <p key={idx} className="cc-md-p"><span dangerouslySetInnerHTML={{ __html: formatInline(line) }} /></p>;
    });
  };

  const formatInline = (str: string) =>
    str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="cc-md-code">$1</code>');

  const buildInlineAttribution = (cit: ChatCitation): string => {
    const source = cit.source || 'an internal source';
    const owner = cit.owner;
    if (owner) return `From ${source} (by ${owner})`;
    return `From ${source}`;
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="view-container cc-view">
      {/* ── Top Header matching reference ── */}
      <header className="cc-top-header">
        <div className="cc-header-left">
          <h1 className="cc-header-title">AI Chat</h1>
        </div>
        <div className="cc-header-right">
          <button className="cc-upgrade-btn" onClick={() => showToast('Enterprise Pro Plan active', 'info')}>
            <Zap size={13} />
            <span>Upgrade</span>
          </button>
          <button className="cc-icon-btn" title="Help" onClick={() => showToast('Press ⌘K or view Help in sidebar', 'info')}>
            <HelpCircle size={15} />
          </button>
          <button className="cc-icon-btn" title="Rewards & Perks" onClick={() => showToast('Axiom AI v2.0 activated', 'info')}>
            <Gift size={15} />
          </button>
        </div>
      </header>

      {/* ── Layout Grid: Center Chat Canvas + Right Projects Rail ── */}
      <div className="cc-layout-grid">
        {/* Main Chat Canvas */}
        <div className="cc-chat-canvas">
          <div className="cc-chat-scroll-area">
            {isEmpty ? (
              /* ── Empty State Hero + 2x2 Action Cards ── */
              <div className="cc-hero-wrap anim-fade-in">
                <h2 className="cc-hero-title">Welcome to Axiom</h2>
                <p className="cc-hero-sub">
                  Get started by asking a question or selecting a task and Chat will do the rest. Not sure where to start?
                </p>

                <div className="cc-action-cards-grid">
                  {SCRIPT_ACTION_CARDS.map((card) => (
                    <button
                      key={card.label}
                      className="cc-action-card"
                      onClick={() => handleSend(card.query)}
                    >
                      <div className="cc-action-card-left">
                        <span className={`cc-action-chip-icon ${card.colorClass}`}>
                          {card.icon}
                        </span>
                        <span className="cc-action-card-label">{card.label}</span>
                      </div>
                      <span className="cc-action-plus">+</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Messages Thread ── */
              messages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble-wrap ${msg.role}`}>
                  <div className="chat-avatar-icon">
                    {msg.role === 'user' ? '👤' : '✦'}
                  </div>
                  <div className="chat-bubble">
                    {renderMarkdown(msg.text)}

                    {msg.isStreaming && <span className="cc-streaming-cursor" />}

                    {/* Inline citation attribution */}
                    {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                      <div className="chat-citations-box">
                        <div className="rag-citations-label">
                          <BookOpen size={12} />
                          <span>Sources ({msg.sources.length})</span>
                        </div>
                        <div className="rag-citations-list">
                          {msg.sources.map((cit: ChatCitation, citIdx: number) => {
                            const citKey = `${idx}-${citIdx}`;
                            const isExpanded = expandedCitationIdx === citKey;
                            return (
                              <div
                                key={citIdx}
                                className={`rag-citation-chip ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => setExpandedCitationIdx(isExpanded ? null : citKey)}
                              >
                                <div className="rag-citation-head">
                                  <span className="rag-citation-attribution">
                                    {buildInlineAttribution(cit)}
                                  </span>
                                  <span className="rag-citation-expand-hint">
                                    {isExpanded ? 'Less' : 'Details'}
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div className="rag-citation-detail anim-fade-in">
                                    <div className="rag-citation-detail-title">{cit.title}</div>
                                    {cit.snippet && (
                                      <div className="rag-citation-snippet">"{cit.snippet}"</div>
                                    )}
                                    <div className="rag-citation-score-row">
                                      Relevance: <strong>{Math.round((cit.score || 0.85) * 100)}%</strong>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="chat-meta-bar">
                      <span>
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="chat-meta-actions">
                        {msg.role === 'bot' && !msg.isStreaming && (
                          <>
                            <button
                              className={`chat-copy-btn ${copiedIndex === idx ? 'copied' : ''}`}
                              onClick={() => handleCopy(msg.text, idx)}
                              title="Copy response"
                            >
                              {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                              className="chat-flag-btn"
                              onClick={() => handleFlagConflict(msg.text)}
                              title="Flag contradictory information for review"
                            >
                              <Flag size={12} />
                              <span>Flag conflict</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Loading indicator */}
            {loading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="chat-bubble-wrap bot anim-fade-in">
                <div className="chat-avatar-icon">✦</div>
                <div className="chat-bubble cc-loading-bubble">
                  <span className="cc-loading-dot-pulse" />
                  <span className="cc-loading-phase-text">
                    {loadingPhase === 'thinking' ? 'Thinking…' : 'Retrieving evidence…'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Contained Floating Input Area ── */}
          <div className="cc-input-container">
            <div className="cc-floating-input-box">
              <div className="cc-input-main-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="cc-chat-input"
                  placeholder="Summarize the latest policies or ask a question..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  className={`cc-send-action-btn ${inputVal.trim() ? 'active' : ''}`}
                  onClick={() => handleSend()}
                  disabled={!inputVal.trim() || loading}
                  title="Send message"
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Sub-actions toolbar row */}
              <div className="cc-input-toolbar-row">
                <div className="cc-toolbar-left">
                  <button
                    className="cc-toolbar-btn"
                    onClick={() => showToast('File attachment available in Connections', 'info')}
                  >
                    <Paperclip size={13} />
                    <span>Attach</span>
                  </button>
                  <button
                    className="cc-toolbar-btn"
                    onClick={() => showToast('Voice search listening...', 'info')}
                  >
                    <Mic size={13} />
                    <span>Voice Message</span>
                  </button>
                  <button
                    className="cc-toolbar-btn"
                    onClick={() => setInputVal('What is our current refund policy?')}
                  >
                    <Compass size={13} />
                    <span>Browse Prompts</span>
                  </button>
                </div>
                <div className="cc-toolbar-right">
                  <span className="cc-char-counter">{inputVal.length} / 3,000</span>
                </div>
              </div>
            </div>

            <p className="cc-disclaimer-text">
              Axiom may generate inaccurate information about people, places, or facts. Model: Axiom Ground Truth v2.0
            </p>
          </div>
        </div>

        {/* ── Right Projects / History Rail ── */}
        <aside className="cc-projects-rail">
          <div className="cc-projects-header">
            <span className="cc-projects-title">Projects ({sessions.length})</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="cc-icon-btn" onClick={handleNewChat} title="New Project Chat" style={{ width: '26px', height: '26px' }}>
                <Plus size={13} />
              </button>
              <button className="cc-icon-btn" title="Options" style={{ width: '26px', height: '26px' }}>
                <MoreHorizontal size={13} />
              </button>
            </div>
          </div>

          <div className="cc-projects-list">
            {filteredSessions.length > 0 ? (
              filteredSessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`cc-project-card ${activeSessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSessionId(s.session_id);
                    localStorage.setItem('cbos_active_session', s.session_id);
                  }}
                >
                  <div className="cc-project-card-info">
                    <span className="cc-project-card-title">{s.title || 'Untitled Chat'}</span>
                    <span className="cc-project-card-sub">{s.message_count || 1} messages</span>
                  </div>
                  <button
                    className="cc-item-btn"
                    onClick={(e) => handleDeleteSession(e, s.session_id)}
                    title="Delete"
                    style={{ opacity: 0.6 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                No past chats yet. Start a new query!
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
export default CommandCenterView;
