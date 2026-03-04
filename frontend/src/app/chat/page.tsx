'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { sendChatMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Send, Loader2, ChevronDown, Trash2, Plus, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Source[];
}

interface Source {
  eventId: string;
  contextId: string;
  branch: string;
  timestamp: string;
  feature: string;
  stage: string;
  relevance: number;
  snippet: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export default function ChatPage() {
  const { config } = useAppContext();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all sessions from localStorage
  useEffect(() => {
    const storedSessions = localStorage.getItem(`chat-sessions-${config.projectId}`);
    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions) as ChatSession[];
        setSessions(parsed);
        
        // Load the most recent session
        if (parsed.length > 0) {
          const latest = parsed[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages);
        }
      } catch (e) {
        console.error('Error loading chat sessions:', e);
      }
    }
  }, [config.projectId]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(
        `chat-sessions-${config.projectId}`,
        JSON.stringify(sessions)
      );
    }
  }, [sessions, config.projectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setError(null);
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setError(null);
    }
  };

  const deleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (sessionId === currentSessionId) {
        if (filtered.length > 0) {
          setCurrentSessionId(filtered[0].id);
          setMessages(filtered[0].messages);
        } else {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
      return filtered;
    });
  };

  const updateCurrentSession = (newMessages: Message[]) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          // Auto-generate title from first user message
          const title =
            newMessages.length > 0 && session.title === 'New Chat'
              ? newMessages[0].content.slice(0, 50) + (newMessages[0].content.length > 50 ? '...' : '')
              : session.title;
          
          return {
            ...session,
            title,
            messages: newMessages,
            updatedAt: new Date().toISOString(),
          };
        }
        return session;
      })
    );
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Create a session if none exists
    if (!currentSessionId) {
      createNewSession();
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    updateCurrentSession(newMessages);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(
        config.projectId,
        inputValue.trim(),
        config.token,
        currentSessionId
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get response. Please try again.');
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    <div className="h-full flex gap-4">
      {/* Session History Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden`}>
        <Card className="h-full border-zinc-800 bg-zinc-900/50 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <Button
              onClick={createNewSession}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8 px-4">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No chat history yet</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative rounded-lg p-3 cursor-pointer transition-colors ${
                      session.id === currentSessionId
                        ? 'bg-teal-500/10 border border-teal-500/30'
                        : 'hover:bg-zinc-800 border border-transparent'
                    }`}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-zinc-400 hover:text-zinc-100 border-zinc-700"
            >
              <History className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30">
              <MessageSquare className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">FlowSync AI Chat</h1>
              <p className="text-sm text-zinc-500">Ask questions about your project</p>
            </div>
          </div>
          {currentSessionId && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteSession(currentSessionId)}
              className="text-zinc-400 hover:text-zinc-100 border-zinc-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Chat Container */}
        <Card className="flex-1 flex flex-col border-zinc-800 bg-zinc-900/50 overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10 border border-teal-500/30 mb-4">
                  <MessageSquare className="h-8 w-8 text-teal-500" />
                </div>
                <p className="text-lg font-medium mb-2 text-zinc-400">
                  {currentSessionId ? 'Start a conversation' : 'Create a new chat to get started'}
                </p>
                <p className="text-sm max-w-md">
                  I can explain features, suggest code, break down tasks, and answer questions about your project history.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={index}>
                  <div
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-teal-500 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      <p className="mt-2 text-xs opacity-60">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 ml-4 space-y-2">
                      <button
                        onClick={() => toggleSource(index)}
                        className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            expandedSources.has(index) ? 'rotate-180' : ''
                          }`}
                        />
                        {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                      </button>
                      {expandedSources.has(index) && (
                        <div className="space-y-2 pl-6">
                          {message.sources.map((source, sIdx) => (
                            <Card
                              key={sIdx}
                              className="border-zinc-700 bg-zinc-800/50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs border-teal-500/30 text-teal-400"
                                >
                                  {source.stage}
                                </Badge>
                                <span className="text-xs text-zinc-500">
                                  {Math.round(source.relevance * 100)}% match
                                </span>
                              </div>
                              <p className="text-sm font-medium text-zinc-300 mb-1">
                                {source.feature}
                              </p>
                              <p className="text-xs text-zinc-500 line-clamp-2">
                                {source.snippet}
                              </p>
                              <p className="text-xs text-zinc-600 mt-2">
                                {source.branch}
                              </p>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-zinc-800 p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={currentSessionId ? "Ask a question..." : "Create a new chat first..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading || !currentSessionId}
                className="flex-1 bg-zinc-800 border-zinc-700 focus-visible:ring-teal-500"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !currentSessionId}
                className="shrink-0 bg-teal-500 hover:bg-teal-600 text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
