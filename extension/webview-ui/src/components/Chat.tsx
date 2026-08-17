import React, { useEffect, useState, useRef } from "react";
import { vscode } from "../utilities/vscode";
import { IconChevronDown, IconChevronRight, IconSend, IconMessage } from "./icons";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

interface Source {
  eventId: string;
  branch: string;
  timestamp: string;
  feature: string;
  stage: string;
  relevance: number;
  snippet: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'chatResponse') {
        const assistantMessage: Message = {
          role: 'assistant',
          content: message.data.reply,
          timestamp: message.data.timestamp,
          sources: message.data.sources,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setSessionId(message.data.sessionId);
        setIsLoading(false);
      }
      
      if (message.type === 'chatError') {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    vscode.postMessage({
      type: 'sendChatMessage',
      data: {
        message: inputValue.trim(),
        sessionId,
      },
    });

    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setSessionId(null);
  };

  const toggleSource = (index: number) => {
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Ask FlowSync</h2>
        {messages.length > 0 && (
          <button className="btn btn-link btn-sm" onClick={clearConversation}>
            Clear
          </button>
        )}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            {/* currentColor, not var(--vscode-descriptionForeground) — this was
                one of three stray host-theme references left in a webview that
                otherwise ignored the host entirely. */}
            <span className="empty-state-icon">
              <IconMessage size={20} />
            </span>
            <p>Ask anything about your project&apos;s history, decisions, or risks.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="message-group">
            <div className={`message message-${message.role}`}>
              <div className="message-header">
                <strong>{message.role === 'user' ? 'You' : 'FlowSync AI'}</strong>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.content.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>

            {message.sources && message.sources.length > 0 && (
              <div className="message-sources">
                <button
                  className="sources-toggle"
                  onClick={() => toggleSource(index)}
                >
                  {expandedSources.has(index) ? (
                    <IconChevronDown size={12} />
                  ) : (
                    <IconChevronRight size={12} />
                  )}{' '}
                  {message.sources.length} source
                  {message.sources.length !== 1 ? 's' : ''}
                </button>

                {expandedSources.has(index) && (
                  <div className="sources-list">
                    {message.sources.map((source, sourceIndex) => (
                      <div key={sourceIndex} className="source-card">
                        <div className="source-header">
                          <span className="badge">{source.stage}</span>
                          <span className="relevance">
                            {(source.relevance * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <div className="source-feature">{source.feature}</div>
                        <div className="source-snippet">{source.snippet}</div>
                        <div className="source-meta">
                          {source.branch} • {new Date(source.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="message-header">
              <strong>FlowSync AI</strong>
            </div>
            <div className="message-content">
              <span className="spinner" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        <button
          className="btn btn-primary btn-send"
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          aria-label="Send message"
        >
          <IconSend size={15} />
        </button>
      </div>
    </div>
  );
}
