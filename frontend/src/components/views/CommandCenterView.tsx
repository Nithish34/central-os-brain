import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Search, Trash2, Copy, Check, Sparkles, Inbox, Edit2, BookOpen, ExternalLink } from 'lucide-react';
import { apiService } from '../../services/api';
import { ChatMessage, ChatSession, ChatCitation } from '../../types';
import { useToast } from '../ui/ToastContainer';
import { AnimatedBrainWelcome } from '../chat/AnimatedBrainWelcome';

interface CommandCenterViewProps {
  onNavigateInbox: () => void;
  onRefreshAll: () => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({ onNavigateInbox, onRefreshAll }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('cbos_active_session') || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [expandedCitationIdx, setExpandedCitationIdx] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, loading]);

  useEffect(() => {
    loadSessions();
  }, []);

  // When activeSessionId changes, load full session history from DB
  useEffect(() => {
    if (activeSessionId) {
      loadSessionHistory(activeSessionId);
    }
  }, [activeSessionId]);

  const loadSessions = async () => {
    try {
      const data = await apiService.getChatSessions();
      setSessions(data.sessions || []);
    } catch {
      // Fallback
    }
  };

  const loadSessionHistory = async (sessionId: string) => {
    try {
      const data = await apiService.getChatSession(sessionId);
      if (data && data.history) {
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

    const userMsg: ChatMessage = {
      role: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    const initialBotMsg: ChatMessage = {
      role: 'bot',
      text: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    if (!textToSend) setInputVal('');
    setLoading(true);

    try {
      await apiService.streamChatMessage(
        {
          message: query,
          session_id: activeSessionId,
        },
        // onChunk: token update
        (chunkText: string) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: updated[lastIdx].text + chunkText,
                isStreaming: true,
              };
            }
            return updated;
          });
        },
        // onDone: finalized response
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

          // Refresh domain if action taken
          if (
            query.toLowerCase().includes('approve') ||
            query.toLowerCase().includes('reject') ||
            query.toLowerCase().includes('reopen') ||
            query.toLowerCase().includes('reset')
          ) {
            onRefreshAll();
          }
          setLoading(false);
        },
        // onError: fallback error message
        (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: `⚠️ **Error communicating with AI engine:** ${err.message}`,
                isStreaming: false,
              };
            }
            return updated;
          });
          setLoading(false);
        }
      );
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: `⚠️ **Error:** ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    showToast('📋 Response copied to clipboard!', 'info');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleNewChat = async () => {
    try {
      const res = await apiService.createChatSession('New Conversation');
      setActiveSessionId(res.session_id);
      localStorage.setItem('cbos_active_session', res.session_id);
      setMessages([]);
      loadSessions();
      showToast('✨ Started new persistent conversation', 'info');
    } catch {
      setActiveSessionId(null);
      localStorage.removeItem('cbos_active_session');
      setMessages([]);
    }
  };

  const handleClear = () => {
    setMessages([]);
    showToast('🗑️ Cleared conversation stream', 'info');
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
      showToast('🗑️ Conversation deleted from DB', 'info');
    } catch (err) {
      showToast('Failed to delete session', 'error');
    }
  };

  const handleStartRename = (e: React.MouseEvent, s: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(s.session_id);
    setEditTitleVal(s.title);
  };

  const handleSaveRename = async (sid: string) => {
    if (!editTitleVal.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await apiService.renameChatSession(sid, editTitleVal.trim());
      setEditingSessionId(null);
      loadSessions();
      showToast('✏️ Conversation renamed', 'info');
    } catch {
      showToast('Failed to rename conversation', 'error');
    }
  };

  const renderMarkdown = (text: string) => {
    const parts = text.split('\n');
    return parts.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ margin: '8px 0 4px', color: '#93c5fd' }}>{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} style={{ margin: '10px 0 4px', color: '#60a5fa' }}>{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} style={{ margin: '12px 0 6px', color: '#3b82f6' }}>{line.replace('# ', '')}</h2>;
      }
      if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
        const itemText = line.replace(/^[-•*]\s+/, '');
        return (
          <li key={idx} style={{ marginLeft: '18px', marginBottom: '3px' }}>
            <span dangerouslySetInnerHTML={{ __html: formatInline(itemText) }} />
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '10px', margin: '6px 0', opacity: 0.9, fontStyle: 'italic' }}>
            <span dangerouslySetInnerHTML={{ __html: formatInline(line.replace('> ', '')) }} />
          </blockquote>
        );
      }
      if (line.trim() === '---') {
        return <hr key={idx} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />;
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      return (
        <p key={idx} style={{ marginBottom: '4px' }}>
          <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        </p>
      );
    });
  };

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:2px 5px;border-radius:4px;font-family:monospace;color:#93c5fd;font-size:12px;">$1</code>');
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="view-container">
      <div className="command-center-layout">
        {/* ── Left Sessions Drawer ── */}
        <aside className="cc-sessions-drawer">
          <div className="cc-sessions-top">
            <button className="btn btn-primary" onClick={handleNewChat} style={{ width: '100%' }}>
              <Plus size={15} />
              <span>New Conversation</span>
            </button>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="cc-search-input"
                placeholder="Search history…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={13} style={{ position: 'absolute', right: '10px', top: '9px', opacity: 0.5 }} />
            </div>
          </div>

          <div className="cc-sessions-list">
            {filteredSessions.length > 0 ? (
              filteredSessions.map((s) => (
                <div
                  key={s.session_id}
                  className={`cc-session-item ${activeSessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSessionId(s.session_id);
                    localStorage.setItem('cbos_active_session', s.session_id);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  {editingSessionId === s.session_id ? (
                    <input
                      type="text"
                      value={editTitleVal}
                      autoFocus
                      onChange={(e) => setEditTitleVal(e.target.value)}
                      onBlur={() => handleSaveRename(s.session_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(s.session_id);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid #3b82f6',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        padding: '2px 6px',
                        width: '80%',
                      }}
                    />
                  ) : (
                    <span className="cc-session-title" title={s.title}>{s.title}</span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="badge" style={{ fontSize: '9px', padding: '1px 5px' }}>
                      {s.message_count}
                    </span>
                    <button
                      onClick={(e) => handleStartRename(e, s)}
                      title="Rename"
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.session_id)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11.5px' }}>
                {searchQuery ? 'No matching chats' : 'Active Session Live'}
              </div>
            )}
          </div>

          <div className="cc-sessions-footer">
            <span style={{ display: 'flex', alignContent: 'center', gap: '6px' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span> SQLite Persisted Store
            </span>
            <span>Admin RBAC</span>
          </div>
        </aside>

        {/* ── Main Chat Stream Canvas ── */}
        <div className="cc-main-chat">
          <div className="cc-chat-header">
            <div className="cc-chat-header-title">
              <span style={{ fontSize: '18px' }}>🧠</span>
              <div>
                <strong>Autonomous Intelligence Copilot</strong>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  Connected to L0 Execution · L2 Hybrid RAG · L3 Ingestion Pipeline
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-ghost" onClick={handleClear} title="Clear stream messages">
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
              <button className="btn btn-ghost" onClick={onNavigateInbox} title="Jump to Conflict Inbox">
                <Inbox size={13} />
                <span>Inbox</span>
              </button>
            </div>
          </div>

          {/* Message Stream or Animated Brain Welcome */}
          <div className="cc-chat-messages">
            {messages.length === 0 && !loading ? (
              <AnimatedBrainWelcome onQuickPrompt={(p: string) => handleSend(p)} />
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble-wrap ${msg.role}`}>
                  <div className="chat-avatar-icon">{msg.role === 'user' ? '👤' : '🧠'}</div>
                  <div className="chat-bubble">
                    {renderMarkdown(msg.text)}

                    {msg.isStreaming && (
                      <span className="streaming-cursor" style={{ display: 'inline-block', width: '6px', height: '14px', background: '#3b82f6', marginLeft: '4px', verticalAlign: 'middle', animation: 'pulse 0.8s infinite' }}></span>
                    )}

                    {/* Hybrid RAG Sources / Citations Card */}
                    {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                      <div className="chat-citations-box" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                          <BookOpen size={12} />
                          <span>GROUNDED RAG CITATIONS &amp; EVIDENCE ({msg.sources.length})</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {msg.sources.map((cit: ChatCitation, citIdx: number) => {
                            const citKey = `${idx}-${citIdx}`;
                            const isExpanded = expandedCitationIdx === citKey;
                            return (
                              <div
                                key={citIdx}
                                onClick={() => setExpandedCitationIdx(isExpanded ? null : citKey)}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ fontWeight: 600, color: '#60a5fa' }}>{cit.title}</span>
                                  <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 700 }}>
                                    {Math.round((cit.score || 0.85) * 100)}% Match
                                  </span>
                                </div>
                                {isExpanded && cit.snippet && (
                                  <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '10.5px', fontStyle: 'italic', borderLeft: '2px solid #3b82f6', paddingLeft: '6px' }}>
                                    "{cit.snippet}"
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
                        {msg.role === 'bot' && msg.engine ? `Engine: ${msg.engine}` : 'User Prompt'} ·{' '}
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {msg.role === 'bot' && !msg.isStreaming && (
                        <button
                          onClick={() => handleCopy(msg.text, idx)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}
                        >
                          {copiedIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {loading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="chat-bubble-wrap bot anim-fade-in">
                <div className="chat-avatar-icon">🧠</div>
                <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} className="anim-spin" style={{ animation: 'spin 1s linear infinite', color: '#60a5fa' }} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Company Brain is retrieving RAG evidence &amp; compiling stream…
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions Matrix */}
          <div className="chat-suggestions-matrix">
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              ⚡ Actions:
            </span>
            <button className="suggestion-chip" onClick={() => handleSend('Approve all open conflicts')}>
              ✅ Approve all open
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Approve the first conflict')}>
              ✅ Approve first
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Reject the first conflict')}>
              ❌ Reject first
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Reopen the third conflict')}>
              🟠 Reopen third
            </button>

            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginLeft: '6px' }}>
              🔍 Queries:
            </span>
            <button className="suggestion-chip" onClick={() => handleSend('Show me all open conflicts')}>
              📋 Open conflicts
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Explain the first conflict in detail')}>
              🔬 Detail 1st conflict
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Show recent pipeline events')}>
              ⚙️ Pipeline events
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Who approved the last conflict?')}>
              📑 Audit log
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Give me a system summary')}>
              📊 System overview
            </button>
          </div>

          {/* Chat Input Bar */}
          <div className="cc-chat-input-bar">
            <div className="cc-input-box">
              <input
                type="text"
                className="cc-input-field"
                placeholder="Ask anything or command actions (e.g., 'Approve first conflict', 'What events arrived from Slack?')…"
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
                className="btn btn-primary"
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || loading}
                style={{ padding: '6px 14px' }}
              >
                <span>Send</span>
                <Send size={13} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', padding: '0 4px' }}>
              <span>↵ Press <strong>Enter</strong> to stream · SQLite/Postgres DB persistent history</span>
              <span>Enterprise RBAC: <strong>Full Admin Execution Authority</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
