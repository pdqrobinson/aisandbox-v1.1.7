export interface SandboxState {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  agents: Agent[];
  objects: SandboxObject[];
  rules: Rule[];
  messages: Message[];
}

export interface Agent {
  id: string;
  name: string;
  type: 'ai' | 'human';
  model?: string;
  capabilities: string[];
  state: AgentState;
  position: Position;
  awareness: Awareness;
  parentNodeId?: string | null;
  isParent?: boolean;
}

export interface AgentState {
  status: 'idle' | 'thinking' | 'acting' | 'communicating';
  currentTask?: string;
  memory: Memory[];
}

export interface Memory {
  id: string;
  timestamp: Date;
  type: 'observation' | 'action' | 'communication' | 'thought';
  content: string;
  metadata?: Record<string, any>;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Awareness {
  visibleObjects: string[]; // IDs of objects the agent can see
  audibleMessages: string[]; // IDs of messages the agent can hear
  currentContext: string;
  selfAwareness: {
    knowsItIsAI: boolean;
    understandsSandbox: boolean;
    capabilities: string[];
  };
}

export interface SandboxObject {
  id: string;
  type: string;
  name: string;
  description: string;
  position: Position;
  properties: Record<string, any>;
  interactions: string[];
}

export interface Rule {
  id: string;
  type: 'physical' | 'social' | 'communication' | 'ai';
  description: string;
  conditions: string[];
  consequences: string[];
}

export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Message extends BaseMessage {
  from: string;
  to: string;
  status: 'sent' | 'delivered' | 'failed';
}

export type SharedMessage = Message;

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  provider: 'Cohere' | 'OpenAI';
}

export interface SandboxConfig {
  maxAgents: number;
  maxObjects: number;
  maxMessages: number;
  timeScale: number;
  physicsEnabled: boolean;
  communicationRules: Rule[];
  aiBehaviorRules: Rule[];
} 