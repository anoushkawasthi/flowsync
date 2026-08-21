'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { sendChatMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { SessionRail } from '@/components/chat/SessionRail';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { SourcePanel } from '@/components/chat/SourcePanel';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { CustomContext } from '@/components/chat/CustomContext';
import { generateTitle, type ChatMessage, type ChatSession } from '@/components/chat/types';
import { MessageSquare, Trash2, History, Bot } from 'lucide-react';

/**
 * Orchestration only. The page was 942 lines with the session rail, the source
 * cards, the composer, and ~20 inline ReactMarkdown overrides all inlined; each
 * of those now lives in components/chat/.
 */
export default function ChatPage() {
  const { config } = useAppContext();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [contextValue, setContextValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const storageKey = `chat-sessions-${config.projectId}`;

  // Load sessions, migrating any titles that predate generateTitle().
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ChatSession[];
      let needsUpdate = false;
      const migrated = parsed.map((session) => {
        if (session.messages.length > 0 && session.title !== 'New Chat') {
          const firstUserMessage = session.messages.find((m) => m.role === 'user')?.content;
          if (firstUserMessage) {
            const next = generateTitle(firstUserMessage);
            if (next !== session.title) {
              needsUpdate = true;
              return { ...session, title: next };
            }
          }
        }
        return session;
      });

      setSessions(migrated);
      if (needsUpdate) localStorage.setItem(storageKey, JSON.stringify(migrated));

      if (migrated.length > 0) {
        const latest = migrated[0];
        setCurrentSessionId(latest.id);
        setMessages(latest.messages);
        setContextValue(latest.context || '');
      }
    } catch (e) {
      console.error('Error loading chat sessions:', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    }
  }, [sessions, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const closeRailOnMobile = () => {
    if (window.innerWidth < 768) setRailOpen(false);
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      context: '',
      backendSessionId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setContextValue('');
    setError(null);
    closeRailOnMobile();
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    setCurrentSessionId(sessionId);
    setMessages(session.messages);
    setContextValue(session.context || '');
    setEditingContext(false);
    setError(null);
    closeRailOnMobile();
  };

  const deleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (sessionId === currentSessionId) {
        if (filtered.length > 0) {
          setCurrentSessionId(filtered[0].id);
          setMessages(filtered[0].messages);
          setContextValue(filtered[0].context || '');
        } else {
          setCurrentSessionId(null);
          setMessages([]);
          setContextValue('');
        }
      }
      // Persist immediately: the save effect is gated on sessions.length > 0,
      // so deleting the last session would otherwise leave it in localStorage.
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      return filtered;
    });
  };

  const patchCurrentSession = (patch: Partial<ChatSession>, newMessages?: ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== currentSessionId) return session;
        const title =
          newMessages && newMessages.length > 0 && session.title === 'New Chat'
            ? generateTitle(newMessages[0].content)
            : session.title;
        return {
          ...session,
          ...patch,
          title,
          ...(newMessages ? { messages: newMessages } : {}),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    if (!currentSessionId) {
      createNewSession();
      return;
    }

    const question = inputValue.trim();
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    patchCurrentSession({ context: contextValue }, newMessages);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const messageWithContext = contextValue
        ? `Context: ${contextValue}\n\nQuestion: ${question}`
        : question;

      const currentSession = sessions.find((s) => s.id === currentSessionId);
      const response = await sendChatMessage(
        config.projectId,
        messageWithContext,
        config.token,
        currentSession?.backendSessionId || null
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      patchCurrentSession(
        { context: contextValue, backendSessionId: response.sessionId },
        finalMessages
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get a response. Please try again.');
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'I encountered an error handling that request. Please try again.',
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      patchCurrentSession({}, finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSource = (index: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const saveContext = () => {
    patchCurrentSession({ context: contextValue });
    setEditingContext(false);
  };

  const cancelEditContext = () => {
    const session = sessions.find((s) => s.id === currentSessionId);
    setContextValue(session?.context || '');
    setEditingContext(false);
  };

  const clearContext = () => {
    setContextValue('');
    patchCurrentSession({ context: '' });
    setShowContext(false);
  };

  const contextVisible =
    currentSessionId && (showContext || editingContext || (!contextValue && messages.length === 0));

  return (
    <div className="flex h-full min-h-0 gap-4">
      <SessionRail
        sessions={sessions}
        currentSessionId={currentSessionId}
        open={railOpen}
        onClose={() => setRailOpen(false)}
        onCreate={createNewSession}
        onSwitch={switchSession}
        onDelete={deleteSession}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRailOpen(true)}
            className="md:hidden"
          >
            <History className="h-4 w-4" />
            History
            {sessions.length > 0 && <span className="tabular-nums">({sessions.length})</span>}
          </Button>

          {currentSessionId && !contextVisible && (
            <Button variant="outline" size="sm" onClick={() => setShowContext(true)}>
              Custom context
            </Button>
          )}

          {currentSessionId && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteSession(currentSessionId)}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete chat</span>
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="neo flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-canvas shadow-neo-2">
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-measure p-4">
              {contextVisible && (
                <CustomContext
                  value={contextValue}
                  onChange={setContextValue}
                  editing={editingContext}
                  onEdit={() => setEditingContext(true)}
                  onSave={saveContext}
                  onCancel={cancelEditContext}
                  onClear={clearContext}
                />
              )}

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <span className="neo grid h-14 w-14 place-items-center rounded-chip bg-accent text-accent-ink">
                    <MessageSquare className="h-6 w-6" />
                  </span>
                  <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink">
                    {currentSessionId ? 'Start a conversation' : 'Create a chat to get started'}
                  </h2>
                  <p className="max-w-[44ch] text-sm text-ink-muted">
                    Ask about features, decisions, or project history. Answers cite the context
                    BuildBerry has captured.
                  </p>
                  {!currentSessionId && (
                    <Button onClick={createNewSession} className="mt-1">
                      New chat
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-5 pb-2">
                {messages.map((message, index) => (
                  <div key={index} className="animate-slide-down-fade">
                    <MessageBubble message={message} />
                    {message.sources && message.sources.length > 0 && (
                      <div className="pl-12">
                        <SourcePanel
                          sources={message.sources}
                          expanded={expandedSources.has(index)}
                          onToggle={() => toggleSource(index)}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <span className="neo grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-accent text-accent-ink">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="neo flex items-center gap-3 rounded-card bg-surface p-4 shadow-neo-1">
                      <LoadingSpinner className="h-4 w-4" />
                      <span className="neo-label-sm">Thinking</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>

          <ChatComposer
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={!currentSessionId}
            loading={isLoading}
            placeholder={currentSessionId ? 'Ask a question…' : 'Create a new chat first…'}
          />
        </div>
      </div>
    </div>
  );
}
