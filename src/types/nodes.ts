import { NotebookNodeData } from './nodes';

export interface UrlNodeData {
  url?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  content?: string;
  lastFetched?: number;
}

export interface ChatNodeData {
  messages: Array<{
    role: string;
    content: string;
    id?: string;
  }>;
  settings: {
    provider: 'cohere' | 'deepseek' | 'ollama';
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    systemPrompt: string;
    environmentPrompt: string;
  };
  autoTakeNotes?: boolean;
  contextNotes?: string[];
}

export interface NotesNodeData {
  notes?: Array<{
    id: string;
    content: string;
    inContext?: boolean;
    source?: string;
  }>;
}

export interface NotebookNodeData {
  cells?: Array<{
    id: string;
    type: 'markdown' | 'code';
    content: string;
    output?: string;
    state: 'idle' | 'running' | 'error' | 'success';
    isCollapsed?: boolean;
    error?: string;
  }>;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}
