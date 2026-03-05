export interface ContextRecord {
  eventId: string;
  projectId: string;
  branch: string;
  feature: string;
  decision: string | null;
  tasks: string[];
  stage:
    | 'Setup'
    | 'Feature Development'
    | 'Refactoring'
    | 'Bug Fix'
    | 'Testing'
    | 'Documentation';
  risk: string | null;
  confidence: number; // 0.0 to 1.0 decimal (backend format), display as percentage
  entities: string[];
  author: string;
  commitHash: string;
  extractedAt: string;
  mergedFrom?: string; // source branch if this record was propagated on merge
  agentReasoning?: {
    reasoning: string;
    decision: string;
    tasks: string[];
    risk: string;
  };
}

export interface EventsResponse {
  events: ContextRecord[];
  count: number;
  lastTimestamp: string | null;
}

export interface SearchSource {
  commitHash: string;
  feature: string;
  extractedAt: string;
  relevanceScore: number;
}

export interface SearchResult {
  answer: string;
  answerGrounded: boolean;
  sources: SearchSource[];
}

export interface ProjectConfig {
  projectId: string;
  token: string;
}
