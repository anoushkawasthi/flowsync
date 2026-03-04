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
import { MessageSquare, Send, Loader2, ChevronDown, Trash2 } from 'lucide-react';
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

export default function ChatPage() {
  const { config } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session from localStorage
  useEffect(() => {
    const storedSession = localStorage.getItem(`chat-session-${config.projectId}`);
    if (storedSession) {
      try {
        const { sessionId: storedSessionId, messages: storedMessages } = JSON.parse(storedSession);
        setSessionId(storedSessionId);
        setMessages(storedMessages || []);
      } catch (e) {
        console.error('Error loading chat session:', e);
      }
    }
  }, [config.projectId]);

  // Save session to localStorage
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(
        `chat-session-${config.projectId}`,
        JSON.stringify({ sessionId, messages })
      );
    }
  }, [sessionId, messages, config.projectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(
        config.projectId,
        inputValue.trim(),
        config.token,
        sessionId
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSessionId(response.sessionId);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get response. Please try again.');
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  const clearConversation = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(`chat-session-${config.projectId}`);
    setError(null);
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
    <div className="mx-auto max-w-4xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30">
            <MessageSquare className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">FlowSync AI Chat</h1>
            <p className="text-sm text-zinc-500">Ask questions about your project</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearConversation}
            className="text-zinc-400 hover:text-zinc-100 border-zinc-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
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
              <p className="text-lg font-medium mb-2 text-zinc-400">Start a conversation</p>
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
              placeholder="Ask a question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              className="flex-1 bg-zinc-800 border-zinc-700 focus-visible:ring-teal-500"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
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
  );
}
