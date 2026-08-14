import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Maximize2, BookOpen } from 'lucide-react';
import { apiService } from '../../services/api';
import { ChatMessage, ChatCitation } from '../../types';

interface FloatingChatWidgetProps {
  currentView: string;
  onOpenFullChat: () => void;
  onRefreshAll: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  currentView,
  onOpenFullChat,
  onRefreshAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      text: "👋 Hi! I'm your **Company Brain OS** intelligence copilot. Ask me about detected conflicts, live pipeline events, or trigger automated workflows!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Hide widget if already on full-screen chat view
  if (currentView === 'chat') return null;

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputVal.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text,
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
        { message: text },
        // onChunk
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
        // onDone
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

          if (
            text.toLowerCase().includes('approve') ||
            text.toLowerCase().includes('reject') ||
            text.toLowerCase().includes('reopen')
          ) {
            onRefreshAll();
          }
          setLoading(false);
        },
        // onError
        (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: `⚠️ **Error:** ${err.message}`,
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

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="floating-assistant-fab"
        onClick={() => setIsOpen(!isOpen)}
        title="Ask Company Brain OS"
      >
        <Sparkles size={16} />
        <span>Ask Brain</span>
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="floating-chat-drawer">
          {/* Header */}
          <div className="cc-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🧠</span>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Company Brain Assistant</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenFullChat();
                }}
                className="btn btn-ghost"
                style={{ padding: '4px 6px' }}
                title="Expand to Full Screen"
              >
                <Maximize2 size={13} />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost"
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className="cc-chat-messages" style={{ padding: '14px', gap: '10px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble-wrap ${msg.role}`} style={{ maxWidth: '95%' }}>
                <div className="chat-avatar-icon" style={{ width: '26px', height: '26px', fontSize: '11px' }}>
                  {msg.role === 'user' ? '👤' : '🧠'}
                </div>
                <div className="chat-bubble" style={{ padding: '8px 12px', fontSize: '12px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                    {msg.isStreaming && (
                      <span style={{ display: 'inline-block', width: '5px', height: '12px', background: '#3b82f6', marginLeft: '3px', verticalAlign: 'middle', animation: 'pulse 0.8s infinite' }}></span>
                    )}
                  </p>

                  {/* Citations chip */}
                  {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={10} />
                      <span>{msg.sources.length} RAG sources cited</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="chat-bubble-wrap bot">
                <div className="chat-avatar-icon" style={{ width: '26px', height: '26px', fontSize: '11px' }}>🧠</div>
                <div className="chat-bubble" style={{ padding: '8px 12px', fontSize: '12px' }}>
                  Reasoning…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div className="chat-suggestions-matrix" style={{ padding: '6px 12px' }}>
            <button className="suggestion-chip" onClick={() => handleSend('Show open conflicts')}>
              📋 Open conflicts
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('Approve first conflict')}>
              ✅ Approve first
            </button>
            <button className="suggestion-chip" onClick={() => handleSend('System summary')}>
              📊 Summary
            </button>
          </div>

          {/* Input Bar */}
          <div className="cc-chat-input-bar" style={{ padding: '10px 14px' }}>
            <div className="cc-input-box">
              <input
                type="text"
                className="cc-input-field"
                placeholder="Ask or command…"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || loading}
                style={{ padding: '4px 10px' }}
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
