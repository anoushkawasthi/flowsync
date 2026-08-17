export interface ChatSource {
  eventId: string;
  contextId: string;
  branch: string;
  timestamp: string;
  feature: string;
  stage: string;
  relevance: number;
  snippet: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: ChatSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  context?: string;
  backendSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Derives a session title from the first user message: strips a leading
 * question phrase, drops trailing punctuation, and truncates on a word
 * boundary so titles don't cut mid-word in the rail.
 */
export function generateTitle(message: string): string {
  let title = message.replace(/\s+/g, ' ').trim();

  const questionPrefixes = [
    'what is',
    'what are',
    'how do',
    'how to',
    'can you',
    'could you',
    'tell me',
    'explain',
    'describe',
    'show me',
    'help me',
    'why is',
    'when should',
    'where is',
    'who is',
  ];

  const lowerTitle = title.toLowerCase();
  for (const prefix of questionPrefixes) {
    if (lowerTitle.startsWith(prefix)) {
      title = title.substring(prefix.length).trim();
      break;
    }
  }

  title = title.replace(/[?.!]+$/, '');

  const maxLength = 40;
  if (title.length > maxLength) {
    const truncated = title.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    title =
      lastSpace > maxLength * 0.6
        ? `${truncated.substring(0, lastSpace)}…`
        : `${truncated}…`;
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}
