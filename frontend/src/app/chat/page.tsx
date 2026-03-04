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
import { MessageSquare, Send, Loader2, ChevronDown, Trash2, Plus, History, FileText, Edit2, Check, X, User, Bot } from 'lucide-react';
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
  context?: string;
  backendSessionId?: string;
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
  const [showSidebar, setShowSidebar] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [contextValue, setContextValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate a smart title from user message
  const generateTitle = (message: string): string => {
    // Remove extra whitespace and newlines
    let title = message.replace(/\s+/g, ' ').trim();
    
    // Common question words/phrases to extract key topics
    const questionPrefixes = [
      'what is', 'what are', 'how do', 'how to', 'can you', 'could you',
      'tell me', 'explain', 'describe', 'show me', 'help me', 'why is',
      'when should', 'where is', 'who is'
    ];
    
    // Try to extract the core question/topic
    const lowerTitle = title.toLowerCase();
    for (const prefix of questionPrefixes) {
      if (lowerTitle.startsWith(prefix)) {
        title = title.substring(prefix.length).trim();
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);
        break;
      }
    }
    
    // Remove trailing punctuation for ellipsis
    title = title.replace(/[?.!]+$/, '');
    
    // Truncate smartly - try to end at a word boundary
    const maxLength = 40;
    if (title.length > maxLength) {
      // Find last space before maxLength
      const truncated = title.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.6) {
        title = truncated.substring(0, lastSpace) + '...';
      } else {
        title = truncated + '...';
      }
    }
    
    // Ensure first letter is capitalized
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    return title;
  };

  // Set initial sidebar state based on screen size
  useEffect(() => {
    setShowSidebar(window.innerWidth >= 768);
    
    // Handle window resize
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load all sessions from localStorage
  useEffect(() => {
    const storedSessions = localStorage.getItem(`chat-sessions-${config.projectId}`);
    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions) as ChatSession[];
        
        // Migrate old session titles to new format
        let needsUpdate = false;
        const migrated = parsed.map(session => {
          // If session has messages and title looks like it needs updating
          if (session.messages.length > 0 && session.title !== 'New Chat') {
            // Check if title needs cleaning (has quotes, too long, etc.)
            const firstUserMessage = session.messages.find(m => m.role === 'user')?.content;
            if (firstUserMessage) {
              const potentialNewTitle = generateTitle(firstUserMessage);
              // Only update if it would be different (avoid unnecessary updates)
              if (potentialNewTitle !== session.title) {
                needsUpdate = true;
                return { ...session, title: potentialNewTitle };
              }
            }
          }
          return session;
        });
        
        setSessions(migrated);
        
        // Save migrated data back to localStorage
        if (needsUpdate) {
          localStorage.setItem(
            `chat-sessions-${config.projectId}`,
            JSON.stringify(migrated)
          );
        }
        
        // Load the most recent session
        if (migrated.length > 0) {
          const latest = migrated[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages);
          setContextValue(latest.context || '');
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

  // Auto-scroll to bottom smoothly when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isLoading]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (showSidebar && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSidebar]);

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
    // Close sidebar on mobile after creating a new session
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setContextValue(session.context || '');
      setEditingContext(false);
      setError(null);
      // Close sidebar on mobile after selecting a session
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
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
              ? generateTitle(newMessages[0].content)
              : session.title;
          
          return {
            ...session,
            title,
            messages: newMessages,
            context: contextValue,
            // Preserve backendSessionId
            backendSessionId: session.backendSessionId,
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
      // Prepend context to message if context exists
      const messageWithContext = contextValue 
        ? `Context: ${contextValue}\n\nQuestion: ${inputValue.trim()}`
        : inputValue.trim();

      // Get the backend session ID for the current session
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      const backendSessionId = currentSession?.backendSessionId || null;

      const response = await sendChatMessage(
        config.projectId,
        messageWithContext,
        config.token,
        backendSessionId
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Update session with backend session ID
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            const title =
              finalMessages.length > 0 && session.title === 'New Chat'
                ? generateTitle(finalMessages[0].content)
                : session.title;
            
            return {
              ...session,
              title,
              messages: finalMessages,
              context: contextValue,
              backendSessionId: response.sessionId,
              updatedAt: new Date().toISOString(),
            };
          }
          return session;
        })
      );
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
      
      // Update session even on error
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: finalMessages,
              updatedAt: new Date().toISOString(),
            };
          }
          return session;
        })
      );
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

  const saveContext = () => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            context: contextValue,
            updatedAt: new Date().toISOString(),
          };
        }
        return session;
      })
    );
    setEditingContext(false);
  };

  const cancelEditContext = () => {
    const session = sessions.find((s) => s.id === currentSessionId);
    if (session) {
      setContextValue(session.context || '');
    }
    setEditingContext(false);
  };

  return (
    <div className="h-full flex gap-4 relative">
      {/* Backdrop for mobile sidebar */}
      {showSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in-0 duration-200"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      {/* Session History Sidebar */}
      <div className={`${
        showSidebar 
          ? 'translate-x-0 w-72 md:w-64' 
          : '-translate-x-full md:-translate-x-0 w-72 md:w-0'
      } fixed md:relative top-0 left-0 h-full z-50 md:z-0 transition-all duration-300 ease-in-out overflow-hidden`}>
        <Card className="h-full border-zinc-800 bg-zinc-900/95 md:bg-zinc-900/50 backdrop-blur-md md:backdrop-blur-none flex flex-col shadow-2xl md:shadow-none">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3 md:mb-0 md:hidden">
              <h2 className="text-lg font-semibold text-zinc-100">Chat History</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
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
                    className={`group relative rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                      session.id === currentSessionId
                        ? 'bg-teal-500/10 border border-teal-500/30 shadow-sm'
                        : 'hover:bg-zinc-800 border border-transparent hover:border-zinc-700/50'
                    }`}
                    onClick={() => switchSession(session.id)}
                    title={session.title}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate leading-snug">
                          {session.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-xs text-zinc-500">
                            {session.messages.length} {session.messages.length === 1 ? 'message' : 'messages'}
                          </p>
                          <span className="text-zinc-700">•</span>
                          <p className="text-xs text-zinc-600">
                            {new Date(session.updatedAt).toLocaleDateString(undefined, { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 md:mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-zinc-400 hover:text-zinc-100 border-zinc-700 relative"
            >
              <History className="h-4 w-4" />
              <span className="hidden lg:inline ml-2">History</span>
              {sessions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center lg:static lg:ml-2 lg:w-5 lg:h-5">
                  {sessions.length}
                </span>
              )}
            </Button>
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30">
              <MessageSquare className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-100">FlowSync AI Chat</h1>
              <p className="text-xs sm:text-sm text-zinc-500 hidden sm:block">Ask questions about your project</p>
            </div>
          </div>
          {currentSessionId && messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteSession(currentSessionId)}
              className="text-zinc-400 hover:text-zinc-100 border-zinc-700"
            >
              <Trash2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Delete</span>
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
            {/* Context Memory Card */}
            {currentSessionId && (
              <div className="mb-4">
                {!editingContext && !showContext && contextValue && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowContext(true)}
                    className="text-teal-400 border-teal-500/30 hover:bg-teal-500/10 mb-2"
                  >
                    <FileText className="h-3 w-3 mr-2" />
                    Show Context
                  </Button>
                )}
                
                {currentSessionId && (showContext || editingContext || (!contextValue && messages.length === 0)) && (
                  <Card className="border-teal-500/30 bg-teal-500/5 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-teal-400" />
                        <h3 className="text-sm font-semibold text-teal-400">Custom Context</h3>
                      </div>
                      <div className="flex gap-1">
                        {!editingContext ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContext(true)}
                              className="h-7 px-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            {contextValue && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowContext(false);
                                  setContextValue('');
                                  saveContext();
                                }}
                                className="h-7 px-2 text-zinc-400 hover:text-zinc-300"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={saveContext}
                              className="h-7 px-2 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditContext}
                              className="h-7 px-2 text-zinc-400 hover:text-zinc-300"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingContext ? (
                      <textarea
                        value={contextValue}
                        onChange={(e) => setContextValue(e.target.value)}
                        placeholder="Add custom context, instructions, or project details..."
                        className="w-full min-h-[80px] p-2 text-sm bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    ) : contextValue ? (
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{contextValue}</p>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">
                        Add custom context to help the AI understand your project better
                      </p>
                    )}
                  </Card>
                )}
              </div>
            )}

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

            <div className="space-y-6 pb-4">
              {messages.map((message, index) => (
                <div key={index} className="animate-in fade-in-50 duration-200">
                  <div
                    className={`flex gap-2 md:gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Avatar for assistant */}
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] md:max-w-[80%] lg:max-w-[75%] rounded-2xl overflow-hidden shadow-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white'
                          : 'bg-zinc-800/90 backdrop-blur-sm text-zinc-100 border border-zinc-700/50'
                      }`}
                    >
                      <div className="p-3 md:p-4">
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-700/50">
                            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wide">AI Assistant</span>
                          </div>
                        )}
                        <div className={`prose prose-invert prose-sm max-w-none ${
                          message.role === 'user' ? 'prose-headings:text-white prose-p:text-white prose-strong:text-white' : ''
                        }`}>
                          <ReactMarkdown
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="my-4 rounded-lg overflow-hidden border border-zinc-700 shadow-md">
                                    <div className="bg-zinc-900 px-3 py-1.5 border-b border-zinc-700 flex items-center justify-between">
                                      <span className="text-xs text-zinc-400 font-mono uppercase tracking-wide">{match[1]}</span>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{ margin: 0, background: 'transparent', padding: '12px' }}
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className={`${className} px-1.5 py-0.5 rounded text-xs font-mono ${
                                    message.role === 'user' ? 'bg-teal-600/80' : 'bg-zinc-700/80'
                                  }`} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              p({ children }) {
                                return <p className="mb-3 last:mb-0 leading-relaxed text-[0.9rem]">{children}</p>;
                              },
                              ul({ children }) {
                                return <ul className="space-y-2 my-3 pl-1">{children}</ul>;
                              },
                              ol({ children }) {
                                return <ol className="space-y-2 my-3 pl-1">{children}</ol>;
                              },
                              li({ children, ...props }) {
                                return (
                                  <li className="flex items-start gap-2 text-[0.9rem]" {...props}>
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-teal-500 mt-2"></span>
                                    <span className="flex-1">{children}</span>
                                  </li>
                                );
                              },
                              h1({ children }) {
                                return (
                                  <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-zinc-700/50 text-teal-400 first:mt-0">
                                    {children}
                                  </h1>
                                );
                              },
                              h2({ children }) {
                                return (
                                  <h2 className="text-lg font-bold mt-5 mb-2.5 text-teal-400 flex items-center gap-2">
                                    <span className="w-1 h-5 bg-teal-500 rounded-full"></span>
                                    {children}
                                  </h2>
                                );
                              },
                              h3({ children }) {
                                return <h3 className="text-base font-semibold mt-4 mb-2 text-zinc-200">{children}</h3>;
                              },
                              h4({ children }) {
                                return <h4 className="text-sm font-semibold mt-3 mb-1.5 text-zinc-300">{children}</h4>;
                              },
                              blockquote({ children }) {
                                return (
                                  <blockquote className="border-l-3 border-teal-500 pl-4 py-2 my-3 bg-teal-500/5 rounded-r italic text-zinc-300">
                                    {children}
                                  </blockquote>
                                );
                              },
                              hr() {
                                return <hr className="my-4 border-zinc-700/50" />;
                              },
                              strong({ children }) {
                                return <strong className="font-semibold text-zinc-100">{children}</strong>;
                              },
                              em({ children }) {
                                return <em className="italic text-zinc-300">{children}</em>;
                              },
                              a({ children, href }) {
                                return (
                                  <a 
                                    href={href} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-teal-400 hover:text-teal-300 underline decoration-teal-500/30 hover:decoration-teal-500/60 transition-colors"
                                  >
                                    {children}
                                  </a>
                                );
                              },
                              table({ children }) {
                                return (
                                  <div className="my-4 overflow-x-auto">
                                    <table className="min-w-full border border-zinc-700 rounded-lg overflow-hidden">
                                      {children}
                                    </table>
                                  </div>
                                );
                              },
                              thead({ children }) {
                                return <thead className="bg-zinc-800 border-b border-zinc-700">{children}</thead>;
                              },
                              th({ children }) {
                                return <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-300">{children}</th>;
                              },
                              td({ children }) {
                                return <td className="px-3 py-2 text-sm text-zinc-400 border-t border-zinc-800">{children}</td>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-opacity-20 border-white">
                          <p className="text-xs opacity-60 font-medium">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {message.role === 'assistant' && (
                            <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-400 bg-teal-500/5">
                              AI
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Avatar for user */}
                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 ml-8 md:ml-11 mr-8 md:mr-0 space-y-2">
                      <button
                        onClick={() => toggleSource(index)}
                        className="flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            expandedSources.has(index) ? 'rotate-180' : ''
                          }`}
                        />
                        <span className="text-xs sm:text-sm">
                          {message.sources.length} source{message.sources.length > 1 ? 's' : ''} referenced
                        </span>
                      </button>
                      {expandedSources.has(index) && (
                        <div className="space-y-2 pl-2 sm:pl-6 animate-in slide-in-from-top-2 duration-200">
                          {message.sources.map((source, sIdx) => (
                            <Card
                              key={sIdx}
                              className="border-zinc-700/50 bg-gradient-to-br from-zinc-800/80 to-zinc-800/40 backdrop-blur-sm p-3 hover:border-teal-500/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex gap-1.5 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-teal-500/30 text-teal-400 bg-teal-500/5"
                                  >
                                    {source.stage}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-zinc-600 text-zinc-400"
                                  >
                                    {source.branch}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></div>
                                  <span className="text-xs text-teal-400 font-semibold">
                                    {Math.round(source.relevance * 100)}% match
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm font-medium text-zinc-200 mb-2">
                                {source.feature}
                              </p>
                              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 bg-zinc-900/50 p-2 rounded border border-zinc-700/30">
                                {source.snippet}
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
                <div className="flex gap-3 justify-start animate-in fade-in-50 duration-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
                      <span className="text-sm text-zinc-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-zinc-800 p-3 md:p-4 bg-zinc-900/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={currentSessionId ? "Ask a question..." : "Create a new chat first..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading || !currentSessionId}
                className="flex-1 bg-zinc-800 border-zinc-700 focus-visible:ring-teal-500 h-10 md:h-11 text-sm md:text-base"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading || !currentSessionId}
                className="shrink-0 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white h-10 md:h-11 px-3 md:px-4 shadow-lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2 hidden sm:block">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
